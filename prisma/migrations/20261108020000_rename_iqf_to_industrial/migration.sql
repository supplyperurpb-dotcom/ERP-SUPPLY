-- Renombra el flujo "IQF" a "Industrial" en toda la base de datos.
-- Todo con RENAME (nunca DROP/CREATE) para no perder ningún dato ya
-- registrado: tablas, columnas y el enum conservan su contenido intacto,
-- solo cambia el nombre.

-- Enum
ALTER TYPE "OrigenPalletIQF" RENAME TO "OrigenPalletIndustrial";

-- Tablas
ALTER TABLE "ingresos_iqf" RENAME TO "ingresos_industrial";
ALTER TABLE "pallets_iqf" RENAME TO "pallets_industrial";
ALTER TABLE "ingreso_iqf_pallets" RENAME TO "ingreso_industrial_pallets";
ALTER TABLE "tarjas_iqf" RENAME TO "tarjas_industrial";
ALTER TABLE "despachos_iqf" RENAME TO "despachos_industrial";

-- Columnas
ALTER TABLE "ingreso_industrial_pallets" RENAME COLUMN "ingresoIQFId" TO "ingresoIndustrialId";
ALTER TABLE "ingreso_fruta_pallets" RENAME COLUMN "palletIQFId" TO "palletIndustrialId";
