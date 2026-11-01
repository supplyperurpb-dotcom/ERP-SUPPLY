-- CreateTable
CREATE TABLE "devoluciones_almacen" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "almacenId" TEXT NOT NULL,
    "area" "AreaEmpresa" NOT NULL,
    "personaQueTrae" TEXT NOT NULL,
    "personaQueTraeDni" TEXT NOT NULL,
    "proveedorId" TEXT,
    "observaciones" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devoluciones_almacen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devolucion_almacen_items" (
    "id" TEXT NOT NULL,
    "devolucionAlmacenId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "noValorado" BOOLEAN NOT NULL DEFAULT false,
    "precioUnitario" DECIMAL(12,4) NOT NULL,
    "subtotal" DECIMAL(14,4) NOT NULL,
    "lote" TEXT,
    "fechaProduccion" TIMESTAMP(3),
    "fechaVencimiento" TIMESTAMP(3),

    CONSTRAINT "devolucion_almacen_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_almacen_numero_key" ON "devoluciones_almacen"("numero");

-- AddForeignKey
ALTER TABLE "devoluciones_almacen" ADD CONSTRAINT "devoluciones_almacen_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_almacen" ADD CONSTRAINT "devoluciones_almacen_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_almacen_items" ADD CONSTRAINT "devolucion_almacen_items_devolucionAlmacenId_fkey" FOREIGN KEY ("devolucionAlmacenId") REFERENCES "devoluciones_almacen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_almacen_items" ADD CONSTRAINT "devolucion_almacen_items_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
