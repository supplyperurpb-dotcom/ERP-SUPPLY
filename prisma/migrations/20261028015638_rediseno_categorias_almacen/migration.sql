-- AlterEnum
BEGIN;
CREATE TYPE "AlmacenCategoriaGeneral_new" AS ENUM ('PESTICIDAS', 'FERTILIZANTES', 'COMBUSTIBLE', 'SUMINISTROS', 'EMPAQUES');
ALTER TABLE "almacenes" ALTER COLUMN "categoriaGeneral" TYPE "AlmacenCategoriaGeneral_new" USING ("categoriaGeneral"::text::"AlmacenCategoriaGeneral_new");
ALTER TYPE "AlmacenCategoriaGeneral" RENAME TO "AlmacenCategoriaGeneral_old";
ALTER TYPE "AlmacenCategoriaGeneral_new" RENAME TO "AlmacenCategoriaGeneral";
DROP TYPE "AlmacenCategoriaGeneral_old";
COMMIT;

