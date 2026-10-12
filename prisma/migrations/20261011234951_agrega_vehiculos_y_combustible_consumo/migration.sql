-- CreateEnum
CREATE TYPE "TipoVehiculo" AS ENUM ('CAMIONETA', 'TRACTOR', 'CISTERNA', 'EQUIPOS_MENORES');

-- AlterTable
ALTER TABLE "consumos_almacen" ADD COLUMN     "horometroKilometraje" DECIMAL(12,2),
ADD COLUMN     "vehiculoPlaca" TEXT;

-- CreateTable
CREATE TABLE "vehiculos" (
    "id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "areaUsuaria" "AreaEmpresa" NOT NULL,
    "tipo" "TipoVehiculo" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehiculos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehiculos_placa_key" ON "vehiculos"("placa");
