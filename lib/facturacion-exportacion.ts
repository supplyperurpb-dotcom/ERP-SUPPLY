// Capa de datos pura para el Dashboard Exportaciones: toma las filas ya
// traídas de la base (ver facturacion_exportacion en prisma/schema.prisma,
// sincronizada por scripts/importar-facturacion-exportacion.ts) y las
// filtra/agrupa. No sabe nada de React ni de cómo se dibuja — los
// componentes visuales (KPIs, gráficos, tablas) solo reciben el resultado
// ya calculado por estas funciones. Así, cuando se vuelve a correr el
// script de importación con un Excel actualizado, las cifras cambian solas
// sin tocar un solo componente.

export type FilaFacturacion = {
  dispatchDate: Date;
  dispWeek: number;
  customer: string;
  market: string;
  destinationCountry: string;
  format: string;
  invoicedAmount: number;
  cifLiquidatedTariffs: number;
  netWeight: number;
  netKilosLiquidated: number;
};

export type FiltrosFacturacion = {
  /** "YYYY-MM-DD", inclusive. */
  fechaDesde?: string;
  /** "YYYY-MM-DD", inclusive. */
  fechaHasta?: string;
  customer?: string;
  market?: string;
  destinationCountry?: string;
};

function fechaISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function filtrarFacturacion(filas: FilaFacturacion[], filtros: FiltrosFacturacion): FilaFacturacion[] {
  return filas.filter((f) => {
    const fecha = fechaISO(f.dispatchDate);
    if (filtros.fechaDesde && fecha < filtros.fechaDesde) return false;
    if (filtros.fechaHasta && fecha > filtros.fechaHasta) return false;
    if (filtros.customer && f.customer !== filtros.customer) return false;
    if (filtros.market && f.market !== filtros.market) return false;
    if (filtros.destinationCountry && f.destinationCountry !== filtros.destinationCountry) return false;
    return true;
  });
}

export type KpisFacturacion = {
  invoicedAmount: number;
  cifLiquidatedTariffs: number;
  netWeight: number;
  netKilosLiquidated: number;
};

export function calcularKpis(filas: FilaFacturacion[]): KpisFacturacion {
  return filas.reduce(
    (acc, f) => ({
      invoicedAmount: acc.invoicedAmount + f.invoicedAmount,
      cifLiquidatedTariffs: acc.cifLiquidatedTariffs + f.cifLiquidatedTariffs,
      netWeight: acc.netWeight + f.netWeight,
      netKilosLiquidated: acc.netKilosLiquidated + f.netKilosLiquidated,
    }),
    { invoicedAmount: 0, cifLiquidatedTariffs: 0, netWeight: 0, netKilosLiquidated: 0 }
  );
}

export type CampoDimension = "customer" | "market" | "destinationCountry" | "format";

export type FilaDimension = {
  etiqueta: string;
  netWeight: number;
  invoicedAmount: number;
};

// Agrupa kg facturado/embarcado por una dimensión (cliente, mercado,
// destino o formato), de mayor a menor kg — para las tablas/barras de
// "kg exportados por X".
export function agruparPorDimension(filas: FilaFacturacion[], campo: CampoDimension): FilaDimension[] {
  const mapa = new Map<string, FilaDimension>();
  for (const f of filas) {
    const etiqueta = f[campo];
    const actual = mapa.get(etiqueta) ?? { etiqueta, netWeight: 0, invoicedAmount: 0 };
    actual.netWeight += f.netWeight;
    actual.invoicedAmount += f.invoicedAmount;
    mapa.set(etiqueta, actual);
  }
  return [...mapa.values()].sort((a, b) => b.netWeight - a.netWeight);
}

export type PuntoEvolucion = {
  periodo: string;
  /** Para ordenar cronológicamente — "periodo" es solo la etiqueta a mostrar. */
  orden: string;
  netWeight: number;
  invoicedAmount: number;
};

// Evolución semanal: agrupa por DISP. WEEK (la misma semana que usa el
// filtro principal del dashboard).
export function calcularEvolucionSemanal(filas: FilaFacturacion[]): PuntoEvolucion[] {
  const mapa = new Map<number, { netWeight: number; invoicedAmount: number }>();
  for (const f of filas) {
    const actual = mapa.get(f.dispWeek) ?? { netWeight: 0, invoicedAmount: 0 };
    actual.netWeight += f.netWeight;
    actual.invoicedAmount += f.invoicedAmount;
    mapa.set(f.dispWeek, actual);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a - b)
    .map(([semana, totales]) => ({ periodo: `Sem ${semana}`, orden: String(semana).padStart(3, "0"), ...totales }));
}

// Evolución mensual: agrupa por año-mes de DISPATCH DATE.
export function calcularEvolucionMensual(filas: FilaFacturacion[]): PuntoEvolucion[] {
  const NOMBRES_MES = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const mapa = new Map<string, { netWeight: number; invoicedAmount: number }>();
  for (const f of filas) {
    const clave = fechaISO(f.dispatchDate).slice(0, 7); // "YYYY-MM"
    const actual = mapa.get(clave) ?? { netWeight: 0, invoicedAmount: 0 };
    actual.netWeight += f.netWeight;
    actual.invoicedAmount += f.invoicedAmount;
    mapa.set(clave, actual);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clave, totales]) => {
      const [anio, mes] = clave.split("-");
      return { periodo: `${NOMBRES_MES[Number(mes) - 1]} ${anio}`, orden: clave, ...totales };
    });
}

export type Participacion = {
  etiqueta: string;
  netWeight: number;
  participacionPct: number;
};

// Participación de cada destino sobre el total de kg embarcados del
// conjunto filtrado (para el gráfico de torta/dona).
export function calcularParticipacionPorDestino(filas: FilaFacturacion[]): Participacion[] {
  const porDestino = agruparPorDimension(filas, "destinationCountry");
  const totalKg = porDestino.reduce((acc, d) => acc + d.netWeight, 0);
  if (totalKg === 0) return [];
  return porDestino.map((d) => ({
    etiqueta: d.etiqueta,
    netWeight: d.netWeight,
    participacionPct: (d.netWeight / totalKg) * 100,
  }));
}

export type OpcionesFiltro = {
  customers: string[];
  markets: string[];
  destinations: string[];
  fechaMin: string | null;
  fechaMax: string | null;
};

// Valores distintos presentes en los datos, para poblar los selects de
// filtro — nunca una lista fija aparte, siempre lo que realmente hay.
export function obtenerOpcionesFiltro(filas: FilaFacturacion[]): OpcionesFiltro {
  const fechas = filas.map((f) => fechaISO(f.dispatchDate)).sort();
  return {
    customers: [...new Set(filas.map((f) => f.customer))].sort(),
    markets: [...new Set(filas.map((f) => f.market))].sort(),
    destinations: [...new Set(filas.map((f) => f.destinationCountry))].sort(),
    fechaMin: fechas[0] ?? null,
    fechaMax: fechas[fechas.length - 1] ?? null,
  };
}
