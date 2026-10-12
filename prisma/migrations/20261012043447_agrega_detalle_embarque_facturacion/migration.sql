/*
  Warnings:

  - Added the required column `label` to the `facturacion_exportacion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `po` to the `facturacion_exportacion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `statusEmbarque` to the `facturacion_exportacion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalFob` to the `facturacion_exportacion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `transportMode` to the `facturacion_exportacion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `facturacion_exportacion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `variety` to the `facturacion_exportacion` table without a default value. This is not possible if the table is not empty.

*/
-- Igual que en las migraciones anteriores de esta tabla: se resincroniza
-- completa desde el Excel, así que se vacía antes de agregar columnas
-- obligatorias en vez de inventar un valor para las filas ya cargadas.
TRUNCATE TABLE "facturacion_exportacion";

-- AlterTable
ALTER TABLE "facturacion_exportacion" ADD COLUMN     "label" TEXT NOT NULL,
ADD COLUMN     "po" TEXT NOT NULL,
ADD COLUMN     "statusEmbarque" TEXT NOT NULL,
ADD COLUMN     "totalFob" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "transportMode" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "variety" TEXT NOT NULL,
ADD COLUMN     "weekAta" INTEGER,
ADD COLUMN     "weekEta" INTEGER;

-- CreateIndex
CREATE INDEX "facturacion_exportacion_po_idx" ON "facturacion_exportacion"("po");

-- CreateIndex
CREATE INDEX "facturacion_exportacion_statusEmbarque_idx" ON "facturacion_exportacion"("statusEmbarque");
