-- Cada línea de Ingreso de Almacén registra el Área que solicitó ese
-- producto (jalada de la Solicitud de Pedido detrás de la OC, ver
-- crearIngresoAlmacenAction) — para poder filtrar qué stock le pertenece
-- a cada área. Nullable y sin backfill: los ingresos ya registrados (y
-- los que vengan de una OC "directa", sin Solped detrás) quedan en null.
ALTER TABLE "ingreso_almacen_items" ADD COLUMN     "area" TEXT;
ALTER TABLE "ingreso_almacen_items" ADD COLUMN     "areaDetalle" TEXT;
