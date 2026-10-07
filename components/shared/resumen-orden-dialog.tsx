"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ResumenOrdenItem = {
  codigo: string;
  descripcion: string;
  descripcionServicio: string | null;
  unidadMedida: string;
  cantidad: number;
  subtotal: number;
};

export type ResumenOrden = {
  id: string;
  numero: string;
  esServicio: boolean;
  proveedor: string;
  fecha: string;
  estadoLabel: string;
  moneda: string;
  items: ResumenOrdenItem[];
};

/** Vista previa de una OC/OS sin salir de donde se está (ver seguimiento-orden-dialog / seguimiento-pedido-dialog). */
export function ResumenOrdenDialog({ resumen, onClose }: { resumen: ResumenOrden | null; onClose: () => void }) {
  const router = useRouter();

  return (
    <Dialog open={!!resumen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {resumen && (
          <>
            <DialogHeader>
              <DialogTitle>Resumen de {resumen.numero}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Proveedor</p>
                <p className="font-medium">{resumen.proveedor}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fecha</p>
                <p className="font-medium">{resumen.fecha}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Estatus</p>
                <p className="font-medium">{resumen.estadoLabel}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Moneda</p>
                <p className="font-medium">{resumen.moneda}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descripción</TableHead>
                    {resumen.esServicio && <TableHead>Descripción del servicio</TableHead>}
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumen.items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{item.codigo}</TableCell>
                      <TableCell>{item.descripcion}</TableCell>
                      {resumen.esServicio && (
                        <TableCell className="max-w-xs whitespace-pre-wrap">{item.descripcionServicio || "—"}</TableCell>
                      )}
                      <TableCell className="text-right">
                        {item.cantidad} {item.unidadMedida}
                      </TableCell>
                      <TableCell className="text-right">{item.subtotal.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button onClick={() => router.push(`/logistica/ordenes-compra/${resumen.id}`)}>
                Ir a vista {resumen.esServicio ? "OS" : "OC"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
