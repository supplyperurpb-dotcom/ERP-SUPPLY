"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { agregarItemsServicioGestionadoAction } from "@/lib/actions/servicio-gestionado-actions";

export type ItemOcDisponible = { id: string; codigo: string; descripcion: string; cantidad: string };

// Elegir una o varias líneas de la OS (las que ya están en seguimiento no
// llegan acá, ver page.tsx) — "Seleccionar todos" alterna todo de una,
// "Añadir"/"Cancelar" son los 2 únicos botones, pedido explícito.
export function AnadirItemsDialog({ servicioGestionadoId, items }: { servicioGestionadoId: string; items: ItemOcDisponible[] }) {
  const [open, setOpen] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpenChange(valor: boolean) {
    setOpen(valor);
    if (!valor) setSeleccionados(new Set());
  }

  function toggleTodos() {
    setSeleccionados((actual) => (actual.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }

  function toggleUno(id: string) {
    setSeleccionados((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) {
        nuevo.delete(id);
      } else {
        nuevo.add(id);
      }
      return nuevo;
    });
  }

  function handleAnadir() {
    if (seleccionados.size === 0) return;
    startTransition(async () => {
      const resultado = await agregarItemsServicioGestionadoAction(servicioGestionadoId, Array.from(seleccionados));
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Ítems añadidos");
      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Añadir Items
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Añadir ítems</DialogTitle>
        </DialogHeader>

        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Todos los ítems de esta orden ya están en seguimiento.</p>
        ) : (
          <>
            <Button type="button" variant="outline" size="sm" onClick={toggleTodos} className="w-fit">
              {seleccionados.size === items.length ? "Quitar selección" : "Seleccionar todos"}
            </Button>
            <div className="max-h-[400px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/40">
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Código</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="cursor-pointer" onClick={() => toggleUno(item.id)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={seleccionados.has(item.id)} onCheckedChange={() => toggleUno(item.id)} />
                      </TableCell>
                      <TableCell className="font-mono font-medium">{item.codigo}</TableCell>
                      <TableCell>{item.descripcion}</TableCell>
                      <TableCell>{item.cantidad}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={seleccionados.size === 0 || pending} onClick={handleAnadir}>
            Añadir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
