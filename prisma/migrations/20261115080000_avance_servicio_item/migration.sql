-- CreateEnum
CREATE TYPE "TipoRegistroAvance" AS ENUM ('PORCENTUAL', 'CANTIDAD');

-- CreateTable
CREATE TABLE "items_servicio_gestionado" (
    "id" TEXT NOT NULL,
    "servicioGestionadoId" TEXT NOT NULL,
    "ordenCompraItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_servicio_gestionado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avances_servicio_item" (
    "id" TEXT NOT NULL,
    "itemServicioGestionadoId" TEXT NOT NULL,
    "tipoRegistro" "TipoRegistroAvance" NOT NULL,
    "porcentaje" DECIMAL(5,2),
    "cantidad" DECIMAL(12,3) NOT NULL,
    "valorizado" DECIMAL(12,2) NOT NULL,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avances_servicio_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "items_servicio_gestionado_ordenCompraItemId_key" ON "items_servicio_gestionado"("ordenCompraItemId");

-- AddForeignKey
ALTER TABLE "items_servicio_gestionado" ADD CONSTRAINT "items_servicio_gestionado_servicioGestionadoId_fkey" FOREIGN KEY ("servicioGestionadoId") REFERENCES "servicios_gestionados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_servicio_gestionado" ADD CONSTRAINT "items_servicio_gestionado_ordenCompraItemId_fkey" FOREIGN KEY ("ordenCompraItemId") REFERENCES "orden_compra_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avances_servicio_item" ADD CONSTRAINT "avances_servicio_item_itemServicioGestionadoId_fkey" FOREIGN KEY ("itemServicioGestionadoId") REFERENCES "items_servicio_gestionado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
