import { Truck, IdCard } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db/prisma";
import { CamionFormDialog } from "./camion-form-dialog";
import { CamionTable } from "./camion-table";
import { ConductorFormDialog } from "./conductor-form-dialog";
import { ConductorTable } from "./conductor-table";

export default async function TransportePage() {
  const [camiones, conductores, proveedoresTransporte] = await Promise.all([
    prisma.camion.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.conductor.findMany({
      include: { proveedor: { select: { razonSocial: true, numeroDocumento: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.proveedor.findMany({
      where: { activo: true, tipo: "TRANSPORTE" },
      orderBy: { razonSocial: "asc" },
      select: { id: true, razonSocial: true, numeroDocumento: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Información Transporte"
        descripcion="Conductores y camiones disponibles para elegir al registrar un Despacho."
      />

      <div className="space-y-8">
        <section>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h2 className="text-lg font-semibold tracking-tight">Conductores</h2>
            <ConductorFormDialog proveedores={proveedoresTransporte} />
          </div>
          {conductores.length === 0 ? (
            <EmptyState
              icono={IdCard}
              titulo="Aún no hay conductores registrados"
              descripcion="Crea el primer conductor con el botón de arriba."
            />
          ) : (
            <ConductorTable conductores={conductores} proveedores={proveedoresTransporte} />
          )}
        </section>

        <section>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h2 className="text-lg font-semibold tracking-tight">Camiones</h2>
            <CamionFormDialog />
          </div>
          {camiones.length === 0 ? (
            <EmptyState
              icono={Truck}
              titulo="Aún no hay camiones registrados"
              descripcion="Crea el primer camión con el botón de arriba."
            />
          ) : (
            <CamionTable camiones={camiones} />
          )}
        </section>
      </div>
    </div>
  );
}
