"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSearch } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { agregarServicioGestionadoAction } from "@/lib/actions/servicio-gestionado-actions";

export type OrdenServicioDisponible = {
  id: string;
  numero: string;
  proveedorRazonSocial: string;
  fecha: string;
  montoTotal: string;
};

// Selector de UNA orden de servicio ya aprobada (ver
// ordenesServicioDisponiblesParaGestion) — clic en la fila para elegirla,
// "Agregar" la registra en el módulo (ver agregarServicioGestionadoAction),
// "Cancelar" cierra sin hacer nada. Pedido explícito: estos son los 2
// únicos botones de este diálogo.
export function AgregarServicioDialog({ ordenes }: { ordenes: OrdenServicioDisponible[] }) {
  const [open, setOpen] = useState(false);
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const ordenesFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return ordenes;
    return ordenes.filter(
      (o) => o.numero.toLowerCase().includes(termino) || o.proveedorRazonSocial.toLowerCase().includes(termino)
    );
  }, [ordenes, busqueda]);

  function handleOpenChange(valor: boolean) {
    setOpen(valor);
    if (!valor) {
      setSeleccionadaId(null);
      setBusqueda("");
    }
  }

  function handleAgregar() {
    if (!seleccionadaId) return;
    startTransition(async () => {
      const resultado = await agregarServicioGestionadoAction(seleccionadaId);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Servicio agregado a Gestión de Servicios");
      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Agregar Servicio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Agregar servicio</DialogTitle>
        </DialogHeader>

        {ordenes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay órdenes de servicio aprobadas disponibles para agregar.
          </p>
        ) : (
          <>
            <TableSearch
              placeholder="Buscar por N.º de orden o proveedor..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="mb-3 max-w-none"
            />
            <div className="max-h-[420px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/40">
                  <TableRow>
                    <TableHead>N.º de orden</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead numeric>Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenesFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        Ningún resultado coincide con la búsqueda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ordenesFiltradas.map((orden) => (
                      <TableRow
                        key={orden.id}
                        className={cn("cursor-pointer", seleccionadaId === orden.id && "bg-muted")}
                        onClick={() => setSeleccionadaId(orden.id)}
                      >
                        <TableCell className="font-mono font-medium">{orden.numero}</TableCell>
                        <TableCell>{orden.proveedorRazonSocial}</TableCell>
                        <TableCell>{orden.fecha}</TableCell>
                        <TableCell numeric>{orden.montoTotal}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!seleccionadaId || pending} onClick={handleAgregar}>
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
