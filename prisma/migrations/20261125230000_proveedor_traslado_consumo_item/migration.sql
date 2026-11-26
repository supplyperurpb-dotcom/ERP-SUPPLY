-- AlterTable
ALTER TABLE "traslado_almacen_items" ADD COLUMN "proveedorId" TEXT;
ALTER TABLE "consumo_almacen_items" ADD COLUMN "proveedorId" TEXT;

-- AddForeignKey
ALTER TABLE "traslado_almacen_items" ADD CONSTRAINT "traslado_almacen_items_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consumo_almacen_items" ADD CONSTRAINT "consumo_almacen_items_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
