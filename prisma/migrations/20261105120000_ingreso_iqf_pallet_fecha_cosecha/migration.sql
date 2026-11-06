-- La fecha de cosecha pasa de ser un solo valor por IngresoIQF a uno por
-- línea (IngresoIQFPallet), porque un mismo camión puede traer descarte
-- de variedades cosechadas en fechas distintas.

-- AlterTable: se agrega nullable primero para poder rellenarla antes de exigir NOT NULL
ALTER TABLE "ingreso_iqf_pallets" ADD COLUMN "fechaCosecha" TIMESTAMP(3);

-- Backfill: cada línea hereda la fecha de cosecha que tenía su ingreso
UPDATE "ingreso_iqf_pallets" lp
SET "fechaCosecha" = i."fechaCosecha"
FROM "ingresos_iqf" i
WHERE lp."ingresoIQFId" = i.id;

-- AlterTable: ahora sí, NOT NULL
ALTER TABLE "ingreso_iqf_pallets" ALTER COLUMN "fechaCosecha" SET NOT NULL;

-- AlterTable: se quita de IngresoIQF, ya vive en cada línea
ALTER TABLE "ingresos_iqf" DROP COLUMN "fechaCosecha";
