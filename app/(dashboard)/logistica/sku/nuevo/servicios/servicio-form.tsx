"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUBFAMILIAS_SERVICIOS } from "@/lib/constants/sku";
import { skuServicioSchema, type SkuServicioInput } from "@/lib/validations/sku";
import { crearSkuServicioAction } from "@/lib/actions/sku-actions";

export function ServicioForm() {
  const router = useRouter();

  const form = useForm<SkuServicioInput>({
    resolver: zodResolver(skuServicioSchema),
    defaultValues: {
      subfamilia: SUBFAMILIAS_SERVICIOS[0],
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
          <CardTitle className="text-base">Servicios</CardTitle>
          <p className="text-sm text-muted-foreground">
            El código se arma solo: <strong>SERV</strong> + el siguiente correlativo (una sola serie para toda la categoría).
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
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
                    {SUBFAMILIAS_SERVICIOS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Este SKU solo agrupa pedidos de este tipo de servicio; el detalle puntual (qué se necesita exactamente) se
            describe al registrar la solicitud de pedido.
          </p>

          <input type="hidden" {...form.register("unidadMedida")} />
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
