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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLASIFICACIONES_AGROQUIMICO, SUBFAMILIAS_AGROQUIMICO, TIPOS_AGROQUIMICO, UNIDADES_MEDIDA_AGROQUIMICO } from "@/lib/constants/sku";
import { skuAgroquimicoSchema, type SkuAgroquimicoInput } from "@/lib/validations/sku";
import { crearSkuAgroquimicoAction } from "@/lib/actions/sku-actions";

export function AgroquimicoForm() {
  const router = useRouter();

  const form = useForm<SkuAgroquimicoInput>({
    resolver: zodResolver(skuAgroquimicoSchema),
    defaultValues: {
      tipo: "FERTILIZANTE",
      subfamilia: SUBFAMILIAS_AGROQUIMICO[0],
      producto: "",
      activo: "",
      clasificacion: CLASIFICACIONES_AGROQUIMICO[0],
      noValorado: false,
      unidadMedida: "LTR",
    },
  });

  const campos = form.watch();
  const tipoInfo = TIPOS_AGROQUIMICO.find((t) => t.valor === campos.tipo);
  const prefijo = useMemo(
    () => `${campos.noValorado ? "NV" : ""}${tipoInfo?.prefijo ?? ""}`,
    [campos.noValorado, tipoInfo]
  );
  const descripcionPreview = useMemo(
    () => [campos.producto, campos.activo, campos.clasificacion].map((v) => v?.trim()).filter(Boolean).join(" "),
    [campos]
  );

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
            El código se arma solo: <strong>{prefijo}</strong> + el siguiente correlativo (6 dígitos) de ese tipo.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Controller
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_AGROQUIMICO.map((t) => (
                      <SelectItem key={t.valor} value={t.valor}>
                        {t.nombre}
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
              name="subfamilia"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBFAMILIAS_AGROQUIMICO.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">Por ahora solo &quot;Bioestimulante&quot;; se irán agregando más.</p>
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
            <Input id="stockMinimo" type="number" min={0} step="0.001" {...form.register("stockMinimo")} />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <Controller
              control={form.control}
              name="noValorado"
              render={({ field }) => (
                <input
                  type="checkbox"
                  id="noValorado"
                  className="h-4 w-4"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              )}
            />
            <Label htmlFor="noValorado" className="cursor-pointer">
              No valorado (antepone &quot;NV&quot; al código)
            </Label>
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
