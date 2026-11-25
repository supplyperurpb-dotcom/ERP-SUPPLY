"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCantidad, formatDate, formatMoneda } from "@/lib/utils";
import type { FilaProgramaEntregas } from "@/lib/programa-entregas";
import type { EstadoDocumento, EstadoEntregaProgramada } from "@prisma/client";

const ESTADO_OC_LABEL: Record<EstadoDocumento, string> = {
  BORRADOR: "Borrador",
  PENDIENTE: "Pendiente VB",
  APROBADO: "Aprobada",
  RECHAZADO: "Rechazada",
  ANULADO: "Anulada",
};

const ESTADO_OC_VARIANT: Record<EstadoDocumento, "success" | "destructive" | "secondary"> = {
  BORRADOR: "secondary",
  PENDIENTE: "secondary",
  APROBADO: "success",
  RECHAZADO: "destructive",
  ANULADO: "destructive",
};

const ESTADO_ENTREGA_LABEL: Record<EstadoEntregaProgramada, string> = {
  PROGRAMADA: "Programada",
  ANULADA: "Anulada",
};

const ESTADO_ENTREGA_VARIANT: Record<EstadoEntregaProgramada, "success" | "destructive"> = {
  PROGRAMADA: "success",
  ANULADA: "destructive",
};

function diaKey(fecha: Date): string {
  return format(fecha, "yyyy-MM-dd");
}

function filaCols(f: FilaProgramaEntregas, mostrarFecha: boolean) {
  return (
    <TableRow key={f.id}>
      {mostrarFecha && <TableCell>{formatDate(f.fechaTentativa)}</TableCell>}
      <TableCell>
        <Link href={`/logistica/ordenes-compra/${f.ordenCompraId}`} className="text-primary hover:underline">
          {f.numeroOC}
        </Link>
      </TableCell>
      <TableCell>{f.proveedorRazonSocial}</TableCell>
      <TableCell className="font-medium">{f.codigo}</TableCell>
      <TableCell>{f.descripcion}</TableCell>
      <TableCell>{f.unidadMedida}</TableCell>
      <TableCell className="text-right">{formatCantidad(f.cantidad)}</TableCell>
      <TableCell className="text-right">{formatMoneda(f.precioUnitario, f.moneda)}</TableCell>
      <TableCell className="text-right font-medium">{formatMoneda(f.valor, f.moneda)}</TableCell>
      <TableCell>
        <Badge variant={ESTADO_OC_VARIANT[f.estadoOC]}>{ESTADO_OC_LABEL[f.estadoOC]}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant={ESTADO_ENTREGA_VARIANT[f.estadoEntrega]}>{ESTADO_ENTREGA_LABEL[f.estadoEntrega]}</Badge>
      </TableCell>
    </TableRow>
  );
}

function TablaEntregas({ filas, mostrarFecha = true }: { filas: FilaProgramaEntregas[]; mostrarFecha?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {mostrarFecha && <TableHead>Fecha</TableHead>}
            <TableHead>N.º OC/OS</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>UM</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead className="text-right">Precio unitario</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Estado OC</TableHead>
            <TableHead>Estado programa</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{filas.map((f) => filaCols(f, mostrarFecha))}</TableBody>
      </Table>
    </div>
  );
}

export function ProgramaEntregasView({ filas }: { filas: FilaProgramaEntregas[] }) {
  const [vista, setVista] = useState<"tabla" | "calendario">("tabla");
  const [modoCalendario, setModoCalendario] = useState<"mes" | "semana">("mes");
  const [ancla, setAncla] = useState(new Date());
  const [diaHover, setDiaHover] = useState<string | null>(null);
  const [diaDetalle, setDiaDetalle] = useState<string | null>(null);

  const filasPorDia = useMemo(() => {
    const mapa = new Map<string, FilaProgramaEntregas[]>();
    for (const f of filas) {
      const key = diaKey(f.fechaTentativa);
      const arr = mapa.get(key) ?? [];
      arr.push(f);
      mapa.set(key, arr);
    }
    return mapa;
  }, [filas]);

  const dias = useMemo(() => {
    if (modoCalendario === "semana") {
      return eachDayOfInterval({
        start: startOfWeek(ancla, { weekStartsOn: 1 }),
        end: endOfWeek(ancla, { weekStartsOn: 1 }),
      });
    }
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(ancla), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(ancla), { weekStartsOn: 1 }),
    });
  }, [ancla, modoCalendario]);

  function irAnterior() {
    setAncla((d) => (modoCalendario === "semana" ? subWeeks(d, 1) : subMonths(d, 1)));
  }
  function irSiguiente() {
    setAncla((d) => (modoCalendario === "semana" ? addWeeks(d, 1) : addMonths(d, 1)));
  }

  const filasDelDiaDetalle = diaDetalle ? (filasPorDia.get(diaDetalle) ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {vista === "calendario" ? format(ancla, "MMMM yyyy", { locale: es }) : "Entregas"}
        </h2>
        <div className="flex items-center gap-2">
          {vista === "calendario" && (
            <>
              <div className="flex rounded-md border">
                <Button
                  type="button"
                  variant={modoCalendario === "mes" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setModoCalendario("mes")}
                >
                  Mes
                </Button>
                <Button
                  type="button"
                  variant={modoCalendario === "semana" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setModoCalendario("semana")}
                >
                  Semana
                </Button>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={irAnterior}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setAncla(new Date())}>
                Hoy
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={irSiguiente}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setVista(vista === "tabla" ? "calendario" : "tabla")}
          >
            {vista === "tabla" ? (
              <>
                <CalendarDays className="mr-2 h-4 w-4" />
                Calendario
              </>
            ) : (
              <>
                <LayoutList className="mr-2 h-4 w-4" />
                Tabla
              </>
            )}
          </Button>
        </div>
      </div>

      {vista === "tabla" ? (
        <TablaEntregas filas={filas} />
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
            <div key={d} className="px-1 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {dias.map((dia) => {
            const key = diaKey(dia);
            const filasDia = filasPorDia.get(key) ?? [];
            const valorPorMoneda = new Map<string, number>();
            for (const f of filasDia) valorPorMoneda.set(f.moneda, (valorPorMoneda.get(f.moneda) ?? 0) + f.valor);
            const fueraDeMes = modoCalendario === "mes" && !isSameMonth(dia, ancla);
            const proveedores = [...new Set(filasDia.map((f) => f.proveedorRazonSocial))];
            const ordenes = [...new Set(filasDia.map((f) => f.numeroOC))];

            return (
              <Popover key={key} open={diaHover === key} onOpenChange={(open) => !open && setDiaHover(null)}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onMouseEnter={() => filasDia.length > 0 && setDiaHover(key)}
                    onMouseLeave={() => setDiaHover(null)}
                    onClick={() => filasDia.length > 0 && setDiaDetalle(key)}
                    className={cn(
                      "min-h-24 rounded-md border p-1.5 text-left align-top text-xs transition-colors",
                      fueraDeMes && "bg-muted/40 text-muted-foreground",
                      isToday(dia) && "border-primary",
                      filasDia.length > 0 && "cursor-pointer hover:bg-accent"
                    )}
                  >
                    <p className={cn("font-medium", isToday(dia) && "text-primary")}>{format(dia, "d")}</p>
                    {filasDia.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        <p className="font-medium">
                          {filasDia.length} entrega{filasDia.length === 1 ? "" : "s"}
                        </p>
                        {[...valorPorMoneda.entries()].map(([moneda, valor]) => (
                          <p key={moneda} className="truncate">
                            {formatMoneda(valor, moneda)}
                          </p>
                        ))}
                      </div>
                    )}
                  </button>
                </PopoverTrigger>
                {filasDia.length > 0 && (
                  <PopoverContent className="w-80 space-y-2 text-sm" onMouseEnter={() => setDiaHover(key)} onMouseLeave={() => setDiaHover(null)}>
                    <p className="font-medium">{formatDate(dia)}</p>
                    <p className="text-muted-foreground">
                      {filasDia.length} entrega{filasDia.length === 1 ? "" : "s"} · {proveedores.join(", ")}
                    </p>
                    <ul className="max-h-40 space-y-1 overflow-y-auto">
                      {filasDia.slice(0, 5).map((f) => (
                        <li key={f.id} className="flex justify-between gap-2">
                          <span className="truncate">
                            {f.codigo} · {f.numeroOC} · {formatCantidad(f.cantidad)} {f.unidadMedida}
                          </span>
                          <span className="shrink-0 font-medium">{formatMoneda(f.valor, f.moneda)}</span>
                        </li>
                      ))}
                    </ul>
                    {filasDia.length > 5 && (
                      <p className="text-xs text-muted-foreground">y {filasDia.length - 5} más...</p>
                    )}
                    <p className="text-xs text-muted-foreground">N.º OC/OS: {ordenes.join(", ")}</p>
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setDiaDetalle(key)}>
                      Ver detalle completo
                    </Button>
                  </PopoverContent>
                )}
              </Popover>
            );
          })}
        </div>
      )}

      <Dialog open={!!diaDetalle} onOpenChange={(open) => !open && setDiaDetalle(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Entregas del {diaDetalle && formatDate(new Date(`${diaDetalle}T00:00:00`))}</DialogTitle>
            <DialogDescription>
              {filasDelDiaDetalle.length} entrega{filasDelDiaDetalle.length === 1 ? "" : "s"} programada
              {filasDelDiaDetalle.length === 1 ? "" : "s"} para este día.
            </DialogDescription>
          </DialogHeader>
          <TablaEntregas filas={filasDelDiaDetalle} mostrarFecha={false} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
