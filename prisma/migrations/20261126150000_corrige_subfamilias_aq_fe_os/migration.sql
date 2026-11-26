-- Corrige la siembra de la migración 20261126120000_familia_subfamilia,
-- que por error duplicó las mismas 10 subfamilias en Agroquímico,
-- Fertilizante y Ósmosis. La lista real de cada una (verificada contra
-- los SKU ya creados en producción, agrupando por el prefijo de su código
-- AG/FE/OS y leyendo su Sku.subfamilia real) es:
--   - Agroquímico: Coadyuvante, Fitorregulador, Foliar, Fungicida, Herbicida, Insecticida
--   - Fertilizante: Base, Bioestimulante
--   - Ósmosis: Limpieza, Suministro
-- No se tocó Suministros (su lista ya era correcta) ni Servicios.
DELETE FROM "subfamilias"
WHERE "familiaId" IN (SELECT "id" FROM "familias" WHERE "nombre" = 'Agroquímico')
  AND "nombre" IN ('Base', 'Bioestimulante', 'Limpieza', 'Suministro');

DELETE FROM "subfamilias"
WHERE "familiaId" IN (SELECT "id" FROM "familias" WHERE "nombre" = 'Fertilizante')
  AND "nombre" IN ('Coadyuvante', 'Fitorregulador', 'Foliar', 'Fungicida', 'Herbicida', 'Insecticida', 'Limpieza', 'Suministro');

DELETE FROM "subfamilias"
WHERE "familiaId" IN (SELECT "id" FROM "familias" WHERE "nombre" = 'Ósmosis')
  AND "nombre" IN ('Coadyuvante', 'Fitorregulador', 'Foliar', 'Fungicida', 'Herbicida', 'Insecticida', 'Base', 'Bioestimulante');
