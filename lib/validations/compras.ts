import { z } from "zod";
import { CONDICIONES_PAGO, LUGARES_ENTREGA, areasDeGerenciaSolped, type GerenciaSolpedCodigo, type AreaSolpedCodigo } from "@/lib/constants/compras";

// Uno o más sustentos adjuntos al generar una OC/OS (pedido explícito,
// 2026-11-27: antes un solo archivo obligatorio, ahora se puede "Añadir
// sustento" como en Registro de Avance) — cada uno ya subido al bucket
// privado (ver subirArchivoSustentoOrdenAction), nunca el File en sí.
const sustentoOrdenSchema = z.object({
  archivo: z.string().min(1),
  nombreArchivo: z.string().min(1),
});

const AREAS = [
  "PRODUCCION",
  "SUPPLY_CHAIN",
  "FINANZAS",
  "GERENCIA_GENERAL",
  "SERVICIOS_GENERALES",
  "RRHH",
  "CALIDAD_E_INOCUIDAD",
] as const;
// Áreas (nivel 2, dentro de cada Gerencia) — ver AREAS_SOLPED en
// lib/constants/compras.ts, única fuente de la relación Gerencia->Área.
const AREAS_DETALLE = [
  "SANIDAD",
  "RIEGO",
  "PRODUCCION_1",
  "COMPRAS",
  "COMEX",
  "ALMACEN",
  "FINANZAS",
  "GERENCIA_GENERAL",
  "SERVICIOS_GENERALES",
  "RRHH",
  "CALIDAD_E_INOCUIDAD",
] as const;
const CATEGORIAS = ["COMPRA", "SERVICIO"] as const;
const TIPOS_ORDEN = ["ABIERTA", "ESTANDAR"] as const;

const itemSolicitudPedidoSchema = z.object({
  // Solo lo usa editarSolicitudPedidoAction, para saber si la línea ya
  // existía (update) o es nueva (create) — en crearSolicitudPedidoAction
  // simplemente no llega.
  id: z.string().optional(),
  skuId: z.string().min(1, "Selecciona un producto"),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unidadMedida: z.string().min(1),
  // Nombre de un valor de la lista editable Centro de costo (ver
  // lib/listas.ts) — ya no es un enum fijo.
  centroCosto: z.string().min(1, "Selecciona el centro de costo"),
  // Solo para categoría Servicio: detalle puntual del servicio pedido
  // (el SKU solo agrupa, p. ej. "Apicultura").
  descripcion: z.string().max(500).optional().or(z.literal("")),
  // Campo/fundo al que corresponde el pedido: nombre de un valor de la
  // lista editable Campo (ver lib/listas.ts).
  campo: z.string().optional().or(z.literal("")),
});

export const solicitudPedidoSchema = z
  .object({
    categoria: z.enum(CATEGORIAS, { required_error: "Selecciona si es una solicitud de compra o de servicio" }),
    area: z.enum(AREAS, { required_error: "Selecciona la gerencia" }),
    areaDetalle: z.enum(AREAS_DETALLE, { required_error: "Selecciona el área" }),
    fecha: z.coerce.date({ required_error: "La fecha de pedido es obligatoria" }),
    // Hora de registro ("HH:MM"), capturada y bloqueada en el formulario —
    // igual que ConsumoAlmacen.horaRetiro.
    hora: z.string().optional().or(z.literal("")),
    fechaNecesidad: z.coerce.date({ required_error: "La fecha estimada de necesidad es obligatoria" }),
    tipoNecesidad: z.enum(["URGENTE", "ESTANDAR"], { required_error: "Selecciona el tipo de necesidad" }),
    justificacion: z.string().trim().min(15, "Especifica el uso con al menos 15 caracteres").max(500),
    items: z.array(itemSolicitudPedidoSchema).min(1, "Agrega al menos un producto"),
  })
  .superRefine((data, ctx) => {
    if (data.fechaNecesidad < data.fecha) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha estimada de necesidad no puede ser anterior a la fecha de pedido",
        path: ["fechaNecesidad"],
      });
    }
    const areasValidas = areasDeGerenciaSolped(data.area as GerenciaSolpedCodigo).map((a) => a.valor as string);
    if (!areasValidas.includes(data.areaDetalle)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El área elegida no corresponde a la gerencia elegida",
        path: ["areaDetalle"],
      });
    }
    if (data.categoria !== "SERVICIO") return;
    data.items.forEach((item, i) => {
      if (!item.descripcion?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Describe el detalle del servicio",
          path: ["items", i, "descripcion"],
        });
      }
    });
  });

export type SolicitudPedidoInput = z.infer<typeof solicitudPedidoSchema>;
export type { AreaSolpedCodigo };

// Programa de Entregas (pedido explícito, 2026-11-25): una línea de la OC
// se puede distribuir en una o más entregas con cantidad y fecha
// tentativa propias — ver programa-entregas-step.tsx. Se permite dejar un
// ítem sin programar del todo o parcialmente (no es obligatorio agotar la
// cantidad), por eso el array puede llegar vacío.
const entregaProgramadaSchema = z.object({
  cantidad: z.coerce.number().positive("La cantidad programada debe ser mayor a 0"),
  fechaTentativa: z.coerce.date({ required_error: "Selecciona la fecha tentativa de la entrega" }),
});

// Revalida, del lado del servidor, que ninguna línea tenga más programado
// de lo que permite su propia cantidad (el cliente ya lo bloquea antes de
// dejar avanzar a "Agendar Programa", esto es la defensa en profundidad).
function validarEntregasNoSuperanCantidad<T extends { cantidad: number; entregas: { cantidad: number }[] }>(
  items: T[],
  ctx: z.RefinementCtx,
  path: "items" = "items"
) {
  items.forEach((item, i) => {
    const programado = item.entregas.reduce((acc, e) => acc + e.cantidad, 0);
    if (programado > item.cantidad) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Lo programado (${programado}) no puede superar la cantidad de la línea (${item.cantidad}).`,
        path: [path, i, "entregas"],
      });
    }
  });
}

const itemOrdenCompraSchema = z.object({
  solicitudPedidoItemId: z.string().min(1, "Falta el origen de esta línea"),
  skuId: z.string().min(1),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  precioUnitario: z.coerce.number().min(0, "El precio unitario no puede ser negativo"),
  gravado: z.coerce.boolean().default(true),
  centroCosto: z.string().min(1, "Selecciona el centro de costo"),
  campo: z.string().optional().or(z.literal("")),
  // Solo para categoría Servicio (OS): detalle y alcance del servicio,
  // precargado de la solicitud y editable aquí.
  descripcion: z.string().max(500).optional().or(z.literal("")),
  entregas: z.array(entregaProgramadaSchema).default([]),
});

export const ordenCompraSchema = z
  .object({
    proveedorId: z.string().min(1, "Selecciona un proveedor"),
    // Fija según el botón con el que se entró (Abierta/Estándar) — no se
    // elige dentro del formulario. ABIERTA exige vigenteHasta; ESTANDAR no
    // la lleva (ver superRefine abajo).
    tipoOrden: z.enum(TIPOS_ORDEN, { required_error: "Falta el tipo de orden" }),
    vigenteHasta: z.coerce.date().optional(),
    fecha: z.coerce.date({ required_error: "La fecha es obligatoria" }),
    // Hora de registro ("HH:MM"), capturada y bloqueada en el formulario —
    // igual que ConsumoAlmacen.horaRetiro.
    hora: z.string().optional().or(z.literal("")),
    fechaEntrega: z.coerce.date({ required_error: "La fecha de entrega es obligatoria" }),
    condicionPago: z.enum(CONDICIONES_PAGO, { required_error: "Selecciona la condición de pago" }),
    lugarEntrega: z.enum(LUGARES_ENTREGA, { required_error: "Selecciona el lugar de entrega" }),
    // "Comentario" en la UI — reemplaza lo que antes era la justificación
    // (auto-pulled de la Solped) mostrada de solo lectura; ahora es un
    // comentario propio de la OC/OS, escrito a mano y obligatorio.
    observaciones: z.string().trim().min(15, "El comentario debe tener al menos 15 caracteres").max(500),
    moneda: z.enum(["PEN", "USD"]).default("PEN"),
    items: z.array(itemOrdenCompraSchema).min(1, "Selecciona al menos un ítem pendiente"),
    // Sustento obligatorio (pedido explícito, 2026-11-25): ruta ya subida
    // al bucket privado (ver subirArchivoOrdenCompraAction), nunca el File
    // en sí — el upload va antes, por separado, igual que en Sustentos de
    // Registro de Avance.
    sustentos: z.array(sustentoOrdenSchema).min(1, "Debes adjuntar al menos un sustento de la orden"),
  })
  .superRefine((data, ctx) => {
    if (data.tipoOrden === "ABIERTA" && !data.vigenteHasta) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona el plazo de vigencia de la orden abierta",
        path: ["vigenteHasta"],
      });
    }
    validarEntregasNoSuperanCantidad(data.items, ctx);
  });

export type OrdenCompraInput = z.infer<typeof ordenCompraSchema>;

// Edición de una OC/OS ya creada (solo en BORRADOR, ver
// editarOrdenCompraAction): una línea con id es una YA EXISTENTE (no se
// puede quitar, solo ajustar cantidad/precio/gravado/descripción — su
// skuId/centroCosto/solicitudPedidoItemId no cambian). Una línea SIN id es
// NUEVA: trae su propio skuId y centroCosto, y — si la orden viene de una
// Solped — también solicitudPedidoItemId (ver superRefine abajo, que
// exige ambos solo cuando no hay id).
const itemOrdenCompraEditSchema = z.object({
  id: z.string().optional(),
  skuId: z.string().optional(),
  centroCosto: z.string().optional(),
  campo: z.string().optional().or(z.literal("")),
  solicitudPedidoItemId: z.string().optional(),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  precioUnitario: z.coerce.number().min(0, "El precio unitario no puede ser negativo"),
  gravado: z.coerce.boolean().default(true),
  descripcion: z.string().max(500).optional().or(z.literal("")),
  // Programa de Entregas (pedido explícito, 2026-11-25): al editar, el
  // usuario pasa por el mismo paso y reemplaza el programa completo de
  // cada línea (ver editarOrdenCompraAction) — no se "parchea" entrega por
  // entrega.
  entregas: z.array(entregaProgramadaSchema).default([]),
});

export const editarOrdenCompraSchema = z
  .object({
    proveedorId: z.string().min(1, "Selecciona un proveedor"),
    fecha: z.coerce.date({ required_error: "La fecha es obligatoria" }),
    hora: z.string().optional().or(z.literal("")),
    fechaEntrega: z.coerce.date({ required_error: "La fecha de entrega es obligatoria" }),
    condicionPago: z.enum(CONDICIONES_PAGO, { required_error: "Selecciona la condición de pago" }),
    lugarEntrega: z.enum(LUGARES_ENTREGA, { required_error: "Selecciona el lugar de entrega" }),
    observaciones: z.string().trim().min(15, "El comentario debe tener al menos 15 caracteres").max(500),
    moneda: z.enum(["PEN", "USD"]).default("PEN"),
    items: z.array(itemOrdenCompraEditSchema).min(1, "La orden debe tener al menos un ítem"),
  })
  .superRefine((data, ctx) => {
    data.items.forEach((item, i) => {
      if (!item.id && (!item.skuId || !item.centroCosto)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Falta el producto o el centro de costo de la línea nueva",
          path: ["items", i],
        });
      }
    });
    validarEntregasNoSuperanCantidad(data.items, ctx);
  });

export type EditarOrdenCompraInput = z.infer<typeof editarOrdenCompraSchema>;

// Orden "directa": se arma a mano, sin jalar ítems de ninguna Solicitud de
// Pedido (ver crearOrdenCompraDirectaAction) — por eso cada línea trae su
// propio skuId/centroCosto en vez de un solicitudPedidoItemId, y la orden
// necesita su propia categoría (Compra/Servicio) porque no hay solicitud
// de la que heredarla. Sigue pasando por el mismo flujo de firmas según
// monto que una orden normal.
const itemOrdenCompraDirectaSchema = z.object({
  skuId: z.string().min(1, "Selecciona un producto"),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  precioUnitario: z.coerce.number().min(0, "El precio unitario no puede ser negativo"),
  gravado: z.coerce.boolean().default(true),
  centroCosto: z.string().min(1, "Selecciona el centro de costo"),
  // Obligatorio en una orden Directa (pedido explícito, 2026-11-25) — a
  // diferencia de una orden "con Solped", donde viene fijo de la
  // solicitud de pedido y no se vuelve a pedir acá.
  campo: z.string().trim().min(1, "Selecciona el campo"),
  descripcion: z.string().max(500).optional().or(z.literal("")),
  entregas: z.array(entregaProgramadaSchema).default([]),
});

export const ordenCompraDirectaSchema = z
  .object({
    categoria: z.enum(CATEGORIAS, { required_error: "Selecciona si es una compra o un servicio" }),
    // Igual que en ordenCompraSchema: fija según el botón con el que se
    // entró (Abierta/Estándar), no se elige dentro del formulario.
    tipoOrden: z.enum(TIPOS_ORDEN, { required_error: "Falta el tipo de orden" }),
    vigenteHasta: z.coerce.date().optional(),
    proveedorId: z.string().min(1, "Selecciona un proveedor"),
    fecha: z.coerce.date({ required_error: "La fecha es obligatoria" }),
    hora: z.string().optional().or(z.literal("")),
    fechaEntrega: z.coerce.date({ required_error: "La fecha de entrega es obligatoria" }),
    condicionPago: z.enum(CONDICIONES_PAGO, { required_error: "Selecciona la condición de pago" }),
    lugarEntrega: z.enum(LUGARES_ENTREGA, { required_error: "Selecciona el lugar de entrega" }),
    observaciones: z.string().trim().min(15, "El comentario debe tener al menos 15 caracteres").max(500),
    moneda: z.enum(["PEN", "USD"]).default("PEN"),
    items: z.array(itemOrdenCompraDirectaSchema).min(1, "Agrega al menos un producto"),
    sustentos: z.array(sustentoOrdenSchema).min(1, "Debes adjuntar al menos un sustento de la orden"),
  })
  .superRefine((data, ctx) => {
    if (data.tipoOrden === "ABIERTA" && !data.vigenteHasta) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona el plazo de vigencia de la orden abierta",
        path: ["vigenteHasta"],
      });
    }
    validarEntregasNoSuperanCantidad(data.items, ctx);
    if (data.categoria !== "SERVICIO") return;
    data.items.forEach((item, i) => {
      if (!item.descripcion?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Describe el detalle del servicio",
          path: ["items", i, "descripcion"],
        });
      }
    });
  });

export type OrdenCompraDirectaInput = z.infer<typeof ordenCompraDirectaSchema>;

export const aprobadoresAreaSchema = z.object({
  asignaciones: z.array(
    z.object({
      area: z.enum(AREAS),
      usuarioId: z.string().min(1, "Selecciona un usuario"),
    })
  ),
});

export type AprobadoresAreaInput = z.infer<typeof aprobadoresAreaSchema>;

const ROLES_ESPECIALES = ["GERENTE_SUPPLY", "DISTRICT_CONTROLLER", "GERENTE_GENERAL", "GERENTE_RRHH"] as const;

export const aprobadoresEspecialesSchema = z.object({
  asignaciones: z.array(
    z.object({
      rol: z.enum(ROLES_ESPECIALES),
      usuarioId: z.string().min(1, "Selecciona un usuario"),
    })
  ),
});

export type AprobadoresEspecialesInput = z.infer<typeof aprobadoresEspecialesSchema>;

export const rechazarSolicitudPedidoSchema = z.object({
  comentario: z.string().max(500).optional().or(z.literal("")),
});
