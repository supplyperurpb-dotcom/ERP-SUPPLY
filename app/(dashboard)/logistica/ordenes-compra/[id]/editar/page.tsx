import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { getUsuarioActual } from "@/lib/auth/session";
import { fechaInputValue } from "@/lib/utils";
import { NOMBRE_ORDEN, type CategoriaCompraCodigo } from "@/lib/constants/compras";
import { OrdenCompraEditarForm } from "./orden-compra-editar-form";

export default async function EditarOrdenCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const orden = await prisma.ordenCompra.findUnique({
    where: { id },
    include: { items: { include: { sku: true } } },
  });
  if (!orden) notFound();

  const usuario = await getUsuarioActual();
  // Mismo criterio que editarOrdenCompraAction: quien la creó, o Supply
  // Chain/ADMIN — y solo si está en BORRADOR (ver AnularFirmaBoton en el
  // detalle para cómo se vuelve a ese estado una vez firmada).
  const puedeEditar =
    !!usuario &&
    orden.estado === "BORRADOR" &&
    (usuario.roles.includes("ADMIN") || usuario.area === "SUPPLY_CHAIN" || orden.creadoPorId === usuario.id);
  if (!puedeEditar) notFound();

  const categoria = orden.categoria as CategoriaCompraCodigo;

  const proveedores = await prisma.proveedor.findMany({
    where: { activo: true },
    orderBy: { razonSocial: "asc" },
  });

  return (
    <div>
      <PageHeader
        titulo={`Editar ${NOMBRE_ORDEN[categoria].toLowerCase()} — ${orden.numero}`}
        descripcion="Solo se puede editar mientras esté en estado Borrador (antes de que alguien la firme)."
      />
      <OrdenCompraEditarForm
        ordenId={orden.id}
        categoria={categoria}
        proveedores={proveedores.map((p) => ({
          id: p.id,
          razonSocial: p.razonSocial,
          ruc: p.tipoDocumento === "RUC" ? p.numeroDocumento : undefined,
          condicionPago: p.condicionPago,
        }))}
        items={orden.items.map((item) => ({
          id: item.id,
          codigo: item.sku.codigo,
          descripcion: item.sku.descripcion,
          centroCosto: item.centroCosto,
        }))}
        valoresIniciales={{
          proveedorId: orden.proveedorId,
          fecha: fechaInputValue(orden.fecha),
          fechaEntrega: orden.fechaEntrega ? fechaInputValue(orden.fechaEntrega) : fechaInputValue(new Date()),
          condicionPago: orden.condicionPago ?? "",
          lugarEntrega: orden.lugarEntrega ?? "",
          observaciones: orden.observaciones ?? "",
          moneda: orden.moneda as "PEN" | "USD",
          filas: Object.fromEntries(
            orden.items.map((item) => [
              item.id,
              {
                cantidad: String(Number(item.cantidad)),
                precioUnitario: String(Number(item.precioUnitario)),
                gravado: item.gravado,
                descripcion: item.descripcion ?? "",
              },
            ])
          ),
        }}
      />
    </div>
  );
}
