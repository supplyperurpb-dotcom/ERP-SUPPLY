-- AlterTable
ALTER TABLE "consumo_almacen_items" ADD COLUMN     "solicitudDespachoItemId" TEXT;

-- CreateTable
CREATE TABLE "solicitudes_despacho" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "observaciones" TEXT,
    "solicitanteId" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitudes_despacho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_despacho_items" (
    "id" TEXT NOT NULL,
    "solicitudDespachoId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "unidadMedida" TEXT NOT NULL,

    CONSTRAINT "solicitud_despacho_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_despacho_numero_key" ON "solicitudes_despacho"("numero");

-- AddForeignKey
ALTER TABLE "consumo_almacen_items" ADD CONSTRAINT "consumo_almacen_items_solicitudDespachoItemId_fkey" FOREIGN KEY ("solicitudDespachoItemId") REFERENCES "solicitud_despacho_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_despacho" ADD CONSTRAINT "solicitudes_despacho_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_despacho_items" ADD CONSTRAINT "solicitud_despacho_items_solicitudDespachoId_fkey" FOREIGN KEY ("solicitudDespachoId") REFERENCES "solicitudes_despacho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_despacho_items" ADD CONSTRAINT "solicitud_despacho_items_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
