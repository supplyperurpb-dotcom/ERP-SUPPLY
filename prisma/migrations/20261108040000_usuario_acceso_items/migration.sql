-- CreateTable
CREATE TABLE "usuario_acceso_items" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_acceso_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_acceso_items_usuarioId_href_key" ON "usuario_acceso_items"("usuarioId", "href");

-- AddForeignKey
ALTER TABLE "usuario_acceso_items" ADD CONSTRAINT "usuario_acceso_items_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

