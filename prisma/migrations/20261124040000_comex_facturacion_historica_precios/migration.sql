-- Base de datos centralizada de Exportaciones (COMEX): migración
-- histórica de Facturación (130 columnas originales) + Gestión de
-- Precios. Aditivo: no toca facturacion_exportacion ni ninguna tabla
-- existente (ver plan "COMEX: Base de datos centralizada de
-- Exportaciones").

-- CreateEnum
CREATE TYPE "TipoImportacionComex" AS ENUM ('FACTURACION_HISTORICA');

-- CreateEnum
CREATE TYPE "EstadoImportacionComex" AS ENUM ('COMPLETADO', 'ERROR');

-- CreateEnum
CREATE TYPE "UnidadPrecio" AS ENUM ('USD_KG', 'USD_CAJA');

-- CreateEnum
CREATE TYPE "TipoPrecio" AS ENUM ('FOB', 'FREIGHT', 'INTERNATIONAL_INSURANCE', 'CIF');

-- CreateTable: control de "ya se migró" + auditoría de cada corrida de
-- importación (nunca se borra).
CREATE TABLE "import_history" (
    "id" TEXT NOT NULL,
    "tipo" "TipoImportacionComex" NOT NULL,
    "archivoNombre" TEXT NOT NULL,
    "archivoHash" TEXT NOT NULL,
    "registros" INTEGER NOT NULL,
    "estado" "EstadoImportacionComex" NOT NULL,
    "errores" TEXT[],
    "ejecutadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_history_archivoHash_key" ON "import_history"("archivoHash");

-- CreateTable: un registro histórico de la hoja "Facturación", con las
-- 130 columnas originales preservadas en datosOriginales (errores de
-- fórmula como texto, nunca como 0) + un subconjunto tipado igual al de
-- facturacion_exportacion para reusar el mismo motor de cálculo.
CREATE TABLE "historical_billing" (
    "id" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "importHistoryId" TEXT NOT NULL,
    "dispatchDate" TIMESTAMP(3) NOT NULL,
    "dispWeek" INTEGER NOT NULL,
    "customer" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "originPort" TEXT NOT NULL,
    "destinationCountry" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "po" TEXT NOT NULL,
    "transportMode" TEXT NOT NULL,
    "weekEta" INTEGER,
    "weekAta" INTEGER,
    "statusEmbarque" TEXT NOT NULL,
    "settlementStatus" TEXT NOT NULL,
    "variety" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "destino" TEXT,
    "totalFob" DECIMAL(14,2) NOT NULL,
    "invoicedAmount" DECIMAL(14,2) NOT NULL,
    "cifLiquidatedTariffs" DECIMAL(14,2) NOT NULL,
    "netWeight" DECIMAL(14,3) NOT NULL,
    "netKilosLiquidated" DECIMAL(14,3) NOT NULL,
    "datosOriginales" JSONB NOT NULL,
    "camposConError" TEXT[],
    "embarqueId" TEXT,
    "embarqueVinculadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historical_billing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "historical_billing_po_idx" ON "historical_billing"("po");

-- CreateIndex
CREATE INDEX "historical_billing_dispatchDate_idx" ON "historical_billing"("dispatchDate");

-- CreateIndex
CREATE INDEX "historical_billing_sourceFile_sourceRowNumber_idx" ON "historical_billing"("sourceFile", "sourceRowNumber");

-- CreateTable: precios ingresados a mano desde la aplicación (Gestión de
-- Precios), separados de lo histórico importado. Permite más de un
-- precio por PO/producto.
CREATE TABLE "price_records" (
    "id" TEXT NOT NULL,
    "po" TEXT,
    "embarqueId" TEXT,
    "productoSku" TEXT,
    "variedad" TEXT,
    "precioUnitario" DECIMAL(14,4) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "unidad" "UnidadPrecio" NOT NULL,
    "incoterm" TEXT,
    "tipoPrecio" "TipoPrecio" NOT NULL,
    "vigenteDesde" TIMESTAMP(3),
    "vigenteHasta" TIMESTAMP(3),
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_records_po_idx" ON "price_records"("po");

-- CreateIndex
CREATE INDEX "price_records_embarqueId_idx" ON "price_records"("embarqueId");

-- CreateTable: historial de cambios de PriceRecord — nunca se
-- sobrescribe un precio anterior sin dejar su registro.
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "priceRecordId" TEXT NOT NULL,
    "precioAnterior" DECIMAL(14,4) NOT NULL,
    "precioNuevo" DECIMAL(14,4) NOT NULL,
    "modificadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "historical_billing" ADD CONSTRAINT "historical_billing_importHistoryId_fkey" FOREIGN KEY ("importHistoryId") REFERENCES "import_history"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_billing" ADD CONSTRAINT "historical_billing_embarqueId_fkey" FOREIGN KEY ("embarqueId") REFERENCES "embarques"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_records" ADD CONSTRAINT "price_records_embarqueId_fkey" FOREIGN KEY ("embarqueId") REFERENCES "embarques"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_priceRecordId_fkey" FOREIGN KEY ("priceRecordId") REFERENCES "price_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
