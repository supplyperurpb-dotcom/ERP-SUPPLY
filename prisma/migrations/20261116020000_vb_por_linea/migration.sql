-- AlterTable: el VB pasa a ser por línea (items_registro_avance), no uno
-- solo para todo el registro.
ALTER TABLE "items_registro_avance"
  ADD COLUMN "estadoVB" "EstadoFirma" NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN "observacionesVB" TEXT,
  ADD COLUMN "decididoPorId" TEXT,
  ADD COLUMN "fechaDecisionVB" TIMESTAMP(3);
