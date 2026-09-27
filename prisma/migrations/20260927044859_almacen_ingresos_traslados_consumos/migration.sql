-- CreateTable
CREATE TABLE "ingresos_almacen" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "ocNumero" TEXT,
    "guiaRemision" TEXT,
    "proveedorId" TEXT,
    "almacenId" TEXT NOT NULL,
    "observaciones" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingresos_almacen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingreso_almacen_items" (
    "id" TEXT NOT NULL,
    "ingresoAlmacenId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "precioUnitario" DECIMAL(12,4) NOT NULL,
    "subtotal" DECIMAL(14,4) NOT NULL,
    "lote" TEXT,

    CONSTRAINT "ingreso_almacen_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traslados_almacen" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "almacenOrigenId" TEXT NOT NULL,
    "almacenDestinoId" TEXT NOT NULL,
    "guiaRemision" TEXT,
    "remitente" TEXT,
    "observaciones" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traslados_almacen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traslado_almacen_items" (
    "id" TEXT NOT NULL,
    "trasladoAlmacenId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "unidadMedida" TEXT NOT NULL,

    CONSTRAINT "traslado_almacen_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumos_almacen" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "almacenOrigenId" TEXT NOT NULL,
    "observaciones" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumos_almacen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumo_almacen_items" (
    "id" TEXT NOT NULL,
    "consumoAlmacenId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "precioUnitarioPonderado" DECIMAL(12,4) NOT NULL,
    "valorConsumido" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "consumo_almacen_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingresos_almacen_numero_key" ON "ingresos_almacen"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "traslados_almacen_numero_key" ON "traslados_almacen"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "consumos_almacen_numero_key" ON "consumos_almacen"("numero");

-- AddForeignKey
ALTER TABLE "ingresos_almacen" ADD CONSTRAINT "ingresos_almacen_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_almacen" ADD CONSTRAINT "ingresos_almacen_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso_almacen_items" ADD CONSTRAINT "ingreso_almacen_items_ingresoAlmacenId_fkey" FOREIGN KEY ("ingresoAlmacenId") REFERENCES "ingresos_almacen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso_almacen_items" ADD CONSTRAINT "ingreso_almacen_items_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslados_almacen" ADD CONSTRAINT "traslados_almacen_almacenOrigenId_fkey" FOREIGN KEY ("almacenOrigenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslados_almacen" ADD CONSTRAINT "traslados_almacen_almacenDestinoId_fkey" FOREIGN KEY ("almacenDestinoId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslado_almacen_items" ADD CONSTRAINT "traslado_almacen_items_trasladoAlmacenId_fkey" FOREIGN KEY ("trasladoAlmacenId") REFERENCES "traslados_almacen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslado_almacen_items" ADD CONSTRAINT "traslado_almacen_items_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumos_almacen" ADD CONSTRAINT "consumos_almacen_almacenOrigenId_fkey" FOREIGN KEY ("almacenOrigenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumo_almacen_items" ADD CONSTRAINT "consumo_almacen_items_consumoAlmacenId_fkey" FOREIGN KEY ("consumoAlmacenId") REFERENCES "consumos_almacen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumo_almacen_items" ADD CONSTRAINT "consumo_almacen_items_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
