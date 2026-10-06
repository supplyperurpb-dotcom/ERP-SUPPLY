-- CreateEnum
CREATE TYPE "TipoLista" AS ENUM ('CENTRO_COSTO', 'CAMPO');

-- CreateTable
CREATE TABLE "lista_valores" (
    "id" TEXT NOT NULL,
    "tipo" "TipoLista" NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lista_valores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lista_valores_tipo_nombre_key" ON "lista_valores"("tipo", "nombre");

-- Seed: catálogo inicial de Centro de costo, copiando los valores que
-- tenía el enum AreaEmpresa (ya con el nombre "bonito" en vez del código).
INSERT INTO "lista_valores" ("id", "tipo", "nombre", "orden", "updatedAt") VALUES
  (gen_random_uuid()::text, 'CENTRO_COSTO', 'Producción', 0, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CENTRO_COSTO', 'Supply Chain', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CENTRO_COSTO', 'Finanzas', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CENTRO_COSTO', 'Gerencia General', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CENTRO_COSTO', 'Servicios Generales', 4, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CENTRO_COSTO', 'RRHH', 5, CURRENT_TIMESTAMP);

-- Seed: catálogo inicial de Campo/Fundo, copiando CAMPOS_SOLPED
-- (lib/constants/compras.ts), que dejó de usarse como lista fija.
INSERT INTO "lista_valores" ("id", "tipo", "nombre", "orden", "updatedAt") VALUES
  (gen_random_uuid()::text, 'CAMPO', 'Achirana Blue', 0, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CAMPO', 'Papito', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CAMPO', 'San Antonio Conv.', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CAMPO', 'San Antonio Org.', 3, CURRENT_TIMESTAMP);

-- AlterTable: centroCosto pasa de enum AreaEmpresa a texto libre (catálogo
-- CENTRO_COSTO). Se castea en vez de recrear la columna para no perder los
-- documentos ya existentes, y de paso se traducen sus códigos de enum
-- (p. ej. "PRODUCCION") al nombre "bonito" sembrado arriba (p. ej.
-- "Producción"), para que historial y catálogo queden consistentes.
ALTER TABLE "solicitud_pedido_items" ALTER COLUMN "centroCosto" TYPE TEXT USING "centroCosto"::TEXT;
ALTER TABLE "orden_compra_items" ALTER COLUMN "centroCosto" TYPE TEXT USING "centroCosto"::TEXT;

UPDATE "solicitud_pedido_items" SET "centroCosto" = CASE "centroCosto"
  WHEN 'PRODUCCION' THEN 'Producción'
  WHEN 'SUPPLY_CHAIN' THEN 'Supply Chain'
  WHEN 'FINANZAS' THEN 'Finanzas'
  WHEN 'GERENCIA_GENERAL' THEN 'Gerencia General'
  WHEN 'SERVICIOS_GENERALES' THEN 'Servicios Generales'
  WHEN 'RRHH' THEN 'RRHH'
  ELSE "centroCosto"
END;

UPDATE "orden_compra_items" SET "centroCosto" = CASE "centroCosto"
  WHEN 'PRODUCCION' THEN 'Producción'
  WHEN 'SUPPLY_CHAIN' THEN 'Supply Chain'
  WHEN 'FINANZAS' THEN 'Finanzas'
  WHEN 'GERENCIA_GENERAL' THEN 'Gerencia General'
  WHEN 'SERVICIOS_GENERALES' THEN 'Servicios Generales'
  WHEN 'RRHH' THEN 'RRHH'
  ELSE "centroCosto"
END;
