-- La migración 20261101130000_proveedor_quita_tipo borró la columna
-- "tipo" de proveedores, pero ese campo SÍ se usa (Acopio filtra
-- proveedores por tipo FUNDO/AMBOS en "Nuevo ingreso" de fruta/IQF, ver
-- app/(dashboard)/acopio/ingreso*/) — se revierte recreando la columna
-- con los mismos valores que tenía antes de borrarla.

-- RecreateEnum
CREATE TYPE "TipoProveedor" AS ENUM ('INSUMOS', 'FUNDO', 'AMBOS', 'TRANSPORTE', 'MATERIALES_EMPAQUE', 'ALMACEN');

-- AlterTable: se agrega nullable primero para poder rellenarla antes de exigir NOT NULL
ALTER TABLE "proveedores" ADD COLUMN "tipo" "TipoProveedor";

-- Backfill de los 5 proveedores "semilla" que ya existían antes de la
-- importación masiva (sus valores originales, por numeroDocumento)
UPDATE "proveedores" SET "tipo" = 'FUNDO' WHERE "numeroDocumento" IN ('20000000001', 'PENDIENTE-PAPITO');
UPDATE "proveedores" SET "tipo" = 'MATERIALES_EMPAQUE' WHERE "numeroDocumento" = '20100000002';
UPDATE "proveedores" SET "tipo" = 'INSUMOS' WHERE "numeroDocumento" IN ('20100000001', '20100000003');

-- Backfill del resto (los 267 importados del Excel, y cualquier fila que
-- falte): mismo criterio que usó scripts/importar-proveedores.ts al
-- crearlos (TRANSPORTE si el rubro lo menciona, si no INSUMOS)
UPDATE "proveedores" SET "tipo" = 'TRANSPORTE' WHERE "tipo" IS NULL AND "rubro" ILIKE '%TRANSPORTE%';
UPDATE "proveedores" SET "tipo" = 'INSUMOS' WHERE "tipo" IS NULL;

-- AlterTable: ahora sí, NOT NULL
ALTER TABLE "proveedores" ALTER COLUMN "tipo" SET NOT NULL;
