/*
  Warnings:

  - Added the required column `palletId` to the `ingreso_fruta_pallets` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EstadoPallet" AS ENUM ('ABIERTO', 'CERRADO');

-- AlterTable
ALTER TABLE "ingreso_fruta_pallets" ADD COLUMN     "palletId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "pallets" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "cantidadBandejas" INTEGER NOT NULL DEFAULT 0,
    "pesoBrutoTotalKg" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "pesoTaraTotalKg" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "pesoNetoKg" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "estado" "EstadoPallet" NOT NULL DEFAULT 'ABIERTO',
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pallets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pallets_numero_key" ON "pallets"("numero");

-- AddForeignKey
ALTER TABLE "ingreso_fruta_pallets" ADD CONSTRAINT "ingreso_fruta_pallets_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "pallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
