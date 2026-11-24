-- Elimina los correos de rechazo de prueba registrados durante la
-- verificación en vivo de la funcionalidad (ninguno cruzó con un Packing
-- List real) para no arrastrar valores del enum viejo (ON DELETE CASCADE
-- se encarga de sus rechazo_items).
DELETE FROM "rechazo_correos";

-- Ya no hay "disposición sugerida" separada (pedido explícito): queda
-- solo "categoriaFinal", editable en cualquier momento.
ALTER TABLE "rechazo_items" DROP COLUMN "disposicionSugerida";
ALTER TABLE "rechazo_items" DROP COLUMN "categoriaSugerida";

-- Postgres no permite quitar valores de un enum directamente: se crea el
-- tipo nuevo con los valores reales que se van a usar (Terminal Market,
-- Non-Fresh, Donation, y Pass para la fruta buena) y se migra la columna.
ALTER TYPE "CategoriaRechazo" RENAME TO "CategoriaRechazo_old";
CREATE TYPE "CategoriaRechazo" AS ENUM ('TERMINAL_MARKET', 'NON_FRESH', 'DONATION', 'PASS');
ALTER TABLE "rechazo_items" ALTER COLUMN "categoriaFinal" TYPE "CategoriaRechazo" USING ("categoriaFinal"::text::"CategoriaRechazo");
DROP TYPE "CategoriaRechazo_old";
