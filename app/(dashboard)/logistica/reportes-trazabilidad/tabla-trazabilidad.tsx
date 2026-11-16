"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCantidad, formatDate } from "@/lib/utils";
import { ESTADO_ATENCION_LABEL, type EstadoAtencionLinea, type LineaTrazabilidad } from "@/lib/trazabilidad";

const ESTADO_VARIANT: Record<EstadoAtencionLinea, "success" | "info" | "warning" | "secondary" | "destructive"> = {
  ATENDIDO: "success",
  ATENDIDO_PARCIAL: "info",
  PENDIENTE_CON_ORDEN: "warning",
  PENDIENTE_SIN_ORDEN: "secondary",
  CERRADO_SIN_ATENDER: "destructive",
};

// Tabla de trazabilidad con detalle expandible por línea (pedido
// explícito): la fila principal es un SolicitudPedidoItem con sus 5
// cantidades ya resueltas (ver calcularTrazabilidad); al expandir se ve
// cada Orden de Compra/Servicio que la cubre y, dentro de ella, cada
// recepción/avance aprobado — sin volver a sumar nada, solo mostrar el
// desglose que ya viene calculado.
export function TablaTrazabilidad({ lineas }: { lineas: LineaTrazabilidad[] }) {
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  function alternar(id: string) {
    setExpandidas((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  if (lineas.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Ningún requerimiento coincide con el filtro.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Requerimiento</TableHead>
            <TableHead>Creado</TableHead>
            <TableHead>Aprobado</TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Familia</TableHead>
            <TableHead>Subfamilia</TableHead>
            <TableHead numeric>Solicitado</TableHead>
            <TableHead numeric>Ordenado</TableHead>
            <TableHead numeric>Atendido</TableHead>
            <TableHead numeric>Pend. c/orden</TableHead>
            <TableHead numeric>Pend. s/orden</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineas.map((linea) => {
            const abierta = expandidas.has(linea.id);
            return (
              <Fragment key={linea.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => alternar(linea.id)}
                >
                  <TableCell>
                    {linea.ordenes.length > 0 &&
                      (abierta ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ))}
                  </TableCell>
                  <TableCell className="font-mono font-medium">{linea.requerimientoNumero}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(linea.fechaCreacion)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {linea.fechaAprobacion ? formatDate(linea.fechaAprobacion) : "—"}
                  </TableCell>
                  <TableCell className="font-mono">{linea.codigo}</TableCell>
                  <TableCell className="max-w-xs">{linea.descripcion}</TableCell>
                  <TableCell>{linea.familia}</TableCell>
                  <TableCell>{linea.subfamilia}</TableCell>
                  <TableCell numeric>
                    {formatCantidad(linea.cantidadSolicitada)} {linea.unidadMedida}
                  </TableCell>
                  <TableCell numeric>{formatCantidad(linea.cantidadOrdenada)}</TableCell>
                  <TableCell numeric className="font-medium">
                    {formatCantidad(linea.cantidadAtendida)}
                  </TableCell>
                  <TableCell numeric>{formatCantidad(linea.cantidadPendienteConOrden)}</TableCell>
                  <TableCell numeric>{formatCantidad(linea.cantidadPendienteSinOrden)}</TableCell>
                  <TableCell>
                    <Badge variant={ESTADO_VARIANT[linea.estado]}>{ESTADO_ATENCION_LABEL[linea.estado]}</Badge>
                  </TableCell>
                </TableRow>
                {abierta && linea.ordenes.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={14} className="bg-muted/20 p-0">
                      <div className="space-y-3 p-4">
                        {linea.ordenes.map((orden) => (
                          <div key={orden.ordenCompraItemId} className="rounded-md border bg-card p-3">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                              <span className="font-mono font-medium">{orden.ocNumero}</span>
                              <span className="text-muted-foreground">{formatDate(orden.ocFecha)}</span>
                              <span>{orden.proveedorNombre}</span>
                              <Badge variant="outline">{orden.ocEstado}</Badge>
                              {orden.cerrado && <Badge variant="secondary">Posición cerrada</Badge>}
                              <span className="ml-auto text-muted-foreground">
                                Ordenado: <span className="font-medium text-foreground">{formatCantidad(orden.cantidadOrdenada)}</span>{" "}
                                · Atendido: <span className="font-medium text-foreground">{formatCantidad(orden.cantidadAtendida)}</span>{" "}
                                · Pendiente: <span className="font-medium text-foreground">{formatCantidad(orden.cantidadPendiente)}</span>
                              </span>
                            </div>
                            {orden.recepciones.length > 0 && (
                              <div className="mt-2 space-y-1 border-t pt-2">
                                {orden.recepciones.map((r, i) => (
                                  <div key={i} className="flex items-center gap-3 pl-4 text-xs text-muted-foreground">
                                    <span className="font-mono">{r.numero}</span>
                                    <span>{formatDate(r.fecha)}</span>
                                    <span className="font-medium text-foreground">{formatCantidad(r.cantidad)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
