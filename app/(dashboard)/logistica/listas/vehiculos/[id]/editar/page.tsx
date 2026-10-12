import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { VehiculoForm } from "../../vehiculo-form";
import type { VehiculoInput } from "@/lib/validations/vehiculo";

export default async function EditarVehiculoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id } });
  if (!vehiculo) notFound();

  const valoresIniciales: VehiculoInput = {
    placa: vehiculo.placa,
    areaUsuaria: vehiculo.areaUsuaria,
    tipo: vehiculo.tipo,
  };

  return (
    <div>
      <PageHeader titulo={`Editar vehículo: ${vehiculo.placa}`} descripcion="Modifica los datos de este vehículo." />
      <VehiculoForm edicion={{ id: vehiculo.id, valoresIniciales }} />
    </div>
  );
}
