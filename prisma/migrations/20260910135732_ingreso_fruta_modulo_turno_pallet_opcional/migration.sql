/*
  Warnings:

  - Added the required column `modulo` to the `ingresos_fruta` table without a default value. This is not possible if the table is not empty.
  - Added the required column `turno` to the `ingresos_fruta` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ingreso_fruta_pallets" DROP CONSTRAINT "ingreso_fruta_pallets_tipoPalletId_fkey";

-- AlterTable
ALTER TABLE "ingreso_fruta_pallets" ALTER COLUMN "tipoPalletId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ingresos_fruta" ADD COLUMN     "modulo" TEXT NOT NULL,
ADD COLUMN     "turno" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "ingreso_fruta_pallets" ADD CONSTRAINT "ingreso_fruta_pallets_tipoPalletId_fkey" FOREIGN KEY ("tipoPalletId") REFERENCES "tipos_pallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
