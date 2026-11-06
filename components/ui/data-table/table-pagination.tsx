import { Button } from "@/components/ui/button";

/**
 * Paginación Anterior/Siguiente para tablas con filtro y estado en cliente
 * (ver `proveedor-table.tsx`). Para listados paginados por la URL (server
 * component + searchParams) usa en cambio `PaginationControls` de
 * `components/shared/pagination-controls.tsx` — no lo reemplaza, porque
 * ese maneja navegación por `Link`, no `onClick`.
 */
export function TablePagination({
  paginaActual,
  totalPaginas,
  total,
  entidad = "resultados",
  onCambiarPagina,
}: {
  paginaActual: number;
  totalPaginas: number;
  total: number;
  entidad?: string;
  onCambiarPagina: (pagina: number) => void;
}) {
  if (totalPaginas <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
      <p>
        Página {paginaActual} de {totalPaginas} ({total} {entidad})
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={paginaActual <= 1} onClick={() => onCambiarPagina(paginaActual - 1)}>
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={paginaActual >= totalPaginas}
          onClick={() => onCambiarPagina(paginaActual + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
