-- CreateTable: nuevo nivel "Registro de Avance" (numerado) entre
-- ServicioGestionado e ItemServicioGestionado.
CREATE TABLE "registros_avance" (
    "id" TEXT NOT NULL,
    "servicioGestionadoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_avance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registros_avance_servicioGestionadoId_numero_key" ON "registros_avance"("servicioGestionadoId", "numero");

ALTER TABLE "registros_avance" ADD CONSTRAINT "registros_avance_servicioGestionadoId_fkey" FOREIGN KEY ("servicioGestionadoId") REFERENCES "servicios_gestionados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: un "Registro de Avance Nº1" por cada ServicioGestionado que
-- ya tuviera ítems en seguimiento (datos de prueba previos a este cambio),
-- para no perderlos.
INSERT INTO "registros_avance" ("id", "servicioGestionadoId", "numero", "createdAt")
SELECT gen_random_uuid()::text, d."servicioGestionadoId", 1, now()
FROM (SELECT DISTINCT "servicioGestionadoId" FROM "items_servicio_gestionado") AS d;

-- AlterTable: items_servicio_gestionado pasa a depender de un
-- RegistroAvance en vez de depender directo del ServicioGestionado.
ALTER TABLE "items_servicio_gestionado" ADD COLUMN "registroAvanceId" TEXT;

UPDATE "items_servicio_gestionado" isg
SET "registroAvanceId" = ra."id"
FROM "registros_avance" ra
WHERE ra."servicioGestionadoId" = isg."servicioGestionadoId" AND ra."numero" = 1;

ALTER TABLE "items_servicio_gestionado" ALTER COLUMN "registroAvanceId" SET NOT NULL;

ALTER TABLE "items_servicio_gestionado" DROP CONSTRAINT "items_servicio_gestionado_servicioGestionadoId_fkey";
DROP INDEX "items_servicio_gestionado_ordenCompraItemId_key";
ALTER TABLE "items_servicio_gestionado" DROP COLUMN "servicioGestionadoId";

ALTER TABLE "items_servicio_gestionado" ADD CONSTRAINT "items_servicio_gestionado_registroAvanceId_fkey" FOREIGN KEY ("registroAvanceId") REFERENCES "registros_avance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "items_registro_avance_registroAvanceId_ordenCompraItemId_key" ON "items_servicio_gestionado"("registroAvanceId", "ordenCompraItemId");

ALTER TABLE "items_servicio_gestionado" RENAME TO "items_registro_avance";
ALTER TABLE "items_registro_avance" RENAME CONSTRAINT "items_servicio_gestionado_pkey" TO "items_registro_avance_pkey";
ALTER TABLE "items_registro_avance" RENAME CONSTRAINT "items_servicio_gestionado_registroAvanceId_fkey" TO "items_registro_avance_registroAvanceId_fkey";
ALTER TABLE "items_registro_avance" RENAME CONSTRAINT "items_servicio_gestionado_ordenCompraItemId_fkey" TO "items_registro_avance_ordenCompraItemId_fkey";

-- AlterTable: avances_servicio_item apunta a items_registro_avance.
ALTER TABLE "avances_servicio_item" RENAME COLUMN "itemServicioGestionadoId" TO "itemRegistroAvanceId";
ALTER TABLE "avances_servicio_item" RENAME CONSTRAINT "avances_servicio_item_itemServicioGestionadoId_fkey" TO "avances_servicio_item_itemRegistroAvanceId_fkey";
