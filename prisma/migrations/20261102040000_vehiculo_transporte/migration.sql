-- CreateEnum
CREATE TYPE "TipoPropiedadVehiculoTransporte" AS ENUM ('PROPIO', 'TERCERO');

-- CreateTable
CREATE TABLE "vehiculos_transporte" (
    "id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "tipo" "TipoPropiedadVehiculoTransporte" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehiculos_transporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehiculos_transporte_placa_key" ON "vehiculos_transporte"("placa");

