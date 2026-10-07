import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { AREAS_EMPRESA } from "@/lib/constants/compras";
import { RetiradoresAutorizadosTable, type FilaRetiradorAutorizado } from "./retiradores-autorizados-table";

export default async function RetiradoresAutorizadosPage() {
  const retiradores = await prisma.retiradorAutorizado.findMany({
    include: { almacenesPermitidos: { include: { almacen: true } } },
    orderBy: [{ activo: "desc" }, { apellidos: "asc" }],
  });

  const filas: FilaRetiradorAutorizado[] = retiradores.map((r) => ({
    id: r.id,
    nombreCompleto: `${r.nombres} ${r.apellidos}`,
    dni: r.dni,
    area: AREAS_EMPRESA.find((a) => a.valor === r.area)?.nombre ?? r.area,
    almacenes: r.almacenesPermitidos.map((p) => p.almacen.nombre),
    activo: r.activo,
  }));

  return (
    <div>
      <PageHeader
        titulo="Retiradores autorizados"
        descripcion="Personas autorizadas a retirar materiales en un Consumo de almacén, con qué almacenes puede retirar cada una."
        acciones={
          <Button asChild>
            <Link href="/logistica/listas/retiradores-autorizados/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo retirador
            </Link>
          </Button>
        }
      />

      {retiradores.length === 0 ? (
        <EmptyState
          icono={Users}
          titulo="Aún no hay retiradores autorizados"
          descripcion="Registra el primero con el botón de arriba."
        />
      ) : (
        <RetiradoresAutorizadosTable filas={filas} />
      )}
    </div>
  );
}
