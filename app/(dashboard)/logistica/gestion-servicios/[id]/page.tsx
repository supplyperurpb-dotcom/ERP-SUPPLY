import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { formatCantidad, formatDateTime, formatMoneda } from "@/lib/utils";
import { getUsuarioActual } from "@/lib/auth/session";
import { esComprador } from "@/lib/compras";
import { RegistrarAvanceBoton } from "./registrar-avance-boton";
import { EliminarRegistroBoton } from "./eliminar-registro-boton";

const ESTADO_LABEL = {
  ABIERTO: "Abierto",
  CULMINADO: "Culminado",
  PENDIENTE_VB: "Pendiente de VB",
  APROBADO: "Aprobado",
  APROBADO_PARCIAL: "Aprobado Parcial",
  RECHAZADO: "Rechazado",
} as const;

const ESTADO_VARIANT = {
  ABIERTO: "secondary",
  CULMINADO: "secondary",
  PENDIENTE_VB: "secondary",
  APROBADO: "success",
  APROBADO_PARCIAL: "warning",
  RECHAZADO: "destructive",
} as const;

// Landing de "Avance OS {número}": 2 botones ("Registrar Avance" crea una
// nueva sesión numerada y navega a ella; "Anterior" vuelve a Gestión de
// Servicios — ver RegistrarAvanceBoton), más el resumen de lo ya
// registrado — pedido explícito: el avance acumulado por ítem y la lista
// de registros de avance creados hasta ahora, cada uno con su link para
// volver a abrirlo. "Añadir Items" y la tabla de avance en sí viven uno
// por sesión, en /registro/[numero].
export default async function AvanceOsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const usuario = await getUsuarioActual();
  // Pedido explícito: solo Comprador gestiona (crea/elimina) registros de
  // avance; a quien se le pide el VB solo ve Aceptar/Rechazar dentro de
  // cada registro (ver [numero]/page.tsx).
  const puedeGestionar = !!usuario && esComprador(usuario);

  const servicio = await prisma.servicioGestionado.findUnique({
    where: { ordenCompraId: id },
    include: {
      ordenCompra: { include: { proveedor: true, items: { include: { sku: true } } } },
      registros: { orderBy: { numero: "desc" } },
    },
  });
  if (!servicio) notFound();

  const ordenCompraItemIds = servicio.ordenCompra.items.map((i) => i.id);
  const itemsConAvance =
    ordenCompraItemIds.length > 0
      ? await prisma.itemRegistroAvance.findMany({
          where: { ordenCompraItemId: { in: ordenCompraItemIds } },
          include: { avances: true },
        })
      : [];
  const acumuladoPorItem = new Map<string, { cantidad: number; valorizado: number }>();
  for (const itemGestionado of itemsConAvance) {
    const actual = acumuladoPorItem.get(itemGestionado.ordenCompraItemId) ?? { cantidad: 0, valorizado: 0 };
    for (const avance of itemGestionado.avances) {
      actual.cantidad += Number(avance.cantidad);
      actual.valorizado += Number(avance.valorizado);
    }
    acumuladoPorItem.set(itemGestionado.ordenCompraItemId, actual);
  }

  return (
    <div>
      <PageHeader
        titulo={`Avance OS ${servicio.ordenCompra.numero}`}
        descripcion={servicio.ordenCompra.proveedor.razonSocial}
        acciones={
          <Badge variant={servicio.cerrado ? "success" : "secondary"}>{servicio.cerrado ? "Cerrada" : "Abierta"}</Badge>
        }
      />
      <div className="mb-6 flex gap-3">
        {!servicio.cerrado && puedeGestionar && (
          <RegistrarAvanceBoton servicioGestionadoId={servicio.id} ordenCompraId={servicio.ordenCompraId} />
        )}
        <Button variant="outline" asChild>
          <Link href="/logistica/gestion-servicios">Anterior</Link>
        </Button>
      </div>

      <h2 className="mb-2 text-sm font-semibold">Avance por ítem</h2>
      <div className="mb-6 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead numeric>Cant. total</TableHead>
              <TableHead numeric>Avanzado</TableHead>
              <TableHead numeric>Saldo cant.</TableHead>
              <TableHead numeric>Saldo valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servicio.ordenCompra.items.map((item) => {
              const cantidadTotal = Number(item.cantidad);
              const valorTotal = Number(item.subtotal);
              const acumulado = acumuladoPorItem.get(item.id) ?? { cantidad: 0, valorizado: 0 };
              const pct = cantidadTotal > 0 ? (acumulado.cantidad / cantidadTotal) * 100 : 0;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-medium">{item.sku.codigo}</TableCell>
                  <TableCell>{item.descripcion || item.sku.descripcion}</TableCell>
                  <TableCell numeric>
                    {formatCantidad(cantidadTotal)} {item.sku.unidadMedida}
                  </TableCell>
                  <TableCell numeric>
                    {formatCantidad(acumulado.cantidad)} {item.sku.unidadMedida} ({pct.toFixed(1)}%)
                  </TableCell>
                  <TableCell numeric>
                    {formatCantidad(cantidadTotal - acumulado.cantidad)} {item.sku.unidadMedida}
                  </TableCell>
                  <TableCell numeric>{formatMoneda((valorTotal - acumulado.valorizado).toString(), servicio.ordenCompra.moneda)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <h2 className="mb-2 text-sm font-semibold">Registros de avance</h2>
      {servicio.registros.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no se registró ningún avance.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Registro</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicio.registros.map((registro) => (
                <TableRow key={registro.id}>
                  <TableCell className="font-medium">Registro de Avance {registro.numero}</TableCell>
                  <TableCell>
                    <Badge variant={ESTADO_VARIANT[registro.estado]}>{ESTADO_LABEL[registro.estado]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(registro.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/logistica/gestion-servicios/${id}/registro/${registro.numero}`}>Ver</Link>
                      </Button>
                      {puedeGestionar && <EliminarRegistroBoton registroAvanceId={registro.id} numero={registro.numero} />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
