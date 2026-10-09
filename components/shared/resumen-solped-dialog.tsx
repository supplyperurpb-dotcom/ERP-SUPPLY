"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCantidad } from "@/lib/utils";

export type ResumenSolpedItem = {
  codigo: string;
  descripcion: string;
  descripcionServicio: string | null;
  unidadMedida: string;
  cantidad: number;
};

export type ResumenSolped = {
  id: string;
  numero: string;
  categoriaLabel: string;
  esServicio: boolean;
  area: string;
  fecha: string;
  estadoLabel: string;
  items: ResumenSolpedItem[];
};

/** Vista previa de una Solped sin salir de donde se está (ver seguimiento-orden-dialog / seguimiento-pedido-dialog). */
export function ResumenSolpedDialog({ resumen, onClose }: { resumen: ResumenSolped | null; onClose: () => void }) {
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
                <p className="text-muted-foreground">Categoría</p>
                <p className="font-medium">{resumen.categoriaLabel}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Área</p>
                <p className="font-medium">{resumen.area}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fecha</p>
                <p className="font-medium">{resumen.fecha}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Estatus</p>
                <p className="font-medium">{resumen.estadoLabel}</p>
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
                    <TableHead>U.M.</TableHead>
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
                      <TableCell className="text-right">{formatCantidad(item.cantidad)}</TableCell>
                      <TableCell>{item.unidadMedida}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button onClick={() => router.push(`/logistica/solicitudes-pedido/${resumen.id}`)}>
                Ir a vista Solped
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
