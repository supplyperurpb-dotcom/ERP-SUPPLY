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

## 11. Entorno de desarrollo usado para este scaffold

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
