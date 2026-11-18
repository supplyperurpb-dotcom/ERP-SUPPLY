-- Quita DNI de TipoDocumentoIdentidad (0 proveedores usaban DNI al momento
-- de esta migración) — Postgres no permite DROP VALUE directo en un enum,
-- se recrea el tipo.
BEGIN;
CREATE TYPE "TipoDocumentoIdentidad_new" AS ENUM ('RUC', 'EXTRANJERO');
ALTER TABLE "proveedores" ALTER COLUMN "tipoDocumento" TYPE "TipoDocumentoIdentidad_new" USING ("tipoDocumento"::text::"TipoDocumentoIdentidad_new");
ALTER TYPE "TipoDocumentoIdentidad" RENAME TO "TipoDocumentoIdentidad_old";
ALTER TYPE "TipoDocumentoIdentidad_new" RENAME TO "TipoDocumentoIdentidad";
DROP TYPE "TipoDocumentoIdentidad_old";
COMMIT;
