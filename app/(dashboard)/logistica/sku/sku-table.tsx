"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Sku } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { crearSkusNoValoradosAction, eliminarSkuAction } from "@/lib/actions/sku-actions";
import { SkuFormDialog } from "./sku-form-dialog";

const POR_PAGINA = 50;

export function SkuTable({ skus, esAdmin }: { skus: Sku[]; esAdmin: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);

  const codigosExistentes = useMemo(() => new Set(skus.map((s) => s.codigo)), [skus]);

  const skusFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return skus;
    return skus.filter(
      (sku) => sku.codigo.toLowerCase().includes(termino) || sku.descripcion.toLowerCase().includes(termino)
    );
  }, [skus, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(skusFiltrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const skusPagina = skusFiltrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  function cambiarBusqueda(valor: string) {
    setBusqueda(valor);
    setPagina(1);
  }

  function handleEliminar(id: string, codigo: string) {
    if (!confirm(`¿Eliminar el SKU ${codigo}? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      const resultado = await eliminarSkuAction(id);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("SKU eliminado");
    });
  }

  // Elegible para versión no valorada: no es Servicios (sin NV), no es ya
  // una versión NV, y todavía no tiene su NV creado.
  function puedeCrearNv(sku: Sku) {
    return sku.categoria !== "Servicios" && !sku.codigo.startsWith("NV") && !codigosExistentes.has(`NV${sku.codigo}`);
  }

  function handleCrearNv(id: string, codigo: string) {
    if (!confirm(`¿Seguro que quiere crear un Código No Valorado para este SKU?`)) return;
    startTransition(async () => {
      const resultado = await crearSkusNoValoradosAction([id]);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      if (resultado?.omitidos && resultado.omitidos.length > 0) {
        toast.error(resultado.omitidos[0]);
        return;
      }
      toast.success(`NV${codigo} creado`);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative max-w-sm shrink-0">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por código o nombre..."
          value={busqueda}
          onChange={(e) => cambiarBusqueda(e.target.value)}
          className="pl-8"
        />
      </div>

      {skusFiltrados.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No se encontró ningún SKU que coincida con &quot;{busqueda}&quot;.
        </p>
      ) : (
        <Table containerClassName="min-h-0 flex-1 rounded-md border">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Subfamilia</TableHead>
              <TableHead>Estado</TableHead>
              {esAdmin && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {skusPagina.map((sku) => (
              <TableRow key={sku.id}>
                <TableCell className="font-medium">{sku.codigo}</TableCell>
                <TableCell>{sku.descripcion}</TableCell>
                <TableCell>{sku.categoria}</TableCell>
                <TableCell>{sku.unidadMedida}</TableCell>
                <TableCell>{sku.subfamilia}</TableCell>
                <TableCell>
                  <Badge variant={sku.activo ? "success" : "secondary"}>{sku.activo ? "Activo" : "Inactivo"}</Badge>
                </TableCell>
                {esAdmin && (
                  <TableCell className="flex justify-end gap-1">
                    {puedeCrearNv(sku) && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        title="Crear código no valorado"
                        onClick={() => handleCrearNv(sku.id, sku.codigo)}
                      >
                        NV
                      </Button>
                    )}
                    <SkuFormDialog sku={sku} />
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isPending}
                      onClick={() => handleEliminar(sku.id, sku.codigo)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {skusFiltrados.length > 0 && (
        <div className="flex shrink-0 items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>
            {skusFiltrados.length} código{skusFiltrados.length === 1 ? "" : "s"} · Página {paginaActual} de {totalPaginas}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={paginaActual <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={paginaActual >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
