-- AlterTable
ALTER TABLE "orden_compra_items" ADD COLUMN     "cerrado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cerradoPorId" TEXT,
ADD COLUMN     "fechaCierre" TIMESTAMP(3),
ADD COLUMN     "motivoCierre" TEXT;
