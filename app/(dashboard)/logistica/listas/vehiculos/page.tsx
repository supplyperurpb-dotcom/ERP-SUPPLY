import Link from "next/link";
import { Truck, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { AREAS_EMPRESA } from "@/lib/constants/compras";
import { TIPOS_VEHICULO } from "@/lib/validations/vehiculo";
import { VehiculosTable, type FilaVehiculo } from "./vehiculos-table";

export default async function VehiculosPage() {
  const vehiculos = await prisma.vehiculo.findMany({
    orderBy: [{ activo: "desc" }, { placa: "asc" }],
  });

  const filas: FilaVehiculo[] = vehiculos.map((v) => ({
    id: v.id,
    placa: v.placa,
    areaUsuaria: AREAS_EMPRESA.find((a) => a.valor === v.areaUsuaria)?.nombre ?? v.areaUsuaria,
    tipo: TIPOS_VEHICULO.find((t) => t.valor === v.tipo)?.nombre ?? v.tipo,
    activo: v.activo,
  }));

  return (
    <div>
      <PageHeader
        titulo="Vehículos"
        descripcion="Placas registradas para despachar combustible — se usan al registrar un Consumo de un almacén de Combustible."
        acciones={
          <Button asChild>
            <Link href="/logistica/listas/vehiculos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo vehículo
            </Link>
          </Button>
        }
      />

      {vehiculos.length === 0 ? (
        <EmptyState icono={Truck} titulo="Aún no hay vehículos registrados" descripcion="Registra el primero con el botón de arriba." />
      ) : (
        <VehiculosTable filas={filas} />
      )}
    </div>
  );
}
