-- CreateEnum
CREATE TYPE "RolAprobadorEspecial" AS ENUM ('GERENTE_SUPPLY', 'DISTRICT_CONTROLLER', 'GERENTE_GENERAL', 'GERENTE_RRHH');

-- CreateEnum
CREATE TYPE "EstadoFirma" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "aprobadores_especiales" (
    "id" TEXT NOT NULL,
    "rol" "RolAprobadorEspecial" NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aprobadores_especiales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_compra_firmas" (
    "id" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "rol" "RolAprobadorEspecial" NOT NULL,
    "estado" "EstadoFirma" NOT NULL DEFAULT 'PENDIENTE',
    "usuarioId" TEXT,
    "fecha" TIMESTAMP(3),
    "comentario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orden_compra_firmas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aprobadores_especiales_rol_key" ON "aprobadores_especiales"("rol");

-- CreateIndex
CREATE UNIQUE INDEX "orden_compra_firmas_ordenCompraId_rol_key" ON "orden_compra_firmas"("ordenCompraId", "rol");

-- AddForeignKey
ALTER TABLE "orden_compra_firmas" ADD CONSTRAINT "orden_compra_firmas_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
