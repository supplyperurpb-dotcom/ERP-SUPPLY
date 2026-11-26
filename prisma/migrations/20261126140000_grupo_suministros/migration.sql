-- AlterTable
ALTER TABLE "skus" ADD COLUMN "grupo" TEXT;

-- CreateTable
CREATE TABLE "grupos" (
    "id" TEXT NOT NULL,
    "subfamiliaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grupos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grupos_subfamiliaId_nombre_key" ON "grupos"("subfamiliaId", "nombre");

-- AddForeignKey
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_subfamiliaId_fkey" FOREIGN KEY ("subfamiliaId") REFERENCES "subfamilias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: un Grupo por cada Subfamilia de la familia Suministros, con el
-- mismo nombre (pedido explícito del usuario, 2026-11-26), para que
-- ninguna quede sin al menos un grupo que elegir en Creación de Materiales.
INSERT INTO "grupos" ("id", "subfamiliaId", "nombre", "orden", "updatedAt")
SELECT gen_random_uuid()::text, s.id, s.nombre, s.orden, CURRENT_TIMESTAMP
FROM "subfamilias" s
JOIN "familias" f ON f.id = s."familiaId"
WHERE f.nombre = 'Suministros';
