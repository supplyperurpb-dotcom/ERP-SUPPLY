"use client";

import { useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUBFAMILIAS_SUMINISTROS, dosLetras } from "@/lib/constants/sku";
import { UNIDADES_MEDIDA } from "@/lib/validations/sku";
import { skuSuministroSchema, type SkuSuministroInput } from "@/lib/validations/sku";
import { crearSkuSuministroAction } from "@/lib/actions/sku-actions";

export function SuministroForm() {
  const router = useRouter();

  const form = useForm<SkuSuministroInput>({
    resolver: zodResolver(skuSuministroSchema),
    defaultValues: {
      subfamilia: SUBFAMILIAS_SUMINISTROS[0],
      producto: "",
      material: "",
      marca: "",
      medida: "",
      destinoDescripcion: "",
      codigoParte: "",
      color: "",
      presentacion: "",
      unidadMedida: "UND",
    },
  });

  const campos = form.watch();
  const prefijo = useMemo(() => `SU${dosLetras(campos.subfamilia ?? "")}`, [campos.subfamilia]);
  const descripcionPreview = useMemo(
    () =>
      [campos.producto, campos.material, campos.marca, campos.medida, campos.destinoDescripcion, campos.codigoParte, campos.color, campos.presentacion]
        .map((v) => v?.trim())
        .filter(Boolean)
        .join(" "),
    [campos]
  );

  async function onSubmit(data: SkuSuministroInput) {
    let resultado;
    try {
      resultado = await crearSkuSuministroAction(data);
    } catch (err) {
      console.error("Error al crear el SKU:", err);
      const detalle = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo crear: ${detalle}`);
      return;
    }
    if (resultado?.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(`SKU ${resultado?.codigo} creado`);
    router.push("/logistica/sku");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suministros</CardTitle>
          <p className="text-sm text-muted-foreground">
            El código se arma solo: <strong>{prefijo}</strong> + el siguiente correlativo de esa subfamilia.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Subfamilia</Label>
            <Controller
              control={form.control}
              name="subfamilia"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBFAMILIAS_SUMINISTROS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Unidad de medida</Label>
            <Controller
              control={form.control}
              name="unidadMedida"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES_MEDIDA.map((u) => (
                      <SelectItem key={u.codigo} value={u.codigo}>
                        {u.codigo} — {u.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="producto">Producto</Label>
            <Input id="producto" {...form.register("producto")} />
            {form.formState.errors.producto && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.producto.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="material">Material (opcional)</Label>
            <Input id="material" {...form.register("material")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="marca">Marca (opcional)</Label>
            <Input id="marca" {...form.register("marca")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="medida">Medida (opcional)</Label>
            <Input id="medida" {...form.register("medida")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="destinoDescripcion">Destino / descripción adicional (opcional)</Label>
            <Input id="destinoDescripcion" {...form.register("destinoDescripcion")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="codigoParte">Código de parte (opcional)</Label>
            <Input id="codigoParte" {...form.register("codigoParte")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">Color (opcional)</Label>
            <Input id="color" {...form.register("color")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="presentacion">Presentación (opcional)</Label>
            <Input id="presentacion" {...form.register("presentacion")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stockMinimo">Stock mínimo (opcional)</Label>
            <Input id="stockMinimo" type="number" min={0} step="0.001" {...form.register("stockMinimo")} />
          </div>

          <div className="space-y-2 sm:col-span-2 rounded-md border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Vista previa del nombre del artículo</p>
            <p className="font-medium">{descripcionPreview || "—"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creando..." : "Crear SKU"}
        </Button>
      </div>
    </form>
  );
}
