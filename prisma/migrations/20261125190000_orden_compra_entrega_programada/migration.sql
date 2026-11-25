-- CreateEnum
CREATE TYPE "EstadoEntregaProgramada" AS ENUM ('PROGRAMADA', 'ANULADA');

-- CreateTable
CREATE TABLE "orden_compra_entregas" (
    "id" TEXT NOT NULL,
    "ordenCompraItemId" TEXT NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "fechaTentativa" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoEntregaProgramada" NOT NULL DEFAULT 'PROGRAMADA',
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orden_compra_entregas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orden_compra_entregas_fechaTentativa_idx" ON "orden_compra_entregas"("fechaTentativa");

-- CreateIndex
CREATE INDEX "orden_compra_entregas_ordenCompraItemId_idx" ON "orden_compra_entregas"("ordenCompraItemId");

-- AddForeignKey
ALTER TABLE "orden_compra_entregas" ADD CONSTRAINT "orden_compra_entregas_ordenCompraItemId_fkey" FOREIGN KEY ("ordenCompraItemId") REFERENCES "orden_compra_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
