-- CreateEnum
CREATE TYPE "EstadoRegistroAvance" AS ENUM ('ABIERTO', 'CULMINADO', 'PENDIENTE_VB', 'APROBADO', 'RECHAZADO');

-- AlterTable
ALTER TABLE "registros_avance"
  ADD COLUMN "estado" "EstadoRegistroAvance" NOT NULL DEFAULT 'ABIERTO',
  ADD COLUMN "aprobadorId" TEXT,
  ADD COLUMN "decididoPorId" TEXT,
  ADD COLUMN "observacionesVB" TEXT,
  ADD COLUMN "fechaDecision" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "sustentos_registro_avance" (
    "id" TEXT NOT NULL,
    "registroAvanceId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "archivo" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sustentos_registro_avance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sustentos_registro_avance_registroAvanceId_numero_key" ON "sustentos_registro_avance"("registroAvanceId", "numero");

ALTER TABLE "sustentos_registro_avance" ADD CONSTRAINT "sustentos_registro_avance_registroAvanceId_fkey" FOREIGN KEY ("registroAvanceId") REFERENCES "registros_avance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
