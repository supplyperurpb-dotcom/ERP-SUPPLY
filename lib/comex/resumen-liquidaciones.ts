import { prisma } from "@/lib/db/prisma";

export type FilaResumenLiquidacion = {
  shipNumber: string;
  po: string | null;
  variedad: string;
  descripcionSku: string | null;
  lpn: string | null;
  palletNumber: string;
  cajasDespachadas: number;
  cajasBuenas: number;
  cajasRechazadasConfirmadas: number;
  cajasTerminalMarket: number;
  cajasNonFresh: number;
  cajasDonation: number;
  cajasSinClasificar: number;
  pctRechazo: number;
};

// Reporte consolidado por PO/Ship Number/Variedad/SKU/LPN/Pallet (punto 9
// del pedido). Grano = cada fila de EmbarquePallet (mismo grano que
// Importar PL): "cajas despachadas" es lo que ya traía el Packing List,
// "cajas rechazadas" solo cuenta líneas con estado CONFIRMADO (una línea
// sin confirmar no descuenta nada hasta que alguien la confirme en el
// detalle de Registro de Rechazos) — y, dentro de las confirmadas, nunca
// las que terminaron con disposición "Pass": esa disposición es fruta
// buena (no es, en los hechos, un rechazo), así que esas cajas vuelven a
// "cajasBuenas" en vez de restar. "Sin clasificar" es el residual de
// líneas confirmadas a las que aún no se les fijó una disposición final
// (mutuamente excluyente por construcción: total confirmado (sin Pass)
// menos Terminal Market menos Non-Fresh menos Donation).
//
// "PO" no es un dato del Packing List (no viene en ese Excel) — sale del
// correo de rechazo asociado, si lo hay; un pallet sin ningún rechazo
// registrado no tiene PO que mostrar.
export async function calcularResumenLiquidaciones({ desde, hasta }: { desde?: Date; hasta?: Date } = {}): Promise<FilaResumenLiquidacion[]> {
  const pallets = await prisma.embarquePallet.findMany({
    where:
      desde || hasta
        ? {
            embarque: {
              importadoEn: {
                ...(desde ? { gte: desde } : {}),
                ...(hasta ? { lte: hasta } : {}),
              },
            },
          }
        : undefined,
    include: {
      embarque: { select: { shipNumber: true } },
      rechazoItems: { select: { cajasRechazadas: true, categoriaFinal: true, estado: true, rechazoCorreo: { select: { poNumber: true } } } },
    },
    orderBy: { palletNumber: "asc" },
  });

  return pallets
    .filter((p) => p.embarque.shipNumber)
    .map((p) => {
      const confirmados = p.rechazoItems.filter((r) => r.estado === "CONFIRMADO" && r.categoriaFinal !== "PASS");
      const cajasRechazadasConfirmadas = confirmados.reduce((acc, r) => acc + r.cajasRechazadas, 0);
      const cajasTerminalMarket = confirmados.filter((r) => r.categoriaFinal === "TERMINAL_MARKET").reduce((acc, r) => acc + r.cajasRechazadas, 0);
      const cajasNonFresh = confirmados.filter((r) => r.categoriaFinal === "NON_FRESH").reduce((acc, r) => acc + r.cajasRechazadas, 0);
      const cajasDonation = confirmados.filter((r) => r.categoriaFinal === "DONATION").reduce((acc, r) => acc + r.cajasRechazadas, 0);
      const cajasSinClasificar = cajasRechazadasConfirmadas - cajasTerminalMarket - cajasNonFresh - cajasDonation;
      const cajasBuenas = p.cases - cajasRechazadasConfirmadas;
      const po = p.rechazoItems.find((r) => r.rechazoCorreo.poNumber)?.rechazoCorreo.poNumber ?? null;

      return {
        shipNumber: p.embarque.shipNumber as string,
        po,
        variedad: p.variedad,
        descripcionSku: p.descripcionSku,
        lpn: p.lpnDriscolls,
        palletNumber: p.palletNumber,
        cajasDespachadas: p.cases,
        cajasBuenas,
        cajasRechazadasConfirmadas,
        cajasTerminalMarket,
        cajasNonFresh,
        cajasDonation,
        cajasSinClasificar,
        pctRechazo: p.cases > 0 ? (cajasRechazadasConfirmadas / p.cases) * 100 : 0,
      };
    });
}
