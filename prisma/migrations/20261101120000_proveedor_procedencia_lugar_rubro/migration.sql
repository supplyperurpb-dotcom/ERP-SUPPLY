-- CreateEnum
CREATE TYPE "Procedencia" AS ENUM ('NACIONAL', 'EXTRANJERO');

-- AlterEnum
ALTER TYPE "TipoDocumentoIdentidad" ADD VALUE 'EXTRANJERO';

-- AlterTable
ALTER TABLE "proveedores" ADD COLUMN     "lugar" TEXT,
ADD COLUMN     "procedencia" "Procedencia" NOT NULL DEFAULT 'NACIONAL',
ADD COLUMN     "rubro" TEXT;

