import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { CategoriasView } from "./categorias-view";

export default async function CategoriasPage() {
  const familias = await prisma.familia.findMany({
    orderBy: { orden: "asc" },
    include: { subfamilias: { orderBy: { orden: "asc" } } },
  });

  return (
    <div>
      <PageHeader
        titulo="Categorías — Creación de Materiales"
        descripcion="Familias y subfamilias usadas al crear un SKU nuevo. Lo que se agregue o desactive aquí se refleja de inmediato en Creación de Materiales."
      />
      <CategoriasView familias={familias} />
    </div>
  );
}
