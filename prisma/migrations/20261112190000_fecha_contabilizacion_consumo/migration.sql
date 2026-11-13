-- AlterTable: agrega fechaContabilizacion a ConsumoAlmacen (igual que ya
-- existe en IngresoAlmacen). Se agrega nullable, se rellena con el valor de
-- `fecha` para los consumos ya registrados (su fecha de contabilización
-- histórica nunca se capturó por separado), y recién después se exige
-- NOT NULL.
ALTER TABLE "consumos_almacen" ADD COLUMN     "fechaContabilizacion" TIMESTAMP(3);

UPDATE "consumos_almacen" SET "fechaContabilizacion" = "fecha" WHERE "fechaContabilizacion" IS NULL;

ALTER TABLE "consumos_almacen" ALTER COLUMN "fechaContabilizacion" SET NOT NULL;
