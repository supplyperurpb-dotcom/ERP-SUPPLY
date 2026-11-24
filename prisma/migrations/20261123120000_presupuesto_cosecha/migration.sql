-- CreateTable: presupuesto semanal (KG BUDGET / KG OCT) por variedad, carga
-- manual desde /acopio/presupuesto, alimenta el Reporte de Acopio > General.
CREATE TABLE "presupuesto_cosecha_semana" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "semana" INTEGER NOT NULL,
    "variedad" TEXT NOT NULL,
    "kgBudget" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "kgOct" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presupuesto_cosecha_semana_pkey" PRIMARY KEY ("id")
);

-- CreateTable: hectáreas por variedad, también carga manual.
CREATE TABLE "presupuesto_cosecha_variedad" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "variedad" TEXT NOT NULL,
    "hectareas" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presupuesto_cosecha_variedad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presupuesto_cosecha_semana_anio_semana_variedad_key" ON "presupuesto_cosecha_semana"("anio", "semana", "variedad");

-- CreateIndex
CREATE UNIQUE INDEX "presupuesto_cosecha_variedad_anio_variedad_key" ON "presupuesto_cosecha_variedad"("anio", "variedad");
