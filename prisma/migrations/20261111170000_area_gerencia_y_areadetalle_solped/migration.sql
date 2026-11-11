-- AlterEnum
ALTER TYPE "AreaEmpresa" ADD VALUE 'CALIDAD_E_INOCUIDAD';

-- AlterTable
ALTER TABLE "solicitudes_pedido" ADD COLUMN     "areaDetalle" TEXT NOT NULL DEFAULT 'COMPRAS';
ALTER TABLE "solicitudes_pedido" ALTER COLUMN "areaDetalle" DROP DEFAULT;
