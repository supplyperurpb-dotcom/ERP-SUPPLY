import { Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db/prisma";
import { ProveedorFormDialog } from "./proveedor-form-dialog";
import { ProveedorTable } from "./proveedor-table";

export default async function ProveedoresPage() {
  const proveedores = await prisma.proveedor.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader
        titulo="Proveedores"
        descripcion="Proveedores de insumos y fundos proveedores de fruta."
        acciones={<ProveedorFormDialog />}
      />

      {proveedores.length === 0 ? (
        <EmptyState
          icono={Users}
          titulo="Aún no hay proveedores registrados"
          descripcion="Registra el primer proveedor de insumos o fundo proveedor de fruta."
        />
      ) : (
        <ProveedorTable proveedores={proveedores} />
      )}
    </div>
  );
}
