import Link from "next/link";
import { Button } from "@/components/ui/button";

// Paginación simple (Anterior/Siguiente) para listados grandes. Preserva
// cualquier filtro ya presente en la URL (fechas, búsqueda, etc.) y solo
// cambia el parámetro "pagina".
export function PaginationControls({
  paginaActual,
  totalPaginas,
  total,
  searchParams,
}: {
  paginaActual: number;
  totalPaginas: number;
  total: number;
  searchParams: Record<string, string | undefined>;
}) {
  if (totalPaginas <= 1) return null;

  function hrefPagina(pagina: number) {
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(searchParams)) {
      if (valor) params.set(clave, valor);
    }
    params.set("pagina", String(pagina));
    return `?${params.toString()}`;
  }

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <p>
        Página {paginaActual} de {totalPaginas} ({total} resultados)
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={paginaActual <= 1} asChild={paginaActual > 1}>
          {paginaActual > 1 ? <Link href={hrefPagina(paginaActual - 1)}>Anterior</Link> : <span>Anterior</span>}
        </Button>
        <Button variant="outline" size="sm" disabled={paginaActual >= totalPaginas} asChild={paginaActual < totalPaginas}>
          {paginaActual < totalPaginas ? (
            <Link href={hrefPagina(paginaActual + 1)}>Siguiente</Link>
          ) : (
            <span>Siguiente</span>
          )}
        </Button>
      </div>
    </div>
  );
}

export const REGISTROS_POR_PAGINA = 50;

export function calcularPagina(paginaParam: string | undefined): number {
  const pagina = Number(paginaParam);
  return Number.isFinite(pagina) && pagina >= 1 ? Math.floor(pagina) : 1;
}
