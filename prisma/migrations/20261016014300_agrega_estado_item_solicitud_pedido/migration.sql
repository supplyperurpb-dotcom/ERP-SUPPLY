-- CreateEnum
CREATE TYPE "EstadoItemSolicitud" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- AlterTable
ALTER TABLE "solicitud_pedido_items" ADD COLUMN     "estado" "EstadoItemSolicitud" NOT NULL DEFAULT 'PENDIENTE';
