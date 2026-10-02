/*
  Warnings:

  - You are about to drop the column `solicitudPedidoId` on the `ordenes_compra` table. All the data in the column will be lost.
  - Added the required column `centroCosto` to the `orden_compra_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `centroCosto` to the `solicitud_pedido_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fechaNecesidad` to the `solicitudes_pedido` table without a default value. This is not possible if the table is not empty.
  - Added the required column `area` to the `solicitudes_pedido` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AreaEmpresa" AS ENUM ('PRODUCCION', 'SUPPLY_CHAIN', 'FINANZAS', 'GERENCIA_GENERAL', 'SERVICIOS_GENERALES', 'RRHH');

-- CreateEnum
CREATE TYPE "TipoNecesidad" AS ENUM ('URGENTE', 'ESTANDAR');

-- DropForeignKey
ALTER TABLE "ordenes_compra" DROP CONSTRAINT "ordenes_compra_solicitudPedidoId_fkey";

-- AlterTable
ALTER TABLE "orden_compra_items" ADD COLUMN     "centroCosto" "AreaEmpresa" NOT NULL,
ADD COLUMN     "gravado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "solicitudPedidoItemId" TEXT;

-- AlterTable
ALTER TABLE "ordenes_compra" DROP COLUMN "solicitudPedidoId",
ADD COLUMN     "igv" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "solicitud_pedido_items" ADD COLUMN     "centroCosto" "AreaEmpresa" NOT NULL;

-- AlterTable
ALTER TABLE "solicitudes_pedido" ADD COLUMN     "fechaNecesidad" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "tipoNecesidad" "TipoNecesidad" NOT NULL DEFAULT 'ESTANDAR',
DROP COLUMN "area",
ADD COLUMN     "area" "AreaEmpresa" NOT NULL;

-- AddForeignKey
ALTER TABLE "orden_compra_items" ADD CONSTRAINT "orden_compra_items_solicitudPedidoItemId_fkey" FOREIGN KEY ("solicitudPedidoItemId") REFERENCES "solicitud_pedido_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
