import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { rangoFechaIngreso } from "@/lib/utils";

type Db = PrismaClient | Prisma.TransactionClient;

// =========================================================================
// Reporte de Trazabilidad de Requerimientos y Órdenes — lib/trazabilidad.ts
//
// Recorre la cadena ya existente en el ERP (nada inventado):
//   SolicitudPedido -> SolicitudPedidoItem -> OrdenCompraItem[] -> OrdenCompra
//                                           -> IngresoAlmacenItem[] (Compra)
//                                           -> ItemRegistroAvance[].avances[] (Servicio, solo VB=APROBADO)
//
// Reglas acordadas explícitamente con el usuario (2026-11-16):
// - Solo SolicitudPedido.estado = APROBADO y, dentro de ella, solo items con
//   estado = APROBADO (las líneas RECHAZADAS no entran en ningún cálculo).
// - "Atendido" para categoría SERVICIO = avances de Gestión de Servicios con
//   estadoVB = APROBADO (no hay Ingreso a Almacén en Servicios).
// - "Cerrado" (OrdenCompraItem.cerrado o SolicitudPedidoItem.cerrado) solo
//   pone en 0 el remanente que ya no se va a recibir — nunca resta de lo ya
//   atendido. Si la línea ya tenía algo atendido (>0), se clasifica como
//   ATENDIDO/ATENDIDO_PARCIAL, nunca como "cerrado sin atender". Ese 4º
//   estado es exclusivo de cuando se cerró sin haber atendido nada.
// =========================================================================

export type EstadoAtencionLinea =
  | "ATENDIDO"
  | "ATENDIDO_PARCIAL"
  | "PENDIENTE_CON_ORDEN"
  | "PENDIENTE_SIN_ORDEN"
  | "CERRADO_SIN_ATENDER";

export type RecepcionTrazabilidad = {
  numero: string;
  fecha: Date;
  cantidad: number;
};

export type FilaOrdenTrazabilidad = {
  ordenCompraItemId: string;
  ordenCompraId: string;
  ocNumero: string;
  ocFecha: Date;
  ocEstado: string;
  proveedorNombre: string;
  categoria: "COMPRA" | "SERVICIO";
  cantidadOrdenada: number;
  cantidadAtendida: number;
  cantidadPendiente: number;
  cerrado: boolean;
  recepciones: RecepcionTrazabilidad[];
};

export type LineaTrazabilidad = {
  id: string; // SolicitudPedidoItem.id
  requerimientoId: string;
  requerimientoNumero: string;
  fechaCreacion: Date;
  fechaAprobacion: Date | null;
  codigo: string;
  descripcion: string;
  familia: string;
  subfamilia: string;
  unidadMedida: string;
  centroCosto: string;
  campo: string | null;
  categoria: "COMPRA" | "SERVICIO";
  cantidadSolicitada: number;
  cantidadOrdenada: number;
  cantidadAtendida: number;
  cantidadPendienteConOrden: number;
  cantidadPendienteSinOrden: number;
  estado: EstadoAtencionLinea;
  ordenes: FilaOrdenTrazabilidad[];
};

export type ResumenTrazabilidad = {
  totalCodigos: number;
  cantidadSolicitada: number;
  cantidadAtendida: number;
  cantidadPendienteConOrden: number;
  cantidadPendienteSinOrden: number;
  cantidadCerradoSinAtender: number;
  pctAtendido: number;
  pctPendiente: number;
};

export type FiltrosTrazabilidad = {
  creacionDesde?: string;
  creacionHasta?: string;
  aprobacionDesde?: string;
  aprobacionHasta?: string;
  familia?: string;
  subfamilia?: string;
  codigo?: string;
  requerimiento?: string;
  ordenCompra?: string;
  proveedor?: string;
  estadoAtencion?: EstadoAtencionLinea;
};

function estadoLinea(l: {
  cantidadAtendida: number;
  cantidadPendienteConOrden: number;
  cantidadPendienteSinOrden: number;
}): EstadoAtencionLinea {
  if (l.cantidadAtendida > 0.001) {
    return l.cantidadPendienteConOrden > 0.001 || l.cantidadPendienteSinOrden > 0.001 ? "ATENDIDO_PARCIAL" : "ATENDIDO";
  }
  if (l.cantidadPendienteConOrden <= 0.001 && l.cantidadPendienteSinOrden <= 0.001) return "CERRADO_SIN_ATENDER";
  return l.cantidadPendienteConOrden > 0.001 ? "PENDIENTE_CON_ORDEN" : "PENDIENTE_SIN_ORDEN";
}

export async function calcularTrazabilidad(
  filtros: FiltrosTrazabilidad,
  db: Db = prisma
): Promise<{ lineas: LineaTrazabilidad[]; resumen: ResumenTrazabilidad }> {
  const rangoCreacion = rangoFechaIngreso(filtros.creacionDesde, filtros.creacionHasta);
  const rangoAprobacion = rangoFechaIngreso(filtros.aprobacionDesde, filtros.aprobacionHasta);

  const skuWhere: Prisma.SkuWhereInput = {};
  if (filtros.codigo) skuWhere.codigo = { contains: filtros.codigo, mode: "insensitive" };
  if (filtros.familia) skuWhere.categoria = filtros.familia;
  if (filtros.subfamilia) skuWhere.subfamilia = filtros.subfamilia;

  const solicitudes = await db.solicitudPedido.findMany({
    where: {
      estado: "APROBADO",
      ...(rangoCreacion ? { fecha: rangoCreacion } : {}),
      ...(rangoAprobacion ? { fechaAprobacion: rangoAprobacion } : {}),
      ...(filtros.requerimiento ? { numero: { contains: filtros.requerimiento, mode: "insensitive" } } : {}),
    },
    include: {
      items: {
        where: { estado: "APROBADO", ...(Object.keys(skuWhere).length > 0 ? { sku: skuWhere } : {}) },
        include: {
          sku: true,
          ordenCompraItems: {
            where: { ordenCompra: { estado: { notIn: ["RECHAZADO", "ANULADO"] } } },
            include: {
              ordenCompra: { include: { proveedor: true } },
              ingresosAlmacenItem: { include: { ingresoAlmacen: true } },
              itemsRegistroAvance: { include: { registroAvance: true, avances: true } },
            },
          },
        },
      },
    },
    orderBy: { fecha: "desc" },
  });

  const lineas: LineaTrazabilidad[] = [];

  for (const solicitud of solicitudes) {
    for (const item of solicitud.items) {
      const cantidadSolicitada = Number(item.cantidad);
      const ordenes: FilaOrdenTrazabilidad[] = [];
      let cantidadOrdenada = 0;
      let cantidadAtendida = 0;
      let cantidadPendienteConOrden = 0;

      for (const oci of item.ordenCompraItems) {
        const cantidadOci = Number(oci.cantidad);
        const esServicio = oci.ordenCompra.categoria === "SERVICIO";
        let atendidaOci = 0;
        const recepciones: RecepcionTrazabilidad[] = [];

        if (esServicio) {
          for (const iga of oci.itemsRegistroAvance) {
            if (iga.estadoVB !== "APROBADO") continue;
            for (const avance of iga.avances) {
              const cantidadAvance = Number(avance.cantidad);
              atendidaOci += cantidadAvance;
              recepciones.push({
                numero: `Registro de Avance ${iga.registroAvance.numero}`,
                fecha: avance.createdAt,
                cantidad: cantidadAvance,
              });
            }
          }
        } else {
          for (const ing of oci.ingresosAlmacenItem) {
            const cantidadIngreso = Number(ing.cantidad);
            atendidaOci += cantidadIngreso;
            recepciones.push({ numero: ing.ingresoAlmacen.numero, fecha: ing.ingresoAlmacen.fecha, cantidad: cantidadIngreso });
          }
        }

        const pendienteOci = oci.cerrado ? 0 : Math.max(cantidadOci - atendidaOci, 0);

        cantidadOrdenada += cantidadOci;
        cantidadAtendida += atendidaOci;
        cantidadPendienteConOrden += pendienteOci;

        ordenes.push({
          ordenCompraItemId: oci.id,
          ordenCompraId: oci.ordenCompraId,
          ocNumero: oci.ordenCompra.numero,
          ocFecha: oci.ordenCompra.fecha,
          ocEstado: oci.ordenCompra.estado,
          proveedorNombre: oci.ordenCompra.proveedor.razonSocial,
          categoria: esServicio ? "SERVICIO" : "COMPRA",
          cantidadOrdenada: cantidadOci,
          cantidadAtendida: atendidaOci,
          cantidadPendiente: pendienteOci,
          cerrado: oci.cerrado,
          recepciones,
        });
      }

      const cantidadPendienteSinOrden = item.cerrado ? 0 : Math.max(cantidadSolicitada - cantidadOrdenada, 0);

      // Filtros que operan sobre el detalle (OC/proveedor): se evalúan por
      // línea completa — si no hay ninguna orden que matchee, la línea no
      // entra al resultado (no solo se ocultan sus filas).
      if (filtros.ordenCompra && !ordenes.some((o) => o.ocNumero.toLowerCase().includes(filtros.ordenCompra!.toLowerCase()))) {
        continue;
      }
      if (filtros.proveedor && !ordenes.some((o) => o.proveedorNombre.toLowerCase().includes(filtros.proveedor!.toLowerCase()))) {
        continue;
      }

      const estado = estadoLinea({ cantidadAtendida, cantidadPendienteConOrden, cantidadPendienteSinOrden });
      if (filtros.estadoAtencion && estado !== filtros.estadoAtencion) continue;

      lineas.push({
        id: item.id,
        requerimientoId: solicitud.id,
        requerimientoNumero: solicitud.numero,
        fechaCreacion: solicitud.fecha,
        fechaAprobacion: solicitud.fechaAprobacion,
        codigo: item.sku.codigo,
        descripcion: item.descripcion || item.sku.descripcion,
        familia: item.sku.categoria,
        subfamilia: item.sku.subfamilia,
        unidadMedida: item.unidadMedida,
        centroCosto: item.centroCosto,
        campo: item.campo,
        categoria: solicitud.categoria,
        cantidadSolicitada,
        cantidadOrdenada,
        cantidadAtendida,
        cantidadPendienteConOrden,
        cantidadPendienteSinOrden,
        estado,
        ordenes,
      });
    }
  }

  const resumen: ResumenTrazabilidad = {
    totalCodigos: new Set(lineas.map((l) => l.codigo)).size,
    cantidadSolicitada: lineas.reduce((acc, l) => acc + l.cantidadSolicitada, 0),
    cantidadAtendida: lineas.reduce((acc, l) => acc + l.cantidadAtendida, 0),
    cantidadPendienteConOrden: lineas.reduce((acc, l) => acc + l.cantidadPendienteConOrden, 0),
    cantidadPendienteSinOrden: lineas.reduce((acc, l) => acc + l.cantidadPendienteSinOrden, 0),
    cantidadCerradoSinAtender: lineas
      .filter((l) => l.estado === "CERRADO_SIN_ATENDER")
      .reduce((acc, l) => acc + l.cantidadSolicitada, 0),
    pctAtendido: 0,
    pctPendiente: 0,
  };
  if (resumen.cantidadSolicitada > 0) {
    resumen.pctAtendido = (resumen.cantidadAtendida / resumen.cantidadSolicitada) * 100;
    resumen.pctPendiente =
      ((resumen.cantidadPendienteConOrden + resumen.cantidadPendienteSinOrden) / resumen.cantidadSolicitada) * 100;
  }

  return { lineas, resumen };
}

export const ESTADO_ATENCION_LABEL: Record<EstadoAtencionLinea, string> = {
  ATENDIDO: "Atendido",
  ATENDIDO_PARCIAL: "Atendido parcial",
  PENDIENTE_CON_ORDEN: "Pendiente con orden",
  PENDIENTE_SIN_ORDEN: "Pendiente sin orden",
  CERRADO_SIN_ATENDER: "Cerrado sin atender",
};

// Valores reales de Sku.categoria/subfamilia en uso — no hay una lista fija
// en el sistema (son texto libre, ver lib/constants/compras.ts), así que
// las opciones del filtro se arman con lo que ya existe en los SKU.
export async function obtenerOpcionesFiltroTrazabilidad(db: Db = prisma) {
  const skus = await db.sku.findMany({ select: { categoria: true, subfamilia: true }, distinct: ["categoria", "subfamilia"] });
  return {
    familias: [...new Set(skus.map((s) => s.categoria))].sort(),
    subfamilias: [...new Set(skus.map((s) => s.subfamilia))].sort(),
  };
}
