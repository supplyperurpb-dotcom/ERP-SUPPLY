import { Ruler } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db/prisma";
import { serializar } from "@/lib/utils";
import { TipoBandejaFormDialog } from "./tipo-bandeja-form-dialog";
import { TipoBandejaTable } from "./tipo-bandeja-table";
import { TipoPalletFormDialog } from "./tipo-pallet-form-dialog";
import { TipoPalletTable } from "./tipo-pallet-table";

export default async function CatalogoTarasPage() {
  const [tiposBandeja, tiposPallet] = serializar(
    await Promise.all([
      prisma.tipoBandeja.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.tipoPallet.findMany({ orderBy: { createdAt: "desc" } }),
    ])
  );

  return (
    <div>
      <PageHeader
        titulo="Catálogo de taras"
        descripcion="Pesos tara estándar de bandejas y pallets, usados para calcular el peso neto (peso bruto - tara) en Acopio."
      />

      <div className="space-y-8">
        <section>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h2 className="text-lg font-semibold tracking-tight">Tipos de bandeja</h2>
            <TipoBandejaFormDialog />
          </div>
          {tiposBandeja.length === 0 ? (
            <EmptyState
              icono={Ruler}
              titulo="Aún no hay tipos de bandeja registrados"
              descripcion="Crea el primer tipo de bandeja con su peso tara estándar."
            />
          ) : (
            <TipoBandejaTable tiposBandeja={tiposBandeja} />
          )}
        </section>

        <section>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h2 className="text-lg font-semibold tracking-tight">Tipos de pallet</h2>
            <TipoPalletFormDialog />
          </div>
          {tiposPallet.length === 0 ? (
            <EmptyState
              icono={Ruler}
              titulo="Aún no hay tipos de pallet registrados"
              descripcion="Crea el primer tipo de pallet con su peso tara estándar."
            />
          ) : (
            <TipoPalletTable tiposPallet={tiposPallet} />
          )}
        </section>
      </div>
    </div>
  );
}
