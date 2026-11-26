"use client";

import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSearch } from "@/components/ui/data-table";
import { skuServicioSchema, type SkuServicioInput } from "@/lib/validations/sku";
import { crearSkuServicioAction } from "@/lib/actions/sku-actions";
import type { Subfamilia } from "@prisma/client";

type SkuExistente = { codigo: string; descripcion: string };

export function ServicioForm({
  skusExistentes,
  subfamilias,
}: {
  skusExistentes: SkuExistente[];
  subfamilias: Subfamilia[];
}) {
  const router = useRouter();
  const [lista, setLista] = useState(skusExistentes);
  const [creado, setCreado] = useState<SkuExistente | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const listaFiltrada = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return lista;
    return lista.filter(
      (s) => s.codigo.toLowerCase().includes(termino) || s.descripcion.toLowerCase().includes(termino)
    );
  }, [lista, busqueda]);

  const form = useForm<SkuServicioInput>({
    resolver: zodResolver(skuServicioSchema),
    defaultValues: {
      subfamiliaId: subfamilias[0]?.id ?? "",
      unidadMedida: "UND",
    },
  });

  async function onSubmit(data: SkuServicioInput) {
    const subfamiliaElegida = subfamilias.find((s) => s.id === data.subfamiliaId);
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
    const nuevo = { codigo: resultado.codigo, descripcion: subfamiliaElegida?.nombre ?? resultado.codigo };
    toast.success(`SKU ${nuevo.codigo} creado`);
    setCreado(nuevo);
    setLista((prev) => [...prev, nuevo].sort((a, b) => a.descripcion.localeCompare(b.descripcion)));
    form.reset({ subfamiliaId: subfamilias[0]?.id ?? "", unidadMedida: "UND" });
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
          {lista.length === 0 ? (
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listaFiltrada.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                          Ningún servicio coincide con la búsqueda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      listaFiltrada.map((s) => (
                        <TableRow key={s.codigo}>
                          <TableCell className="w-28 font-medium">{s.codigo}</TableCell>
                          <TableCell>{s.descripcion}</TableCell>
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
              solicitud de pedido. ¿Falta una subfamilia? Agrégala en Logística &gt; Listas &gt; Categorías.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="subfamiliaId">Subfamilia</Label>
            <Controller
              control={form.control}
              name="subfamiliaId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="subfamiliaId">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {subfamilias.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.subfamiliaId && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.subfamiliaId.message}</p>
            )}
            <input type="hidden" {...form.register("unidadMedida")} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/logistica/sku")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting || subfamilias.length === 0}>
            {form.formState.isSubmitting ? "Creando..." : "Crear código"}
          </Button>
        </div>
      </form>
    </div>
  );
}
