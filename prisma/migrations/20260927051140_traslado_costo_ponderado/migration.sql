/*
  Warnings:

  - Added the required column `costoUnitario` to the `traslado_almacen_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `valorTotal` to the `traslado_almacen_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "traslado_almacen_items" ADD COLUMN     "costoUnitario" DECIMAL(12,4) NOT NULL,
ADD COLUMN     "valorTotal" DECIMAL(14,4) NOT NULL;
