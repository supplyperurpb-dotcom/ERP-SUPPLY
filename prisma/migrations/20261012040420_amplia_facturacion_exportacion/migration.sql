/*
  Warnings:

  - Added the required column `customer` to the `facturacion_exportacion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `destinationCountry` to the `facturacion_exportacion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dispatchDate` to the `facturacion_exportacion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `format` to the `facturacion_exportacion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `market` to the `facturacion_exportacion` table without a default value. This is not possible if the table is not empty.

*/
-- Esta tabla se resincroniza completa desde el Excel (ver
-- scripts/importar-facturacion-exportacion.ts), así que se vacía antes de
-- agregar las columnas nuevas obligatorias en vez de inventar un valor por
-- defecto para las filas ya cargadas.
TRUNCATE TABLE "facturacion_exportacion";

-- AlterTable
ALTER TABLE "facturacion_exportacion" ADD COLUMN     "customer" TEXT NOT NULL,
ADD COLUMN     "destinationCountry" TEXT NOT NULL,
ADD COLUMN     "dispatchDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "format" TEXT NOT NULL,
ADD COLUMN     "market" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "facturacion_exportacion_dispatchDate_idx" ON "facturacion_exportacion"("dispatchDate");

-- CreateIndex
CREATE INDEX "facturacion_exportacion_customer_idx" ON "facturacion_exportacion"("customer");

-- CreateIndex
CREATE INDEX "facturacion_exportacion_market_idx" ON "facturacion_exportacion"("market");

-- CreateIndex
CREATE INDEX "facturacion_exportacion_destinationCountry_idx" ON "facturacion_exportacion"("destinationCountry");
