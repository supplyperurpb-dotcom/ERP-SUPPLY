import { z } from "zod";
import { AREAS_EMPRESA, type AreaEmpresaCodigo } from "@/lib/constants/compras";

// Se castea preservando los literales (no a `string` genérico) para que
// DevolucionAlmacenInput["area"] siga siendo asignable al campo Prisma
// `area: AreaEmpresa` sin un cast adicional en la action.
const AREAS = AREAS_EMPRESA.map((a) => a.valor) as [AreaEmpresaCodigo, ...AreaEmpresaCodigo[]];

// Una devolución no depende de una Orden de Compra: cada línea solo indica
// qué SKU y cuánto vuelve al almacén. El precio se calcula en el servidor
// (nunca se confía en lo que mande el cliente) — ver
// crearDevolucionAlmacenAction: 0 si noValorado, si no el costo unitario
// ponderado ACTUAL del SKU en el almacén de destino.
const itemDevolucionSchema = z.object({
  skuId: z.string().min(1, "Selecciona un producto"),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unidadMedida: z.string().min(1),
  noValorado: z.coerce.boolean().default(false),
  // Obligatorios solo si el almacén es de categoría PESTICIDAS o
  // FERTILIZANTES, o el propio SKU lo exige (Sku.requiereLote) — igual
  // criterio que ingreso/traslado/consumo, ver validarOrigen en
  // lib/actions/devolucion-almacen-actions.ts.
  lote: z.string().max(60).optional().or(z.literal("")),
  // El <input type="date"> de una línea que no necesita lote se deja en
  // blanco y manda "" (no undefined) — z.coerce.date() lo convertiría en
  // una fecha inválida, así que primero se normaliza "" a undefined.
  fechaProduccion: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.date().optional()),
  fechaVencimiento: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.date().optional()),
});

export const devolucionAlmacenSchema = z
  .object({
    // Fecha de registro: siempre hoy, bloqueada en el formulario — igual
    // que el Ingreso.
    fecha: z.coerce.date({ required_error: "La fecha es obligatoria" }),
    almacenId: z.string().min(1, "Selecciona el almacén"),
    area: z.enum(AREAS, { required_error: "Selecciona el área" }),
    personaQueTrae: z.string().trim().min(1, "Selecciona quién trae el material").max(150),
    personaQueTraeDni: z
      .string()
      .trim()
      .regex(/^\d{8}$/, "El DNI de quien trae el material es obligatorio"),
    // Si está marcada, proveedorId es obligatorio (ver superRefine) y el
    // formulario muestra el combobox de proveedor; si no, la devolución
    // queda sin proveedor asociado (p. ej. vuelve de un área interna).
    tieneProveedor: z.coerce.boolean().default(false),
    proveedorId: z.string().optional().or(z.literal("")),
    observaciones: z.string().max(500).optional().or(z.literal("")),
    items: z.array(itemDevolucionSchema).min(1, "Agrega al menos un producto"),
  })
  .superRefine((data, ctx) => {
    if (data.tieneProveedor && !data.proveedorId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecciona el proveedor", path: ["proveedorId"] });
    }
  });

export type DevolucionAlmacenInput = z.infer<typeof devolucionAlmacenSchema>;
