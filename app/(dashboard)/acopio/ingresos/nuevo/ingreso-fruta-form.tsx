"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Package, PackagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatKg, fechaLocalHoy, horaLocalAhora } from "@/lib/utils";
import { ingresoFrutaSchema, type IngresoFrutaInput } from "@/lib/validations/ingreso-fruta";
import { crearIngresoFrutaAction, actualizarIngresoFrutaAction } from "@/lib/actions/ingreso-fruta-actions";
import { CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET as CAPACIDAD_MAXIMA } from "@/lib/constants/pallet";
import {
  MODULOS_ACOPIO,
  MODULOS_POR_FUNDO,
  VARIEDADES_POR_MODULO,
  TURNOS_POR_MODULO_VARIEDAD,
  FORMATOS_LINEA_PESAJE,
  TIPOS_PRODUCTO_LINEA_PESAJE,
} from "@/lib/constants/modulos";

type ProveedorOption = { id: string; razonSocial: string };
type TipoBandejaOption = { id: string; nombre: string; pesoTaraKg: string };
type TipoPalletOption = { id: string; nombre: string; pesoTaraKg: string };
type PalletAbierto = { id: string; numero: string; cantidadBandejas: number };
// "fruta" arma un Pallet normal (líneas "Exportable"); "iqf" arma un
// PalletIQF (líneas "Descarte Campo"), para que su tarja salga en Tarjas
// IQF. Un mismo pallet nunca mezcla ambos tipos de producto.
type PalletNuevo = { tempId: string; etiqueta: string; tipo: "fruta" | "iqf" };

// Radix Select no permite un SelectItem con value="" (lo reserva para el
// placeholder), así que se usa este sentinel para representar "sin pallet".
const SIN_PALLET = "__sin_pallet__";

const LINEA_VACIA = {
  modulo: "",
  turno: "",
  variedad: "",
  formato: "",
  tipoProducto: "",
  tipoBandejaId: "",
  tipoPalletId: "",
  cantidadBandejas: 0,
  pesoBrutoTotalKg: 0,
  palletAsignado: "",
};

export function IngresoFrutaForm({
  proveedores,
  tiposBandeja,
  tiposPallet,
  palletsAbiertos,
  palletsAbiertosIQF,
  edicion,
}: {
  proveedores: ProveedorOption[];
  tiposBandeja: TipoBandejaOption[];
  tiposPallet: TipoPalletOption[];
  palletsAbiertos: PalletAbierto[];
  /** Pallets IQF abiertos de origen "Descarte Campo" (ver PalletIQF.origen). */
  palletsAbiertosIQF: PalletAbierto[];
  /** Presente solo cuando el formulario edita un ingreso ya existente. */
  edicion?: {
    ingresoId: string;
    valoresIniciales: IngresoFrutaInput;
    /** bandejas que este mismo ingreso ya aportaba a cada pallet (para
     * "liberar" ese espacio en el cálculo de capacidad mientras se edita). */
    contribucionOriginalPorPallet: Record<string, number>;
  };
}) {
  const router = useRouter();
  const taraPorTipo = new Map(tiposBandeja.map((t) => [t.id, Number(t.pesoTaraKg)]));
  const taraPorTipoPallet = new Map(tiposPallet.map((t) => [t.id, Number(t.pesoTaraKg)]));
  const contribucionOriginal = edicion?.contribucionOriginalPorPallet ?? {};

  const [palletsNuevos, setPalletsNuevos] = useState<PalletNuevo[]>([]);
  const [lineaDialogoAbierto, setLineaDialogoAbierto] = useState<number | null>(null);
  const contadorPalletNuevo = useRef(0);

  const form = useForm<IngresoFrutaInput>({
    resolver: zodResolver(ingresoFrutaSchema),
    defaultValues: edicion?.valoresIniciales ?? {
      proveedorId: "",
      // El <input type="date"> trabaja con un string "YYYY-MM-DD" en la fecha
      // LOCAL del navegador (toISOString() da la fecha en UTC, que puede caer
      // un día antes o después según la hora); react-hook-form lo deja pasar
      // tal cual y zod lo convierte a Date recién al validar.
      fechaCosecha: fechaLocalHoy() as unknown as Date,
      horaIngreso: horaLocalAhora(),
      placaTransporte: "",
      observaciones: "",
      pallets: [LINEA_VACIA],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "pallets" });
  const pallets = useWatch({ control: form.control, name: "pallets" }) ?? [];
  const proveedorIdSeleccionado = useWatch({ control: form.control, name: "proveedorId" });

  // Cada fundo cosecha solo de ciertos módulos (ver MODULOS_POR_FUNDO). Si el
  // fundo elegido no está en ese catálogo (uno nuevo, sin configurar), se
  // permiten todos los módulos.
  const razonSocialSeleccionada = proveedores
    .find((p) => p.id === proveedorIdSeleccionado)
    ?.razonSocial.toUpperCase();
  const modulosDisponibles: readonly string[] =
    (razonSocialSeleccionada && MODULOS_POR_FUNDO[razonSocialSeleccionada]) || MODULOS_ACOPIO;

  const filasCalculadas = pallets.map((pallet) => {
    const taraUnitaria = taraPorTipo.get(pallet?.tipoBandejaId ?? "") ?? 0;
    const taraPallet = pallet?.tipoPalletId ? taraPorTipoPallet.get(pallet.tipoPalletId) ?? 0 : 0;
    const cantidad = Number(pallet?.cantidadBandejas) || 0;
    const pesoBruto = Number(pallet?.pesoBrutoTotalKg) || 0;
    const pesoTara = cantidad * taraUnitaria + taraPallet;
    const pesoNeto = pesoBruto - pesoTara;
    return { pesoTara, pesoNeto };
  });

  const totales = filasCalculadas.reduce(
    (acc, fila, i) => ({
      cantidadBandejas: acc.cantidadBandejas + (Number(pallets[i]?.cantidadBandejas) || 0),
      pesoBruto: acc.pesoBruto + (Number(pallets[i]?.pesoBrutoTotalKg) || 0),
      pesoNeto: acc.pesoNeto + fila.pesoNeto,
    }),
    { cantidadBandejas: 0, pesoBruto: 0, pesoNeto: 0 }
  );

  // Bandejas ya asignadas a cada pallet abierto/nuevo *dentro de este mismo
  // formulario* (para calcular cuánto espacio le queda a cada uno en vivo).
  function bandejasAsignadasEnFormulario(destino: string, excluirIndex?: number) {
    return pallets.reduce((acc, p, i) => {
      if (i === excluirIndex) return acc;
      return p?.palletAsignado === destino ? acc + (Number(p.cantidadBandejas) || 0) : acc;
    }, 0);
  }

  function etiquetaAsignacion(valor: string | undefined): string | null {
    if (!valor) return null;
    const [tipo, id] = valor.split(":");
    if (tipo === "nuevo") return palletsNuevos.find((p) => p.tempId === id)?.etiqueta ?? null;
    if (tipo === "existente")
      return (
        palletsAbiertos.find((p) => p.id === id)?.numero ??
        palletsAbiertosIQF.find((p) => p.id === id)?.numero ??
        null
      );
    return null;
  }

  function crearPalletNuevo(index: number) {
    const esDescarteCampo = pallets[index]?.tipoProducto === "Descarte Campo";
    contadorPalletNuevo.current += 1;
    const tempId = `t${contadorPalletNuevo.current}`;
    const etiqueta = esDescarteCampo
      ? `Pallet IQF nuevo #${contadorPalletNuevo.current}`
      : `Pallet nuevo #${contadorPalletNuevo.current}`;
    setPalletsNuevos((prev) => [...prev, { tempId, etiqueta, tipo: esDescarteCampo ? "iqf" : "fruta" }]);
    form.setValue(`pallets.${index}.palletAsignado`, `nuevo:${tempId}`, { shouldValidate: true });
  }

  function asignarPalletExistente(index: number, destino: string) {
    form.setValue(`pallets.${index}.palletAsignado`, destino, { shouldValidate: true });
    setLineaDialogoAbierto(null);
  }

  // Si la línea que se está liberando era la única que apuntaba a un pallet
  // nuevo (creado con "Crear pallet nuevo" pero recién), el pallet temporal
  // se descarta en vez de quedar huérfano en la lista de "nuevos en este
  // formulario".
  function liberarPalletNuevoSiHuerfano(valorActual: string | undefined, indexExcluido: number) {
    if (!valorActual?.startsWith("nuevo:")) return;
    const tempId = valorActual.slice("nuevo:".length);
    const otraLineaLoUsa = pallets.some((p, i) => i !== indexExcluido && p?.palletAsignado === valorActual);
    if (!otraLineaLoUsa) {
      setPalletsNuevos((prev) => prev.filter((p) => p.tempId !== tempId));
    }
  }

  // "Cambiar" quita la asignación de esta línea.
  function quitarAsignacion(index: number) {
    const valorActual = pallets[index]?.palletAsignado;
    form.setValue(`pallets.${index}.palletAsignado`, "", { shouldValidate: true });
    liberarPalletNuevoSiHuerfano(valorActual, index);
  }

  useEffect(() => {
    const errorPallets = form.formState.errors.pallets;
    if (errorPallets && !Array.isArray(errorPallets)) {
      toast.error(errorPallets.message ?? "Revisa las líneas de pesaje");
    }
  }, [form.formState.errors.pallets]);

  async function onSubmit(data: IngresoFrutaInput) {
    let resultado;
    try {
      resultado = edicion
        ? await actualizarIngresoFrutaAction(edicion.ingresoId, data)
        : await crearIngresoFrutaAction(data);
    } catch (err) {
      console.error("Error al guardar el ingreso:", err);
      const detalle = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo guardar: ${detalle}`);
      return;
    }
    if (resultado?.error) {
      toast.error(resultado.error);
      return;
    }
    if (edicion) {
      toast.success("Ingreso actualizado");
      router.push(`/acopio/ingresos/${edicion.ingresoId}`);
    } else {
      toast.success("Ingreso de materia prima registrado");
      router.push(resultado?.id ? `/acopio/ingresos/${resultado.id}` : "/acopio/ingresos");
    }
  }

  // Opciones disponibles para el diálogo de "asignar a pallet existente":
  // pallets abiertos en BD + pallets nuevos creados en este mismo formulario,
  // con la capacidad restante calculada en vivo. El pool (fruta vs IQF)
  // depende del tipo de producto de la línea que abrió el diálogo.
  const poolDialogo: "fruta" | "iqf" =
    lineaDialogoAbierto !== null && pallets[lineaDialogoAbierto]?.tipoProducto === "Descarte Campo"
      ? "iqf"
      : "fruta";
  const opcionesDialogo = lineaDialogoAbierto === null
    ? { abiertos: [], nuevos: [] }
    : {
        abiertos: (poolDialogo === "iqf" ? palletsAbiertosIQF : palletsAbiertos)
          .map((p) => ({
            ...p,
            // Se suma de vuelta lo que este mismo ingreso ya le había
            // aportado a este pallet: mientras se edita, ese espacio está
            // "liberado" hasta que se guarde de nuevo.
            restante:
              CAPACIDAD_MAXIMA -
              p.cantidadBandejas +
              (contribucionOriginal[p.id] ?? 0) -
              bandejasAsignadasEnFormulario(`existente:${p.id}`, lineaDialogoAbierto),
          }))
          .filter((p) => p.restante > 0),
        nuevos: palletsNuevos
          .filter((p) => p.tipo === poolDialogo)
          .map((p) => ({
            ...p,
            restante: CAPACIDAD_MAXIMA - bandejasAsignadasEnFormulario(`nuevo:${p.tempId}`, lineaDialogoAbierto),
          }))
          .filter((p) => p.restante > 0),
      };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del camión</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Fundo</Label>
            <Controller
              control={form.control}
              name="proveedorId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(valor) => {
                    field.onChange(valor);
                    // Si el módulo de alguna línea ya no es válido para el
                    // nuevo fundo, se resetea junto con variedad y turno
                    // (misma cascada que al cambiar el módulo de una línea).
                    const nuevaRazonSocial = proveedores.find((p) => p.id === valor)?.razonSocial.toUpperCase();
                    const nuevosModulos: readonly string[] =
                      (nuevaRazonSocial && MODULOS_POR_FUNDO[nuevaRazonSocial]) || MODULOS_ACOPIO;
                    pallets.forEach((_, i) => {
                      const moduloActual = form.getValues(`pallets.${i}.modulo`);
                      if (moduloActual && !nuevosModulos.includes(moduloActual)) {
                        form.setValue(`pallets.${i}.modulo`, "", { shouldValidate: true });
                        form.setValue(`pallets.${i}.variedad`, "", { shouldValidate: true });
                        form.setValue(`pallets.${i}.turno`, "", { shouldValidate: true });
                      }
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un fundo" />
                  </SelectTrigger>
                  <SelectContent>
                    {proveedores.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.razonSocial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.proveedorId && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.proveedorId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="placaTransporte">Placa del vehículo</Label>
            <Input id="placaTransporte" placeholder="Ej. ABC-123" {...form.register("placaTransporte")} />
            {form.formState.errors.placaTransporte && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.placaTransporte.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="horaIngreso">Hora de recepción</Label>
            <Input id="horaIngreso" type="time" {...form.register("horaIngreso")} />
            {form.formState.errors.horaIngreso && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.horaIngreso.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fechaCosecha">Fecha de cosecha</Label>
            <Input id="fechaCosecha" type="date" {...form.register("fechaCosecha")} />
            {form.formState.errors.fechaCosecha && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.fechaCosecha.message}</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
            <Textarea id="observaciones" rows={2} {...form.register("observaciones")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Líneas de pesaje</CardTitle>
            <p className="text-sm text-muted-foreground">
              Un camión puede traer fruta de más de un módulo, turno o variedad, y cada grupo se asigna a
              un pallet físico (máximo {CAPACIDAD_MAXIMA} bandejas por pallet).
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => append(LINEA_VACIA)}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar línea
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => {
            const asignacion = etiquetaAsignacion(pallets[index]?.palletAsignado);
            return (
              <div key={field.id} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Línea {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={fields.length === 1}
                    onClick={() => {
                      liberarPalletNuevoSiHuerfano(pallets[index]?.palletAsignado, index);
                      remove(index);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Módulo</Label>
                    <Controller
                      control={form.control}
                      name={`pallets.${index}.modulo`}
                      render={({ field: selectField }) => (
                        <Select
                          value={selectField.value}
                          onValueChange={(valor) => {
                            selectField.onChange(valor);
                            const variedadActual = form.getValues(`pallets.${index}.variedad`);
                            const opcionesVariedad = VARIEDADES_POR_MODULO[valor] ?? [];
                            if (!opcionesVariedad.includes(variedadActual)) {
                              form.setValue(`pallets.${index}.variedad`, "", { shouldValidate: true });
                              form.setValue(`pallets.${index}.turno`, "", { shouldValidate: true });
                            } else {
                              const opcionesTurno = TURNOS_POR_MODULO_VARIEDAD[valor]?.[variedadActual] ?? [];
                              const turnoActual = form.getValues(`pallets.${index}.turno`);
                              if (!opcionesTurno.includes(turnoActual)) {
                                form.setValue(`pallets.${index}.turno`, "", { shouldValidate: true });
                              }
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona..." />
                          </SelectTrigger>
                          <SelectContent>
                            {modulosDisponibles.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {form.formState.errors.pallets?.[index]?.modulo && (
                      <p className="text-xs font-medium text-destructive">
                        {form.formState.errors.pallets[index]?.modulo?.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Variedad</Label>
                    <Controller
                      control={form.control}
                      name={`pallets.${index}.variedad`}
                      render={({ field: selectField }) => {
                        const opciones = VARIEDADES_POR_MODULO[pallets[index]?.modulo ?? ""] ?? [];
                        return (
                          <Select
                            value={selectField.value}
                            onValueChange={(valor) => {
                              selectField.onChange(valor);
                              const opcionesTurno = TURNOS_POR_MODULO_VARIEDAD[pallets[index]?.modulo ?? ""]?.[valor] ?? [];
                              const turnoActual = form.getValues(`pallets.${index}.turno`);
                              if (!opcionesTurno.includes(turnoActual)) {
                                form.setValue(`pallets.${index}.turno`, "", { shouldValidate: true });
                              }
                            }}
                            disabled={opciones.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={opciones.length === 0 ? "Elige un módulo primero" : "Selecciona..."}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {opciones.map((v) => (
                                <SelectItem key={v} value={v}>
                                  {v}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      }}
                    />
                    {form.formState.errors.pallets?.[index]?.variedad && (
                      <p className="text-xs font-medium text-destructive">
                        {form.formState.errors.pallets[index]?.variedad?.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Turno</Label>
                    <Controller
                      control={form.control}
                      name={`pallets.${index}.turno`}
                      render={({ field: selectField }) => {
                        const opciones =
                          TURNOS_POR_MODULO_VARIEDAD[pallets[index]?.modulo ?? ""]?.[pallets[index]?.variedad ?? ""] ??
                          [];
                        return (
                          <Select
                            value={selectField.value}
                            onValueChange={selectField.onChange}
                            disabled={opciones.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={opciones.length === 0 ? "Elige módulo y variedad primero" : "Selecciona..."}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {opciones.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      }}
                    />
                    {form.formState.errors.pallets?.[index]?.turno && (
                      <p className="text-xs font-medium text-destructive">
                        {form.formState.errors.pallets[index]?.turno?.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Formato</Label>
                    <Controller
                      control={form.control}
                      name={`pallets.${index}.formato`}
                      render={({ field: selectField }) => (
                        <Select value={selectField.value} onValueChange={selectField.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona..." />
                          </SelectTrigger>
                          <SelectContent>
                            {FORMATOS_LINEA_PESAJE.map((f) => (
                              <SelectItem key={f} value={f}>
                                {f}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {form.formState.errors.pallets?.[index]?.formato && (
                      <p className="text-xs font-medium text-destructive">
                        {form.formState.errors.pallets[index]?.formato?.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo de producto</Label>
                    <Controller
                      control={form.control}
                      name={`pallets.${index}.tipoProducto`}
                      render={({ field: selectField }) => (
                        <Select
                          value={selectField.value}
                          onValueChange={(valor) => {
                            // Cambiar el tipo de producto cambia de pool de
                            // pallet físico (fruta vs IQF), así que la
                            // asignación anterior deja de ser válida.
                            if (valor !== selectField.value) {
                              liberarPalletNuevoSiHuerfano(pallets[index]?.palletAsignado, index);
                              form.setValue(`pallets.${index}.palletAsignado`, "", { shouldValidate: true });
                            }
                            selectField.onChange(valor);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona..." />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPOS_PRODUCTO_LINEA_PESAJE.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {form.formState.errors.pallets?.[index]?.tipoProducto && (
                      <p className="text-xs font-medium text-destructive">
                        {form.formState.errors.pallets[index]?.tipoProducto?.message}
                      </p>
                    )}
                    {pallets[index]?.tipoProducto === "Descarte Campo" && (
                      <p className="text-xs text-muted-foreground">
                        Esta línea arma un pallet IQF: su tarja saldrá en Tarjas IQF.
                      </p>
                    )}
                  </div>
                </div>

                <Separator className="my-3" />

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Tipo de bandeja</Label>
                    <Controller
                      control={form.control}
                      name={`pallets.${index}.tipoBandejaId`}
                      render={({ field: selectField }) => (
                        <Select value={selectField.value} onValueChange={selectField.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona..." />
                          </SelectTrigger>
                          <SelectContent>
                            {tiposBandeja.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {form.formState.errors.pallets?.[index]?.tipoBandejaId && (
                      <p className="text-xs font-medium text-destructive">
                        {form.formState.errors.pallets[index]?.tipoBandejaId?.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo de pallet (opcional)</Label>
                    <Controller
                      control={form.control}
                      name={`pallets.${index}.tipoPalletId`}
                      render={({ field: selectField }) => (
                        <Select
                          value={selectField.value || SIN_PALLET}
                          onValueChange={(valor) => selectField.onChange(valor === SIN_PALLET ? "" : valor)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sin pallet" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SIN_PALLET}>Sin pallet</SelectItem>
                            {tiposPallet.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cant. bandejas</Label>
                    <Input type="number" min={1} step="1" {...form.register(`pallets.${index}.cantidadBandejas`)} />
                    {form.formState.errors.pallets?.[index]?.cantidadBandejas && (
                      <p className="text-xs font-medium text-destructive">
                        {form.formState.errors.pallets[index]?.cantidadBandejas?.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Peso bruto (kg)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.001"
                      {...form.register(`pallets.${index}.pesoBrutoTotalKg`)}
                    />
                    {form.formState.errors.pallets?.[index]?.pesoBrutoTotalKg && (
                      <p className="text-xs font-medium text-destructive">
                        {form.formState.errors.pallets[index]?.pesoBrutoTotalKg?.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>Tara: {formatKg(filasCalculadas[index]?.pesoTara ?? 0)}</span>
                  <span className="font-semibold text-primary">
                    Peso neto: {formatKg(filasCalculadas[index]?.pesoNeto ?? 0)}
                  </span>
                </div>

                <Separator className="my-3" />

                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-xs">Pallet asignado</Label>
                  {asignacion ? (
                    <>
                      <Badge variant="outline" className="gap-1">
                        <Package className="h-3 w-3" />
                        {asignacion}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => quitarAsignacion(index)}
                      >
                        Cambiar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!pallets[index]?.tipoProducto}
                        onClick={() => crearPalletNuevo(index)}
                      >
                        <PackagePlus className="mr-2 h-4 w-4" />
                        Crear pallet nuevo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!pallets[index]?.tipoProducto}
                        onClick={() => setLineaDialogoAbierto(index)}
                      >
                        <Package className="mr-2 h-4 w-4" />
                        Asignar a pallet existente
                      </Button>
                      {!pallets[index]?.tipoProducto && (
                        <span className="text-xs text-muted-foreground">Elige primero el tipo de producto.</span>
                      )}
                    </>
                  )}
                </div>
                {form.formState.errors.pallets?.[index]?.palletAsignado && (
                  <p className="mt-1 text-xs font-medium text-destructive">
                    {form.formState.errors.pallets[index]?.palletAsignado?.message}
                  </p>
                )}
              </div>
            );
          })}

          <div className="flex flex-col items-end gap-1 border-t pt-4 text-sm">
            <p>
              Total de bandejas: <span className="font-medium">{totales.cantidadBandejas}</span>
            </p>
            <p>
              Peso bruto total: <span className="font-medium">{formatKg(totales.pesoBruto)}</span>
            </p>
            <p className="text-base">
              Peso neto total: <span className="font-semibold text-primary">{formatKg(totales.pesoNeto)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={lineaDialogoAbierto !== null} onOpenChange={(open) => !open && setLineaDialogoAbierto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar a pallet existente{poolDialogo === "iqf" ? " (IQF)" : ""}</DialogTitle>
            <DialogDescription>
              {poolDialogo === "iqf"
                ? "Solo se muestran pallets IQF de Descarte Campo abiertos con espacio disponible."
                : "Solo se muestran pallets abiertos con espacio disponible."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {opcionesDialogo.nuevos.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  Nuevos en este formulario
                </p>
                <div className="space-y-1">
                  {opcionesDialogo.nuevos.map((p) => (
                    <button
                      key={p.tempId}
                      type="button"
                      onClick={() => lineaDialogoAbierto !== null && asignarPalletExistente(lineaDialogoAbierto, `nuevo:${p.tempId}`)}
                      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span>{p.etiqueta}</span>
                      <span className="text-muted-foreground">quedan {p.restante}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                {poolDialogo === "iqf" ? "Pallets IQF abiertos" : "Pallets abiertos"}
              </p>
              {opcionesDialogo.abiertos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay pallets abiertos con espacio disponible.</p>
              ) : (
                <div className="space-y-1">
                  {opcionesDialogo.abiertos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => lineaDialogoAbierto !== null && asignarPalletExistente(lineaDialogoAbierto, `existente:${p.id}`)}
                      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span>{p.numero}</span>
                      <span className="text-muted-foreground">quedan {p.restante}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Guardando..." : edicion ? "Guardar cambios" : "Registrar ingreso"}
        </Button>
      </div>
    </form>
  );
}
