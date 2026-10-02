import { PageHeader } from "@/components/shared/page-header";
import { ServicioForm } from "./servicio-form";

export default function NuevoSkuServicioPage() {
  return (
    <div>
      <PageHeader titulo="Nuevo SKU — Servicios" descripcion="El código se genera automáticamente: SERV + correlativo." />
      <ServicioForm />
    </div>
  );
}
