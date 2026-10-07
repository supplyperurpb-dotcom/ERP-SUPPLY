-- CreateTable
CREATE TABLE "retiradores_autorizados" (
    "id" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "area" "AreaEmpresa" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retiradores_autorizados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retirador_almacen_permitidos" (
    "id" TEXT NOT NULL,
    "retiradorAutorizadoId" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,

    CONSTRAINT "retirador_almacen_permitidos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "retiradores_autorizados_dni_key" ON "retiradores_autorizados"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "retirador_almacen_permitidos_retiradorAutorizadoId_almacenI_key" ON "retirador_almacen_permitidos"("retiradorAutorizadoId", "almacenId");

-- AddForeignKey
ALTER TABLE "retirador_almacen_permitidos" ADD CONSTRAINT "retirador_almacen_permitidos_retiradorAutorizadoId_fkey" FOREIGN KEY ("retiradorAutorizadoId") REFERENCES "retiradores_autorizados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retirador_almacen_permitidos" ADD CONSTRAINT "retirador_almacen_permitidos_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
