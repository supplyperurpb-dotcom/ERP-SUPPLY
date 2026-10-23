-- Elimina la dinámica de "Solicitud de Traslado": el Traslado entre
-- almacenes pasa a ser una operación directa, igual que Consumo, sin paso
-- de solicitud/aprobación previo.

-- Quita las columnas que enlazaban un traslado con la solicitud de la que
-- se había ejecutado (los traslados ya registrados conservan sus datos:
-- número, almacenes, ítems, costos; solo pierden esa referencia).
ALTER TABLE "traslado_almacen_items" DROP CONSTRAINT IF EXISTS "traslado_almacen_items_solicitudTrasladoItemId_fkey";
ALTER TABLE "traslado_almacen_items" DROP COLUMN IF EXISTS "solicitudTrasladoItemId";

ALTER TABLE "traslados_almacen" DROP CONSTRAINT IF EXISTS "traslados_almacen_solicitudTrasladoId_fkey";
ALTER TABLE "traslados_almacen" DROP COLUMN IF EXISTS "solicitudTrasladoId";

-- Borra las tablas de Solicitud de Traslado por completo.
DROP TABLE IF EXISTS "solicitud_traslado_items";
DROP TABLE IF EXISTS "solicitudes_traslado";
