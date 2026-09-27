-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoProveedor" ADD VALUE 'TRANSPORTE';
ALTER TYPE "TipoProveedor" ADD VALUE 'MATERIALES_EMPAQUE';
ALTER TYPE "TipoProveedor" ADD VALUE 'ALMACEN';
