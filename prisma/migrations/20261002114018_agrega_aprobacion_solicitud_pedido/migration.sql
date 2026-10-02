-- AlterTable
ALTER TABLE "solicitudes_pedido" ADD COLUMN     "aprobadoPorId" TEXT,
ADD COLUMN     "comentarioRechazo" TEXT,
ADD COLUMN     "fechaAprobacion" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "aprobadores_area" (
    "id" TEXT NOT NULL,
    "area" "AreaEmpresa" NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aprobadores_area_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aprobadores_area_area_key" ON "aprobadores_area"("area");
