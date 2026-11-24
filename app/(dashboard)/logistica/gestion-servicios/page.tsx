import Link from "next/link";
import { Wrench } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FiltroRangoFecha } from "@/components/shared/filtro-rango-fecha";
import { prisma } from "@/lib/db/prisma";
import { fechaHoyPeru, formatDate, formatDateTime, formatMoneda, rangoFechaIngreso } from "@/lib/utils";
import { AgregarServicioDialog, type OrdenServicioDisponible } from "./agregar-servicio-dialog";

export default async function GestionServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ busqueda?: string; desde?: string; hasta?: string }>;
}) {
  const { busqueda, desde, hasta } = await searchParams;

  // Mismo criterio que en Ingreso de Materia Prima: sin filtro de fecha en
  // la URL (primera visita), se muestra hoy por defecto; si se vacía a
  // propósito, se ve todo el histórico. rangoFechaIngreso arma un rango de
  // día completo (00:00 a 23:59:59.999, hora Lima) — no es específico de
  // "ingreso", acá se reutiliza para "createdAt" (fecha en que se agregó).
  const desdeEfectivo = desde === undefined ? fechaHoyPeru() : desde;
  const hastaEfectivo = hasta === undefined ? fechaHoyPeru() : hasta;
  const rangoFecha = rangoFechaIngreso(desdeEfectivo, hastaEfectivo);

  const termino = busqueda?.trim();

  const [servicios, ordenesDisponibles] = await Promise.all([
    prisma.servicioGestionado.findMany({
      where: {
        ...(rangoFecha ? { createdAt: rangoFecha } : {}),
        ...(termino
          ? {
              ordenCompra: {
                OR: [
                  { numero: { contains: termino, mode: "insensitive" } },
                  { proveedor: { razonSocial: { contains: termino, mode: "insensitive" } } },
                ],
              },
            }
          : {}),
      },
      include: { ordenCompra: { include: { proveedor: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Disponibles para el selector del diálogo "Agregar Servicio": órdenes
    // de servicio ya aprobadas que todavía no se agregaron (ver
    // ServicioGestionado.ordenCompraId, único).
    prisma.ordenCompra.findMany({
      where: { categoria: "SERVICIO", estado: "APROBADO", servicioGestionado: null },
      include: { proveedor: true },
      orderBy: { fecha: "desc" },
    }),
  ]);

  const ordenesParaDialogo: OrdenServicioDisponible[] = ordenesDisponibles.map((orden) => ({
    id: orden.id,
    numero: orden.numero,
    proveedorRazonSocial: orden.proveedor.razonSocial,
    fecha: formatDate(orden.fecha),
    montoTotal: formatMoneda(orden.montoTotal.toString(), orden.moneda),
  }));

  const hayFiltro = Boolean(busqueda || desde || hasta);

  return (
    <div>
      <PageHeader
        titulo="Gestión de Servicios"
        descripcion="Órdenes de servicio ya aprobadas, agregadas acá para su seguimiento."
        acciones={<AgregarServicioDialog ordenes={ordenesParaDialogo} />}
      />

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="grid min-w-[220px] flex-1 gap-1.5">
          <Label htmlFor="busqueda">Proveedor o N.º de orden</Label>
          <Input id="busqueda" name="busqueda" placeholder="Ej. Achirana o OS-FO-0001" defaultValue={busqueda ?? ""} />
        </div>
        <FiltroRangoFecha desde={desdeEfectivo} hasta={hastaEfectivo} label="Fecha" />
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {hayFiltro && (
          <Button type="button" variant="ghost" asChild>
            <Link href="/logistica/gestion-servicios">Limpiar filtro</Link>
          </Button>
        )}
      </form>

      {servicios.length === 0 ? (
        <EmptyState
          icono={Wrench}
          titulo={hayFiltro ? "Ningún servicio coincide con el filtro" : "Todavía no hay servicios agregados"}
          descripcion={
            hayFiltro
              ? "Prueba con otro criterio de búsqueda o limpia el filtro."
              : 'Usa el botón "Agregar Servicio" para registrar una orden de servicio ya aprobada.'
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N.º de orden</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Fecha de la orden</TableHead>
              <TableHead numeric>Monto</TableHead>
              <TableHead>Agregado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servicios.map((servicio) => (
              <TableRow key={servicio.id}>
                <TableCell className="font-mono font-medium">
                  <Link href={`/logistica/ordenes-compra/${servicio.ordenCompraId}`} className="text-primary hover:underline">
                    {servicio.ordenCompra.numero}
                  </Link>
                </TableCell>
                <TableCell>{servicio.ordenCompra.proveedor.razonSocial}</TableCell>
                <TableCell>{formatDate(servicio.ordenCompra.fecha)}</TableCell>
                <TableCell numeric>
                  {formatMoneda(servicio.ordenCompra.montoTotal.toString(), servicio.ordenCompra.moneda)}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDateTime(servicio.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant={servicio.cerrado ? "success" : "secondary"}>{servicio.cerrado ? "Cerrada" : "Abierta"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/logistica/gestion-servicios/${servicio.ordenCompraId}`}>Gestionar OS</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
