import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { RetiradorAutorizadoForm } from "../../retirador-autorizado-form";
import type { RetiradorAutorizadoInput } from "@/lib/validations/retirador-autorizado";

export default async function EditarRetiradorAutorizadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [retirador, almacenes] = await Promise.all([
    prisma.retiradorAutorizado.findUnique({ where: { id }, include: { almacenesPermitidos: true } }),
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);
  if (!retirador) notFound();

  const valoresIniciales: RetiradorAutorizadoInput = {
    nombres: retirador.nombres,
    apellidos: retirador.apellidos,
    dni: retirador.dni,
    area: retirador.area,
    almacenesPermitidosIds: retirador.almacenesPermitidos.map((p) => p.almacenId),
  };

  return (
    <div>
      <PageHeader
        titulo={`Editar retirador: ${retirador.nombres} ${retirador.apellidos}`}
        descripcion="Modifica los datos o los almacenes permitidos de este retirador."
      />
      <RetiradorAutorizadoForm
        almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
        edicion={{ id: retirador.id, valoresIniciales }}
      />
    </div>
  );
}
