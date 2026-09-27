/*
  Warnings:

  - You are about to drop the column `fleteAsignado` on the `consumo_almacen_items` table. All the data in the column will be lost.
  - You are about to drop the column `flete` on the `consumos_almacen` table. All the data in the column will be lost.
  - You are about to drop the column `guiaRemision` on the `consumos_almacen` table. All the data in the column will be lost.
  - You are about to drop the column `remitente` on the `consumos_almacen` table. All the data in the column will be lost.
  - You are about to drop the column `remitenteRuc` on the `consumos_almacen` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "consumo_almacen_items" DROP COLUMN "fleteAsignado";

-- AlterTable
ALTER TABLE "consumos_almacen" DROP COLUMN "flete",
DROP COLUMN "guiaRemision",
DROP COLUMN "remitente",
DROP COLUMN "remitenteRuc";

-- AlterTable
ALTER TABLE "traslado_almacen_items" ADD COLUMN     "fleteAsignadoUsd" DECIMAL(14,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "traslados_almacen" ADD COLUMN     "moneda" TEXT NOT NULL DEFAULT 'PEN';
