-- Mueve el "Fundo" (proveedorId) de la cabecera de Ingreso de Materia
-- Prima (IngresoFruta) a cada línea de pesaje (IngresoFrutaPallet),
-- porque un mismo camión puede traer fruta de dos fundos distintos.
-- Con backfill: cada línea existente hereda el fundo que tenía su
-- ingreso antes de este cambio, así que no se pierde ningún dato.

-- 1. Columna nueva en la línea (nullable por ahora, para poder backfillear)
ALTER TABLE "ingreso_fruta_pallets" ADD COLUMN "proveedorId" TEXT;

-- 2. Backfill: cada línea hereda el proveedor que tenía su ingreso (cabecera)
UPDATE "ingreso_fruta_pallets" AS linea
SET "proveedorId" = cabecera."proveedorId"
FROM "ingresos_fruta" AS cabecera
WHERE linea."ingresoFrutaId" = cabecera.id;

-- 3. Ya con todas las líneas backfilleadas, se vuelve obligatoria
ALTER TABLE "ingreso_fruta_pallets" ALTER COLUMN "proveedorId" SET NOT NULL;

-- 4. FK de la línea hacia Proveedor
ALTER TABLE "ingreso_fruta_pallets" ADD CONSTRAINT "ingreso_fruta_pallets_proveedorId_fkey"
  FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Quitar la columna de la cabecera (ya no se usa, cada línea tiene la suya)
ALTER TABLE "ingresos_fruta" DROP CONSTRAINT "ingresos_fruta_proveedorId_fkey";
ALTER TABLE "ingresos_fruta" DROP COLUMN "proveedorId";
