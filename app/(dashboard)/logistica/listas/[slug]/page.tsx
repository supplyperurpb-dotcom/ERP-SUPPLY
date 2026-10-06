import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { configTipoLista } from "@/lib/constants/listas";
import { ListaValoresTable } from "./lista-valores-table";

export default async function ListaValoresPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = configTipoLista(slug);
  if (!config) notFound();

  const valores = await prisma.listaValor.findMany({
    where: { tipo: config.tipo },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
  });

  return (
    <div>
      <PageHeader
        titulo={config.nombre}
        descripcion={`Valores de ${config.nombreSingular} disponibles al crear una solicitud de pedido.`}
      />
      <ListaValoresTable tipo={config.tipo} valores={valores} nombreSingular={config.nombreSingular} />
    </div>
  );
}
