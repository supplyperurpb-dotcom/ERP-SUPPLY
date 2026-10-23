/*
  Warnings:

  - You are about to drop the column `almacenId` on the `solicitudes_despacho` table. All the data in the column will be lost.
  - Added the required column `centroCosto` to the `solicitud_despacho_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `area` to the `solicitudes_despacho` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "solicitudes_despacho" DROP CONSTRAINT "solicitudes_despacho_almacenId_fkey";

-- AlterTable
ALTER TABLE "solicitud_despacho_items" ADD COLUMN     "campo" TEXT,
ADD COLUMN     "centroCosto" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "solicitudes_despacho" DROP COLUMN "almacenId",
ADD COLUMN     "area" "AreaEmpresa" NOT NULL;
