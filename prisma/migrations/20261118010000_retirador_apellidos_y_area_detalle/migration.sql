-- AlterTable: separa "apellidos" en apellidoPaterno/apellidoMaterno y
-- agrega areaDetalle (nivel 2 del organigrama, igual que Usuario.areaDetalle).
ALTER TABLE "retiradores_autorizados" ADD COLUMN "apellidoPaterno" TEXT;
ALTER TABLE "retiradores_autorizados" ADD COLUMN "apellidoMaterno" TEXT;
ALTER TABLE "retiradores_autorizados" ADD COLUMN "areaDetalle" TEXT;

-- Backfill: primera palabra de "apellidos" -> apellidoPaterno, el resto
-- (si hay) -> apellidoMaterno.
UPDATE "retiradores_autorizados"
SET
  "apellidoPaterno" = split_part("apellidos", ' ', 1),
  "apellidoMaterno" = CASE
    WHEN position(' ' in "apellidos") = 0 THEN NULL
    ELSE NULLIF(trim(substring("apellidos" from position(' ' in "apellidos") + 1)), '')
  END;

ALTER TABLE "retiradores_autorizados" ALTER COLUMN "apellidoPaterno" SET NOT NULL;
ALTER TABLE "retiradores_autorizados" DROP COLUMN "apellidos";
