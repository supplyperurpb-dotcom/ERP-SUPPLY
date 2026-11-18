-- AlterTable
ALTER TABLE "proveedores" DROP COLUMN "tipo";
ALTER TABLE "proveedores"
  ADD COLUMN "pais" TEXT,
  ADD COLUMN "banco" TEXT,
  ADD COLUMN "numeroCuenta" TEXT;

-- DropEnum
DROP TYPE "TipoProveedor";
