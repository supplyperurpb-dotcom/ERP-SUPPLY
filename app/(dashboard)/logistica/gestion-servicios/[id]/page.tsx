import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { RegistrarAvanceBoton } from "./registrar-avance-boton";

// Landing de "Avance OS {número}" — pedido explícito: solo 2 botones acá
// ("Registrar Avance" crea una nueva sesión numerada y navega a ella, ver
// RegistrarAvanceBoton; "Anterior" vuelve a Gestión de Servicios). El
// selector "Añadir Items" y la tabla de ítems/avance viven uno por sesión,
// en /registro/[numero].
export default async function AvanceOsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const servicio = await prisma.servicioGestionado.findUnique({
    where: { ordenCompraId: id },
    include: { ordenCompra: { include: { proveedor: true } } },
  });
  if (!servicio) notFound();

  return (
    <div>
      <PageHeader titulo={`Avance OS ${servicio.ordenCompra.numero}`} descripcion={servicio.ordenCompra.proveedor.razonSocial} />
      <div className="flex gap-3">
        <RegistrarAvanceBoton servicioGestionadoId={servicio.id} ordenCompraId={servicio.ordenCompraId} />
        <Button variant="outline" asChild>
          <Link href="/logistica/gestion-servicios">Anterior</Link>
        </Button>
      </div>
    </div>
  );
}
