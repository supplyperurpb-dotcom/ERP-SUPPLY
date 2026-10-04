"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { skuServicioSchema, type SkuServicioInput } from "@/lib/validations/sku";
import { crearSkuServicioAction } from "@/lib/actions/sku-actions";

type SkuExistente = { codigo: string; descripcion: string };

export function ServicioForm({ skusExistentes }: { skusExistentes: SkuExistente[] }) {
  const router = useRouter();
  const [lista, setLista] = useState(skusExistentes);
  const [creado, setCreado] = useState<SkuExistente | null>(null);

  const form = useForm<SkuServicioInput>({
    resolver: zodResolver(skuServicioSchema),
    defaultValues: {
      subfamilia: "",
      unidadMedida: "UND",
    },
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
    const nuevo = { codigo: resultado.codigo, descripcion: data.subfamilia };
    toast.success(`SKU ${nuevo.codigo} creado`);
    setCreado(nuevo);
    setLista((prev) => [...prev, nuevo].sort((a, b) => a.descripcion.localeCompare(b.descripcion)));
    form.reset({ subfamilia: "", unidadMedida: "UND" });
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
        <CardContent>
          {lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay ningún SKU de Servicios creado.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Código</TableHead>
                    <TableHead>Nombre</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((s) => (
                    <TableRow key={s.codigo}>
                      <TableCell className="w-28 font-medium">{s.codigo}</TableCell>
                      <TableCell>{s.descripcion}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
            <Label htmlFor="subfamilia">Nombre de la subfamilia</Label>
            <Input id="subfamilia" placeholder="Ej. Fumigación" {...form.register("subfamilia")} />
            {form.formState.errors.subfamilia && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.subfamilia.message}</p>
            )}
            <input type="hidden" {...form.register("unidadMedida")} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/logistica/sku")}>
            Volver a SKU
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Creando..." : "Crear"}
          </Button>
        </div>
      </form>
    </div>
  );
}
