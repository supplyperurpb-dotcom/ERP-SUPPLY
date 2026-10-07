-- AlterTable
ALTER TABLE "consumo_almacen_items" ADD COLUMN     "fechaProduccion" TIMESTAMP(3),
ADD COLUMN     "fechaVencimiento" TIMESTAMP(3),
ADD COLUMN     "lote" TEXT;
