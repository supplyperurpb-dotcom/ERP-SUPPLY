-- CreateTable
CREATE TABLE "orden_compra_sustentos" (
    "id" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "archivo" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orden_compra_sustentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orden_compra_sustentos_ordenCompraId_idx" ON "orden_compra_sustentos"("ordenCompraId");

-- AddForeignKey
ALTER TABLE "orden_compra_sustentos" ADD CONSTRAINT "orden_compra_sustentos_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
