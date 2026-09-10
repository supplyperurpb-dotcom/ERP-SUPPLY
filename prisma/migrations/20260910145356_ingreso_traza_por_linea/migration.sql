/*
  Warnings:

  - You are about to drop the column `modulo` on the `ingresos_fruta` table. All the data in the column will be lost.
  - You are about to drop the column `turno` on the `ingresos_fruta` table. All the data in the column will be lost.
  - You are about to drop the column `variedad` on the `ingresos_fruta` table. All the data in the column will be lost.
  - Added the required column `modulo` to the `ingreso_fruta_pallets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `turno` to the `ingreso_fruta_pallets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `variedad` to the `ingreso_fruta_pallets` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ingreso_fruta_pallets" ADD COLUMN     "modulo" TEXT NOT NULL,
ADD COLUMN     "turno" TEXT NOT NULL,
ADD COLUMN     "variedad" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ingresos_fruta" DROP COLUMN "modulo",
DROP COLUMN "turno",
DROP COLUMN "variedad";
