"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Proveedor } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/buttons";
import { ActivoBadge } from "@/components/ui/estado-badge";
import {
  DataTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSearch,
  TablePagination,
  TableActions,
  TableEmptyState,
} from "@/components/ui/data-table";
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
  const [exportando, setExportando] = useState(false);
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

  async function handleExportar() {
    setExportando(true);
    try {
      const XLSX = await import("xlsx");
      const filas = proveedores.map((p) => ({
        Procedencia: p.procedencia,
        "Tipo de documento": p.tipoDocumento,
        "Número de documento": p.numeroDocumento,
        "Razón social": p.razonSocial,
        "Nombre comercial": p.nombreComercial ?? "",
        Tipo: TIPO_LABEL[p.tipo],
        Rubro: p.rubro ?? "",
        Dirección: p.direccion,
        Lugar: p.lugar ?? "",
        Teléfono: p.telefono,
        Email: p.email,
        Contacto: p.contactoNombre,
        "Condición de pago": p.condicionPago,
        Estado: p.activo ? "Activo" : "Inactivo",
      }));
      const hoja = XLSX.utils.json_to_sheet(filas);
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Proveedores");
      const fecha = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(libro, `proveedores_${fecha}.xlsx`);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <TableSearch
          placeholder="Buscar por razón social, RUC/DNI, rubro o lugar..."
          value={busqueda}
          onChange={(e) => cambiarBusqueda(e.target.value)}
        />
        <Button variant="outline" onClick={handleExportar} disabled={exportando}>
          <Download className="mr-2 h-4 w-4" />
          {exportando ? "Exportando..." : "Exportar"}
        </Button>
      </div>

      <DataTable>
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
              <TableCell className="font-mono font-medium">
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
                <ActivoBadge activo={proveedor.activo} />
              </TableCell>
              <TableCell>
                <TableActions>
                  <ProveedorFormDialog proveedor={proveedor} />
                  <IconButton disabled={isPending} onClick={() => handleEliminar(proveedor.id, proveedor.razonSocial)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </IconButton>
                </TableActions>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>

      {proveedoresFiltrados.length === 0 && <TableEmptyState mensaje="Ningún proveedor coincide con la búsqueda." />}

      <TablePagination
        paginaActual={paginaActual}
        totalPaginas={totalPaginas}
        total={proveedoresFiltrados.length}
        entidad="proveedores"
        onCambiarPagina={setPagina}
      />
    </div>
  );
}
