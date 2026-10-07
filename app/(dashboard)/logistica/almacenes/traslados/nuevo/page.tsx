import { PageHeader } from "@/components/shared/page-header";
import { calcularSolicitudesTrasladoPendientes } from "@/lib/stock-almacen";
import { TrasladoAlmacenWizard } from "./traslado-almacen-wizard";

export default async function NuevoTrasladoAlmacenPage({
  searchParams,
}: {
  searchParams: Promise<{ solicitudId?: string }>;
}) {
  const { solicitudId } = await searchParams;
  const solicitudesPendientes = await calcularSolicitudesTrasladoPendientes();

  return (
    <div>
      <PageHeader
        titulo="Nuevo traslado entre almacenes"
        descripcion="Ejecuta una solicitud de traslado pendiente: elige qué ítems mover ahora (pueden ser menos de lo solicitado, el resto queda pendiente para después)."
      />
      <TrasladoAlmacenWizard solicitudes={solicitudesPendientes} solicitudIdInicial={solicitudId} />
    </div>
  );
}
