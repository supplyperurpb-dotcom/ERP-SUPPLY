-- CreateEnum
CREATE TYPE "EstadoDespacho" AS ENUM ('BORRADOR', 'CULMINADO');

-- AlterTable
ALTER TABLE "despachos" ADD COLUMN     "culminadoEn" TIMESTAMP(3),
ADD COLUMN     "estado" "EstadoDespacho" NOT NULL DEFAULT 'BORRADOR',
ADD COLUMN     "guiaRemisionArchivo" TEXT;

