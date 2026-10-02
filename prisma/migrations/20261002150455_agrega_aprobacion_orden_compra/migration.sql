-- AlterTable
ALTER TABLE "ordenes_compra" ADD COLUMN     "aprobadoPorId" TEXT,
ADD COLUMN     "comentarioRechazo" TEXT,
ADD COLUMN     "fechaAprobacion" TIMESTAMP(3);
