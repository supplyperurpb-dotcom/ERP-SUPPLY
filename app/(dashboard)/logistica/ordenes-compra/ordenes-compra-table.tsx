"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Check, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/shared/confirm-dialog-provider";
import { AnularOrdenBoton } from "./aprobar-rechazar-botones";
import { firmarOrdenesCompraMasivoAction } from "@/lib/actions/orden-compra-actions";
import type { EstadoDocumento } from "@prisma/client";

const ESTADO_LABEL: Record<EstadoDocumento, string> = {
  BORRADOR: "Borrador",
  PENDIENTE: "Pendiente VB",
  APROBADO: "Aprobada",
  RECHAZADO: "Rechazada",
  ANULADO: "Anulada",
};

const ESTADO_VARIANT: Record<EstadoDocumento, "success" | "destructive" | "secondary"> = {
  BORRADOR: "secondary",
  PENDIENTE: "secondary",
  APROBADO: "success",
  RECHAZADO: "destructive",
  ANULADO: "destructive",
};

export type FilaOrdenCompra = {
  id: string;
  numero: string;
  categoria: "COMPRA" | "SERVICIO";
  categoriaLabel: string;
  proveedorRazonSocial: string;
  estado: EstadoDocumento;
  fecha: string;
  subtotal: string;
  igv: string;
  montoTotal: string;
  puedeAnular: boolean;
  /** Tiene un rol de aprobación especial propio pendiente en esta orden. */
  puedeFirmar: boolean;
};

// Correlativo de "OC-000004669"/"OS-000004670": los últimos dígitos, sin
// importar el prefijo — para que el orden numérico quede correcto aunque
// se mezclen OC y OS (comparar el texto completo agruparía todas las OC
// antes que las OS, por orden alfabético del prefijo).
function correlativo(numero: string): number {
  const match = numero.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

export function OrdenesCompraTable({ filas }: { filas: FilaOrdenCompra[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);
  const [ordenNumero, setOrdenNumero] = useState<"asc" | "desc" | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const confirmar = useConfirm();

  const filasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    const resultado = termino
      ? filas.filter(
          (f) => f.numero.toLowerCase().includes(termino) || f.proveedorRazonSocial.toLowerCase().includes(termino)
        )
      : filas;
    if (!ordenNumero) return resultado;
    return [...resultado].sort((a, b) =>
      ordenNumero === "asc" ? correlativo(a.numero) - correlativo(b.numero) : correlativo(b.numero) - correlativo(a.numero)
    );
  }, [filas, busqueda, ordenNumero]);

  function alternarOrdenNumero() {
    setOrdenNumero((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  const filasFirmables = useMemo(() => filasFiltradas.filter((f) => f.puedeFirmar), [filasFiltradas]);
  const haySeleccionables = filasFirmables.length > 0;
  const seleccionadasEnVista = seleccionadas.filter((id) => filasFirmables.some((f) => f.id === id));
  const todasSeleccionadas = haySeleccionables && seleccionadasEnVista.length === filasFirmables.length;

  function alternarFila(id: string, marcado: boolean) {
    setSeleccionadas((prev) => (marcado ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  }

  function alternarTodas(marcado: boolean) {
    setSeleccionadas((prev) => {
      const idsVista = filasFirmables.map((f) => f.id);
      if (marcado) return [...new Set([...prev, ...idsVista])];
      return prev.filter((id) => !idsVista.includes(id));
    });
  }

  async function handleAprobarSeleccionadas() {
    const numeros = filas.filter((f) => seleccionadasEnVista.includes(f.id)).map((f) => f.numero);
    if (!(await confirmar(`¿Aprobar ${numeros.length} orden(es)? ${numeros.join(", ")}`))) return;
    startTransition(async () => {
      const resultado = await firmarOrdenesCompraMasivoAction(seleccionadasEnVista);
      if (resultado.aprobadas > 0) toast.success(`${resultado.aprobadas} orden(es) aprobada(s)`);
      for (const error of resultado.errores) toast.error(error);
      setSeleccionadas([]);
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número de OC/OS o proveedor..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8"
          />
        </div>
        {seleccionadasEnVista.length > 0 && (
          <Button disabled={pending} onClick={handleAprobarSeleccionadas}>
            <Check className="mr-2 h-4 w-4" />
            Aprobar seleccionadas ({seleccionadasEnVista.length})
          </Button>
        )}
      </div>

      {filasFiltradas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No se encontró ninguna orden que coincida con &quot;{busqueda}&quot;.
        </p>
      ) : (
        <Table containerClassName="min-h-0 flex-1 rounded-md border">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={alternarOrdenNumero}
                  title="Ordenar por correlativo"
                >
                  Número
                  {ordenNumero === "asc" ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : ordenNumero === "desc" ? (
                    <ArrowDown className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUp className="h-3.5 w-3.5 opacity-30" />
                  )}
                </button>
              </TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-right">IGV</TableHead>
              <TableHead className="text-right">Monto total</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
              {haySeleccionables && (
                <TableHead className="text-center">
                  <Checkbox
                    checked={todasSeleccionadas}
                    onCheckedChange={(marcado) => alternarTodas(!!marcado)}
                    aria-label="Seleccionar todas las aprobables"
                  />
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filasFiltradas.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.numero}</TableCell>
                <TableCell>
                  <Badge variant={f.categoria === "SERVICIO" ? "secondary" : "success"}>{f.categoriaLabel}</Badge>
                </TableCell>
                <TableCell>{f.proveedorRazonSocial}</TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[f.estado]}>{ESTADO_LABEL[f.estado]}</Badge>
                </TableCell>
                <TableCell>{f.fecha}</TableCell>
                <TableCell className="text-right">{f.subtotal}</TableCell>
                <TableCell className="text-right">{f.igv}</TableCell>
                <TableCell className="text-right font-medium">{f.montoTotal}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    {f.puedeAnular && <AnularOrdenBoton id={f.id} numero={f.numero} />}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/logistica/ordenes-compra/${f.id}`}>Ver</Link>
                    </Button>
                  </div>
                </TableCell>
                {haySeleccionables && (
                  <TableCell className="text-center">
                    {f.puedeFirmar && (
                      <Checkbox
                        checked={seleccionadas.includes(f.id)}
                        onCheckedChange={(marcado) => alternarFila(f.id, !!marcado)}
                        aria-label={`Seleccionar ${f.numero} para aprobar`}
                      />
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
