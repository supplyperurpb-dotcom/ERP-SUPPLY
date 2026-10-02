-- AlterTable
ALTER TABLE "ordenes_compra" ADD COLUMN     "condicionPago" TEXT,
ADD COLUMN     "fechaEntrega" TIMESTAMP(3),
ADD COLUMN     "lugarEntrega" TEXT,
ADD COLUMN     "observaciones" TEXT;
