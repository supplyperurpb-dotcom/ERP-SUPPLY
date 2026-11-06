-- AlterTable
ALTER TABLE "despachos_iqf" ADD COLUMN     "culminadoEn" TIMESTAMP(3),
ADD COLUMN     "estado" "EstadoDespacho" NOT NULL DEFAULT 'BORRADOR',
ADD COLUMN     "guiaRemisionArchivo" TEXT;

