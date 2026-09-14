"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PackageX } from "lucide-react";
import { fechaLocalHoy, horaLocalAhora, formatKg } from "@/lib/utils";
import { despachoSchema, type DespachoInput } from "@/lib/validations/despacho";
import { crearDespachoAction } from "@/lib/actions/despacho-actions";

type TarjaDisponible = {
  id: string;
  numero: string;
  palletNumero: string;
  cantidadBandejas: number;
  pesoNetoKg: number;
};

export function DespachoForm({ tarjasDisponibles }: { tarjasDisponibles: TarjaDisponible[] }) {
  const router = useRouter();

  const form = useForm<DespachoInput>({
    resolver: zodResolver(despachoSchema),
    defaultValues: {
      placaCamion: "",
      conductor: "",
      fechaDespacho: fechaLocalHoy() as unknown as Date,
      horaDespacho: horaLocalAhora(),
      numeroGuiaRemision: "",
      tarjaIds: [],
    },
  });

  const tarjaIds = form.watch("tarjaIds");

  function alternar(id: string, marcado: boolean) {
    const actual = form.getValues("tarjaIds");
    form.setValue(
      "tarjaIds",
      marcado ? [...actual, id] : actual.filter((x) => x !== id),
      { shouldValidate: true }
    );
  }

  const seleccionadas = tarjasDisponibles.filter((t) => tarjaIds.includes(t.id));
  const totales = seleccionadas.reduce(
    (acc, t) => ({ bandejas: acc.bandejas + t.cantidadBandejas, neto: acc.neto + t.pesoNetoKg }),
    { bandejas: 0, neto: 0 }
  );

  async function onSubmit(data: DespachoInput) {
    const resultado = await crearDespachoAction(data);
    if (resultado?.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success("Despacho registrado");
    router.push("/acopio/despacho");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del despacho</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="placaCamion">Placa del camión</Label>
            <Input id="placaCamion" placeholder="Ej. ABC-123" {...form.register("placaCamion")} />
            {form.formState.errors.placaCamion && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.placaCamion.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="conductor">Conductor</Label>
            <Input id="conductor" placeholder="Nombre completo" {...form.register("conductor")} />
            {form.formState.errors.conductor && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.conductor.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fechaDespacho">Fecha de despacho</Label>
            <Input id="fechaDespacho" type="date" {...form.register("fechaDespacho")} />
            {form.formState.errors.fechaDespacho && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.fechaDespacho.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="horaDespacho">Hora de despacho</Label>
            <Input id="horaDespacho" type="time" {...form.register("horaDespacho")} />
            {form.formState.errors.horaDespacho && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.horaDespacho.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="numeroGuiaRemision">N.º de guía de remisión (opcional)</Label>
            <Input id="numeroGuiaRemision" placeholder="Ej. EG07 - 00000941" {...form.register("numeroGuiaRemision")} />
            {form.formState.errors.numeroGuiaRemision && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.numeroGuiaRemision.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarjas disponibles para despachar</CardTitle>
          <p className="text-sm text-muted-foreground">
            Solo se muestran pallets con tarja generada que todavía no fueron despachados.
          </p>
        </CardHeader>
        <CardContent>
          {tarjasDisponibles.length === 0 ? (
            <EmptyState
              icono={PackageX}
              titulo="No hay tarjas disponibles"
              descripcion="Genera una tarja desde un pallet en el módulo de Tarjas antes de crear un despacho."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Tarja</TableHead>
                    <TableHead>Pallet</TableHead>
                    <TableHead>Bandejas</TableHead>
                    <TableHead>Peso neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tarjasDisponibles.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={tarjaIds.includes(t.id)}
                          onChange={(e) => alternar(t.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{t.numero}</TableCell>
                      <TableCell>{t.palletNumero}</TableCell>
                      <TableCell>{t.cantidadBandejas}</TableCell>
                      <TableCell>{formatKg(t.pesoNetoKg)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex flex-col items-end gap-1 border-t pt-4 text-sm">
                <p>
                  Tarjas seleccionadas: <span className="font-medium">{seleccionadas.length}</span>
                </p>
                <p>
                  Total de bandejas: <span className="font-medium">{totales.bandejas}</span>
                </p>
                <p className="text-base">
                  Peso neto total: <span className="font-semibold text-primary">{formatKg(totales.neto)}</span>
                </p>
              </div>
              {form.formState.errors.tarjaIds && (
                <p className="mt-2 text-right text-sm font-medium text-destructive">
                  {form.formState.errors.tarjaIds.message}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting || tarjasDisponibles.length === 0}>
          {form.formState.isSubmitting ? "Guardando..." : "Registrar despacho"}
        </Button>
      </div>
    </form>
  );
}
