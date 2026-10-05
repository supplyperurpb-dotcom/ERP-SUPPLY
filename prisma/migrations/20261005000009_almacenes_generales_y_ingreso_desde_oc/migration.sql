-- CreateEnum
CREATE TYPE "AlmacenCategoriaGeneral" AS ENUM ('PACKING', 'AGROQUIMICOS_FERTILIZANTES', 'COMBUSTIBLE', 'SUMINISTROS');

-- AlterTable
ALTER TABLE "almacenes" ADD COLUMN     "almacenPadreId" TEXT,
ADD COLUMN     "categoriaGeneral" "AlmacenCategoriaGeneral",
ADD COLUMN     "esGeneral" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ingreso_almacen_items" ADD COLUMN     "fechaProduccion" TIMESTAMP(3),
ADD COLUMN     "fechaVencimiento" TIMESTAMP(3),
ADD COLUMN     "ordenCompraItemId" TEXT;

-- AlterTable
ALTER TABLE "ingresos_almacen" ADD COLUMN     "ordenCompraId" TEXT;

-- AddForeignKey
ALTER TABLE "almacenes" ADD CONSTRAINT "almacenes_almacenPadreId_fkey" FOREIGN KEY ("almacenPadreId") REFERENCES "almacenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos_almacen" ADD CONSTRAINT "ingresos_almacen_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso_almacen_items" ADD CONSTRAINT "ingreso_almacen_items_ordenCompraItemId_fkey" FOREIGN KEY ("ordenCompraItemId") REFERENCES "orden_compra_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
