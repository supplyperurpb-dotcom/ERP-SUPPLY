# Decisiones técnicas — Fase 1 (Scaffold)

Este documento registra las decisiones de arquitectura tomadas al construir la estructura base del
sistema, y los supuestos asumidos donde el requerimiento no era explícito. Sirve como punto de
partida para las fases siguientes.

## 1. ORM: Prisma en lugar de Drizzle

Se eligió **Prisma** sobre Drizzle por tres razones prácticas para este proyecto:

- **Prisma Studio** da un explorador visual de datos sin configuración adicional, útil para que el
  equipo de negocio (logística, acopio, comex) valide datos de prueba durante el desarrollo, sin
  necesitar SQL.
- El flujo `prisma migrate dev` + `schema.prisma` como fuente única de verdad es más simple de
  operar para un equipo pequeño que la combinación de Drizzle Kit + definición de esquema en
  TypeScript, sobre todo en la fase de scaffold donde el modelo todavía va a cambiar seguido.
  la generación de tipos de Prisma más el cliente cubre lo mismo con menos piezas móviles.
- Es la integración más documentada con Supabase Postgres en proyectos Next.js/Vercel, lo que
  reduce fricción al conectar el `DATABASE_URL` (pooler) y `DIRECT_URL` (migraciones).

La contrapartida conocida es el tamaño del cliente generado y un runtime algo más pesado que
Drizzle en edge functions — no es un problema aquí porque las rutas de negocio con Prisma corren en
runtime Node (no Edge), incluida la ruta de generación de PDF.

## 2. Autenticación: Supabase Auth + tabla `usuarios` propia

Se mantiene una tabla `usuarios` en Postgres (vía Prisma) separada de `auth.users` de Supabase,
vinculada por `supabaseAuthId`. Motivo: `auth.users` no es directamente extensible con las
relaciones de negocio (`asignaciones_rol`, `logs_auditoria`, `creadoPorId` en documentos), y
mantener una tabla propia permite hacer joins normales con Prisma en vez de depender de vistas o
funciones RPC sobre el schema `auth`.

El middleware (`middleware.ts`) solo verifica que exista una sesión válida de Supabase Auth y
protege las rutas no públicas. La resolución de roles (`lib/auth/session.ts`,
`getUsuarioActual()`) ocurre en Server Components vía Prisma, cacheada por request con `cache()`
de React para no repetir la consulta en cada Server Component que la necesite.

**Supuesto**: en esta fase no existe una pantalla de invitación/registro de usuarios. El primer
usuario (y su vínculo a un rol) se crea manualmente en el panel de Supabase + Prisma Studio (ver
README). Fase 2 debería mover esto a un flujo dentro del módulo de Usuarios (invitar por correo,
Supabase envía el magic link, el sistema crea la fila en `usuarios` al primer login).

## 3. Permisos por módulo, no por campo

Se implementó control de acceso por módulo (`lib/auth/constants.ts`, `tienePermiso()`), no por
campo ni por acción granular dentro de un módulo, tal como pedía el alcance de esta fase. La tabla
`Permiso` en el schema sí soporta una acción (`VER | CREAR | EDITAR | APROBAR | ELIMINAR`) por
módulo y rol, pensada para cuando se quiera enforced a nivel de UI/servidor más fino — por ahora
esa tabla se siembra pero no se consulta activamente; el filtro real de navegación usa el mapeo
estático `ACCESO_MODULO_POR_ROL`.

Row Level Security de Supabase se documenta como capa adicional en el plan, pero **no se activó
todavía**: todas las consultas de este scaffold pasan por Prisma con la `service`/conexión directa
a Postgres, no por el cliente de Supabase con la sesión del usuario. Antes de ir a producción hay
que decidir si RLS se activa sobre las tablas y cómo conviven las dos vías de acceso (Prisma server
actions vs. cliente Supabase directo), para no duplicar lógica de autorización.

## 4. `creadoPorId` como campo plano, sin relación Prisma

Los modelos transaccionales (`Proveedor`, `Sku`, `SolicitudPedido`, `OrdenCompra`, `IngresoFruta`,
`Tarja`, `GuiaRemision`, `Embarque`, `PackingList`, movimientos de stock) tienen un campo
`creadoPorId` de tipo `String?` **sin** `@relation` hacia `Usuario`. Es intencional: declarar la
relación real obligaría a nombrar ~10 relaciones inversas distintas en el modelo `Usuario`
(`creadoPor_solicitudes`, `creadoPor_ordenes`, etc.), lo que infla el modelo sin aportar nada en
esta fase. Se documenta aquí para que, si en fase 2 se necesita integridad referencial o
navegación desde `Usuario` hacia "todo lo que creó", se añadan esas relaciones nombradas de forma
deliberada.

## 5. `Aprobacion` y `MovimientoStock.documentoOrigen*` como referencias polimórficas simples

En vez de una FK estricta por tipo de documento, `Aprobacion` guarda `tipoDocumento` (enum) +
`documentoId` (string) sin relación Prisma, e igual `MovimientoStock.documentoOrigenTipo` /
`documentoOrigenId`. Esto evita atar el módulo de aprobaciones (o el de movimientos de stock) a un
único tipo de documento origen mediante un esquema de "muchas FKs opcionales". El costo es que la
integridad referencial de esos campos se valida en código de aplicación, no en la base de datos —
aceptable en esta fase porque todavía no hay lógica de negocio real escribiendo esas filas.

## 6. Regla de aprobación: configuración lista, lógica real pendiente

`ReglaAprobacion` (tipo de documento + monto umbral + rol aprobador) existe en el modelo pero no
hay ningún flujo que la lea todavía — las Solicitudes de Pedido y Órdenes de Compra se crean
directamente en estado `BORRADOR` sin generar automáticamente una fila en `Aprobacion`. Fase 2
debe: (a) generar la(s) fila(s) de `Aprobacion` correspondientes al pasar un documento a
`PENDIENTE`, evaluando `ReglaAprobacion` contra el monto/tipo, y (b) las acciones de
aprobar/rechazar que actualicen tanto `Aprobacion` como el estado del documento y escriban
`LogAuditoria`.

## 7. `LogAuditoria` no se escribe automáticamente todavía

La tabla existe con la forma pedida (usuario, acción, entidad, entidadId, valores antes/después,
fecha), pero ningún Server Action de esta fase escribe en ella — los CRUD de SKU, Proveedor y
Catálogo de taras solo hacen create/update/delete directos. Antes de fase 2, conviene decidir si la
auditoría se centraliza en un helper compartido (ej. un wrapper alrededor de `prisma.$transaction`)
en vez de repetir el `prisma.logAuditoria.create(...)` en cada acción.

## 8. Generación de PDF: `pdf-lib` (se descartó `@react-pdf/renderer` tras probarlo)

La primera versión de este módulo usaba `@react-pdf/renderer`, que describe el documento como
componentes React (`Document`, `Page`, `View`, `Text`). Al conectar un proyecto de Supabase real y
probar el botón "Generar PDF de prueba" de punta a punta en el navegador, la generación fallaba
siempre con `Error: Minified React error #31` ("Objects are not valid as a React child") al llamar
`renderToBuffer` **solo** cuando el código corría dentro del route handler de Next.js — un script
de Node ejecutado directo, con el mismo `@react-pdf/renderer`, la misma plantilla y el mismo React,
funcionaba sin problemas. Se probaron cuatro correcciones distintas antes de descartar la librería:
construir el elemento con `createElement` vs. invocar el componente como función plana, actualizar
`@react-pdf/renderer` de 3.4.5 a 4.9.0, excluirla del bundling de Next con
`serverExternalPackages`, y reescribir la plantilla sin JSX (usando `React.createElement`
explícito para forzar que resolviera la misma copia de `react` que la app). Ninguna cambió el
resultado — el reconciler interno de `@react-pdf/renderer` resuelve una copia de React distinta a
la que usa el resto de la app cuando el bundler de Next.js empaqueta el route handler, y no se
encontró una combinación de configuración que lo evitara en este entorno (Next 15.5.25 + webpack
en modo dev, Windows).

Dado que el propio enunciado original ya contemplaba `pdf-lib` como alternativa válida, se migró el
módulo a esa librería: no depende de React en absoluto (construye el PDF con una API imperativa —
`PDFDocument.create()`, `page.drawText()`, etc.), así que no puede sufrir este tipo de conflicto de
bundling, y es la opción más liviana y probada en funciones serverless de Vercel. Se probó el
pipeline completo con una plantilla genérica (`lib/pdf/documento-base.ts`) servida desde
`app/api/pdf/test/route.ts`, confirmando los 3 documentos de ejemplo (guía, tarja, packing list)
con `curl`/`Invoke-WebRequest` contra el servidor de desarrollo real. Los datos que arma ese
endpoint siguen siendo de ejemplo (hardcodeados), no vienen de la base de datos — la conexión con
datos reales de cada documento es trabajo de fase 2.

## 9. Entidades no listadas explícitamente que se agregaron

- **`Cliente`**: no estaba en la lista de entidades del enunciado pero es necesaria para
  `Embarque` y `StockCamara` (segmentación "por cliente/destino si aplica").
- **`IngresoFrutaBandejaPeso`**: tabla hija de `IngresoFrutaPallet` para registrar el peso bruto
  por bandeja individual dentro de un pallet (el enunciado pide "peso bruto por
  jaba/bandeja/pallet"); el pallet guarda los totales agregados (`pesoBrutoTotalKg`,
  `pesoTaraTotalKg`, `pesoNetoKg`) y esta tabla el detalle por bandeja.
- **`GuiaRemisionDetalle`**: detalle de la guía de remisión por pallet transportado (necesario para
  que una guía pueda cubrir más de un pallet).

## 10. Catálogo de unidades de medida

`lib/validations/sku.ts` incluye un catálogo simplificado de unidades SUNAT (`KGM`, `NIU`, `BX`,
`LTR`, `ZZ`) como punto de partida para los `<select>` de la UI. **No** es el catálogo oficial
completo de SUNAT (que tiene cientos de códigos) — fase 2 debería reemplazarlo por el catálogo 03
completo si se requiere selección exhaustiva.

## 11. Módulo de Ingresos de fruta: `tipoPalletId` opcional, `modulo`/`turno` como texto libre

El primer flujo funcional real de Acopio ("Nuevo ingreso de materia prima") se construyó según lo
pedido explícitamente por el usuario, que difiere un poco del diseño original de
`IngresoFrutaPallet`:

- **`tipoPalletId` pasó a ser opcional** (`String?` / relación opcional). El cálculo de peso neto
  de este flujo es `peso bruto − (cantidad de bandejas × tara de la bandeja según catálogo)`, sin
  descontar tara de pallet/parihuela — el usuario fue explícito en que la fruta "viene en bandeja"
  y no mencionó pallets en la fórmula. El campo se mantiene en el modelo (no se eliminó) porque
  `Tarja` y `GuiaRemisionDetalle` ya referencian `IngresoFrutaPallet`, y podría volver a ser
  relevante para packing/logística más adelante.
- **`modulo`, `turno` y `variedad` viven en `IngresoFrutaPallet` (por línea), no en `IngresoFruta`
  (cabecera).** Se movieron ahí en una segunda vuelta: el usuario aclaró que `IngresoFruta`
  representa la llegada de **un camión**, registrada una sola vez (placa, hora de recepción), y que
  un mismo camión puede traer fruta de varios módulos/turnos/variedades del fundo — cada uno se
  captura como una línea de pesaje independiente, con su propia tara y peso neto calculados. Por
  eso `placaTransporte` pasó de opcional a obligatorio en la cabecera (es el identificador natural
  del camión). El formulario (`ingreso-fruta-form.tsx`) usa `useFieldArray` de react-hook-form para
  las líneas dinámicas, y la tabla de "Ingresos" resume el conjunto de módulos únicos por camión en
  una sola columna (no hay todavía una vista de detalle por ingreso que liste cada línea).
- Texto libre, no catálogo: no existe todavía un catálogo formal
  Módulo → Turno por fundo — si se necesita más adelante, se puede modelar como una tabla propia
  con FK desde `Proveedor`, sin romper estos dos campos (se podrían migrar a IDs).
- El número correlativo (`IF-0001`, `IF-0002`, …) se genera contando filas existentes
  (`prisma.ingresoFruta.count() + 1`) en el propio server action — no es resistente a condiciones
  de carrera con escrituras concurrentes; aceptable para esta fase, pero antes de tener múltiples
  usuarios de Acopio registrando ingresos en simultáneo conviene mover la numeración a una
  secuencia de base de datos o una transacción con bloqueo.
- El registro de "varios pallets por ingreso" se implementó como líneas de pesaje dinámicas
  (`useFieldArray` de react-hook-form) dentro de un único formulario/submit — no como un flujo de
  "crear ingreso, luego agregar pallets uno por uno". El server action recibe el objeto completo
  (cabecera + arreglo de líneas) y hace un solo `prisma.ingresoFruta.create` con `pallets: { create: [...] }`
  anidado.

## 12. Menú móvil del dashboard

El sidebar original era `hidden md:flex` (oculto por completo debajo de 768px) sin ninguna forma de
abrirlo — el botón ☰ del topbar no tenía `onClick`. Se detectó al usar la app real en una ventana
angosta: la página cargaba bien, pero no había manera de ver la navegación. Se resolvió con
`components/shared/dashboard-shell.tsx` (Client Component que envuelve sidebar + topbar + contenido
y mantiene el estado `menuAbierto`), convirtiendo el sidebar en un panel deslizante con backdrop en
mobile, y que se cierra solo al navegar a un link.

## 13. Pallets físicos como entidad propia, con asignación manual desde el formulario

Segunda vuelta de cambios al flujo de Ingresos: el usuario aclaró que las bandejas no se quedan
"sueltas" por línea de pesaje — se van apilando en **pallets físicos reales**, con una capacidad
máxima fija de 240 bandejas, y un mismo pallet puede recibir bandejas de más de una línea (incluso
de camiones distintos, en entregas separadas).

- Se agregó el modelo `Pallet` (tabla `pallets`): `numero` correlativo (`PAL-0001`, …),
  `cantidadBandejas`/`pesoBrutoTotalKg`/`pesoTaraTotalKg`/`pesoNetoKg` **denormalizados** (se
  actualizan en cada asignación, no se recalculan agregando en cada lectura — igual que
  `OrdenCompra.montoTotal`), y `estado` (`ABIERTO`/`CERRADO`, se cierra solo al llegar a 240 o
  manualmente si el flujo lo permite en una fase futura). Es una entidad distinta de `TipoPallet`
  (el catálogo de tipos de parihuela con su tara, ya existente) — `Pallet` es la instancia física,
  `TipoPallet` es el tipo/catálogo.
- `CAPACIDAD_MAXIMA_BANDEJAS_POR_PALLET = 240` es una constante fija en código
  (`lib/constants/pallet.ts`), no un campo configurable por tipo de pallet — el usuario fue
  explícito en que es un techo único ("puedo tener pallets de 200 o 100, pero no más de 240"), no
  algo que varíe por catálogo.
- `IngresoFrutaPallet` (la línea de pesaje) ahora tiene `palletId` obligatorio: cada línea se
  asigna a **un** pallet físico. Si una entrega de bandejas debe repartirse entre dos pallets (p.
  ej. 40 para completar uno existente + 160 para uno nuevo), el usuario crea dos líneas — una por
  destino — cada una con su propio peso bruto pesado por separado (confirmado con el usuario: el
  peso **no** se prorratea automáticamente, se pesa cada porción).
- El formulario ofrece, por línea, dos botones: **"Crear pallet nuevo"** (reserva un id temporal en
  el cliente — el número correlativo real se asigna recién en el server action, dentro de la
  transacción, para no generar huecos ni duplicados) y **"Asignar a pallet existente"** (abre un
  diálogo con los pallets abiertos en BD y los pallets nuevos creados en ese mismo formulario, cada
  uno mostrando cuántas bandejas le quedan — calculado en vivo restando lo ya asignado dentro del
  formulario, no solo lo que hay en BD).
- El server action (`crearIngresoFrutaAction`) agrupa las líneas por destino, valida capacidad
  (contra 240 para pallets nuevos, y contra `240 - cantidadBandejas actual en BD` para existentes —
  esta segunda validación es la autoridad real, por si el snapshot que vio el usuario en el
  formulario quedó desactualizado), y dentro de una única `prisma.$transaction` crea los pallets
  nuevos con su correlativo, incrementa los totales de los existentes, y crea el `IngresoFruta` con
  sus líneas ya apuntando al `palletId` real.
- **Pendiente, fuera de alcance de este cambio**: `Tarja` y `GuiaRemisionDetalle` todavía referencian
  `IngresoFrutaPallet` (la línea), no `Pallet` (el pallet físico). Conceptualmente una tarja se
  pega a un pallet físico, no a una línea de pesaje — antes de construir los módulos de Tarjas y
  Guías de remisión, esas relaciones deberían apuntar a `Pallet`.
- No se construyó una página de listado de `Pallet` en esta vuelta (no se pidió); el único punto de
  visibilidad hoy es el diálogo de asignación dentro de "Nuevo ingreso".

## 14. Catálogo de taras corregido, tara de pallet opcional en el cálculo de neto

El catálogo inicial (sembrado por `prisma/seed.ts`) tenía datos de ejemplo genéricos ("Jaba
plástica estándar" 0.65 kg, "Parihuela madera estándar" 22 kg). El usuario dio los valores reales:

- `TipoBandeja`: **Bandeja Plástica Blanca** (0.285 kg) y **Jaba Plástica** (1.4 kg) — reemplazan a
  la jaba genérica.
- `TipoPallet`: se agregó **Pallet Plástico Azul** (18.5 kg) junto a la parihuela de madera ya
  existente (esa no se pidió quitar).

Como todavía no había ningún `IngresoFruta`/`Pallet` real en la base de datos (se verificó antes de
tocar nada), la corrección se aplicó directo con un script puntual de Prisma contra la base real, y
`seed.ts` se actualizó para que coincida en instalaciones nuevas.

Además, el usuario aclaró que **algunas líneas se pesan sobre una parihuela/pallet físico y otras
no** ("hay pallets que se pesan sin pallet"), así que el selector de `TipoPallet` por línea (el
campo `tipoPalletId`, ya opcional en el modelo desde la primera vuelta de Acopio) se expuso por fin
en el formulario de "Nuevo ingreso" como una casilla opcional ("Sin pallet" por defecto). Cuando se
elige uno, su tara se suma a la de las bandejas en el cálculo de peso neto:
`peso neto = peso bruto − (cantidad de bandejas × tara de bandeja) − tara del pallet (si se eligió uno)`.

## 15. Bug de estabilidad: `require()` en `tailwind.config.ts` tumbaba el servidor de desarrollo

Se detectó que `next dev` podía morir espontáneamente con `ReferenceError: require is not defined`
apuntando a `tailwind.config.ts:61` (`plugins: [require("tailwindcss-animate")]`). El archivo usa
`export default`, así que en este toolchain (Next 15.5.25 + Node 24) se carga por una ruta ESM
(`ModuleLoader.importSyncForRequire`) donde `require` no está disponible como global — a diferencia
de un `tailwind.config.js` en CommonJS clásico, donde sí lo estaría. Curiosamente `npm run build`
nunca lo disparó (la ruta de carga en el build de producción es distinta); solo aparecía en `next
dev`, de forma intermitente, cuando PostCSS necesitaba releer la config de Tailwind.

Fix: reemplazar el `require()` por un `import tailwindcssAnimate from "tailwindcss-animate"` normal
al inicio del archivo. Si en el futuro se agregan más plugins de Tailwind en este archivo, deben
importarse igual (nunca con `require`).

## 16. Segundo bug de estabilidad del dev server: `experimental.devtoolSegmentExplorer`

Tras el fix de `tailwind.config.ts`, `next dev` volvió a caerse dos veces más con errores
distintos pero del mismo estilo ("Could not find the module ...segment-explorer-node.js
#SegmentViewNode in the React Client Manifest", luego "`__webpack_modules__[moduleId] is not a
function`"), siempre después de varios ciclos de Fast Refresh seguidos, terminando en `/login`
respondiendo 500. Revisando `node_modules/next/dist/server/config-shared.js` se confirmó que Next
15.5.25 trae una función experimental, **`experimental.devtoolSegmentExplorer`, activada por
defecto (`true`)**, cuyo nombre coincide exactamente con el módulo que fallaba
(`SegmentViewNode`/"segment explorer"). Se desactivó explícitamente en `next.config.mjs`
(`experimental: { devtoolSegmentExplorer: false }`). Es una herramienta de UI de DevTools (explorador
de segmentos de rutas dentro del overlay de desarrollo) — no afecta el build de producción ni
ninguna funcionalidad de la aplicación, solo se apaga esa pieza del overlay.

**Nota operativa**: cuando el dev server quede en este estado (errores de webpack/manifest sin
relación con el código que se acaba de editar, `/login` u otra ruta respondiendo 500), el arreglo
es: detener el proceso, borrar la carpeta `.next` y volver a levantar `npm run dev`. Ocurrió varias
veces durante esta sesión, probablemente agravado por los múltiples reinicios abruptos del servidor
(`TaskStop` en medio de una escritura de caché de webpack).

## 17. Tercer bug de estabilidad: se desactiva el caché de webpack en dev

Con `devtoolSegmentExplorer` ya desactivado, `next dev` volvió a caerse con el mismo error que en
el primer bug de esta serie (`Cannot find module './331.js'`, `.next/server/webpack-runtime.js`),
esta vez al recompilar `/login` después de varias rutas ya visitadas — confirmado reproduciendo el
fallo con un script de Playwright real. Esto descarta que el problema fuera un solo flag
experimental: es el **caché persistente de webpack en disco** (`.next/cache/webpack`) el que se
corrompe en este entorno tras suficientes recompilaciones dentro de una misma sesión de `next dev`
(no se determinó la causa exacta — sospecha: interacción con los reinicios abruptos del proceso
via `TaskStop`, o alguna particularidad de Node 24 / Windows con el filesystem cache de webpack 5).

Se desactivó ese caché en modo desarrollo agregando a `next.config.mjs`:

```js
webpack: (config, { dev }) => {
  if (dev) config.cache = false;
  return config;
},
```

Esto vuelve cada recompilación un poco más lenta (no reutiliza el caché en disco entre reinicios
del proceso), pero **no afecta el build de producción** (el `if (dev)` lo deja intacto) ni ninguna
funcionalidad de la app. Verificado con una prueba de estrés (3 rondas navegando 7 rutas distintas,
21 requests) sin ningún error 5xx, después de que el mismo escenario reprodujera el crash antes del
cambio.

## 18. Vista de detalle de Ingreso y Tarjas reales (PDF de etiqueta 10×15 cm)

Dos features pedidas juntas: (a) poder ver el detalle de un ingreso (sus líneas de pesaje) desde el
listado, y (b) generar una etiqueta imprimible por pallet armado, con módulo/variedad/bandejas/peso
neto.

- **`app/(dashboard)/acopio/ingresos/[id]/page.tsx`**: primera ruta dinámica del proyecto. Next
  15 volvió asíncrono el `params` de páginas y route handlers (`params: Promise<{ id: string }>`,
  `const { id } = await params`) — no había hecho falta notarlo antes porque ninguna otra página
  usa segmentos dinámicos.
- **Tarja pasa a referenciar `Pallet` (físico), no `IngresoFrutaPallet` (línea)** — corrige la
  relación "pendiente" que había quedado documentada en la sección 13. Tenía sentido esperar: recién
  con la vista de detalle y el flujo de generación de etiqueta quedó claro que la tarja es por
  pallet armado (que puede reunir líneas de más de un módulo/variedad, incluso de más de un
  camión), no por línea de pesaje individual. Migración aplicada contra la base real.
- **`app/(dashboard)/acopio/tarjas/page.tsx`** dejó de ser un listado de `Tarja` (que empezaba
  vacío siempre) y pasa a listar **`Pallet`**: cada fila muestra bandejas/240, estado, peso neto, y
  un botón que es "Generar tarja" si el pallet todavía no tiene una, o "Ver PDF (TJ-000X)" si ya la
  tiene — la generación de la tarja (`crearTarjaAction`) solo crea la fila en BD con el correlativo;
  el PDF se arma al vuelo en `GET /api/pdf/tarja/[palletId]`, no se sube a Supabase Storage todavía
  (el campo `pdfUrl` de `Tarja` queda sin usar por ahora — coherente con no implementar Storage en
  esta fase).
- **Etiqueta de 10×15 cm** (`lib/pdf/tarja-pdf.ts`, con `pdf-lib`, tamaño de página en puntos:
  `10 * 28.3465` × `15 * 28.3465`): una línea por cada línea de pesaje que aportó al pallet
  (módulo/turno/variedad, tipo de bandeja, cantidad, peso neto) más los totales del pallet. Probado
  end-to-end con Playwright (crear tarja → descargar PDF → verificar contenido) contra datos reales
  antes de darlo por bueno.

## 19. Entorno de desarrollo usado para este scaffold

El scaffold se escribió a mano, archivo por archivo (incluidos los tres CRUD de referencia y las
páginas placeholder, generados por agentes siguiendo ese mismo patrón), en una máquina que
inicialmente **no tenía Node.js ni Git instalados**. Una vez instalados ambos, se corrió la
verificación completa contra el código real:

- `npm install` (537+ paquetes, sin errores; `postinstall` corrió `prisma generate` correctamente
  contra `schema.prisma`).
- `npm run build` — pasa. Next.js intenta pre-renderizar las rutas del dashboard en build time, lo
  que produce errores de Prisma en el log (`Environment variable not found: DATABASE_URL`) porque
  no hay una base de datos real conectada en este entorno; son solo ruido esperado — Next detecta
  que esas rutas dependen de datos dinámicos (por `cookies()` en el layout del dashboard) y las
  marca como renderizadas bajo demanda (`ƒ`), no como estáticas. El build termina con éxito.
- `npm run lint` (ESLint vía `next/core-web-vitals`) y `npm run typecheck` (`tsc --noEmit`) — ambos
  sin advertencias ni errores.
- Se corrigieron dos problemas de tipos reales que solo aparecieron al compilar de verdad, ambos en
  `app/api/pdf/test/route.ts`: (a) `renderToBuffer` de `@react-pdf/renderer` está tipado para
  aceptar únicamente un elemento `<Document>` directo, no un componente que internamente renderiza
  uno — se resolvió con un cast explícito al tipo que espera la firma de la función; (b) el
  `Buffer` de Node no siempre satisface la definición TypeScript de `BodyInit` del DOM — se resolvió
  envolviéndolo en `new Uint8Array(buffer)` antes de pasarlo a `NextResponse`.

### Next.js 14 → 15.5.25 por vulnerabilidades de seguridad

El plan original fijaba Next.js en la serie 14.2.x. Al correr `npm install` + `npm audit`, la base
de datos de advisories vigente marcaba la serie 14.x completa (incluida la última, 14.2.35) con
varias vulnerabilidades **críticas** sin parchear, entre ellas dos de RCE no autenticado (una en
servidores hospedados en Windows, otra en la API de optimización de imágenes con archivos AVIF).
Ninguna versión 14.x las corrige — el fix más bajo disponible es la serie 15.5.x. Se decidió subir
el proyecto a **`next@15.5.25`** (con `eslint-config-next@15.5.25` a la par) en vez de quedarse en
una versión con RCE conocido, incluso siendo scaffold.

Se evaluó saltar directo a Next 16 (versión `latest` en el momento de escribir esto), pero se
descartó para esta fase: las advisories críticas ya quedan resueltas en 15.5.25, y no había forma
de verificar en este entorno qué breaking changes adicionales trae la serie 16. Queda como
recomendación evaluar esa migración en una fase posterior, con las release notes de Next 16 a la
vista.

La migración a Next 15 solo requirió un cambio de código: `cookies()` de `next/headers` pasó a ser
asíncrono. Se actualizó `lib/auth/supabase-server.ts` (`createSupabaseServerClient` ahora es
`async` y hace `await cookies()`) y sus 4 puntos de uso (`lib/auth/session.ts`,
`lib/actions/auth-actions.ts`). Se verificó que Next 15.5.25 sigue soportando React 18.2+ como peer
dependency, así que **no** se subió a React 19 — evita de paso la migración de `useFormState`/
`useFormStatus` a `useActionState`, y mantiene el resto del código sin cambios.

También se cambió el script `lint` de `next lint` (que `next build` marca como deprecado y se
removerá en Next 16) a invocar `eslint` directamente sobre el mismo `.eslintrc.json`.

**Vulnerabilidad conocida y aceptada por ahora**: `npm audit` reporta una vulnerabilidad moderada/
alta de `postcss` (lectura arbitraria de archivos vía `sourceMappingURL`) que vive en
`node_modules/next/node_modules/postcss` — es una dependencia interna del propio *build tooling* de
Next, no el `postcss` de nivel raíz de este proyecto, y solo se resuelve saltando a Next 16. El
vector de explotación (procesar CSS con comentarios `sourceMappingURL` maliciosos durante el build)
no aplica al tráfico HTTP normal de la aplicación en producción. Se documenta aquí para que quede
trazado y se revise junto con la eventual migración a Next 16.

## 20. Server action que hace `redirect()` invocada como función directa: se queda colgada

Al probar "Registrar ingreso" en el navegador, el botón se quedaba en "Guardando..." sin avanzar
nunca (reproducido con Playwright: el mismo escenario, mismo resultado). `crearIngresoFrutaAction`
terminaba con `redirect("/acopio/ingresos")` del lado del servidor — un patrón que funciona bien
cuando la action es el `action` de un `<form>`, pero acá se invoca como una función `async` normal
dentro de un `onSubmit` manual (porque el formulario necesita mandar datos estructurados —
cabecera + arreglo de líneas — no `FormData` plano). Invocada así, el `redirect()` interno no se
propaga como navegación del lado del cliente; la promesa de la llamada a la action nunca se resuelve
de forma limpia para el código que la espera.

Arreglo: la action ya no llama `redirect()` — solo hace `revalidatePath` y devuelve
`{ success: true }`; el componente cliente (que ya tenía el código para eso) hace
`router.push("/acopio/ingresos")` él mismo al recibir una respuesta exitosa. Confirmado con
Playwright esperando explícitamente la navegación (`waitForURL`) en vez de un `waitForTimeout` fijo
— la primera vuelta de la prueba tenía un timeout corto y por eso parecía que seguía "colgado"
cuando en realidad el POST ya había completado, solo que la recompilación en modo desarrollo de la
ruta de destino tomaba unos segundos más (no ocurre en producción, donde las rutas ya están
compiladas).

**Regla para el resto de los formularios de "envío estructurado"** (los que llaman a su server
action como función directa en vez de `<form action={...}>`, como este y cualquier futuro formulario
con arreglos dinámicos): la action nunca debe llamar `redirect()` — debe devolver un estado de
éxito/error, y la navegación posterior a un éxito la hace el componente cliente con
`useRouter().push(...)`.

## 21. Editar un Ingreso: revertir y volver a aplicar contra los pallets, no solo actualizar la línea

El usuario pidió poder volver a entrar a un ingreso ya guardado y editarlo (cabecera y líneas de
pesaje), no solo verlo. Lo delicado no es la cabecera (campos simples) sino las líneas: cada una ya
había sumado sus bandejas/pesos al `Pallet` físico que tiene asignado, con esos totales
denormalizados (sección 13) usados también para generar la tarja. Sobrescribir la línea sin tocar
esos totales los habría dejado desincronizados.

- **`actualizarIngresoFrutaAction`** (nueva, en `lib/actions/ingreso-fruta-actions.ts`) hace, dentro
  de una sola transacción: (1) revierte la contribución de cada línea **anterior** en su pallet
  (`decrement` de bandejas/bruto/tara/neto, recalcula `estado`), (2) borra esas líneas viejas, (3)
  valida capacidad de los pallets existentes **contra su estado ya revertido** (si la edición vuelve
  a usar el mismo pallet, el espacio que ella misma liberó en el paso 1 ya cuenta como disponible),
  (4) crea pallets nuevos / incrementa los existentes y crea las líneas nuevas — mismo patrón que
  `crearIngresoFrutaAction`, factorizado en helpers compartidos (`calcularLineas`, `agruparPorDestino`,
  `sumar`, `datosLineaCrear`) para no duplicar la lógica de cálculo de tara/neto y agrupamiento por
  pallet. Los errores de validación se lanzan como `ErrorValidacion` dentro del callback de la
  transacción (Prisma hace rollback automático) y se capturan afuera para devolver el mensaje.
- **El formulario es el mismo componente que "Nuevo ingreso"** (`IngresoFrutaForm`), con una prop
  opcional `edicion` (`ingresoId`, `valoresIniciales`, `contribucionOriginalPorPallet`). En modo
  edición, cada línea arranca con `palletAsignado: "existente:<idReal>"` (no hay pallets "nuevos"
  temporales al cargar). El diálogo de "asignar a pallet existente" necesita saber cuánto le había
  aportado **este mismo ingreso** a cada pallet para calcular bien la capacidad disponible mientras
  se edita — sin eso, un pallet que este ingreso dejó en 240/240 se vería con 0 de espacio aunque se
  esté reduciendo su propia línea. `contribucionOriginalPorPallet` (sumado por pallet, por si dos
  líneas del mismo ingreso apuntaban al mismo pallet) se sube de vuelta en el cálculo de "restante".
- La página `app/(dashboard)/acopio/ingresos/[id]/editar/page.tsx` arma `palletsAbiertos` como la
  unión de los pallets `ABIERTO` en BD **más** los pallets que este ingreso ya usa aunque estén
  `CERRADO` por su propia culpa — si no se incluyen, el formulario no podría mostrarle al usuario a
  qué pallet está asignada cada línea existente.
- Como la tarja (sección 18) se genera al vuelo desde los datos vivos del pallet, no se
  pre-renderiza ni se guarda, **una tarja ya impresa queda desactualizada automáticamente si se
  edita una línea que aporta a ese pallet** — la próxima vez que alguien abra el PDF verá los datos
  nuevos. No se bloqueó la edición de líneas que ya tienen tarja generada; queda como algo a
  reconsiderar si en el futuro se necesita "sellar" un pallet una vez impresa su etiqueta.
- Probado end-to-end con Playwright contra datos reales: precarga de un ingreso con una línea de
  200 bandejas, edición a 150, guardado, y verificación directa en base de datos de que el pallet
  quedó en `cantidadBandejas=150`, `pesoNetoKg` recalculado y `estado` correcto.

## 22. Módulo de Despacho + renombre "Ingresos de fruta" → "Ingreso de Materia Prima"

Renombre simple de etiquetas en la navegación, títulos de página y textos que mencionaban
"Ingresos/Ingreso de fruta" (no tocó el modelo de datos: `IngresoFruta` sigue llamándose así
internamente, es solo el texto visible el que cambió).

Módulo nuevo, dentro de Acopio (entre Tarjas y Guías de remisión, ya que opera sobre tarjas ya
generadas):

- **Modelo `Despacho`** (`numero` correlativo `DESP-0001`, `placaCamion`, `conductor`,
  `fechaDespacho`, `horaDespacho`) con relación uno-a-muchos hacia `Tarja` (`Tarja.despachoId`,
  opcional). Una tarja despachada queda vinculada a su despacho para siempre — no hay "des-despachar"
  en esta fase.
- **"Disponible para despachar" = `Tarja` con `despachoId: null`.** La página `/acopio/despacho/nuevo`
  solo lista esas; una vez creado el despacho, esas tarjas dejan de aparecer en cualquier despacho
  futuro automáticamente (la condición del `where` ya las excluye, no hace falta lógica adicional).
- `crearDespachoAction` valida, dentro de la misma función (antes de la transacción), que ninguna de
  las tarjas seleccionadas ya tenga `despachoId` — cubre el caso de que el snapshot que vio el
  usuario en el formulario haya quedado desactualizado por otro despacho hecho mientras tanto.
- Selección de tarjas: en vez de reutilizar el patrón de `useFieldArray` (pensado para filas que se
  crean/editan), es una tabla con checkboxes nativos controlados por un solo campo `tarjaIds:
  string[]` del formulario — más simple para "elegir de una lista existente" que para "armar líneas
  nuevas".
- Se agregó una columna "Despacho" en la página de Tarjas (número de despacho si ya salió, "—" si
  no) para que quede visible desde ahí también, no solo al armar un despacho nuevo.
- Probado end-to-end con Playwright: crear despacho seleccionando una tarja real, confirmar que
  desaparece de "disponibles" en una visita posterior a `/acopio/despacho/nuevo`, y verificar en
  base de datos que `Tarja.despachoId` quedó vinculado al despacho correcto. El despacho y el
  vínculo de prueba se revirtieron después (`despachoId` a `null` + `delete` del despacho) para no
  dejar datos de prueba mezclados con los reales del usuario.

## 23. Filtro por fecha y exportación a Excel en Ingreso de Materia Prima

Dos pedidos del usuario sobre el listado de Ingresos: exportar todo lo ingresado a Excel, y poder
"firmar por fecha" en la vista de listado — se confirmó con el usuario (pregunta directa) que esto
último significaba **filtrar**, no una firma/sello literal.

- **Filtro de fecha**: `app/(dashboard)/acopio/ingresos/page.tsx` ahora acepta
  `searchParams: Promise<{ desde?: string; hasta?: string }>` (mismo patrón async que `params` en
  la sección 18) y arma un `where: { fechaIngreso: { gte, lte } }` de Prisma. Es un `<form>` GET
  nativo sin JavaScript (sin `onSubmit`, sin Client Component): los `<input type="date">` se llaman
  `name="desde"`/`name="hasta"`, el navegador arma el querystring solo al enviar. `desde` se ancla a
  `T00:00:00` y `hasta` a `T23:59:59.999` (hora del servidor) para que el filtro sea inclusivo en
  ambos extremos sin depender de zona horaria explícita — coherente con `fechaLocalHoy()` en
  `lib/utils.ts`, que también asume hora local del servidor/navegador, no UTC estricto.
- **Exportación a Excel**: nueva ruta `GET /api/excel/ingresos` (`app/api/excel/ingresos/route.ts`),
  usando `xlsx` (SheetJS) para armar el `.xlsx` en memoria (`XLSX.write(..., { type: "buffer",
  bookType: "xlsx" })`) y devolverlo como `NextResponse` con `Content-Disposition: attachment`
  — mismo patrón que `GET /api/pdf/tarja/[palletId]` (sección 18), pero de descarga en vez de
  visualización inline. Respeta los mismos `desde`/`hasta` que el listado (se lee el `href` del
  botón "Exportar a Excel" armado con las mismas query params activas en la página). **Una fila por
  línea de pesaje** (`IngresoFrutaPallet`), no una fila por ingreso/camión — un ingreso con dos
  líneas (dos módulos/pallets distintos en el mismo camión) genera dos filas, repitiendo los campos
  de cabecera (número, proveedor, placa, fechas, estado). Se decidió así porque el dato "de negocio"
  granular vive a nivel de línea (módulo, turno, variedad, tara, peso neto, pallet asignado) — una
  fila por ingreso habría obligado a concatenar esos campos en una sola celda, perdiendo la
  posibilidad de sumar/filtrar por módulo o variedad directamente en Excel.
- Se evaluó el paquete `xlsx` con `npm audit`: tiene dos advisories conocidas (prototype pollution y
  ReDoS), ambas en el **parser de lectura** de archivos `.xlsx`/`.csv` arbitrarios y sin fix
  publicado por SheetJS vía npm. No aplican aquí: esta ruta solo **escribe** (`json_to_sheet` +
  `XLSX.utils.book_append_sheet` + `XLSX.write`) a partir de datos propios que vienen de Prisma, no
  parsea ningún archivo subido por un usuario. Se documenta para que quede claro que el uso actual
  no está expuesto al vector de esas advisories, y que si en el futuro se agrega un flujo de
  **importar** Excel (leer un archivo subido), hay que reevaluar la librería o sanitizar/limitar esa
  ruta específica.
- **Verificación end-to-end**: como el login de la app es con contraseña contra Supabase Auth (no
  hay credenciales de prueba guardadas en el repo, y el único usuario real en la base es la cuenta
  del propio usuario), se creó un usuario temporal completo para la prueba — fila en Supabase Auth
  (`admin.createUser`, vía `SUPABASE_SERVICE_ROLE_KEY`) **más** su fila correspondiente en `Usuario`
  + `AsignacionRol(ADMIN)` en Prisma (`getUsuarioActual()`, sección 2, exige que exista la fila de
  `Usuario` vinculada por `supabaseAuthId`; sin ella el layout del dashboard hace `redirect("/login")`
  y, como el usuario sí tiene sesión de Supabase válida, el middleware lo rebota de `/login` hacia
  `/`, entrando en un loop de `ERR_TOO_MANY_REDIRECTS` — se reprodujo este loop en el primer intento
  de la prueba antes de crear la fila de `Usuario`). Con Playwright: login real, filtro con rango sin
  datos (verifica el estado vacío), filtro con el día real (verifica que trae las mismas filas que
  sin filtro), y descarga del Excel vía `context.request.get` reutilizando la sesión del navegador —
  se parseó la respuesta con `xlsx` para confirmar cantidad exacta de filas (9, una por cada
  `IngresoFrutaPallet` real en la base en ese momento, repartidas en 7 ingresos) y las columnas
  esperadas. Tanto el usuario de prueba (Auth + Prisma) como los scripts temporales se eliminaron al
  terminar; no se creó ni modificó ningún `IngresoFruta`/`Pallet` real (todo el flujo probado es de
  solo lectura).

## 24. Bug: `formatDate` mostraba la fecha de cosecha un día antes

El usuario reportó que, exportando el Excel, la "Fecha de cosecha" salía un día antes de la
seleccionada en el formulario (eligiendo 11/09/2026, se veía 10/09/2026). Causa raíz confirmada:

- Los campos de fecha de calendario (`fechaCosecha`, `fechaDespacho`, `fecha` de solicitud/orden,
  `fechaEmision`, `fechaTraslado`, ...) se capturan con `<input type="date">` (ej. `"2026-09-11"`) y
  se validan con `z.coerce.date()`, que convierte ese string a **medianoche UTC** de ese día
  (`new Date("2026-09-11")` → `2026-09-11T00:00:00.000Z`).
- `formatDate()` (`lib/utils.ts`) llamaba a `Intl.DateTimeFormat` **sin especificar `timeZone`**, así
  que usaba el huso horario por defecto del proceso de Node. En esta máquina ese default es
  `America/Lima` (confirmado con `Intl.DateTimeFormat().resolvedOptions().timeZone`) — UTC-5. Al
  formatear `2026-09-11T00:00:00Z` en UTC-5, cae en `2026-09-10 19:00:00` hora local, mostrando el
  día anterior. El mismo problema existiría, en sentido inverso, si el proceso corriera en un huso
  horario adelantado a UTC.
- **Fix**: `formatDate()` ahora fija `timeZone: "UTC"` por defecto (parámetro `opciones.timeZone`
  para casos que necesiten otra cosa) — como estos campos se anclan a medianoche UTC precisamente
  para representar "solo una fecha, sin hora", formatearlos en UTC siempre reproduce el día
  literalmente elegido, sin importar en qué huso horario corra el servidor (dev en esta máquina,
  o producción en Vercel, que por defecto corre en UTC).
- **Caso aparte: `fechaIngreso`**. A diferencia de los campos anteriores, `IngresoFruta.fechaIngreso`
  no viene de un `<input type="date">` — es un timestamp real (`@default(now())`, sin campo en el
  formulario) que representa el momento exacto en que se registró el camión. Para ese campo el
  default a UTC habría sido igual de incorrecto en sentido opuesto (un ingreso registrado de noche,
  hora Perú, podría "saltar" al día siguiente en UTC). Por eso: (a) `formatDateTime()` ahora fija
  `timeZone: "America/Lima"` por defecto (se usa para timestamps reales: `createdAt`,
  `movimiento.fecha`, `fechaIngreso` en el detalle del ingreso), y (b) los dos usos de
  `formatDate(ingreso.fechaIngreso, ...)` (listado y Excel) pasan explícitamente
  `{ timeZone: "America/Lima" }` en vez de aceptar el default UTC de `formatDate`.
- De paso, se detectó y corrigió el mismo tipo de fragilidad en el filtro de fechas de la sección 23:
  `rangoFechas()` armaba los límites `gte`/`lte` con `new Date(`${desde}T00:00:00`)` (sin offset),
  que también se interpreta en hora local del proceso — mismo riesgo que el bug de arriba, solo que
  no se había manifestado aún como error visible. Se extrajo a un helper compartido
  `rangoFechaIngreso()` en `lib/utils.ts` (usado tanto por la página de listado como por la ruta de
  Excel, eliminando la duplicación que tenían antes) que ancla los límites con `"-05:00"` explícito
  (`${desde}T00:00:00-05:00` / `${hasta}T23:59:59.999-05:00`), consistente con que `fechaIngreso` se
  interpreta en hora de Perú.
- Verificado con Playwright + un `IngresoFruta` de prueba real (`fechaCosecha` fijada explícitamente
  a `2026-09-11T00:00:00Z`, hoy en el momento de la prueba): tanto la vista de detalle como el Excel
  exportado muestran `11/09/2026`, no `10/09/2026`. Usuario de prueba y el registro creado se
  eliminaron después.

## 25. Excel de Ingresos: "Productor" y "RUC" fijos (REITER), la columna "Proveedor" en realidad es el fundo

El usuario aclaró que el modelo `Proveedor` no representa un proveedor externo en este flujo: es el
**fundo** de origen de la fruta (ej. "Achirana Blue"), y el RUC que traía la columna `Doc. proveedor`
(el del fundo) no es el dato que importa en el documento — el productor real, para efectos del
Excel, siempre es **REITER PERUVIAN BERRY SA** (RUC `20610390341`), la empresa dueña de este
sistema.

Cambios solo en `app/api/excel/ingresos/route.ts` (no se tocó el modelo `Proveedor` ni el formulario
de Ingresos — "Productor" y "RUC" son un dato fijo de la empresa, no algo que varíe por ingreso, así
que no tiene sentido un selector para esto):

- Columna `Proveedor / Fundo` → renombrada a **`Fundo`** (mismo dato: `ingreso.proveedor.razonSocial`).
- Columna `Doc. proveedor` (RUC/DNI del fundo) → **eliminada**.
- Dos columnas nuevas, con valor constante en cada fila: **`Productor`** (`"REITER PERUVIAN BERRY
  SA"`) y **`RUC`** (`"20610390341"`), definidas como constantes al inicio del archivo
  (`PRODUCTOR`, `RUC_PRODUCTOR`) — mismo patrón de nombre de empresa hardcodeado que ya existía en
  `lib/pdf/tarja-pdf.ts` y `lib/pdf/documento-base.ts` (sección 18).
- Verificado con Playwright + `xlsx`: se descargó el Excel real contra la base de datos actual y se
  confirmó que las columnas `Productor`/`RUC`/`Fundo` existen con los valores esperados en todas las
  filas, y que las columnas viejas (`Proveedor / Fundo`, `Doc. proveedor`) ya no aparecen.

El mismo cambio de etiqueta se propagó a las pantallas reales de Acopio (el usuario señaló que en el
formulario de "Nuevo ingreso" seguía diciendo "Proveedor / Fundo"): `ingreso-fruta-form.tsx` (label
del selector), listado de Ingresos, Tarjas, Guías de remisión y el detalle de un Ingreso — todos
pasan a decir simplemente **"Fundo"**. **No** se tocó `/logistica/proveedores` (el CRUD real de
`Proveedor`, que sí incluye proveedores de insumos además de fundos — `tipo: INSUMOS | FUNDO |
AMBOS` — así que "Proveedor" sigue siendo el término correcto ahí) ni el endpoint de ejemplo
`app/api/pdf/test/route.ts` (datos de PDF genéricos sin relación con el modelo real). Verificado con
Playwright navegando a las tres pantallas reales y confirmando ausencia del texto viejo.
