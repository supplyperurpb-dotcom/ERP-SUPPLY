/*
  Warnings:

  - Added the required column `settlementStatus` to the `facturacion_exportacion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Esta tabla es un espejo de resync total del Excel (ver
-- scripts/importar-facturacion-exportacion.ts), se vuelve a poblar entera
-- justo después de aplicar esta migración, así que truncar es seguro.
TRUNCATE TABLE "facturacion_exportacion";
ALTER TABLE "facturacion_exportacion" ADD COLUMN     "settlementStatus" TEXT NOT NULL;
