/*
  Warnings:

  - Added the required column `origen` to the `pallets_iqf` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OrigenPalletIQF" AS ENUM ('DESCARTE_CAMPO', 'DESCARTE_PLANTA');

-- DropForeignKey
ALTER TABLE "ingreso_fruta_pallets" DROP CONSTRAINT "ingreso_fruta_pallets_palletId_fkey";

-- AlterTable
ALTER TABLE "ingreso_fruta_pallets" ADD COLUMN     "palletIQFId" TEXT,
ALTER COLUMN "palletId" DROP NOT NULL;

-- AlterTable
-- Antes de esta migración todo pallet IQF venía de Ingreso IQF (Descarte
-- Planta), así que las filas existentes se rellenan con ese valor.
ALTER TABLE "pallets_iqf" ADD COLUMN     "origen" "OrigenPalletIQF" NOT NULL DEFAULT 'DESCARTE_PLANTA';

ALTER TABLE "pallets_iqf" ALTER COLUMN "origen" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "ingreso_fruta_pallets" ADD CONSTRAINT "ingreso_fruta_pallets_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "pallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso_fruta_pallets" ADD CONSTRAINT "ingreso_fruta_pallets_palletIQFId_fkey" FOREIGN KEY ("palletIQFId") REFERENCES "pallets_iqf"("id") ON DELETE SET NULL ON UPDATE CASCADE;
