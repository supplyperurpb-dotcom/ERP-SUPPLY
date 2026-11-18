import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { nombreCompletoRetirador } from "@/lib/utils";
import { areasDeGerenciaSolped, type GerenciaSolpedCodigo } from "@/lib/constants/compras";
import { RetiradorAutorizadoForm } from "../../retirador-autorizado-form";
import type { RetiradorAutorizadoInput } from "@/lib/validations/retirador-autorizado";

export default async function EditarRetiradorAutorizadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [retirador, almacenes] = await Promise.all([
    prisma.retiradorAutorizado.findUnique({ where: { id }, include: { almacenesPermitidos: true } }),
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);
  if (!retirador) notFound();

  const gerencia = retirador.area as GerenciaSolpedCodigo;
  const valoresIniciales: RetiradorAutorizadoInput = {
    nombres: retirador.nombres,
    apellidoPaterno: retirador.apellidoPaterno,
    // "" para un retirador creado antes de que este campo fuera
    // obligatorio: el formulario lo deja en blanco y exige completarlo.
    apellidoMaterno: retirador.apellidoMaterno ?? "",
    dni: retirador.dni,
    // Ver nota equivalente en devoluciones/[id]/editar/page.tsx.
    area: gerencia,
    // Retiradores creados antes de este campo no tienen areaDetalle: se
    // precarga con la primera área de su gerencia para que el formulario
    // no arranque con un valor inválido.
    areaDetalle: retirador.areaDetalle ?? areasDeGerenciaSolped(gerencia)[0]?.valor ?? "",
    almacenesPermitidosIds: retirador.almacenesPermitidos.map((p) => p.almacenId),
  };

  return (
    <div>
      <PageHeader
        titulo={`Editar retirador: ${nombreCompletoRetirador(retirador)}`}
        descripcion="Modifica los datos o los almacenes permitidos de este retirador."
      />
      <RetiradorAutorizadoForm
        almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
        edicion={{ id: retirador.id, valoresIniciales }}
      />
    </div>
  );
}
