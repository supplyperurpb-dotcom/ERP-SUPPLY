-- AlterTable
ALTER TABLE "consumo_almacen_items" ADD COLUMN     "fleteAsignado" DECIMAL(14,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "consumos_almacen" ADD COLUMN     "flete" DECIMAL(12,2),
ADD COLUMN     "guiaRemision" TEXT,
ADD COLUMN     "remitente" TEXT,
ADD COLUMN     "remitenteRuc" TEXT;

-- AlterTable
ALTER TABLE "ingreso_almacen_items" ADD COLUMN     "fleteAsignado" DECIMAL(14,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ingresos_almacen" ADD COLUMN     "flete" DECIMAL(12,2),
ADD COLUMN     "remitente" TEXT,
ADD COLUMN     "remitenteRuc" TEXT;

-- AlterTable
ALTER TABLE "traslado_almacen_items" ADD COLUMN     "fleteAsignado" DECIMAL(14,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "traslados_almacen" ADD COLUMN     "flete" DECIMAL(12,2),
ADD COLUMN     "remitenteRuc" TEXT;
