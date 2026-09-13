-- AlterTable
-- Se agregan con un valor por defecto temporal para poder rellenar la única
-- fila existente (ingreso ya registrado antes de este cambio); luego se
-- quita el default para que el formulario exija elegir un valor siempre.
ALTER TABLE "ingreso_fruta_pallets"
  ADD COLUMN "formato" TEXT NOT NULL DEFAULT 'Sweetest Batch',
  ADD COLUMN "tipoProducto" TEXT NOT NULL DEFAULT 'Exportable';

ALTER TABLE "ingreso_fruta_pallets"
  ALTER COLUMN "formato" DROP DEFAULT,
  ALTER COLUMN "tipoProducto" DROP DEFAULT;
