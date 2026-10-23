"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Search } from "lucide-react";
import { toast } from "sonner";
import type { Sku } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { crearSkusNoValoradosAction } from "@/lib/actions/sku-actions";

export function CrearSkuNoValoradoDialog({ skus }: { skus: Sku[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const codigosExistentes = useMemo(() => new Set(skus.map((s) => s.codigo)), [skus]);

  // Elegibles: no son Servicios (sin versión no valorada), no son ya una
  // versión NV, y todavía no tienen su NV creado.
  const elegibles = useMemo(
    () =>
      skus.filter(
        (s) => s.categoria !== "Servicios" && !s.codigo.startsWith("NV") && !codigosExistentes.has(`NV${s.codigo}`)
      ),
    [skus, codigosExistentes]
  );

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return elegibles;
    return elegibles.filter(
      (s) => s.codigo.toLowerCase().includes(termino) || s.descripcion.toLowerCase().includes(termino)
    );
  }, [elegibles, busqueda]);

  function alternar(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCrear() {
    const ids = Array.from(seleccionados);
    if (ids.length === 0) return;
    startTransition(async () => {
      const resultado = await crearSkusNoValoradosAction(ids);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      const partes = [`${resultado?.creados ?? 0} código(s) no valorado(s) creado(s)`];
      if (resultado?.omitidos && resultado.omitidos.length > 0) {
        partes.push(`${resultado.omitidos.length} omitido(s): ${resultado.omitidos.join("; ")}`);
      }
      toast.success(partes.join(". "));
      setSeleccionados(new Set());
      setBusqueda("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Copy className="mr-2 h-4 w-4" />
          Crear Código No Valorado
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Crear código no valorado</DialogTitle>
          <DialogDescription>
            Elige uno o más códigos ya creados. El código no valorado es el mismo código con &quot;NV&quot; delante
            (p. ej. AGFO0001 → NVAGFO0001).
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>UM</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    No hay códigos disponibles para crear su versión no valorada.
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((sku) => (
                  <TableRow key={sku.id} className="cursor-pointer" onClick={() => alternar(sku.id)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={seleccionados.has(sku.id)} onCheckedChange={() => alternar(sku.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{sku.codigo}</TableCell>
                    <TableCell>{sku.descripcion}</TableCell>
                    <TableCell>{sku.unidadMedida}</TableCell>
                    <TableCell>
                      <Badge variant={sku.activo ? "success" : "secondary"}>{sku.activo ? "Activo" : "Inactivo"}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{seleccionados.size} seleccionado(s)</p>
          <Button onClick={handleCrear} disabled={seleccionados.size === 0 || isPending}>
            {isPending ? "Creando..." : "Crear NV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
