import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { GERENCIAS_SOLPED, AREAS_SOLPED } from "@/lib/constants/compras";
import { nombreCompletoRetirador } from "@/lib/utils";
import { RetiradoresAutorizadosTable, type FilaRetiradorAutorizado } from "./retiradores-autorizados-table";

export default async function RetiradoresAutorizadosPage() {
  const retiradores = await prisma.retiradorAutorizado.findMany({
    include: { almacenesPermitidos: { include: { almacen: true } } },
    orderBy: [{ activo: "desc" }, { apellidoPaterno: "asc" }],
  });

  const filas: FilaRetiradorAutorizado[] = retiradores.map((r) => {
    const nombreGerencia = GERENCIAS_SOLPED.find((g) => g.valor === r.area)?.nombre ?? r.area;
    const nombreArea = AREAS_SOLPED.find((a) => a.valor === r.areaDetalle)?.nombre;
    return {
      id: r.id,
      nombreCompleto: nombreCompletoRetirador(r),
      dni: r.dni,
      area: nombreArea && nombreArea !== nombreGerencia ? `${nombreGerencia} — ${nombreArea}` : nombreGerencia,
      almacenes: r.almacenesPermitidos.map((p) => p.almacen.nombre),
      activo: r.activo,
    };
  });

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
