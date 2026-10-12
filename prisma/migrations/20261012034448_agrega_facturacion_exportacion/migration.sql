-- CreateTable
CREATE TABLE "facturacion_exportacion" (
    "id" TEXT NOT NULL,
    "dispWeek" INTEGER NOT NULL,
    "invoicedAmount" DECIMAL(14,2) NOT NULL,
    "cifLiquidatedTariffs" DECIMAL(14,2) NOT NULL,
    "netWeight" DECIMAL(14,3) NOT NULL,
    "netKilosLiquidated" DECIMAL(14,3) NOT NULL,
    "importadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facturacion_exportacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "facturacion_exportacion_dispWeek_idx" ON "facturacion_exportacion"("dispWeek");
