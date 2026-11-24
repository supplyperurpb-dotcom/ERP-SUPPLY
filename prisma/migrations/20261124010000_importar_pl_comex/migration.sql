-- AlterTable: campos nuevos en "embarques" para COMEX > Importar PL (todos
-- opcionales, no afectan embarques ya existentes del flujo manual).
ALTER TABLE "embarques" ADD COLUMN "shipNumber" TEXT;
ALTER TABLE "embarques" ADD COLUMN "growerCode" INTEGER;
ALTER TABLE "embarques" ADD COLUMN "grower" TEXT;
ALTER TABLE "embarques" ADD COLUMN "consignee" TEXT;
ALTER TABLE "embarques" ADD COLUMN "notify" TEXT;
ALTER TABLE "embarques" ADD COLUMN "vessel" TEXT;
ALTER TABLE "embarques" ADD COLUMN "blSwb" TEXT;
ALTER TABLE "embarques" ADD COLUMN "origenPuerto" TEXT;
ALTER TABLE "embarques" ADD COLUMN "tipoEmbarque" TEXT;
ALTER TABLE "embarques" ADD COLUMN "fechaCarga" TIMESTAMP(3);
ALTER TABLE "embarques" ADD COLUMN "etd" TIMESTAMP(3);
ALTER TABLE "embarques" ADD COLUMN "eta" TIMESTAMP(3);
ALTER TABLE "embarques" ADD COLUMN "totalCasesExcel" INTEGER;
ALTER TABLE "embarques" ADD COLUMN "totalNetWeightExcel" DECIMAL(12,3);
ALTER TABLE "embarques" ADD COLUMN "archivoOriginalUrl" TEXT;
ALTER TABLE "embarques" ADD COLUMN "archivoOriginalNombre" TEXT;
ALTER TABLE "embarques" ADD COLUMN "archivoHash" TEXT;
ALTER TABLE "embarques" ADD COLUMN "importadoPorId" TEXT;
ALTER TABLE "embarques" ADD COLUMN "importadoEn" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "embarques_shipNumber_key" ON "embarques"("shipNumber");

-- CreateIndex
CREATE UNIQUE INDEX "embarques_archivoHash_key" ON "embarques"("archivoHash");

-- CreateTable: líneas (pallets) del Packing List importado.
CREATE TABLE "embarque_pallets" (
    "id" TEXT NOT NULL,
    "embarqueId" TEXT NOT NULL,
    "palletNumber" TEXT NOT NULL,
    "itemFruitCode" INTEGER,
    "descripcionSku" TEXT,
    "variedad" TEXT NOT NULL,
    "label" TEXT,
    "fruitType" TEXT,
    "cases" INTEGER NOT NULL,
    "kgPorSku" DECIMAL(10,3),
    "pesoNetoKg" DECIMAL(10,3) NOT NULL,
    "thermographRecorder" TEXT,
    "thermographType" TEXT,
    "tipoBolsaLiner" TEXT,
    "atmosferaControlada" TEXT,
    "codeDemea" TEXT,
    "trazabilityCodeDoc" TEXT,
    "lpnDriscolls" TEXT,
    "fechaCosecha" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embarque_pallets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "embarque_pallets_palletNumber_idx" ON "embarque_pallets"("palletNumber");

-- CreateIndex
CREATE INDEX "embarque_pallets_trazabilityCodeDoc_idx" ON "embarque_pallets"("trazabilityCodeDoc");

-- CreateIndex
CREATE INDEX "embarque_pallets_lpnDriscolls_idx" ON "embarque_pallets"("lpnDriscolls");

-- CreateIndex
CREATE INDEX "embarque_pallets_variedad_idx" ON "embarque_pallets"("variedad");

-- AddForeignKey
ALTER TABLE "embarque_pallets" ADD CONSTRAINT "embarque_pallets_embarqueId_fkey" FOREIGN KEY ("embarqueId") REFERENCES "embarques"("id") ON DELETE CASCADE ON UPDATE CASCADE;
