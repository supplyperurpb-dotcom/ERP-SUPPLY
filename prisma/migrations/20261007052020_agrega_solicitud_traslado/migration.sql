-- AlterTable
ALTER TABLE "traslado_almacen_items" ADD COLUMN     "solicitudTrasladoItemId" TEXT;

-- AlterTable
ALTER TABLE "traslados_almacen" ADD COLUMN     "solicitudTrasladoId" TEXT;

-- CreateTable
CREATE TABLE "solicitudes_traslado" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "almacenOrigenId" TEXT NOT NULL,
    "almacenDestinoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "solicitanteId" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_traslado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_traslado_items" (
    "id" TEXT NOT NULL,
    "solicitudTrasladoId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "unidadMedida" TEXT NOT NULL,

    CONSTRAINT "solicitud_traslado_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_traslado_numero_key" ON "solicitudes_traslado"("numero");

-- AddForeignKey
ALTER TABLE "traslados_almacen" ADD CONSTRAINT "traslados_almacen_solicitudTrasladoId_fkey" FOREIGN KEY ("solicitudTrasladoId") REFERENCES "solicitudes_traslado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslado_almacen_items" ADD CONSTRAINT "traslado_almacen_items_solicitudTrasladoItemId_fkey" FOREIGN KEY ("solicitudTrasladoItemId") REFERENCES "solicitud_traslado_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_traslado" ADD CONSTRAINT "solicitudes_traslado_almacenOrigenId_fkey" FOREIGN KEY ("almacenOrigenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_traslado" ADD CONSTRAINT "solicitudes_traslado_almacenDestinoId_fkey" FOREIGN KEY ("almacenDestinoId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_traslado_items" ADD CONSTRAINT "solicitud_traslado_items_solicitudTrasladoId_fkey" FOREIGN KEY ("solicitudTrasladoId") REFERENCES "solicitudes_traslado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_traslado_items" ADD CONSTRAINT "solicitud_traslado_items_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
