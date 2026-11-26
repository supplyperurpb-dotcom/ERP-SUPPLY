"use client";

import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Familia, Subfamilia } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLASIFICACIONES_AGROQUIMICO, UNIDADES_MEDIDA_AGROQUIMICO } from "@/lib/constants/sku";
import { skuAgroquimicoSchema, type SkuAgroquimicoInput } from "@/lib/validations/sku";
import { crearSkuAgroquimicoAction } from "@/lib/actions/sku-actions";

type FamiliaConSubfamilias = Familia & { subfamilias: Subfamilia[] };

export function AgroquimicoForm({ familias }: { familias: FamiliaConSubfamilias[] }) {
  const router = useRouter();

  const form = useForm<SkuAgroquimicoInput>({
    resolver: zodResolver(skuAgroquimicoSchema),
    defaultValues: {
      familiaId: familias[0]?.id ?? "",
      subfamiliaId: familias[0]?.subfamilias[0]?.id ?? "",
      producto: "",
      activo: "",
      clasificacion: CLASIFICACIONES_AGROQUIMICO[0],
      unidadMedida: "LT",
      requiereLote: true,
    },
  });

  const campos = form.watch();
  const familiaElegida = familias.find((f) => f.id === campos.familiaId);
  const subfamiliaElegida = familiaElegida?.subfamilias.find((s) => s.id === campos.subfamiliaId);
  const prefijo = useMemo(
    () => `${familiaElegida?.prefijo ?? ""}${subfamiliaElegida?.prefijo ?? ""}`,
    [familiaElegida, subfamiliaElegida]
  );
  const descripcionPreview = useMemo(() => campos.producto?.trim() ?? "", [campos.producto]);

  // Si cambia la familia, la subfamilia elegida puede no pertenecerle:
  // se cambia a la primera de la nueva familia.
  useEffect(() => {
    if (familiaElegida && !subfamiliaElegida) {
      form.setValue("subfamiliaId", familiaElegida.subfamilias[0]?.id ?? "");
    }
  }, [familiaElegida, subfamiliaElegida, form]);

  async function onSubmit(data: SkuAgroquimicoInput) {
    let resultado;
    try {
      resultado = await crearSkuAgroquimicoAction(data);
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
          <CardTitle className="text-base">Agroquímicos, Fertilizantes y Ósmosis</CardTitle>
          <p className="text-sm text-muted-foreground">
            El código se arma solo: <strong>{prefijo}</strong> + el siguiente correlativo (4 dígitos) de ese tipo y
            subfamilia. Para crear la versión no valorada (NV), usa el botón &quot;Crear Código No Valorado&quot; en
            la lista de SKU. ¿Falta un tipo o subfamilia? Agrégalo en Logística &gt; Listas &gt; Categorías.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Controller
              control={form.control}
              name="familiaId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {familias.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Subfamilia</Label>
            <Controller
              control={form.control}
              name="subfamiliaId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(familiaElegida?.subfamilias ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">Define las 2 letras del código (p. ej. Foliar → FO).</p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="producto">Producto</Label>
            <Input id="producto" {...form.register("producto")} />
            {form.formState.errors.producto && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.producto.message}</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="activo">Activo / composición (opcional)</Label>
            <Textarea id="activo" rows={2} {...form.register("activo")} />
          </div>

          <div className="space-y-2">
            <Label>Clasificación</Label>
            <Controller
              control={form.control}
              name="clasificacion"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASIFICACIONES_AGROQUIMICO.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
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
                    {UNIDADES_MEDIDA_AGROQUIMICO.map((u) => (
                      <SelectItem key={u.codigo} value={u.codigo}>
                        {u.codigo} — {u.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stockMinimo">Stock mínimo (opcional)</Label>
            <Controller
              control={form.control}
              name="stockMinimo"
              render={({ field }) => (
                <NumberInput id="stockMinimo" value={String(field.value ?? "")} onChange={field.onChange} />
              )}
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="requiereLote"
              type="checkbox"
              className="h-4 w-4"
              {...form.register("requiereLote")}
            />
            <Label htmlFor="requiereLote" className="font-normal">
              Registrar Lote, Fecha de Producción y Fecha de Vencimiento
            </Label>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">
            Si se marca, todo ingreso a almacén de este SKU exigirá esos 3 datos, sin importar el almacén.
          </p>

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
        <Button type="submit" disabled={form.formState.isSubmitting || familias.length === 0}>
          {form.formState.isSubmitting ? "Creando..." : "Crear código"}
        </Button>
      </div>
    </form>
  );
}
