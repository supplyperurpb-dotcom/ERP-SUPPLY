-- Seed: catálogo inicial de Condición de pago, copiando CONDICIONES_PAGO
-- (lib/constants/compras.ts), que deja de ser la lista fija — pedido
-- explícito, 2026-11-27: se puede crear una nueva condición de pago al
-- crear un Proveedor y que quede disponible para los siguientes.
INSERT INTO "lista_valores" ("id", "tipo", "nombre", "orden", "updatedAt") VALUES
  (gen_random_uuid()::text, 'CONDICION_PAGO', 'CONTADO', 0, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CONDICION_PAGO', 'CREDITO 7 DIAS', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CONDICION_PAGO', 'CREDITO 15 DIAS', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CONDICION_PAGO', 'CREDITO 30 DIAS', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CONDICION_PAGO', 'CREDITO 45 DIAS', 4, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CONDICION_PAGO', 'CREDITO 60 DIAS', 5, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CONDICION_PAGO', 'CREDITO 90 DIAS', 6, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CONDICION_PAGO', 'CREDITO 120 DIAS', 7, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CONDICION_PAGO', 'FN 30 DIAS', 8, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CONDICION_PAGO', 'FN 45 DIAS', 9, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CONDICION_PAGO', 'FN 60 DIAS', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CONDICION_PAGO', 'FN 90 DIAS', 11, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CONDICION_PAGO', 'FN 120 DIAS', 12, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CONDICION_PAGO', 'SEGUN NEGOCIACION', 13, CURRENT_TIMESTAMP);
