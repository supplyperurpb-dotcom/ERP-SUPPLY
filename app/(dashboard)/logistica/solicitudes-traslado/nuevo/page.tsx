import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/db/prisma";
import { calcularStockAlmacen } from "@/lib/stock-almacen";
import { siguienteNumero } from "@/lib/utils";
import { SolicitudTrasladoBuilder } from "./solicitud-traslado-builder";

export default async function NuevaSolicitudTrasladoPage() {
  const [almacenes, existentes] = await Promise.all([
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.solicitudTraslado.findMany({ select: { numero: true } }),
  ]);
  const stocks = await Promise.all(almacenes.map((a) => calcularStockAlmacen(a.id)));
  const stockPorAlmacen: Record<string, Awaited<ReturnType<typeof calcularStockAlmacen>>> = {};
  almacenes.forEach((a, i) => {
    stockPorAlmacen[a.id] = stocks[i];
  });
  // Solo un adelanto: el número real se asigna recién al guardar (ver
  // crearSolicitudTrasladoAction) — mismo criterio que OC/Solped.
  const numeroTentativo = siguienteNumero(existentes.map((s) => s.numero), "ST-", 9);

  return (
    <div>
      <PageHeader
        titulo={`Nueva solicitud de traslado — ${numeroTentativo}`}
        descripcion="Elige el almacén de origen y destino, y marca qué productos (con su cantidad) quieres mover. No necesita aprobación: queda lista para ejecutarse apenas la solicitas."
      />
      <SolicitudTrasladoBuilder
        almacenes={almacenes.map((a) => ({ id: a.id, nombre: a.nombre }))}
        stockPorAlmacen={stockPorAlmacen}
      />
    </div>
  );
}
