"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PackageX } from "lucide-react";
import { fechaLocalHoy, horaLocalAhora, formatKg, formatCantidad } from "@/lib/utils";
import { TIPOS_CAMION } from "@/lib/validations/transporte";
import { despachoSchema, type DespachoInput } from "@/lib/validations/despacho";
import { crearDespachoIQFAction } from "@/lib/actions/despacho-iqf-actions";

type TarjaDisponible = {
  id: string;
  numero: string;
  palletNumero: string;
  cantidadBandejas: number;
  pesoNetoKg: number;
};
type CamionOption = { id: string; placa: string; tipo: string };
type ConductorOption = { id: string; nombre: string };

const TIPO_CAMION_LABEL = Object.fromEntries(TIPOS_CAMION.map((t) => [t.valor, t.nombre])) as Record<string, string>;

export function DespachoIQFForm({
  tarjasDisponibles,
  camiones,
  conductores,
}: {
  tarjasDisponibles: TarjaDisponible[];
  camiones: CamionOption[];
  conductores: ConductorOption[];
}) {
  const router = useRouter();
  const fechaRegistro = fechaLocalHoy();

  const form = useForm<DespachoInput>({
    resolver: zodResolver(despachoSchema),
    defaultValues: {
      placaCamion: "",
      conductor: "",
      fechaDespacho: fechaLocalHoy() as unknown as Date,
      horaDespacho: horaLocalAhora(),
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
    const resultado = await crearDespachoIQFAction(data);
    if (resultado?.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success("Carga finalizada");
    router.push(resultado?.id ? `/acopio/despacho-iqf/${resultado.id}` : "/acopio/despacho-iqf");
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
            <Controller
              control={form.control}
              name="placaCamion"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="placaCamion">
                    <SelectValue placeholder="Selecciona un camión" />
                  </SelectTrigger>
                  <SelectContent>
                    {camiones.map((c) => (
                      <SelectItem key={c.id} value={c.placa}>
                        {c.placa} — {TIPO_CAMION_LABEL[c.tipo] ?? c.tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {camiones.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay camiones registrados. Créalos en Información Transporte.
              </p>
            )}
            {form.formState.errors.placaCamion && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.placaCamion.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="conductor">Conductor</Label>
            <Controller
              control={form.control}
              name="conductor"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="conductor">
                    <SelectValue placeholder="Selecciona un conductor" />
                  </SelectTrigger>
                  <SelectContent>
                    {conductores.map((c) => (
                      <SelectItem key={c.id} value={c.nombre}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {conductores.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay conductores registrados. Créalos en Información Transporte.
              </p>
            )}
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
            <Input
              id="horaDespacho"
              type="time"
              readOnly
              className="cursor-not-allowed bg-muted opacity-70"
              {...form.register("horaDespacho")}
            />
            <p className="text-xs text-muted-foreground">Se registra con la hora actual, no se puede modificar.</p>
            {form.formState.errors.horaDespacho && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.horaDespacho.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fechaRegistro">Fecha de registro</Label>
            <Input
              id="fechaRegistro"
              type="date"
              readOnly
              disabled
              className="cursor-not-allowed bg-muted opacity-70"
              value={fechaRegistro}
            />
            <p className="text-xs text-muted-foreground">Fecha en la que se registró este despacho, no se puede modificar.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarjas IQF disponibles para despachar</CardTitle>
          <p className="text-sm text-muted-foreground">
            Solo se muestran pallets IQF con tarja generada que todavía no fueron despachados.
          </p>
        </CardHeader>
        <CardContent>
          {tarjasDisponibles.length === 0 ? (
            <EmptyState
              icono={PackageX}
              titulo="No hay tarjas disponibles"
              descripcion="Genera una tarja desde un pallet en el módulo de Tarjas IQF antes de crear un despacho."
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
                      <TableCell>{formatCantidad(t.cantidadBandejas)}</TableCell>
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
                  Total de bandejas: <span className="font-medium">{formatCantidad(totales.bandejas)}</span>
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
          {form.formState.isSubmitting ? "Guardando..." : "Finalizar carga"}
        </Button>
      </div>
    </form>
  );
}
