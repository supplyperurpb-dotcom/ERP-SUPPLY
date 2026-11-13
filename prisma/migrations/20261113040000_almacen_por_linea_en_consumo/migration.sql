-- El almacén de origen de un Consumo de Almacén pasa de vivir en la
-- cabecera (consumos_almacen) a vivir en cada línea (consumo_almacen_items)
-- — para que un mismo consumo pueda repartir un mismo producto entre
-- varios almacenes al atender una o más Solicitudes de Despacho. No hace
-- falta backfill: a la fecha de esta migración no hay ninguna fila en
-- consumos_almacen.

-- DropForeignKey
ALTER TABLE "consumos_almacen" DROP CONSTRAINT "consumos_almacen_almacenOrigenId_fkey";

-- AlterTable
ALTER TABLE "consumos_almacen" DROP COLUMN "almacenOrigenId";

-- AlterTable
ALTER TABLE "consumo_almacen_items" ADD COLUMN     "almacenOrigenId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "consumo_almacen_items" ADD CONSTRAINT "consumo_almacen_items_almacenOrigenId_fkey" FOREIGN KEY ("almacenOrigenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
