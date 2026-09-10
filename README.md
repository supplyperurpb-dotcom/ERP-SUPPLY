# Sistema de Gestión — Arándanos Ica

Scaffold del sistema de gestión integral para una empresa productora y exportadora de arándanos
ubicada en Ica, Perú. Cubre 4 áreas: **Logística/Compras**, **Acopio**, **Usuarios/Aprobaciones**
y **Comex**.

> **Fase actual: scaffold.** Este repositorio contiene la estructura base (modelo de datos,
> autenticación, navegación, y CRUD de referencia para SKU, Proveedores y Catálogo de taras). La
> lógica de negocio compleja (flujos de aprobación reales, cálculos, integración SUNAT) se
> implementa en fases posteriores. Ver [docs/DECISIONES-TECNICAS.md](docs/DECISIONES-TECNICAS.md).

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Supabase**: Postgres + Auth + Storage
- **Prisma** como ORM sobre el Postgres de Supabase
- **Tailwind CSS** + componentes propios de estilo shadcn/ui
- **Zod** + **react-hook-form** para validación de formularios
- **pdf-lib** para generación de PDF (tarjas, guías, packing list)
- Despliegue en **Vercel**, CI en **GitHub Actions** (lint + typecheck + build)

## Requisitos previos

- Node.js 18.18+ (recomendado 20 LTS)
- Una cuenta y proyecto de [Supabase](https://supabase.com)
- npm (viene con Node)

> `npm install`, `npm run build`, `npm run lint` y `npm run typecheck` ya se corrieron sobre este
> scaffold y pasan limpios (ver [docs/DECISIONES-TECNICAS.md](docs/DECISIONES-TECNICAS.md) para el
> detalle, incluyendo la actualización de Next.js 14 → 15.5.25 por vulnerabilidades de seguridad).
> Falta conectar un proyecto de Supabase real y correr las migraciones — sigue los pasos de abajo.

## 1. Instalación

```bash
npm install
```

El script `postinstall` ejecuta automáticamente `prisma generate`.

## 2. Configura Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **Project Settings > API**, copia la URL del proyecto y las llaves `anon` y `service_role`.
3. En **Project Settings > Database > Connection string**, copia la cadena de conexión con
   *pooler* (para `DATABASE_URL`) y la conexión directa (para `DIRECT_URL`, usada solo por
   `prisma migrate`).
4. En **Storage**, crea un bucket (por defecto el proyecto espera uno llamado `documentos`) para
   guardar fotos de tarjas, PDFs de guías de remisión y packing lists.
5. Copia `.env.example` a `.env` y completa los valores:

```bash
cp .env.example .env
```

## 3. Variables de entorno

Ver [.env.example](.env.example) para la lista completa y comentada. Resumen:

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave pública (cliente) |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave de servicio, **solo servidor** |
| `DATABASE_URL` | Conexión Postgres vía pooler (runtime) |
| `DIRECT_URL` | Conexión Postgres directa (migraciones) |
| `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` | Bucket de Storage para documentos |
| `NEXT_PUBLIC_APP_URL` | URL pública de la app |

## 4. Base de datos

Aplica el schema de Prisma a tu proyecto de Supabase:

```bash
npm run prisma:migrate -- --name init
npm run prisma:seed
```

El seed crea los 6 roles base (`ADMIN`, `LOGISTICA_COMPRAS`, `ACOPIO`, `COMEX`, `APROBADOR`,
`SOLO_LECTURA`) y algunos catálogos de ejemplo (un tipo de bandeja, un tipo de pallet, un formato
de exportación).

## 5. Crea tu primer usuario

La autenticación la maneja Supabase Auth, pero el sistema también guarda cada usuario en la tabla
propia `usuarios` (para poder asignarle roles vía `asignaciones_rol`). En esta fase de scaffold no
existe una pantalla de registro/invitación, así que el primer usuario se crea manualmente:

1. En el panel de Supabase, **Authentication > Users > Add user**, crea el usuario con correo y
   contraseña.
2. Copia su `User UID`.
3. Con `npm run prisma:studio` (o SQL directo), crea una fila en `usuarios` con `supabaseAuthId`
   igual a ese UID, y una fila en `asignaciones_rol` que lo vincule al rol `ADMIN`.

Fases futuras deberán reemplazar este paso manual por un flujo de invitación de usuarios dentro
del propio módulo de Usuarios.

## 6. Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) — te redirige a `/login`.

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prisma:generate` | Regenera el cliente de Prisma |
| `npm run prisma:migrate` | Crea/aplica una migración |
| `npm run prisma:studio` | Explorador visual de la base de datos |
| `npm run prisma:seed` | Ejecuta el seed (roles y catálogos base) |

## Estructura del proyecto

```
/app
  /(auth)              -> login, recuperación de contraseña
  /(dashboard)
    /inicio
    /logistica          -> solicitudes-pedido, ordenes-compra, proveedores, sku, inventario, almacenes
    /acopio              -> ingresos, tarjas, guias-remision, catalogo-taras
    /usuarios             -> roles, aprobaciones
    /comex                -> packing-list, stock-camara, formatos-exportacion
  /api/pdf/test          -> route handler de prueba de generación de PDF
/components
  /ui                   -> primitivas de estilo shadcn/ui
  /shared                -> PageHeader, EmptyState, SidebarNav, Topbar
/lib
  /db                   -> cliente de Prisma
  /auth                  -> clientes Supabase (browser/server), sesión, roles/permisos
  /pdf                   -> generador de PDF base
  /validations            -> esquemas Zod por módulo
  /actions                -> Server Actions por módulo
/prisma
  schema.prisma
/docs
  DECISIONES-TECNICAS.md
```

## Despliegue en Vercel

1. Importa el repositorio de GitHub en [Vercel](https://vercel.com/new).
2. Configura las mismas variables de entorno de `.env.example` en **Project Settings >
   Environment Variables** (Production y Preview).
3. Vercel detecta Next.js automáticamente. El build ejecuta `prisma generate` vía `postinstall`.
4. Antes del primer deploy, corre las migraciones (`npm run prisma:migrate`) apuntando a la base
   de datos de producción/staging desde tu entorno local o desde un job de CI dedicado — este
   scaffold no ejecuta migraciones automáticamente en cada deploy.

## CI

`.github/workflows/ci.yml` corre en cada push/PR a `main`: instala dependencias, lint, typecheck y
build, usando variables de entorno de relleno (no se conecta a una base de datos real).
