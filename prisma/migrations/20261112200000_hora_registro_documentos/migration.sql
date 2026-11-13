-- AlterTable: agrega "hora" ("HH:MM", bloqueada en el formulario, igual
-- que ConsumoAlmacen.horaRetiro) a los documentos que todavía no la
-- tenían. Nullable y sin backfill: los registros ya existentes quedan en
-- null (se muestran como "—"), solo los nuevos la capturan.
ALTER TABLE "solicitudes_pedido" ADD COLUMN     "hora" TEXT;
ALTER TABLE "ordenes_compra" ADD COLUMN     "hora" TEXT;
ALTER TABLE "ingresos_almacen" ADD COLUMN     "hora" TEXT;
ALTER TABLE "traslados_almacen" ADD COLUMN     "hora" TEXT;
ALTER TABLE "devoluciones_almacen" ADD COLUMN     "hora" TEXT;
ALTER TABLE "solicitudes_despacho" ADD COLUMN     "hora" TEXT;
