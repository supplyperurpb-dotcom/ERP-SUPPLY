-- AlterTable
ALTER TABLE "tarjas" ADD COLUMN     "despachoId" TEXT;

-- CreateTable
CREATE TABLE "despachos" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "placaCamion" TEXT NOT NULL,
    "conductor" TEXT NOT NULL,
    "fechaDespacho" TIMESTAMP(3) NOT NULL,
    "horaDespacho" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "despachos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "despachos_numero_key" ON "despachos"("numero");

-- AddForeignKey
ALTER TABLE "tarjas" ADD CONSTRAINT "tarjas_despachoId_fkey" FOREIGN KEY ("despachoId") REFERENCES "despachos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
