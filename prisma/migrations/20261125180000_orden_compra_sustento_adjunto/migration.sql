-- Sustento adjunto al generar la orden de compra/servicio (pedido explícito,
-- 2026-11-25): un archivo por orden, ruta dentro del bucket privado (ver
-- lib/storage.ts). Nullable a nivel de base para no romper órdenes previas;
-- la obligatoriedad para órdenes nuevas se valida en la app (zod).
ALTER TABLE "ordenes_compra" ADD COLUMN "archivo" TEXT;
ALTER TABLE "ordenes_compra" ADD COLUMN "nombreArchivo" TEXT;
