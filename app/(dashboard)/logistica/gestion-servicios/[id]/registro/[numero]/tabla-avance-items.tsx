"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCantidad, formatMoneda } from "@/lib/utils";
import {
  decidirVbItemAction,
  reabrirItemParaEdicionAction,
  registrarAvanceServicioAction,
  type TipoRegistroAvanceInput,
} from "@/lib/actions/servicio-gestionado-actions";

export type EstadoVBItem = "PENDIENTE" | "APROBADO" | "RECHAZADO";

export type FilaAvanceItem = {
  itemRegistroAvanceId: string;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  cantidadTotal: number;
  precioUnitario: number;
  moneda: string;
  saldoCantidad: number;
  saldoValor: number;
  estadoVB: EstadoVBItem;
  observacionesVB: string | null;
  /** Lo ya registrado en este ítem de ESTE registro (null = nada registrado todavía). */
  avanceRegistrado: { cantidad: number; valorizado: number } | null;
};

export function TablaAvanceItems({
  filas,
  soloLectura = false,
  mostrarVb = false,
  puedeDecidirVb = false,
  puedeRevertir = false,
  puedeEditar = false,
}: {
  filas: FilaAvanceItem[];
  soloLectura?: boolean;
  /** El registro ya está en (o pasó por) VB — se muestra la columna, aunque el visitante actual no pueda decidir. */
  mostrarVb?: boolean;
  /** El usuario actual es a quien se le pidió el VB (o ADMIN) — puede usar Aprobado/Rechazado en líneas aún PENDIENTE. */
  puedeDecidirVb?: boolean;
  /** El usuario actual es exactamente a quien se le pidió el VB (nunca ADMIN) — único que puede "Revertir a Aprobado" una línea rechazada. */
  puedeRevertir?: boolean;
  /** El usuario actual es Comprador — puede "Editar" cualquier línea (aprobada, rechazada o aún pendiente) una vez pasado ABIERTO. */
  puedeEditar?: boolean;
}) {
  if (filas.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">Todavía no hay ítems añadidos a este registro. Usa &quot;Añadir Items&quot;.</p>;
  }

  // Pedido explícito: una vez enviado a aprobación, debe seguir viéndose
  // lo que se registró — así que las columnas también se muestran si
  // alguna línea ya tiene avance registrado, aunque el visitante no sea
  // Comprador ni el registro siga ABIERTO.
  const mostrarColumnasRegistro = !soloLectura || puedeEditar || filas.some((f) => f.avanceRegistrado !== null);

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead numeric>Cant.</TableHead>
            <TableHead numeric>Valorizado</TableHead>
            {mostrarColumnasRegistro && <TableHead className="min-w-[160px]">Tipo de registro</TableHead>}
            {mostrarColumnasRegistro && <TableHead className="min-w-[220px]">Avance a registrar</TableHead>}
            <TableHead numeric>Saldo cant.</TableHead>
            <TableHead numeric>Saldo valor</TableHead>
            {mostrarVb && <TableHead className="min-w-[260px]">Visto bueno</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((fila) => (
            <FilaAvance
              key={fila.itemRegistroAvanceId}
              fila={fila}
              soloLectura={soloLectura}
              mostrarVb={mostrarVb}
              puedeDecidirVb={puedeDecidirVb}
              puedeRevertir={puedeRevertir}
              puedeEditar={puedeEditar}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FilaAvance({
  fila,
  soloLectura,
  mostrarVb,
  puedeDecidirVb,
  puedeRevertir,
  puedeEditar,
}: {
  fila: FilaAvanceItem;
  soloLectura: boolean;
  mostrarVb: boolean;
  puedeDecidirVb: boolean;
  puedeRevertir: boolean;
  puedeEditar: boolean;
}) {
  const [tipo, setTipo] = useState<TipoRegistroAvanceInput | "">("");
  const [valor, setValor] = useState("");
  const [observacionesVB, setObservacionesVB] = useState("");
  const [modoEdicion, setModoEdicion] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  // Pedido explícito: registrar avance por línea (y por lo tanto "Editar")
  // es exclusivo de Comprador — a quien se le pidió el VB solo debe ver
  // Aprobado/Rechazado, nunca estos controles (sí sigue viendo el valor ya
  // registrado como texto, vía fila.avanceRegistrado más abajo).
  const mostrarControlesRegistro = puedeEditar && (!soloLectura || modoEdicion);

  const valorNumerico = Number(valor);
  const esValido = tipo !== "" && valor.trim() !== "" && Number.isFinite(valorNumerico) && valorNumerico > 0;

  const preview = useMemo(() => {
    if (!esValido) return null;
    const cantidad = tipo === "PORCENTUAL" ? (fila.cantidadTotal * valorNumerico) / 100 : valorNumerico;
    const valorizado = cantidad * fila.precioUnitario;
    return { cantidad, valorizado };
  }, [esValido, tipo, valorNumerico, fila.cantidadTotal, fila.precioUnitario]);

  function handleRegistrar() {
    if (!esValido || !tipo) return;
    startTransition(async () => {
      const resultado = await registrarAvanceServicioAction(fila.itemRegistroAvanceId, tipo, valorNumerico);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Avance registrado");
      setValor("");
      router.refresh();
    });
  }

  function handleEditar() {
    if (fila.estadoVB === "PENDIENTE") {
      setModoEdicion(true);
      return;
    }
    startTransition(async () => {
      const resultado = await reabrirItemParaEdicionAction(fila.itemRegistroAvanceId);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Línea habilitada para editar");
      setModoEdicion(true);
      router.refresh();
    });
  }

  function handleDecidirVb(decision: "APROBADO" | "RECHAZADO") {
    if (decision === "RECHAZADO" && !observacionesVB.trim()) {
      toast.error("Las observaciones son obligatorias para rechazar.");
      return;
    }
    startTransition(async () => {
      const resultado = await decidirVbItemAction(fila.itemRegistroAvanceId, decision, observacionesVB);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(decision === "APROBADO" ? "Línea aprobada" : "Línea rechazada");
      router.refresh();
    });
  }

  return (
    <TableRow>
      <TableCell className="font-mono font-medium">{fila.codigo}</TableCell>
      <TableCell className="max-w-xs">{fila.descripcion}</TableCell>
      <TableCell numeric>
        {formatCantidad(fila.cantidadTotal)} {fila.unidadMedida}
      </TableCell>
      <TableCell numeric>{formatMoneda((fila.cantidadTotal * fila.precioUnitario).toString(), fila.moneda)}</TableCell>
      {(mostrarControlesRegistro || puedeEditar || fila.avanceRegistrado) && (
        <TableCell>
          {mostrarControlesRegistro ? (
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoRegistroAvanceInput)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PORCENTUAL">Avance Porcentual</SelectItem>
                <SelectItem value="CANTIDAD">Avance por Cantidad</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            puedeEditar && (
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={handleEditar}>
                Editar
              </Button>
            )
          )}
        </TableCell>
      )}
      {(mostrarControlesRegistro || puedeEditar || fila.avanceRegistrado) && (
        <TableCell>
          <div className="space-y-1.5">
            {fila.avanceRegistrado && (
              <p className="text-sm font-medium">
                {formatCantidad(fila.avanceRegistrado.cantidad)} {fila.unidadMedida} ·{" "}
                {formatMoneda(fila.avanceRegistrado.valorizado.toString(), fila.moneda)}
              </p>
            )}
            {mostrarControlesRegistro && tipo !== "" && (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    placeholder={tipo === "PORCENTUAL" ? "% de avance" : `Cantidad (${fila.unidadMedida})`}
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-28"
                  />
                  <Button type="button" size="sm" disabled={!esValido || pending} onClick={handleRegistrar}>
                    Registrar
                  </Button>
                </div>
                {preview && (
                  <p className="text-xs text-muted-foreground">
                    {tipo === "PORCENTUAL" && `${valorNumerico.toFixed(1)}% = `}
                    {formatCantidad(preview.cantidad)} {fila.unidadMedida} · {formatMoneda(preview.valorizado.toString(), fila.moneda)}
                  </p>
                )}
              </>
            )}
            {!fila.avanceRegistrado && !(mostrarControlesRegistro && tipo !== "") && (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        </TableCell>
      )}
      <TableCell numeric className="font-medium">
        {formatCantidad(fila.saldoCantidad)} {fila.unidadMedida}
      </TableCell>
      <TableCell numeric className="font-medium">
        {formatMoneda(fila.saldoValor.toString(), fila.moneda)}
      </TableCell>
      {mostrarVb && (
        <TableCell>
          {fila.estadoVB === "PENDIENTE" ? (
            puedeDecidirVb ? (
              <div className="space-y-1.5">
                <Input
                  placeholder="Observaciones (obligatorias si rechazas)"
                  value={observacionesVB}
                  onChange={(e) => setObservacionesVB(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => handleDecidirVb("APROBADO")}
                    className="text-green-700 hover:text-green-800"
                  >
                    Aprobado
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => handleDecidirVb("RECHAZADO")}
                    className="text-destructive hover:text-destructive"
                  >
                    Rechazado
                  </Button>
                </div>
              </div>
            ) : (
              <Badge variant="secondary">Pendiente</Badge>
            )
          ) : (
            <div className="space-y-1.5">
              <Badge variant={fila.estadoVB === "APROBADO" ? "success" : "destructive"}>
                {fila.estadoVB === "APROBADO" ? "Aprobado" : "Rechazado"}
              </Badge>
              {fila.observacionesVB && <p className="text-xs text-muted-foreground">&quot;{fila.observacionesVB}&quot;</p>}
              {fila.estadoVB === "RECHAZADO" && puedeRevertir && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => handleDecidirVb("APROBADO")}
                  className="text-green-700 hover:text-green-800"
                >
                  Revertir a Aprobado
                </Button>
              )}
            </div>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}
