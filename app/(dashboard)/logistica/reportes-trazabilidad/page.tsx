import { PageHeader } from "@/components/shared/page-header";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { fechaHoyPeru } from "@/lib/utils";
import { calcularTrazabilidad, obtenerOpcionesFiltroTrazabilidad, type EstadoAtencionLinea } from "@/lib/trazabilidad";
import { FiltrosTrazabilidadBar } from "./filtros-trazabilidad";
import { ResumenTrazabilidadCards } from "./resumen-trazabilidad";
import { TablaTrazabilidad } from "./tabla-trazabilidad";

const POR_PAGINA = 50;

export default async function ReportesTrazabilidadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  // Por defecto (campo ausente de la URL) se cae a "hoy" — mismo criterio
  // que el resto de los filtros de fecha del sistema, aplicado acá a cada
  // uno de los 2 rangos (Creación/Aprobación) por separado.
  const filtros = {
    creacionDesde: sp.creacionDesde ?? fechaHoyPeru(),
    creacionHasta: sp.creacionHasta ?? fechaHoyPeru(),
    aprobacionDesde: sp.aprobacionDesde ?? fechaHoyPeru(),
    aprobacionHasta: sp.aprobacionHasta ?? fechaHoyPeru(),
    familia: sp.familia,
    subfamilia: sp.subfamilia,
    codigo: sp.codigo,
    requerimiento: sp.requerimiento,
    ordenCompra: sp.ordenCompra,
    proveedor: sp.proveedor,
    estadoAtencion: sp.estadoAtencion as EstadoAtencionLinea | undefined,
  };

  const [{ lineas, resumen }, opciones] = await Promise.all([
    calcularTrazabilidad(filtros),
    obtenerOpcionesFiltroTrazabilidad(),
  ]);

  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const totalPaginas = Math.max(1, Math.ceil(lineas.length / POR_PAGINA));
  const lineasPagina = lineas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <div>
      <PageHeader
        titulo="Reportes de Trazabilidad"
        descripcion="Qué se solicitó, cuándo se aprobó, si ya tiene orden de compra, cuánto se atendió y cuánto queda pendiente."
      />

      <FiltrosTrazabilidadBar valores={filtros} opciones={opciones} />

      <ResumenTrazabilidadCards resumen={resumen} />

      <TablaTrazabilidad lineas={lineasPagina} />

      <div className="mt-3">
        <PaginationControls paginaActual={pagina} totalPaginas={totalPaginas} total={lineas.length} searchParams={sp} />
      </div>
    </div>
  );
}
