import { z } from "zod";
import { CONDICIONES_PAGO, LUGARES_ENTREGA } from "@/lib/constants/compras";

const AREAS = ["PRODUCCION", "SUPPLY_CHAIN", "FINANZAS", "GERENCIA_GENERAL", "SERVICIOS_GENERALES", "RRHH"] as const;
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
    area: z.enum(AREAS, { required_error: "Selecciona el área" }),
    fecha: z.coerce.date({ required_error: "La fecha de pedido es obligatoria" }),
    fechaNecesidad: z.coerce.date({ required_error: "La fecha estimada de necesidad es obligatoria" }),
    tipoNecesidad: z.enum(["URGENTE", "ESTANDAR"], { required_error: "Selecciona el tipo de necesidad" }),
    justificacion: z.string().trim().min(1, "La justificación es obligatoria").max(500),
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

const itemOrdenCompraSchema = z.object({
  solicitudPedidoItemId: z.string().min(1, "Falta el origen de esta línea"),
  skuId: z.string().min(1),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  precioUnitario: z.coerce.number().min(0, "El precio unitario no puede ser negativo"),
  gravado: z.coerce.boolean().default(true),
  centroCosto: z.string().min(1, "Selecciona el centro de costo"),
  // Solo para categoría Servicio (OS): detalle y alcance del servicio,
  // precargado de la solicitud y editable aquí.
  descripcion: z.string().max(500).optional().or(z.literal("")),
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
    fechaEntrega: z.coerce.date({ required_error: "La fecha de entrega es obligatoria" }),
    condicionPago: z.enum(CONDICIONES_PAGO, { required_error: "Selecciona la condición de pago" }),
    lugarEntrega: z.enum(LUGARES_ENTREGA, { required_error: "Selecciona el lugar de entrega" }),
    // "Comentario" en la UI — reemplaza lo que antes era la justificación
    // (auto-pulled de la Solped) mostrada de solo lectura; ahora es un
    // comentario propio de la OC/OS, escrito a mano y obligatorio.
    observaciones: z.string().trim().min(1, "El comentario es obligatorio").max(500),
    moneda: z.enum(["PEN", "USD"]).default("PEN"),
    items: z.array(itemOrdenCompraSchema).min(1, "Selecciona al menos un ítem pendiente"),
  })
  .superRefine((data, ctx) => {
    if (data.tipoOrden === "ABIERTA" && !data.vigenteHasta) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona el plazo de vigencia de la orden abierta",
        path: ["vigenteHasta"],
      });
    }
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
  solicitudPedidoItemId: z.string().optional(),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  precioUnitario: z.coerce.number().min(0, "El precio unitario no puede ser negativo"),
  gravado: z.coerce.boolean().default(true),
  descripcion: z.string().max(500).optional().or(z.literal("")),
});

export const editarOrdenCompraSchema = z
  .object({
    proveedorId: z.string().min(1, "Selecciona un proveedor"),
    fecha: z.coerce.date({ required_error: "La fecha es obligatoria" }),
    fechaEntrega: z.coerce.date({ required_error: "La fecha de entrega es obligatoria" }),
    condicionPago: z.enum(CONDICIONES_PAGO, { required_error: "Selecciona la condición de pago" }),
    lugarEntrega: z.enum(LUGARES_ENTREGA, { required_error: "Selecciona el lugar de entrega" }),
    observaciones: z.string().trim().min(1, "El comentario es obligatorio").max(500),
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
  descripcion: z.string().max(500).optional().or(z.literal("")),
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
    fechaEntrega: z.coerce.date({ required_error: "La fecha de entrega es obligatoria" }),
    condicionPago: z.enum(CONDICIONES_PAGO, { required_error: "Selecciona la condición de pago" }),
    lugarEntrega: z.enum(LUGARES_ENTREGA, { required_error: "Selecciona el lugar de entrega" }),
    observaciones: z.string().trim().min(1, "El comentario es obligatorio").max(500),
    moneda: z.enum(["PEN", "USD"]).default("PEN"),
    items: z.array(itemOrdenCompraDirectaSchema).min(1, "Agrega al menos un producto"),
  })
  .superRefine((data, ctx) => {
    if (data.tipoOrden === "ABIERTA" && !data.vigenteHasta) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona el plazo de vigencia de la orden abierta",
        path: ["vigenteHasta"],
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
