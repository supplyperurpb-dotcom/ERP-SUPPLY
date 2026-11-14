-- Conductor ya no exige Proveedor al crearse (ver formulario de
-- Información Transporte): ahora tiene su propio tipo Propio/Tercero,
-- reutilizando el mismo enum que VehiculoTransporte.tipo.
-- proveedorId pasa a ser opcional; las filas existentes conservan el
-- proveedor que ya tenían (todas eran de un proveedor de transporte, por
-- lo que se backfillean como TERCERO).
ALTER TABLE "conductores" ALTER COLUMN "proveedorId" DROP NOT NULL;
ALTER TABLE "conductores" ADD COLUMN "tipo" "TipoPropiedadVehiculoTransporte" NOT NULL DEFAULT 'TERCERO';
