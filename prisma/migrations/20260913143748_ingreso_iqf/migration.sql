-- CreateTable
CREATE TABLE "ingresos_iqf" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "fechaCosecha" TIMESTAMP(3) NOT NULL,
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horaIngreso" TEXT,
    "placaTransporte" TEXT,
    "observaciones" TEXT,
    "estado" "EstadoDocumento" NOT NULL DEFAULT 'BORRADOR',
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingresos_iqf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pallets_iqf" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "cantidadBandejas" INTEGER NOT NULL DEFAULT 0,
    "pesoBrutoTotalKg" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "pesoTaraTotalKg" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "pesoNetoKg" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "estado" "EstadoPallet" NOT NULL DEFAULT 'ABIERTO',
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pallets_iqf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingreso_iqf_pallets" (
    "id" TEXT NOT NULL,
    "ingresoIQFId" TEXT NOT NULL,
    "numeroPallet" INTEGER NOT NULL,
    "palletId" TEXT NOT NULL,
    "variedad" TEXT NOT NULL,
    "tipoProducto" TEXT NOT NULL,
    "tipoPalletId" TEXT,
    "tipoBandejaId" TEXT NOT NULL,
    "cantidadBandejas" INTEGER NOT NULL,
    "pesoBrutoTotalKg" DECIMAL(10,3) NOT NULL,
    "pesoTaraTotalKg" DECIMAL(10,3) NOT NULL,
    "pesoNetoKg" DECIMAL(10,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingreso_iqf_pallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarjas_iqf" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "palletId" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfUrl" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "despachoId" TEXT,

    CONSTRAINT "tarjas_iqf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "despachos_iqf" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "placaCamion" TEXT NOT NULL,
    "conductor" TEXT NOT NULL,
    "fechaDespacho" TIMESTAMP(3) NOT NULL,
    "horaDespacho" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "despachos_iqf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingresos_iqf_numero_key" ON "ingresos_iqf"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "pallets_iqf_numero_key" ON "pallets_iqf"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "ingreso_iqf_pallets_ingresoIQFId_numeroPallet_key" ON "ingreso_iqf_pallets"("ingresoIQFId", "numeroPallet");

-- CreateIndex
CREATE UNIQUE INDEX "tarjas_iqf_numero_key" ON "tarjas_iqf"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "tarjas_iqf_palletId_key" ON "tarjas_iqf"("palletId");

-- CreateIndex
CREATE UNIQUE INDEX "despachos_iqf_numero_key" ON "despachos_iqf"("numero");

-- AddForeignKey
ALTER TABLE "ingresos_iqf" ADD CONSTRAINT "ingresos_iqf_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso_iqf_pallets" ADD CONSTRAINT "ingreso_iqf_pallets_ingresoIQFId_fkey" FOREIGN KEY ("ingresoIQFId") REFERENCES "ingresos_iqf"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso_iqf_pallets" ADD CONSTRAINT "ingreso_iqf_pallets_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "pallets_iqf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso_iqf_pallets" ADD CONSTRAINT "ingreso_iqf_pallets_tipoPalletId_fkey" FOREIGN KEY ("tipoPalletId") REFERENCES "tipos_pallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso_iqf_pallets" ADD CONSTRAINT "ingreso_iqf_pallets_tipoBandejaId_fkey" FOREIGN KEY ("tipoBandejaId") REFERENCES "tipos_bandeja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarjas_iqf" ADD CONSTRAINT "tarjas_iqf_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "pallets_iqf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarjas_iqf" ADD CONSTRAINT "tarjas_iqf_despachoId_fkey" FOREIGN KEY ("despachoId") REFERENCES "despachos_iqf"("id") ON DELETE SET NULL ON UPDATE CASCADE;
