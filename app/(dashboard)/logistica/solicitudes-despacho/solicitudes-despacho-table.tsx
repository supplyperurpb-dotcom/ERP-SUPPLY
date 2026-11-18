"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileDown, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EliminarMovimientoButton } from "@/components/shared/eliminar-movimiento-button";
import { eliminarSolicitudDespachoAction } from "@/lib/actions/solicitud-despacho-actions";

export type EstadoSolicitudDespacho = "PENDIENTE" | "PARCIAL" | "ATENDIDA";

const ESTADO_LABEL: Record<EstadoSolicitudDespacho, string> = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  ATENDIDA: "Atendida",
};

const ESTADO_VARIANT: Record<EstadoSolicitudDespacho, "success" | "secondary"> = {
  PENDIENTE: "secondary",
  PARCIAL: "secondary",
  ATENDIDA: "success",
};

export type FilaSolicitudDespacho = {
  id: string;
  numero: string;
  area: string;
  /** Valor crudo del enum (ver AreaEmpresa) — para comparar, no para mostrar. */
  areaCodigo: string;
  fecha: string;
  /** "YYYY-MM-DD", para el filtro por rango de fechas — ver fecha para el texto mostrado en la tabla. */
  fechaISO: string;
  solicitante: string;
  numItems: number;
  estado: EstadoSolicitudDespacho;
  puedeEliminar: boolean;
};

// Fecha de hoy en el calendario local del navegador (no UTC: evita que a
// ciertas horas del día la fecha "de hoy" quede corrida un día).
function hoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function SolicitudesDespachoTable({
  filas,
  puedeAtender,
}: {
  filas: FilaSolicitudDespacho[];
  /** Solo Almacén y los administradores atienden solicitudes — ver
   * esAlmacen en lib/stock-almacen.ts. El resto solo ve "Ver" y, si
   * corresponde, "Eliminar". */
  puedeAtender: boolean;
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoSolicitudDespacho | "TODOS">("TODOS");
  // Rango de fechas — por defecto hoy a hoy (pedido explícito), igual de
  // editable que cualquier filtro de fecha para ver otros días.
  const [fechaDesde, setFechaDesde] = useState(hoyISO());
  const [fechaHasta, setFechaHasta] = useState(hoyISO());

  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());

  const filasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return filas
      .filter((f) => !termino || f.numero.toLowerCase().includes(termino))
      .filter((f) => filtroEstado === "TODOS" || f.estado === filtroEstado)
      .filter((f) => (!fechaDesde || f.fechaISO >= fechaDesde) && (!fechaHasta || f.fechaISO <= fechaHasta));
  }, [filas, busqueda, filtroEstado, fechaDesde, fechaHasta]);

  const filaPorId = new Map(filas.map((f) => [f.id, f]));
  const areaSeleccionada = [...seleccionadas][0] ? filaPorId.get([...seleccionadas][0])?.areaCodigo : null;

  function alternarSeleccion(fila: FilaSolicitudDespacho, marcado: boolean) {
    if (marcado && areaSeleccionada && fila.areaCodigo !== areaSeleccionada) {
      toast.error("No se pueden agrupar solicitudes de distintas áreas usuarias. Deben atenderse por separado.");
      return;
    }
    setSeleccionadas((prev) => {
      const siguiente = new Set(prev);
      if (marcado) siguiente.add(fila.id);
      else siguiente.delete(fila.id);
      return siguiente;
    });
  }

  function atenderSeleccionadas() {
    if (seleccionadas.size === 0) return;
    router.push(`/logistica/almacenes/consumos/nuevo?solicitudDespachoIds=${[...seleccionadas].join(",")}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por número de solicitud..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-[150px]"
            />
            <span className="text-sm text-muted-foreground">a</span>
            <Input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as EstadoSolicitudDespacho | "TODOS")}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Estatus" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos los estatus</SelectItem>
              {(Object.keys(ESTADO_LABEL) as EstadoSolicitudDespacho[]).map((estado) => (
                <SelectItem key={estado} value={estado}>
                  {ESTADO_LABEL[estado]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {puedeAtender && seleccionadas.size > 0 && (
          <Button onClick={atenderSeleccionadas}>
            Atender Seleccionadas ({seleccionadas.size})
          </Button>
        )}
      </div>

      {filasFiltradas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {busqueda
            ? `No se encontró ninguna solicitud que coincida con "${busqueda}".`
            : "Ninguna solicitud coincide con el estatus o el rango de fechas elegido."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {puedeAtender && <TableHead className="w-10" />}
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario solicitante</TableHead>
              <TableHead>Área usuaria</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead className="text-right">N.º de ítems</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filasFiltradas.map((f) => {
              const noEstaAtendida = f.estado !== "ATENDIDA";
              const deshabilitadaPorArea = !!areaSeleccionada && f.areaCodigo !== areaSeleccionada && !seleccionadas.has(f.id);
              return (
                <TableRow key={f.id}>
                  {puedeAtender && (
                    <TableCell>
                      <Checkbox
                        checked={seleccionadas.has(f.id)}
                        disabled={!noEstaAtendida || deshabilitadaPorArea}
                        onCheckedChange={(v) => alternarSeleccion(f, !!v)}
                        title={deshabilitadaPorArea ? "Ya hay solicitudes de otra área usuaria seleccionadas." : undefined}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{f.numero}</TableCell>
                  <TableCell>{f.fecha}</TableCell>
                  <TableCell>{f.solicitante}</TableCell>
                  <TableCell>{f.area}</TableCell>
                  <TableCell>
                    <Badge variant={ESTADO_VARIANT[f.estado]}>{ESTADO_LABEL[f.estado]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{f.numItems}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button variant="outline" size="sm" asChild title="Descargar PDF">
                        <a href={`/api/pdf/solicitud-despacho/${f.id}`} target="_blank" rel="noopener noreferrer">
                          <FileDown className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/logistica/solicitudes-despacho/${f.id}`}>Ver</Link>
                      </Button>
                      {puedeAtender && noEstaAtendida && (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/logistica/almacenes/consumos/nuevo?solicitudDespachoIds=${f.id}`}>Atender</Link>
                        </Button>
                      )}
                      {f.puedeEliminar && (
                        <EliminarMovimientoButton
                          id={f.id}
                          numero={f.numero}
                          etiqueta="la solicitud de despacho"
                          accion={eliminarSolicitudDespachoAction}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
