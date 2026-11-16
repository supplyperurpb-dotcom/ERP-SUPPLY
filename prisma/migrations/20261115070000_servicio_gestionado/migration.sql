-- CreateTable
CREATE TABLE "servicios_gestionados" (
    "id" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servicios_gestionados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "servicios_gestionados_ordenCompraId_key" ON "servicios_gestionados"("ordenCompraId");

-- AddForeignKey
ALTER TABLE "servicios_gestionados" ADD CONSTRAINT "servicios_gestionados_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
