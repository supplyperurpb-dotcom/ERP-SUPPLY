-- CreateTable
CREATE TABLE "familias" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "prefijo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "familias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subfamilias" (
    "id" TEXT NOT NULL,
    "familiaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "prefijo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subfamilias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "familias_nombre_key" ON "familias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "subfamilias_familiaId_nombre_key" ON "subfamilias"("familiaId", "nombre");

-- AddForeignKey
ALTER TABLE "subfamilias" ADD CONSTRAINT "subfamilias_familiaId_fkey" FOREIGN KEY ("familiaId") REFERENCES "familias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: Familias, copiando TIPOS_AGROQUIMICO (lib/constants/sku.ts) + las
-- categorías "Suministros"/"Servicios" que hoy solo existían como texto
-- fijo en los formularios de Creación de Materiales.
INSERT INTO "familias" ("id", "nombre", "prefijo", "orden", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Agroquímico', 'AG', 0, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Fertilizante', 'FE', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Ósmosis', 'OS', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Suministros', 'SU', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Servicios', 'SERV', 4, CURRENT_TIMESTAMP);

-- Seed: Subfamilias de Agroquímico/Fertilizante/Ósmosis, copiando
-- SUBFAMILIAS_AGROQUIMICO + PREFIJO_SUBFAMILIA_AGROQUIMICO. Se duplican
-- bajo cada una de las 3 familias (hoy comparten la misma lista, pero
-- quedan como catálogos independientes a futuro).
INSERT INTO "subfamilias" ("id", "familiaId", "nombre", "prefijo", "orden", "updatedAt")
SELECT gen_random_uuid()::text, f.id, v.nombre, v.prefijo, v.orden, CURRENT_TIMESTAMP
FROM "familias" f, (VALUES
  ('Coadyuvante', 'CO', 0),
  ('Fitorregulador', 'FI', 1),
  ('Foliar', 'FO', 2),
  ('Fungicida', 'FU', 3),
  ('Herbicida', 'HE', 4),
  ('Insecticida', 'IN', 5),
  ('Base', 'BA', 6),
  ('Bioestimulante', 'BE', 7),
  ('Limpieza', 'LI', 8),
  ('Suministro', 'SU', 9)
) AS v(nombre, prefijo, orden)
WHERE f.nombre IN ('Agroquímico', 'Fertilizante', 'Ósmosis');

-- Seed: Subfamilias de Suministros, copiando SUBFAMILIAS_SUMINISTROS +
-- PREFIJO_SUBFAMILIA_SUMINISTRO.
INSERT INTO "subfamilias" ("id", "familiaId", "nombre", "prefijo", "orden", "updatedAt")
SELECT gen_random_uuid()::text, f.id, v.nombre, v.prefijo, v.orden, CURRENT_TIMESTAMP
FROM "familias" f, (VALUES
  ('Abarrotes', 'AB', 0),
  ('Activo', 'AC', 1),
  ('Apicultura', 'AP', 2),
  ('Combustibles', 'CO', 3),
  ('Electricidad', 'EL', 4),
  ('Embalaje', 'EM', 5),
  ('EPP', 'EP', 6),
  ('Farmacia', 'FA', 7),
  ('Ferreteria', 'FE', 8),
  ('Formateria', 'FO', 9),
  ('Gases Comprimidos', 'GC', 10),
  ('Gasfiteria', 'GA', 11),
  ('Herramientas', 'HE', 12),
  ('Instrumentos de Laboratorio', 'IN', 13),
  ('Letreros y Banners', 'LE', 14),
  ('Limpieza', 'LI', 15),
  ('Lubricantes', 'LU', 16),
  ('Materiales de Campo', 'MA', 17),
  ('Materiales de construccion', 'MC', 18),
  ('Merchandising', 'ME', 19),
  ('Muebles y enseres', 'MU', 20),
  ('Plaguicidas', 'PL', 21),
  ('Repuestos', 'RE', 22),
  ('Riego', 'RI', 23),
  ('TI', 'TI', 24),
  ('Utiles de oficina', 'UT', 25),
  ('Varios', 'VA', 26),
  ('Refrigeración', 'RF', 27)
) AS v(nombre, prefijo, orden)
WHERE f.nombre = 'Suministros';

-- Seed: Subfamilias de Servicios, copiando SUBFAMILIAS_SERVICIOS (sin
-- prefijo: el código de Servicios no depende de la subfamilia).
INSERT INTO "subfamilias" ("id", "familiaId", "nombre", "prefijo", "orden", "updatedAt")
SELECT gen_random_uuid()::text, f.id, v.nombre, NULL, v.orden, CURRENT_TIMESTAMP
FROM "familias" f, (VALUES
  ('Servicios Varios', 0),
  ('Consultoría Legal', 1),
  ('Obras Civiles', 2),
  ('Obras Eléctricas', 3),
  ('Alquiler de Maquinaria', 4),
  ('Alquiler de Equipos', 5),
  ('Alquiler de Vehículos Menores', 6),
  ('Transporte de Personal', 7),
  ('Transporte de materiales', 8),
  ('Sistema de Riego', 9),
  ('Servicios Generales', 10),
  ('Alimentación', 11),
  ('Infraestructura de Campo', 12),
  ('Mantenimiento de Vehículos', 13),
  ('Seguros Locales', 14),
  ('Auditorias de Campo', 15),
  ('Auditorias Financiera', 16),
  ('Consultoría Tributaria', 17),
  ('Consultoría Contable', 18),
  ('Consultoría Campo', 19),
  ('Análisis de Laboratorio', 20),
  ('Servicios Administrativos', 21),
  ('Apicultura', 22),
  ('Calibración de materiales y equipos', 23),
  ('Seguridad Privada', 24),
  ('Servicio de maquila de fruta', 25),
  ('Fletes Marítimos', 26)
) AS v(nombre, orden)
WHERE f.nombre = 'Servicios';
