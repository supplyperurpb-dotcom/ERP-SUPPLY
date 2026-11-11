-- Nuevo rol COMPRADORES (ver enum RolNombre): único rol habilitado para
-- "cerrar posición" (Solped y OC/OS) y para crear/editar Órdenes de
-- compra y servicio.
ALTER TYPE "RolNombre" ADD VALUE 'COMPRADORES';

-- "Cerrar posición" en Solicitud de pedido -- mismo patrón que ya existe
-- en orden_compra_items.cerrado (ver migración 20261023040749).
ALTER TABLE "solicitud_pedido_items" ADD COLUMN     "cerrado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cerradoPorId" TEXT,
ADD COLUMN     "fechaCierre" TIMESTAMP(3),
ADD COLUMN     "motivoCierre" TEXT;
