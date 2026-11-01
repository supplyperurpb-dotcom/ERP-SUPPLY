"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Proveedor } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { eliminarProveedorAction } from "@/lib/actions/proveedor-actions";
import { useConfirm } from "@/components/shared/confirm-dialog-provider";
import { ProveedorFormDialog } from "./proveedor-form-dialog";

const POR_PAGINA = 50;

const TIPO_LABEL: Record<Proveedor["tipo"], string> = {
  INSUMOS: "Insumos",
  FUNDO: "Fundo",
  AMBOS: "Ambos",
  TRANSPORTE: "Transporte",
  MATERIALES_EMPAQUE: "Materiales de Empaque",
  ALMACEN: "Almacén",
};

export function ProveedorTable({ proveedores }: { proveedores: Proveedor[] }) {
  const [isPending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const confirmar = useConfirm();

  const proveedoresFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return proveedores;
    return proveedores.filter(
      (p) =>
        p.razonSocial.toLowerCase().includes(termino) ||
        (p.nombreComercial ?? "").toLowerCase().includes(termino) ||
        p.numeroDocumento.toLowerCase().includes(termino) ||
        (p.rubro ?? "").toLowerCase().includes(termino) ||
        (p.lugar ?? "").toLowerCase().includes(termino)
    );
  }, [proveedores, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(proveedoresFiltrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const proveedoresPagina = proveedoresFiltrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  function cambiarBusqueda(valor: string) {
    setBusqueda(valor);
    setPagina(1);
  }

  async function handleEliminar(id: string, razonSocial: string) {
    if (!(await confirmar(`¿Eliminar el proveedor ${razonSocial}? Esta acción no se puede deshacer.`))) return;
    startTransition(async () => {
      await eliminarProveedorAction(id);
      toast.success("Proveedor eliminado");
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por razón social, RUC/DNI, rubro o lugar..."
          value={busqueda}
          onChange={(e) => cambiarBusqueda(e.target.value)}
          className="pl-8"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Documento</TableHead>
            <TableHead>Razón social</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Rubro</TableHead>
            <TableHead>Lugar</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {proveedoresPagina.map((proveedor) => (
            <TableRow key={proveedor.id}>
              <TableCell className="font-medium">
                {proveedor.tipoDocumento} {proveedor.numeroDocumento}
              </TableCell>
              <TableCell>
                {proveedor.razonSocial}
                {proveedor.nombreComercial && (
                  <p className="text-xs text-muted-foreground">{proveedor.nombreComercial}</p>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{TIPO_LABEL[proveedor.tipo]}</Badge>
              </TableCell>
              <TableCell>{proveedor.rubro || "—"}</TableCell>
              <TableCell>{proveedor.lugar || "—"}</TableCell>
              <TableCell>{proveedor.telefono || proveedor.email || "—"}</TableCell>
              <TableCell>
                <Badge variant={proveedor.activo ? "success" : "secondary"}>
                  {proveedor.activo ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-1">
                <ProveedorFormDialog proveedor={proveedor} />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={() => handleEliminar(proveedor.id, proveedor.razonSocial)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {proveedoresFiltrados.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Ningún proveedor coincide con la búsqueda.</p>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <p>
            Página {paginaActual} de {totalPaginas} ({proveedoresFiltrados.length} proveedores)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={paginaActual <= 1} onClick={() => setPagina(paginaActual - 1)}>
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={paginaActual >= totalPaginas}
              onClick={() => setPagina(paginaActual + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
