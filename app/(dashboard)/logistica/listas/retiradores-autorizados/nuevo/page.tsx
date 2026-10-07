import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { RetiradorAutorizadoForm } from "../retirador-autorizado-form";

export default async function NuevoRetiradorAutorizadoPage() {
  const almacenes = await prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });

  return (
    <div>
      <PageHeader
        titulo="Nuevo retirador autorizado"
        descripcion="Registra a la persona y marca de qué almacenes puede retirar materiales."
      />
      <RetiradorAutorizadoForm almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))} />
    </div>
  );
}
