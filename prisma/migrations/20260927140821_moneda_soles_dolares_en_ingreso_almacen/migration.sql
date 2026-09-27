/*
  Warnings:

  - Added the required column `precioUnitarioUsd` to the `ingreso_almacen_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotalUsd` to the `ingreso_almacen_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ingreso_almacen_items" ADD COLUMN     "fleteAsignadoUsd" DECIMAL(14,4) NOT NULL DEFAULT 0,
ADD COLUMN     "precioUnitarioUsd" DECIMAL(12,4) NOT NULL,
ADD COLUMN     "subtotalUsd" DECIMAL(14,4) NOT NULL;

-- AlterTable
ALTER TABLE "ingresos_almacen" ADD COLUMN     "moneda" TEXT NOT NULL DEFAULT 'PEN';
