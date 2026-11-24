-- CreateEnum
CREATE TYPE "EstadoRechazoCorreo" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "EstadoRechazoItem" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'ANULADO', 'DISPUTADO');

-- CreateEnum
CREATE TYPE "CategoriaRechazo" AS ENUM ('TERMINAL_MARKET', 'NON_FRESH', 'OTRO', 'PENDIENTE_CLASIFICAR');

-- CreateTable: una captura de correo de rechazo importada (OCR).
CREATE TABLE "rechazo_correos" (
    "id" TEXT NOT NULL,
    "embarqueId" TEXT,
    "poNumber" TEXT,
    "asuntoCorreo" TEXT,
    "remitente" TEXT,
    "fechaCorreo" TIMESTAMP(3),
    "archivoOriginalUrl" TEXT NOT NULL,
    "archivoOriginalNombre" TEXT NOT NULL,
    "archivoHash" TEXT NOT NULL,
    "textoExtraido" TEXT NOT NULL,
    "totalPalletsCorreo" INTEGER,
    "totalCajasRechazadasCorreo" INTEGER,
    "estado" "EstadoRechazoCorreo" NOT NULL DEFAULT 'PENDIENTE',
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rechazo_correos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rechazo_correos_archivoHash_key" ON "rechazo_correos"("archivoHash");

-- CreateTable: una línea de rechazo (un LPN) dentro de un correo.
CREATE TABLE "rechazo_items" (
    "id" TEXT NOT NULL,
    "rechazoCorreoId" TEXT NOT NULL,
    "embarquePalletId" TEXT,
    "lpn" TEXT NOT NULL,
    "itemCode" TEXT,
    "descripcionSku" TEXT,
    "variedad" TEXT,
    "cajasOriginales" INTEGER,
    "cajasRechazadas" INTEGER NOT NULL,
    "disposicionSugerida" TEXT,
    "categoriaSugerida" "CategoriaRechazo" NOT NULL DEFAULT 'PENDIENTE_CLASIFICAR',
    "categoriaFinal" "CategoriaRechazo",
    "motivoRechazo" TEXT,
    "estado" "EstadoRechazoItem" NOT NULL DEFAULT 'PENDIENTE',
    "alertaLpnNoEncontrado" BOOLEAN NOT NULL DEFAULT false,
    "alertaVariedadNoCoincide" BOOLEAN NOT NULL DEFAULT false,
    "alertaExcedeOriginales" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rechazo_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rechazo_items_lpn_idx" ON "rechazo_items"("lpn");

-- CreateIndex
CREATE INDEX "rechazo_items_embarquePalletId_idx" ON "rechazo_items"("embarquePalletId");

-- AddForeignKey
ALTER TABLE "rechazo_correos" ADD CONSTRAINT "rechazo_correos_embarqueId_fkey" FOREIGN KEY ("embarqueId") REFERENCES "embarques"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rechazo_items" ADD CONSTRAINT "rechazo_items_rechazoCorreoId_fkey" FOREIGN KEY ("rechazoCorreoId") REFERENCES "rechazo_correos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rechazo_items" ADD CONSTRAINT "rechazo_items_embarquePalletId_fkey" FOREIGN KEY ("embarquePalletId") REFERENCES "embarque_pallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
