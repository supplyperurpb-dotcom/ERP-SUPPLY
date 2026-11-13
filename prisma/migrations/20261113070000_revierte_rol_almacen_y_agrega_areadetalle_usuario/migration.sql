-- Revierte el rol ALMACEN: "Almacén" no es un rol, es un Área dentro de
-- la Gerencia Supply Chain (mismo organigrama que SolicitudPedido ya
-- usa — ver AREAS_SOLPED en lib/constants/compras.ts). Ninguna fila de
-- "roles" llegó a usar este valor (se agregó y se revirtió en la misma
-- sesión, antes de asignárselo a nadie), así que no hace falta backfill.
ALTER TYPE "RolNombre" RENAME TO "RolNombre_old";
CREATE TYPE "RolNombre" AS ENUM ('ADMIN', 'LOGISTICA_COMPRAS', 'ACOPIO', 'COMEX', 'APROBADOR', 'APROBADOR_GENERAL', 'ANULADOR', 'SOLO_LECTURA', 'COMPRADORES');
ALTER TABLE "roles" ALTER COLUMN "nombre" TYPE "RolNombre" USING ("nombre"::text::"RolNombre");
DROP TYPE "RolNombre_old";

-- AlterTable: Usuario gana areaDetalle (nivel 2, dentro de su Gerencia) —
-- igual patrón que SolicitudPedido.areaDetalle.
ALTER TABLE "usuarios" ADD COLUMN     "areaDetalle" TEXT;
