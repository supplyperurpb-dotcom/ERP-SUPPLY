-- CreateEnum
CREATE TYPE "TipoOrdenCompra" AS ENUM ('ABIERTA', 'ESTANDAR');

-- AlterTable
ALTER TABLE "ordenes_compra" ADD COLUMN     "tipoOrden" "TipoOrdenCompra" NOT NULL DEFAULT 'ESTANDAR',
ADD COLUMN     "vigenteHasta" TIMESTAMP(3);

