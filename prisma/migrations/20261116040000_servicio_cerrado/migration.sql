-- AlterTable
ALTER TABLE "servicios_gestionados"
  ADD COLUMN "cerrado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fechaCierre" TIMESTAMP(3);
