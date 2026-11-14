# Sistema de diseño — ERP REITER

Documento vivo de los tokens y componentes globales de UI. Antes de crear un
componente nuevo o repetir un patrón de estilo a mano, revisa si ya existe acá.

## Regla general

**Reutilizar antes que crear.** Todo lo de acá abajo es un envoltorio fino
sobre un primitivo de `components/ui/*` ya existente (shadcn/Radix) o sobre
otro componente compartido — ninguno introduce una librería nueva ni
duplica lógica de negocio. Si necesitas algo que no está, primero revisa si
un componente existente + una prop nueva lo resuelve antes de crear un
archivo nuevo.

## Tokens (Fase 0-1 — no modificar sin aprobación explícita)

Definidos en `app/globals.css` (`:root` + `.dark`) y mapeados en
`tailwind.config.ts`. Son la única fuente de verdad de color — nunca usar un
hex literal en un componente nuevo si un token ya cubre el caso.

| Token Tailwind | Uso |
|---|---|
| `bg-background` / `text-foreground` | Fondo/texto por defecto (body) |
| `bg-card` / `border-border` | Superficies blancas: Topbar, Dialog, Popover, Card |
| `bg-primary` / `text-primary-foreground` | Botón principal, ítem de nav activo |
| `bg-sidebar` / `text-sidebar-foreground` / `border-sidebar-border` | Fondo navy del sidebar — **solo** en `sidebar-nav.tsx` |
| `hover:bg-sidebar-accent` / `hover:text-sidebar-accent-foreground` | Hover de ítems inactivos del sidebar |
| `bg-canvas` | Fondo gris claro del área de contenido — **solo** en `dashboard-shell.tsx` |
| `text-muted-foreground` | Texto secundario |
| `bg-destructive` / `text-destructive` | Error / acción destructiva |

`--sidebar-*` y `--content-background` están deliberadamente separados de
`--card`/`--background`: así Topbar/Dialog/Popover quedan blancos aunque el
sidebar sea navy y el contenido sea gris. No usar estos dos grupos de tokens
fuera de los dos archivos indicados.

## Fase 3 — Identidad visual (tokens, tipografía, tablas, KPI)

Pedido explícito del usuario (2026-11-14): mejorar calidad visual/jerarquía/
tipografía/espaciados/tablas/microinteracciones sin tocar funcionalidad ni
cálculos. Propuesta aprobada antes de implementar. Alcance real:

**Color** — se retonó (mismos roles, mismos nombres de token, nuevos
valores) para darle una identidad propia a la marca en vez del azul
corporativo genérico que había antes:
- `--primary`/`--ring`: de un azul SaaS genérico a un violeta-azulado
  ("berry-600", `#4C3A8C` en claro) — el color de la piel del arándano. Un
  solo acento de marca, gastado con disciplina (botón primario, nav activo,
  focus ring) — no se agregó un segundo color de identidad.
- `--sidebar-background`/`-border`/`-accent`: mismo navy de siempre
  ("indigo-950"), tono más específico, sin cambiar su rol.
- `--content-background` ("canvas"): gris ligeramente más cálido que antes.
- `--bloom` (nuevo, mapeado a `bg-bloom`): gris-violeta pálido (la pruina
  del arándano) — reemplaza `bg-muted/50` como hover por defecto de
  `TableRow` (`components/ui/table.tsx`).
- `app/layout.tsx` (`viewport.themeColor`) y `public/manifest.json`
  (`theme_color`) actualizados al mismo hex, para que la barra del
  navegador/PWA coincida.
- **No se tocó** la paleta de gráficos de `dashboard-exportaciones/colores.ts`
  ni ninguna de sus cards (`SectionCard` solo lo usa ese dashboard hoy) — ya
  estaba bien resuelta de una ronda anterior y el pedido era no tocarla.

**Tipografía** — antes no había ninguna declarada (caía al stack del
sistema operativo por defecto de Tailwind). Ahora, vía `next/font/google`
en `app/layout.tsx` + `fontFamily` en `tailwind.config.ts`:
- `font-sans` (default de toda la UI): **IBM Plex Sans** — pensada para
  software empresarial denso en datos, con carácter propio.
- `font-mono`: **IBM Plex Mono**, reservada solo para códigos reales (no
  para labels ni texto normal) — SKU, placas, DNI, licencias, N.º de
  documento. Es un recurso estructural (marca "esto es un código"), no
  decoración. Pilotado en `SkuCombobox`, `CamionCombobox`,
  `VehiculoCombobox`, `RetiradorAutorizadoCombobox`, y las columnas de
  Documento/Placa/DNI/Licencia de `proveedor-table.tsx`,
  `camion-table.tsx`, `conductor-table.tsx`. El resto de tablas/comboboxes
  con códigos queda para una próxima ronda (mismo patrón de adopción
  incremental que `Combobox`/`EntityFormDialog`).

**Tablas** (`components/ui/table.tsx`) — `TableHead`/`TableCell` ganan un
prop opcional `numeric` (alinea a la derecha + `tabular-nums`; sin el prop,
comportamiento idéntico a antes). Pilotado en `TipoBandejaTable` y
`TipoPalletTable` (columna "Peso tara (kg)"); el resto de tablas con
columnas numéricas se migra incrementalmente.

**KPICard** (`components/ui/cards/kpi-card.tsx`) — la rama **sin** `paleta`
(hoy sin ningún llamador real: todos los que existen, en
`dashboard-exportaciones/kpi-cards.tsx`, pasan `paleta`) cambió de
fondo+borde teñidos a una barra de acento a la izquierda
(`border-l-4 border-l-primary`), más valores con `tabular-nums`. La rama
**con** `paleta` (la que sí usa Exportaciones) no cambió en absoluto.

**No se tocó** (fuera del alcance aprobado): `Card`/`Button`/`Badge` base,
`SectionCard`, ninguna lógica de negocio, cálculo, query, validación zod ni
mensaje de toast.

## Selectores con búsqueda — `components/ui/combobox.tsx`

Primitivo `Combobox<T>` (Popover + Command de cmdk) del que son envoltorios
finos los 7 comboboxes de dominio existentes (`SkuCombobox`,
`ProveedorSelectCombobox`, `VehiculoCombobox`, `RetiradorAutorizadoCombobox`,
`OrdenCompraPendienteCombobox`, `CamionCombobox`, `ConductorCombobox`, todos
en `components/shared/`). Cada uno mantiene su propio tipo de opción y su
firma de props exacta — nadie que los importa necesita cambiar nada.

```tsx
import { Combobox } from "@/components/ui/combobox";

<Combobox
  items={opciones}
  value={value}
  onSelect={onSelect}
  itemKey={(o) => o.id}
  matchValue={(o) => o.id}       // campo contra el que se compara `value` (no siempre es itemKey, ej. placa en vez de id)
  searchValue={(o) => `${o.codigo} ${o.nombre}`}  // texto buscable en cmdk
  renderItem={(o) => <span>{o.nombre}</span>}
  renderSeleccionado={(o) => o.nombre}  // opcional, por defecto usa renderItem
  placeholder="Selecciona..."
  searchPlaceholder="Buscar..."
  emptyMessage="No se encontró ningún resultado."
  ancho={420}       // 420 | 480, default 480 (clases completas predefinidas, no interpoladas)
  multilinea         // para filas largas tipo "código — descripción"
  extraOption={{ label: "Sin proveedor", value: "", onSelect: () => onSelect(null) }}
/>
```

Para un combobox de dominio nuevo: crear el wrapper en `components/shared/`
con su propio tipo de opción, nunca usar `Combobox` directo en una página.

## Botones — `components/ui/buttons.tsx`

Envoltorios de `Button` (`components/ui/button.tsx`) con la variante fija,
para no repetir `variant="..."` en cada call site.

```tsx
import { PrimaryButton, SecondaryButton, DangerButton, IconButton } from "@/components/ui/buttons";

<PrimaryButton onClick={...}>Guardar</PrimaryButton>
<SecondaryButton>Cancelar</SecondaryButton>
<DangerButton onClick={handleEliminar}>Eliminar</DangerButton>
<IconButton><Trash2 className="h-4 w-4" /></IconButton>
```

- `PrimaryButton` → `Button variant="default"`
- `SecondaryButton` → `Button variant="secondary"`
- `DangerButton` → `Button variant="destructive"`
- `IconButton` → `Button size="icon"`, `variant` por defecto `"ghost"` (configurable)

Para variantes no cubiertas (`outline`, `link`) o casos puntuales, seguir
usando `Button` directo — estos 4 son los patrones repetidos, no un
reemplazo total.

## Formularios — `components/ui/form-fields/`

Cada uno envuelve el campo base (`Input`/`Textarea`/`Select`/`Checkbox`) +
`FormField` (label + mensaje de error/descripción), replicando el bloque
`space-y-2` repetido a mano en los formularios existentes.

> El directorio se llama `form-fields/`, no `form/`, porque ya existe
> `components/ui/form.tsx` (el `Form`/`FormField`/`FormLabel` de shadcn para
> react-hook-form — confirmado sin importadores en todo el repo, pero no se
> borró en esta fase: su limpieza queda para la Fase 5 ya documentada en el
> plan de arquitectura). Un directorio `form/` con `index.ts` colisiona con
> ese archivo en el mismo specifier `@/components/ui/form` y TypeScript
> resuelve al archivo, no al directorio — de ahí el nombre distinto.

```tsx
import { FormInput, FormSelect, FormTextarea, FormCheckbox, FormDatePicker } from "@/components/ui/form-fields";

<FormInput label="Razón social" required error={errors.razonSocial} {...register("razonSocial")} />

<FormSelect
  label="Tipo"
  required
  value={tipo}
  onValueChange={setTipo}
  options={[{ value: "FUNDO", label: "Fundo" }, { value: "INSUMOS", label: "Insumos" }]}
/>

<FormTextarea label="Observaciones" {...register("observaciones")} />
<FormCheckbox label="Activo" checked={activo} onCheckedChange={setActivo} />
<FormDatePicker label="Fecha de cosecha" required {...register("fechaCosecha")} />
```

- `FormInput`, `FormTextarea`, `FormDatePicker`: ref-forwarding, compatibles con
  `register()` de react-hook-form.
- `FormSelect`, `FormCheckbox`: no ref-forwarding (Radix no es un `<input>`
  nativo) — usar con `Controller` o estado controlado, como ya se hace con
  `Select` en el resto de la app.
- `FormField`/`FormLabel` son las piezas internas; úsalos directo solo si
  necesitas envolver un control que no es ninguno de los anteriores.

## Tarjetas — `components/ui/cards/`

| Componente | Uso | Reemplaza/formaliza |
|---|---|---|
| `SectionCard` | Card con título (+ descripción/acciones) agrupando una sección | `Card`+`CardHeader`+`CardTitle` retipeado a mano |
| `KPICard` | Indicador con tinte de color opcional (`color` en hex) | El patrón `${color}1A`/`${color}66` de los dashboards |
| `SummaryCard` | Dato único con ícono opcional, sin tinte | Tarjetas de total/resumen simples |
| `InformationCard` | Grid de pares label/valor de solo lectura | El patrón "Datos del camión"/"Datos del despacho" de las páginas de detalle |

```tsx
import { SectionCard, KPICard, SummaryCard, InformationCard } from "@/components/ui/cards/...";

<SectionCard title="Datos del proveedor" description="Información general">...</SectionCard>
<KPICard label="Total kg" value="12,450" color="#1F3A5F" />
<SummaryCard label="N.º de tarjas" value="34" icono={Package} />
<InformationCard title="Datos del despacho" items={[{ label: "Placa", value: "ABC-123" }]} />
```

No hay barrel `index.ts` en `cards/` todavía — importar cada uno desde su
archivo (`@/components/ui/cards/section-card`, etc.).

## Tablas — `components/ui/data-table/`

No es un `DataTable` genérico por columnas — eso implicaría reescribir el
render de cada tabla existente, lo que está fuera del alcance de esta fase.
En cambio, son las piezas sueltas que ya se repetían a mano:

```tsx
import { DataTable, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSearch, TablePagination, TableActions, TableEmptyState } from "@/components/ui/data-table";

<TableSearch placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />

<DataTable>
  <TableHeader>...</TableHeader>
  <TableBody>...</TableBody>
</DataTable>

{filtrados.length === 0 && <TableEmptyState mensaje="Ningún resultado coincide con la búsqueda." />}

<TablePagination
  paginaActual={pagina}
  totalPaginas={totalPaginas}
  total={filtrados.length}
  entidad="proveedores"
  onCambiarPagina={setPagina}
/>
```

- `DataTable` es un re-export de `Table` (mismo componente, mismo nombre más
  descriptivo en este barrel).
- `TablePagination` es para tablas con **filtro y paginación en estado de
  cliente** (como `proveedor-table.tsx`). Para listados paginados por la URL
  (`searchParams` en un server component), sigue usándose
  `PaginationControls` de `components/shared/pagination-controls.tsx` — no se
  reemplaza, resuelven casos distintos (navegación por `Link` vs. `onClick`).
- Para "no hay ningún registro todavía" (tabla vacía de origen, no por
  filtro), seguir usando `EmptyState` de `components/shared/empty-state.tsx`
  (con ícono) — `TableEmptyState` es solo el mensaje de texto plano que
  aparece cuando una búsqueda no encuentra coincidencias.

## Estados / badges — `components/ui/estado-badge.tsx` + `lib/design/estado-variant.ts`

```tsx
import { EstadoBadge, ActivoBadge, SuccessBadge, WarningBadge, DangerBadge, InfoBadge } from "@/components/ui/estado-badge";

<EstadoBadge estado="APROBADO" />        {/* variant="success" */}
<ActivoBadge activo={proveedor.activo} /> {/* "Activo"→success, "Inactivo"→secondary */}
<InfoBadge>Nuevo</InfoBadge>
```

- `estadoDocumentoVariant()`/`activoVariant()`/`activoLabel()` en
  `lib/design/estado-variant.ts` son las funciones puras si solo necesitas la
  variante, no el badge completo (ej. para pasarla a otro componente).
- La variante `info` (`bg-blue-100 text-blue-800`) es nueva en `badge.tsx`
  (Fase 2) — las variantes `success`/`warning` ya existían antes de esta
  fase y no se tocaron.
- Al migrar un archivo que hoy tiene su propio objeto `_VARIANT` copiado:
  reemplazar por estas funciones, nunca cambiar qué variante le corresponde a
  cada estado salvo que sea un bug confirmado (ver `usuarios/lista/page.tsx`,
  que usaba `destructive` en vez de `secondary` para inactivo).

## Form-dialogs — `components/shared/entity-form-dialog.tsx`

Envuelve el esqueleto repetido en los `*-form-dialog.tsx`: `Dialog` +
`useFormState` + toast de éxito (cierra el diálogo) + botón de envío con
"Guardando...". El contenido del formulario (los campos) lo sigue armando
cada `*-form-dialog.tsx` vía `children` — nunca absorbe la server action,
la validación zod, ni el gating por rol (que sigue en el padre, ej. una
tabla, decidiendo si renderiza el `*FormDialog`).

```tsx
import { EntityFormDialog } from "@/components/shared/entity-form-dialog";

export function TipoBandejaFormDialog({ tipoBandeja }: { tipoBandeja?: TipoBandeja }) {
  const esEdicion = !!tipoBandeja;
  const action = esEdicion ? actualizarTipoBandejaAction.bind(null, tipoBandeja.id) : crearTipoBandejaAction;

  return (
    <EntityFormDialog esEdicion={esEdicion} action={action} entidad="tipo de bandeja">
      {() => (
        <>
          <FormInput label="Nombre" name="nombre" defaultValue={tipoBandeja?.nombre} required />
          {/* resto de campos */}
        </>
      )}
    </EntityFormDialog>
  );
}
```

- `entidad` (minúscula, singular, ej. "tipo de bandeja" o "camión") arma los
  defaults: título ("Nuevo/Editar X"), botón de la lista ("Nuevo X"), botón
  de envío ("Crear X" / "Guardar cambios") y el toast de éxito ("X
  creado"/"X actualizado"). Sobrescribir con `textoBotonCrear`,
  `textoBotonEnviarCrear`, `mensajeExitoCrear`, etc. solo si el texto
  default no calza (género/plural irregular).
- `action` debe tener la forma `(state, formData) => Promise<state>` con
  `state: { error?: string; success?: boolean } | undefined` — el mismo
  tipo que ya devuelven todas las server actions de los `*-form-dialog.tsx`
  existentes (`TaraActionState`, `TransporteActionState`, etc.), así que no
  hace falta tocarlas.
- `children` recibe el `state` actual (para mostrar algo condicionado a un
  error puntual si hiciera falta) y debe devolver solo los campos — el
  wrapper ya pone el `<form>`, el mensaje de error general y el botón.
- Migrados como piloto: `TipoBandejaFormDialog`, `TipoPalletFormDialog`,
  `CamionFormDialog`. El resto (`ConductorFormDialog` ya usa
  `FormInput`/`FormSelect`/`PrimaryButton` pero no este wrapper;
  `ProveedorFormDialog`, `SkuFormDialog`, `AlmacenFormDialog` siguen con el
  esqueleto manual) queda para una próxima ronda, sin plazo.

## Ventanas / mensajes

| Componente | Archivo | Cuándo usar |
|---|---|---|
| `Modal` | `components/ui/modal.tsx` | Dialog simple: título + contenido + footer de acciones. Para composición más particular, seguir usando `Dialog`/`DialogContent` directo. |
| `AlertDialog` | `components/ui/alert-dialog.tsx` | Confirmación controlada embebida en un componente (título/descripción/confirmar/cancelar), sin pasar por el provider global. |
| `useConfirm()` | `components/shared/confirm-dialog-provider.tsx` (ya existente) | El caso imperativo más común: `if (!(await confirmar("¿Eliminar X?"))) return;` dentro de un handler async. Es el "ConfirmDialog" de la fase — no se creó un archivo nuevo porque este ya cumple el rol. |
| `usePrompt()` | mismo archivo que `useConfirm` | Reemplazo async de `window.prompt()`. |
| `LoadingState` | `components/ui/loading-state.tsx` | Spinner + mensaje opcional, para una sección que está cargando. No usar para el estado "enviando" de un botón — para eso sigue el patrón existente de `disabled` + texto cambiado en el propio botón. |
| `EmptyState` | `components/shared/empty-state.tsx` (ya existente) | "No hay ningún registro" con ícono — no se tocó, ya cumplía el rol. |

## Notas para quien continúe esta fase

- El gating por rol (`roles.includes("ADMIN")` envolviendo un trigger) **no**
  lo absorbe ningún componente de esta fase — sigue en el componente padre,
  exactamente como antes. Al migrar un form-dialog o una fila de tabla con
  gating, verificar que ese `if`/ternario se preservó.
- Ningún componente de esta fase cambia una server action, una validación
  zod, un mensaje de toast ni una query — son solo envoltorios de
  presentación.
- Pendiente (fuera de esta ronda, requiere aprobación explícita antes de
  migrar más módulos): migrar el resto de los `*-form-dialog.tsx` a
  `EntityFormDialog`. El `Combobox` genérico y `EntityFormDialog` ya se
  crearon, con piloto aplicado (ver sus secciones arriba);
  `placa-vehiculo-field.tsx` (confirmado sin importadores) ya se eliminó.
- `chart-colors.ts` centralizado — **descartado, premisa ya no aplica**: el
  acento `#8dcfec` que motivó este ítem ya no existe en el código (la
  paleta del dashboard de Exportaciones se rediseñó por completo en una
  ronda anterior, ver `app/(dashboard)/comex/dashboard-exportaciones/colores.ts`).
  Se confirmó por grep que ningún otro archivo del repo repite esos hex —
  `colores.ts` ya es la única fuente de verdad de color de ese dashboard,
  así que moverlo a `components/ui/charts/chart-colors.ts` sería solo un
  rename cosmético (tocar todos sus importadores) sin resolver ninguna
  duplicación real. No se hizo.
