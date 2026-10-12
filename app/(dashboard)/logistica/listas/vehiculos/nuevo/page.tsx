import { PageHeader } from "@/components/shared/page-header";
import { VehiculoForm } from "../vehiculo-form";

export default function NuevoVehiculoPage() {
  return (
    <div>
      <PageHeader titulo="Nuevo vehículo" descripcion="Registra la placa, el área usuaria y el tipo de vehículo." />
      <VehiculoForm />
    </div>
  );
}
