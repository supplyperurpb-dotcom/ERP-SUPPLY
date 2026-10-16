/*
  Warnings:

  - Added the required column `originPort` to the `facturacion_exportacion` table without a default value. This is not possible if the table is not empty.

*/
-- Tabla espejo de resincronización completa del Excel (ver
-- scripts/importar-facturacion-exportacion.ts): nunca se edita a mano, así
-- que truncarla antes de agregar la columna requerida es seguro — se
-- vuelve a poblar corriendo el script de importación.
TRUNCATE TABLE "facturacion_exportacion";

-- AlterTable
ALTER TABLE "facturacion_exportacion" ADD COLUMN     "originPort" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "facturacion_exportacion_originPort_idx" ON "facturacion_exportacion"("originPort");
