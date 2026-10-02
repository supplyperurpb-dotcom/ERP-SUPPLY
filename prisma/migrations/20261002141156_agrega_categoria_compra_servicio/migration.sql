-- CreateEnum
CREATE TYPE "CategoriaCompra" AS ENUM ('COMPRA', 'SERVICIO');

-- AlterTable
ALTER TABLE "ordenes_compra" ADD COLUMN     "categoria" "CategoriaCompra" NOT NULL DEFAULT 'COMPRA';

-- AlterTable
ALTER TABLE "solicitudes_pedido" ADD COLUMN     "categoria" "CategoriaCompra" NOT NULL DEFAULT 'COMPRA';
