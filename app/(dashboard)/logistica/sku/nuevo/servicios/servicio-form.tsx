"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSearch } from "@/components/ui/data-table";
import { useConfirm } from "@/components/shared/confirm-dialog-provider";
import { skuServicioSchema, type SkuServicioInput } from "@/lib/validations/sku";
import { crearSkuServicioAction, eliminarSkuAction } from "@/lib/actions/sku-actions";
import { SkuFormDialog } from "../../sku-form-dialog";
import type { Sku, Subfamilia } from "@prisma/client";

export function ServicioForm({
  skusExistentes,
  subfamilias,
  esAdmin,
  puedeEditar,
}: {
  skusExistentes: Sku[];
  subfamilias: Subfamilia[];
  esAdmin: boolean;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const confirmar = useConfirm();
  const [creado, setCreado] = useState<{ codigo: string; descripcion: string } | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const listaFiltrada = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return skusExistentes;
    return skusExistentes.filter(
      (s) => s.codigo.toLowerCase().includes(termino) || s.descripcion.toLowerCase().includes(termino)
    );
  }, [skusExistentes, busqueda]);

  const form = useForm<SkuServicioInput>({
    resolver: zodResolver(skuServicioSchema),
    defaultValues: { subfamilia: "", unidadMedida: "UND" },
  });

  async function onSubmit(data: SkuServicioInput) {
    let resultado;
    try {
      resultado = await crearSkuServicioAction(data);
    } catch (err) {
      console.error("Error al crear el SKU:", err);
      const detalle = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo crear: ${detalle}`);
      return;
    }
    if (resultado?.error || !resultado?.codigo) {
      toast.error(resultado?.error ?? "No se pudo crear el SKU");
      return;
    }
    toast.success(`SKU ${resultado.codigo} creado`);
    setCreado({ codigo: resultado.codigo, descripcion: data.subfamilia.trim() });
    form.reset({ subfamilia: "", unidadMedida: "UND" });
    router.refresh();
  }

  async function handleEliminar(id: string, codigo: string) {
    if (!(await confirmar(`¿Eliminar el SKU ${codigo}? Esta acción no se puede deshacer.`))) return;
    startTransition(async () => {
      const resultado = await eliminarSkuAction(id);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("SKU eliminado");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Servicios ya creados</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cada subfamilia de servicio tiene un único SKU que solo agrupa; revisa esta lista antes de crear una nueva
            para no duplicarla.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {skusExistentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay ningún SKU de Servicios creado.</p>
          ) : (
            <>
              <TableSearch
                placeholder="Buscar por código o descripción..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      {(esAdmin || puedeEditar) && <TableHead className="w-24 text-right">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listaFiltrada.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                          Ningún servicio coincide con la búsqueda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      listaFiltrada.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="w-28 font-medium">{s.codigo}</TableCell>
                          <TableCell>{s.descripcion}</TableCell>
                          {(esAdmin || puedeEditar) && (
                            <TableCell className="flex justify-end gap-1">
                              {puedeEditar && <SkuFormDialog sku={s} />}
                              {esAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={isPending}
                                  onClick={() => handleEliminar(s.id, s.codigo)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {creado && (
        <div className="flex items-center gap-2 rounded-md border border-green-600/30 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <p>
            SKU creado: <span className="font-semibold">{creado.codigo}</span> — {creado.descripcion}
          </p>
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nueva subfamilia de servicio</CardTitle>
            <p className="text-sm text-muted-foreground">
              El código se arma solo: <strong>SERV</strong> + el siguiente correlativo. Este SKU solo agrupa pedidos de
              este tipo de servicio; el detalle puntual (qué se necesita exactamente) se describe al registrar la
              solicitud de pedido.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="subfamilia">Subfamilia</Label>
            <Input
              id="subfamilia"
              list="subfamilias-servicio"
              placeholder="Escribe la subfamilia (nueva o ya existente)"
              autoComplete="off"
              {...form.register("subfamilia")}
            />
            <datalist id="subfamilias-servicio">
              {subfamilias.map((s) => (
                <option key={s.id} value={s.nombre} />
              ))}
            </datalist>
            {form.formState.errors.subfamilia && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.subfamilia.message}</p>
            )}
            <input type="hidden" {...form.register("unidadMedida")} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/logistica/sku")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Creando..." : "Crear código"}
          </Button>
        </div>
      </form>
    </div>
  );
}
