-- Limpieza cosmética: Postgres no renombra automáticamente los nombres de
-- constraints/índices al hacer RENAME TABLE/COLUMN (migración anterior).
-- Esto solo les cambia el nombre para que coincidan con las tablas ya
-- renombradas — no toca ningún dato.

ALTER TABLE "despachos_industrial" RENAME CONSTRAINT "despachos_iqf_pkey" TO "despachos_industrial_pkey";
ALTER TABLE "ingreso_industrial_pallets" RENAME CONSTRAINT "ingreso_iqf_pallets_pkey" TO "ingreso_industrial_pallets_pkey";
ALTER TABLE "ingresos_industrial" RENAME CONSTRAINT "ingresos_iqf_pkey" TO "ingresos_industrial_pkey";
ALTER TABLE "pallets_industrial" RENAME CONSTRAINT "pallets_iqf_pkey" TO "pallets_industrial_pkey";
ALTER TABLE "tarjas_industrial" RENAME CONSTRAINT "tarjas_iqf_pkey" TO "tarjas_industrial_pkey";

ALTER TABLE "ingreso_fruta_pallets" RENAME CONSTRAINT "ingreso_fruta_pallets_palletIQFId_fkey" TO "ingreso_fruta_pallets_palletIndustrialId_fkey";
ALTER TABLE "ingreso_industrial_pallets" RENAME CONSTRAINT "ingreso_iqf_pallets_ingresoIQFId_fkey" TO "ingreso_industrial_pallets_ingresoIndustrialId_fkey";
ALTER TABLE "ingreso_industrial_pallets" RENAME CONSTRAINT "ingreso_iqf_pallets_palletId_fkey" TO "ingreso_industrial_pallets_palletId_fkey";
ALTER TABLE "ingreso_industrial_pallets" RENAME CONSTRAINT "ingreso_iqf_pallets_tipoBandejaId_fkey" TO "ingreso_industrial_pallets_tipoBandejaId_fkey";
ALTER TABLE "ingreso_industrial_pallets" RENAME CONSTRAINT "ingreso_iqf_pallets_tipoPalletId_fkey" TO "ingreso_industrial_pallets_tipoPalletId_fkey";
ALTER TABLE "ingresos_industrial" RENAME CONSTRAINT "ingresos_iqf_proveedorId_fkey" TO "ingresos_industrial_proveedorId_fkey";
ALTER TABLE "tarjas_industrial" RENAME CONSTRAINT "tarjas_iqf_despachoId_fkey" TO "tarjas_industrial_despachoId_fkey";
ALTER TABLE "tarjas_industrial" RENAME CONSTRAINT "tarjas_iqf_palletId_fkey" TO "tarjas_industrial_palletId_fkey";

ALTER INDEX "despachos_iqf_numero_key" RENAME TO "despachos_industrial_numero_key";
ALTER INDEX "ingreso_iqf_pallets_ingresoIQFId_numeroPallet_key" RENAME TO "ingreso_industrial_pallets_ingresoIndustrialId_numeroPallet_key";
ALTER INDEX "ingresos_iqf_numero_key" RENAME TO "ingresos_industrial_numero_key";
ALTER INDEX "pallets_iqf_numero_key" RENAME TO "pallets_industrial_numero_key";
ALTER INDEX "tarjas_iqf_numero_key" RENAME TO "tarjas_industrial_numero_key";
ALTER INDEX "tarjas_iqf_palletId_key" RENAME TO "tarjas_industrial_palletId_key";
