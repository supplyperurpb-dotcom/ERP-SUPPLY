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
  solicitante: string;
  numItems: number;
  estado: EstadoSolicitudDespacho;
  puedeEliminar: boolean;
};

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
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());

  const filasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return filas;
    return filas.filter((f) => f.numero.toLowerCase().includes(termino));
  }, [filas, busqueda]);

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
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número de solicitud..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8"
          />
        </div>
        {puedeAtender && seleccionadas.size > 0 && (
          <Button onClick={atenderSeleccionadas}>
            Atender Seleccionadas ({seleccionadas.size})
          </Button>
        )}
      </div>

      {filasFiltradas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No se encontró ninguna solicitud que coincida con &quot;{busqueda}&quot;.
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
