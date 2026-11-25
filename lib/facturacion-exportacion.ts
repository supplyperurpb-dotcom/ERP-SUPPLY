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
  originPort: string;
  destinationCountry: string;
  format: string;
  po: string;
  transportMode: string;
  weekEta: number | null;
  weekAta: number | null;
  statusEmbarque: string;
  /** Estatus de liquidación (columna "STATUS" del Excel, no confundir con statusEmbarque) — LIQUIDADO / PENDIENTE / vacío. */
  settlementStatus: string;
  variety: string;
  type: string;
  label: string;
  /** "Destino" — TERMINAL MARKET / NON FRESH / null. Ver categoriaLiquidacion. */
  destino: string | null;
  totalFob: number;
  invoicedAmount: number;
  cifLiquidatedTariffs: number;
  netWeight: number;
  netKilosLiquidated: number;
};

export type FiltrosFacturacion = {
  /** "YYYY-MM-DD", inclusive. Solo lo usa el comparativo entre periodos, ya no la barra principal. */
  fechaDesde?: string;
  /** "YYYY-MM-DD", inclusive. Solo lo usa el comparativo entre periodos, ya no la barra principal. */
  fechaHasta?: string;
  /** Vacío o ausente = todas. */
  weeks?: number[];
  /** Vacío o ausente = todos. */
  markets?: string[];
  /** Vacío o ausente = todos. */
  destinationCountries?: string[];
  /** Vacío o ausente = todos. Valores reales de transportMode (AEREO/MARITIMO). */
  transportModes?: string[];
};

function fechaISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Pedido explícito: ningún cálculo de liquidación debe contar una fila que
// no esté LIQUIDADO en el Excel (columna "STATUS"), aunque traiga valores
// en Net Kilos Liquidated / CIF Liquidated (Tariffs) — se tratan como si
// esa fila todavía no tuviera nada liquidado. Lo facturado (netWeight,
// invoicedAmount) no se filtra por esto, solo lo liquidado.
function kgLiquidadoValido(f: FilaFacturacion): number {
  return f.settlementStatus === "LIQUIDADO" ? f.netKilosLiquidated : 0;
}
function valorLiquidadoValido(f: FilaFacturacion): number {
  return f.settlementStatus === "LIQUIDADO" ? f.cifLiquidatedTariffs : 0;
}

// Pedido explícito (2026-11-17): para el PU CIF ponderado de "Kg
// exportados por variedad, según tipo" y "Mezcla de etiquetas Premium por
// variedad" — cada fila aporta su valorizado liquidado si ya está
// LIQUIDADO, o su valorizado facturado si todavía está pendiente. El
// precio ponderado sale de sumar esos valorizados y dividir entre el
// total de kg facturado (netWeight), nunca mezclando ambos kg.
function valorPonderado(f: FilaFacturacion): number {
  return f.settlementStatus === "LIQUIDADO" ? f.cifLiquidatedTariffs : f.invoicedAmount;
}

// Pedido explícito (2026-11-17): el Kg Liquidado de "Evolución semanal de
// precios" se reclasifica en 4 categorías mutuamente excluyentes — si la
// columna "Destino" marca TERMINAL MARKET o NON FRESH, ese kg cuenta ahí y
// deja de sumar en Premium/Convencional, sin importar lo que diga TYPE.
export type CategoriaLiquidacion = "PREMIUM" | "CONVENCIONAL" | "TERMINAL_MARKET" | "NON_FRESH";

function categoriaLiquidacion(f: FilaFacturacion): CategoriaLiquidacion {
  if (f.destino === "TERMINAL MARKET") return "TERMINAL_MARKET";
  if (f.destino === "NON FRESH") return "NON_FRESH";
  return f.type === "PREMIUM" ? "PREMIUM" : "CONVENCIONAL";
}

export function filtrarFacturacion(filas: FilaFacturacion[], filtros: FiltrosFacturacion): FilaFacturacion[] {
  return filas.filter((f) => {
    const fecha = fechaISO(f.dispatchDate);
    if (filtros.fechaDesde && fecha < filtros.fechaDesde) return false;
    if (filtros.fechaHasta && fecha > filtros.fechaHasta) return false;
    if (filtros.weeks && filtros.weeks.length > 0 && !filtros.weeks.includes(f.dispWeek)) return false;
    if (filtros.markets && filtros.markets.length > 0 && !filtros.markets.includes(f.market)) return false;
    if (
      filtros.destinationCountries &&
      filtros.destinationCountries.length > 0 &&
      !filtros.destinationCountries.includes(f.destinationCountry)
    )
      return false;
    if (filtros.transportModes && filtros.transportModes.length > 0 && !filtros.transportModes.includes(f.transportMode))
      return false;
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
      cifLiquidatedTariffs: acc.cifLiquidatedTariffs + valorLiquidadoValido(f),
      netWeight: acc.netWeight + f.netWeight,
      netKilosLiquidated: acc.netKilosLiquidated + kgLiquidadoValido(f),
    }),
    { invoicedAmount: 0, cifLiquidatedTariffs: 0, netWeight: 0, netKilosLiquidated: 0 }
  );
}

export type CampoDimension = "customer" | "market" | "originPort" | "destinationCountry" | "format" | "type";

export type FilaDimension = {
  etiqueta: string;
  netWeight: number;
  invoicedAmount: number;
  /** N° de embarques (PO) distintos de esta etiqueta. */
  embarques: number;
};

// Agrupa kg facturado/embarcado por una dimensión (cliente, mercado,
// destino o formato), de mayor a menor kg — para las tablas/barras de
// "kg exportados por X". También cuenta embarques (PO) distintos, para
// mostrar en el tooltip de esas barras.
export function agruparPorDimension(filas: FilaFacturacion[], campo: CampoDimension): FilaDimension[] {
  const mapa = new Map<string, { etiqueta: string; netWeight: number; invoicedAmount: number; pos: Set<string> }>();
  for (const f of filas) {
    const etiqueta = f[campo];
    const actual = mapa.get(etiqueta) ?? { etiqueta, netWeight: 0, invoicedAmount: 0, pos: new Set<string>() };
    actual.netWeight += f.netWeight;
    actual.invoicedAmount += f.invoicedAmount;
    actual.pos.add(f.po);
    mapa.set(etiqueta, actual);
  }
  return [...mapa.values()]
    .map((d) => ({ etiqueta: d.etiqueta, netWeight: d.netWeight, invoicedAmount: d.invoicedAmount, embarques: d.pos.size }))
    .sort((a, b) => b.netWeight - a.netWeight);
}

export type PuntoEvolucionPrecio = {
  semana: number;
  /** null = sin kg facturado esa semana (no se inventa un precio en 0). */
  puFacturado: number | null;
  kgFacturado: number;
  /** null = sin kg liquidado esa semana. */
  puLiquidado: number | null;
  kgLiquidado: number;
  // Desglose del Kg Liquidado en 4 categorías mutuamente excluyentes (ver
  // categoriaLiquidacion) — para la barra apilada y el detalle del
  // tooltip de "Evolución semanal de precios". kgTerminalMarket y
  // kgNonFresh comparten color en la barra pero se calculan y muestran
  // por separado.
  kgPremium: number;
  kgConvencional: number;
  kgTerminalMarket: number;
  kgNonFresh: number;
  puLiquidadoPremium: number | null;
  puLiquidadoConvencional: number | null;
  puLiquidadoTerminalMarket: number | null;
  puLiquidadoNonFresh: number | null;
};

// Evolución semanal del precio unitario CIF: PU facturado (invoicedAmount
// / netWeight) y PU liquidado (cifLiquidatedTariffs / netKilosLiquidated)
// de cada semana de despacho (misma semana que usa el filtro principal),
// con sus kg para mostrar en el tooltip, más el desglose por categoría de
// liquidación (ver categoriaLiquidacion).
export function calcularEvolucionPrecioSemanal(filas: FilaFacturacion[]): PuntoEvolucionPrecio[] {
  type Acumulado = {
    invoicedAmount: number;
    netWeight: number;
    cifLiquidatedTariffs: number;
    netKilosLiquidated: number;
    porCategoria: Record<CategoriaLiquidacion, { kg: number; valor: number }>;
  };
  const nuevoAcumulado = (): Acumulado => ({
    invoicedAmount: 0,
    netWeight: 0,
    cifLiquidatedTariffs: 0,
    netKilosLiquidated: 0,
    porCategoria: {
      PREMIUM: { kg: 0, valor: 0 },
      CONVENCIONAL: { kg: 0, valor: 0 },
      TERMINAL_MARKET: { kg: 0, valor: 0 },
      NON_FRESH: { kg: 0, valor: 0 },
    },
  });

  const mapa = new Map<number, Acumulado>();
  for (const f of filas) {
    const actual = mapa.get(f.dispWeek) ?? nuevoAcumulado();
    const kg = kgLiquidadoValido(f);
    const valor = valorLiquidadoValido(f);
    actual.invoicedAmount += f.invoicedAmount;
    actual.netWeight += f.netWeight;
    actual.cifLiquidatedTariffs += valor;
    actual.netKilosLiquidated += kg;
    const categoria = actual.porCategoria[categoriaLiquidacion(f)];
    categoria.kg += kg;
    categoria.valor += valor;
    mapa.set(f.dispWeek, actual);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a - b)
    .map(([semana, t]) => {
      const premium = t.porCategoria.PREMIUM;
      const convencional = t.porCategoria.CONVENCIONAL;
      const terminalMarket = t.porCategoria.TERMINAL_MARKET;
      const nonFresh = t.porCategoria.NON_FRESH;
      return {
        semana,
        puFacturado: t.netWeight > 0 ? t.invoicedAmount / t.netWeight : null,
        kgFacturado: t.netWeight,
        puLiquidado: t.netKilosLiquidated > 0 ? t.cifLiquidatedTariffs / t.netKilosLiquidated : null,
        kgLiquidado: t.netKilosLiquidated,
        kgPremium: premium.kg,
        kgConvencional: convencional.kg,
        kgTerminalMarket: terminalMarket.kg,
        kgNonFresh: nonFresh.kg,
        puLiquidadoPremium: premium.kg > 0 ? premium.valor / premium.kg : null,
        puLiquidadoConvencional: convencional.kg > 0 ? convencional.valor / convencional.kg : null,
        puLiquidadoTerminalMarket: terminalMarket.kg > 0 ? terminalMarket.valor / terminalMarket.kg : null,
        puLiquidadoNonFresh: nonFresh.kg > 0 ? nonFresh.valor / nonFresh.kg : null,
      };
    });
}

export type FilaImpactoLiquidacion = {
  semana: number;
  puFacturado: number;
  puLiquidado: number;
  kgLiquidado: number;
  /** puLiquidado - puFacturado. Negativo = se liquidó más barato de lo facturado (pérdida). */
  diferenciaPorKg: number;
  /** diferenciaPorKg * kgLiquidado. Negativo = pérdida, positivo = ganancia. */
  impactoUsd: number;
};

export type ResumenImpactoLiquidacion = {
  porSemana: FilaImpactoLiquidacion[];
  /** Suma de todos los impactos negativos, en positivo. */
  totalPerdida: number;
  /** Suma de todos los impactos positivos. */
  totalGanancia: number;
  /** totalGanancia - totalPerdida. */
  neto: number;
};

// Cuánto cambió el precio real liquidado respecto al precio facturado de
// esa misma semana, valorizado sobre los kg ya liquidados — reusa
// calcularEvolucionPrecioSemanal (mismo PU facturado/liquidado que ya
// muestra ese gráfico) y solo lo convierte a un impacto en USD por
// semana. Semanas sin liquidación todavía no entran en el resumen.
export function calcularImpactoLiquidacion(filas: FilaFacturacion[]): ResumenImpactoLiquidacion {
  const porSemana: FilaImpactoLiquidacion[] = [];
  let totalPerdida = 0;
  let totalGanancia = 0;
  for (const p of calcularEvolucionPrecioSemanal(filas)) {
    if (p.puFacturado === null || p.puLiquidado === null || p.kgLiquidado <= 0) continue;
    const diferenciaPorKg = p.puLiquidado - p.puFacturado;
    const impactoUsd = diferenciaPorKg * p.kgLiquidado;
    if (impactoUsd < 0) totalPerdida += -impactoUsd;
    else totalGanancia += impactoUsd;
    porSemana.push({
      semana: p.semana,
      puFacturado: p.puFacturado,
      puLiquidado: p.puLiquidado,
      kgLiquidado: p.kgLiquidado,
      diferenciaPorKg,
      impactoUsd,
    });
  }
  return { porSemana, totalPerdida, totalGanancia, neto: totalGanancia - totalPerdida };
}

export type Participacion = {
  etiqueta: string;
  netWeight: number;
  participacionPct: number;
  /** invoicedAmount/netWeight (o liquidado equivalente) de esta etiqueta. null = sin kg, no se inventa un precio. */
  puCif: number | null;
};

// Participación de cada destino sobre el total de kg embarcados del
// conjunto filtrado (para el gráfico de torta/dona).
export function calcularParticipacion(filas: FilaFacturacion[], campo: CampoDimension): Participacion[] {
  const agrupado = agruparPorDimension(filas, campo);
  const totalKg = agrupado.reduce((acc, d) => acc + d.netWeight, 0);
  if (totalKg === 0) return [];
  return agrupado.map((d) => ({
    etiqueta: d.etiqueta,
    netWeight: d.netWeight,
    participacionPct: (d.netWeight / totalKg) * 100,
    puCif: d.netWeight > 0 ? d.invoicedAmount / d.netWeight : null,
  }));
}

// Misma idea que calcularParticipacion, pero sobre KG LIQUIDADOS
// (netKilosLiquidated) en vez de kg facturado — para comparar, p. ej.,
// Premium vs. Convencional tanto en lo facturado como en lo ya liquidado.
// Igual que el resto de cálculos de liquidación: solo cuentan las filas
// con estatus LIQUIDADO (kgLiquidadoValido/valorLiquidadoValido).
export function calcularParticipacionLiquidado(filas: FilaFacturacion[], campo: CampoDimension): Participacion[] {
  const mapa = new Map<string, { kg: number; valor: number }>();
  for (const f of filas) {
    const etiqueta = f[campo];
    const actual = mapa.get(etiqueta) ?? { kg: 0, valor: 0 };
    actual.kg += kgLiquidadoValido(f);
    actual.valor += valorLiquidadoValido(f);
    mapa.set(etiqueta, actual);
  }
  const totalKg = [...mapa.values()].reduce((acc, t) => acc + t.kg, 0);
  if (totalKg === 0) return [];
  return [...mapa.entries()]
    .map(([etiqueta, t]) => ({
      etiqueta,
      netWeight: t.kg,
      participacionPct: (t.kg / totalKg) * 100,
      puCif: t.kg > 0 ? t.valor / t.kg : null,
    }))
    .sort((a, b) => b.netWeight - a.netWeight);
}

// Misma idea que calcularParticipacion, pero la participación (%) se
// calcula sobre invoicedAmount (valorizado facturado) en vez de netWeight
// — pedido explícito, para comparar Premium vs. Convencional por su peso
// en valor, no en kg. netWeight/puCif se siguen mostrando igual, solo
// cambia la base del %.
export function calcularParticipacionPorValor(filas: FilaFacturacion[], campo: CampoDimension): Participacion[] {
  const agrupado = agruparPorDimension(filas, campo);
  const totalValor = agrupado.reduce((acc, d) => acc + d.invoicedAmount, 0);
  if (totalValor === 0) return [];
  return agrupado.map((d) => ({
    etiqueta: d.etiqueta,
    netWeight: d.netWeight,
    participacionPct: (d.invoicedAmount / totalValor) * 100,
    puCif: d.netWeight > 0 ? d.invoicedAmount / d.netWeight : null,
  }));
}

// Misma idea que calcularParticipacionLiquidado, pero la participación
// (%) se calcula sobre el valor liquidado en vez de los kg liquidados.
export function calcularParticipacionLiquidadoPorValor(filas: FilaFacturacion[], campo: CampoDimension): Participacion[] {
  const mapa = new Map<string, { kg: number; valor: number }>();
  for (const f of filas) {
    const etiqueta = f[campo];
    const actual = mapa.get(etiqueta) ?? { kg: 0, valor: 0 };
    actual.kg += kgLiquidadoValido(f);
    actual.valor += valorLiquidadoValido(f);
    mapa.set(etiqueta, actual);
  }
  const totalValor = [...mapa.values()].reduce((acc, t) => acc + t.valor, 0);
  if (totalValor === 0) return [];
  return [...mapa.entries()]
    .map(([etiqueta, t]) => ({
      etiqueta,
      netWeight: t.kg,
      participacionPct: (t.valor / totalValor) * 100,
      puCif: t.kg > 0 ? t.valor / t.kg : null,
    }))
    .sort((a, b) => b.netWeight - a.netWeight);
}

export type OpcionesFiltro = {
  weeks: number[];
  markets: string[];
  destinations: string[];
  transportModes: string[];
  fechaMin: string | null;
  fechaMax: string | null;
};

// Valores distintos presentes en los datos, para poblar los selects de
// filtro — nunca una lista fija aparte, siempre lo que realmente hay.
export function obtenerOpcionesFiltro(filas: FilaFacturacion[]): OpcionesFiltro {
  const fechas = filas.map((f) => fechaISO(f.dispatchDate)).sort();
  return {
    weeks: [...new Set(filas.map((f) => f.dispWeek))].sort((a, b) => a - b),
    markets: [...new Set(filas.map((f) => f.market))].sort(),
    destinations: [...new Set(filas.map((f) => f.destinationCountry))].sort(),
    transportModes: [...new Set(filas.map((f) => f.transportMode))].sort(),
    fechaMin: fechas[0] ?? null,
    fechaMax: fechas[fechas.length - 1] ?? null,
  };
}

// A partir de acá: funciones que replican, como gráficos, las tablas
// dinámicas de la hoja "Reporte Expo" del Excel (que ya se arma a mano
// sobre esta misma data) — cada una agrupa por una categoría (mercado,
// semana, etc.) y la segmenta en 2+ series apiladas. "series" sale de los
// valores que de verdad aparecen en los datos, nunca de una lista fija.

export type PuntoApilado = { categoria: string; [serie: string]: string | number };

// Un solo punto por semana, combinando la semana real: ATA para lo ya
// ARRIBADO, ETA (estimado) para lo que sigue EN TRANSITO, mostrado como
// proyección — construido directo sobre las filas de la tabla (no sobre
// una tabla dinámica del Excel). Cada serie lleva su kg (para la barra) y
// su n° de contenedores (PO distintas) acompañando en "<estado>__n", que
// StackedBarChart agrega al tooltip si lo encuentra. También lleva el
// valorizado facturado total de la semana (invoicedAmount, sin separar por
// estado) para que el tooltip lo muestre aparte.
export function calcularEmbarquesCombinadoPorSemana(filas: FilaFacturacion[]): {
  puntos: PuntoApilado[];
  series: string[];
} {
  const porSemana = new Map<number, Map<string, { kg: number; pos: Set<string> }>>();
  const facturadoPorSemana = new Map<number, number>();
  const estados = new Set<string>();
  for (const f of filas) {
    const semana = f.statusEmbarque === "ARRIBADO" ? f.weekAta : f.weekEta;
    if (semana === null) continue;
    estados.add(f.statusEmbarque);
    const porEstado = porSemana.get(semana) ?? new Map<string, { kg: number; pos: Set<string> }>();
    const actual = porEstado.get(f.statusEmbarque) ?? { kg: 0, pos: new Set<string>() };
    actual.kg += f.netWeight;
    actual.pos.add(f.po);
    porEstado.set(f.statusEmbarque, actual);
    porSemana.set(semana, porEstado);
    facturadoPorSemana.set(semana, (facturadoPorSemana.get(semana) ?? 0) + f.invoicedAmount);
  }
  const series = [...estados].sort();
  const puntos = [...porSemana.entries()]
    .sort(([a], [b]) => a - b)
    .map(([semana, porEstado]) => {
      const punto: PuntoApilado = { categoria: String(semana), invoicedAmount: facturadoPorSemana.get(semana) ?? 0 };
      for (const estado of series) {
        const t = porEstado.get(estado);
        punto[estado] = t?.kg ?? 0;
        punto[`${estado}__n`] = t?.pos.size ?? 0;
      }
      return punto;
    });
  return { puntos, series };
}

export type ResumenEstadoContenedores = { estado: string; n: number; netWeight: number; invoicedAmount: number };

// Resumen rápido: cuántos embarques (PO) hay en cada estado (ARRIBADO /
// EN TRANSITO), con su kg y valor facturado — para las tarjetas de
// resumen, no para los gráficos semanales.
export function calcularResumenPorEstado(filas: FilaFacturacion[]): ResumenEstadoContenedores[] {
  const porEstado = new Map<string, { pos: Set<string>; netWeight: number; invoicedAmount: number }>();
  for (const f of filas) {
    const actual = porEstado.get(f.statusEmbarque) ?? { pos: new Set<string>(), netWeight: 0, invoicedAmount: 0 };
    actual.pos.add(f.po);
    actual.netWeight += f.netWeight;
    actual.invoicedAmount += f.invoicedAmount;
    porEstado.set(f.statusEmbarque, actual);
  }
  return [...porEstado.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([estado, t]) => ({ estado, n: t.pos.size, netWeight: t.netWeight, invoicedAmount: t.invoicedAmount }));
}

// "4_VOLUMEN FACTURADO" + "6_KG POR ETIQUETA": kg por semana de despacho,
// segmentados por tipo de producto (premium/convencional) o por etiqueta
// de empaque — misma función, cambia el campo de segmentación.
export function calcularKgPorSemanaYCampo(
  filas: FilaFacturacion[],
  campo: "type" | "label"
): { puntos: PuntoApilado[]; series: string[] } {
  const porSemana = new Map<number, Map<string, number>>();
  const valores = new Set<string>();
  for (const f of filas) {
    const valor = f[campo];
    valores.add(valor);
    const porValor = porSemana.get(f.dispWeek) ?? new Map<string, number>();
    porValor.set(valor, (porValor.get(valor) ?? 0) + f.netWeight);
    porSemana.set(f.dispWeek, porValor);
  }
  // Orden fijo (no alfabético) en ambos casos, pedido explícito: para
  // "type", Premium abajo / Convencional arriba; para "label", SB abajo,
  // luego JB, luego S&C, luego YL arriba.
  const ORDEN_LABEL = ["SB", "JB", "S&C", "YL"] as const;
  const series =
    campo === "type"
      ? (["PREMIUM", "CONVENCIONAL"] as const).filter((t) => valores.has(t))
      : [
          ...ORDEN_LABEL.filter((l) => valores.has(l)),
          // Cualquier etiqueta nueva que no esté en el orden fijo (no debería
          // pasar con los datos vistos) se agrega al final, en vez de
          // perderse silenciosamente.
          ...[...valores].filter((v) => !(ORDEN_LABEL as readonly string[]).includes(v)).sort(),
        ];
  const puntos = [...porSemana.entries()]
    .sort(([a], [b]) => a - b)
    .map(([semana, porValor]) => {
      const punto: PuntoApilado = { categoria: String(semana) };
      for (const v of series) punto[v] = porValor.get(v) ?? 0;
      return punto;
    });
  return { puntos, series };
}

// Proyección de cierre de campaña (pedido explícito, 2026-11-25): mientras
// no haya despacho real para estas semanas, se usa el estimado semanal de
// Premium (PL) / Convencional (YL) que maneja el equipo comercial, en Kg.
// Actualizar este mapa a mano cuando cambie el estimado; apenas el Excel
// traiga despacho real de una de estas semanas, aplicarProyeccionCierre deja
// de proyectarla (la fila real manda, nunca se mezcla con la proyección).
const PROYECCION_CIERRE_SEMANAL: { semana: number; PREMIUM: number; CONVENCIONAL: number }[] = [
  { semana: 48, PREMIUM: 14355, CONVENCIONAL: 20388 },
  { semana: 49, PREMIUM: 13926, CONVENCIONAL: 20352 },
  { semana: 50, PREMIUM: 13446, CONVENCIONAL: 21776 },
  { semana: 51, PREMIUM: 13220, CONVENCIONAL: 22940 },
  { semana: 52, PREMIUM: 9850, CONVENCIONAL: 32646 },
];

// Agrega al resultado de calcularKgPorSemanaYCampo(filas, "type") las
// semanas de PROYECCION_CIERRE_SEMANAL que todavía no tengan una fila real
// en `puntos`. Cada punto proyectado queda marcado con `proyectado: 1` para
// que el gráfico lo pinte más claro (ver StackedBarChart).
export function aplicarProyeccionCierre(puntos: PuntoApilado[], series: string[]): PuntoApilado[] {
  const semanasReales = new Set(puntos.map((p) => Number(p.categoria)));
  const proyectados = PROYECCION_CIERRE_SEMANAL.filter((p) => !semanasReales.has(p.semana)).map((p) => {
    const punto: PuntoApilado = { categoria: String(p.semana), proyectado: 1 };
    for (const s of series) punto[s] = s === "PREMIUM" ? p.PREMIUM : s === "CONVENCIONAL" ? p.CONVENCIONAL : 0;
    return punto;
  });
  return [...puntos, ...proyectados].sort((a, b) => Number(a.categoria) - Number(b.categoria));
}

export type CierreProyectado = { premiumPct: number; convencionalPct: number };

// % acumulado de Premium/Convencional con el que cerraría la campaña, sumando
// semanas reales + proyectadas — se calcula sobre el mismo arreglo que ya
// pinta el gráfico, para que el número de arriba siempre cuadre con las
// barras.
export function calcularCierreProyectado(puntos: PuntoApilado[]): CierreProyectado | null {
  let premium = 0;
  let convencional = 0;
  for (const p of puntos) {
    premium += Number(p.PREMIUM ?? 0);
    convencional += Number(p.CONVENCIONAL ?? 0);
  }
  const total = premium + convencional;
  if (total === 0) return null;
  return { premiumPct: (premium / total) * 100, convencionalPct: (convencional / total) * 100 };
}

export type PorLiquidarMercado = { mercado: string; kg: number; valor: number; puCif: number | null };
export type PorLiquidarResumen = { kg: number; valor: number; puCif: number | null; porMercado: PorLiquidarMercado[] };

// Pendiente por liquidar se define SOLO por kg (pedido explícito, 2026-11-25):
// netWeight - netKilosLiquidated (de las filas LIQUIDADO), total y por
// mercado — las liquidaciones llegan de a pocos, por eso kg liquidado
// nunca debería superar kg facturado. El valor de ese kg pendiente se
// obtiene valorizándolo al PU CIF FACTURADO (invoicedAmount/netWeight) de
// ESE MISMO mercado — NUNCA comparando contra "CIF Liquidated (Tariffs)":
// esa columna resultó ser un valor de tarifa/aduana, no equivalente al
// Invoiced Amount ni siquiera cuando un embarque está 100% liquidado en
// kg (confirmado con datos reales del mercado DOC: 22 líneas, todas
// LIQUIDADO con kg pendiente 0, y aun así Invoiced Amount siempre bastante
// mayor que CIF Liquidated Tariffs — comparar esas dos columnas
// directamente no mide dinero pendiente).
//
// El "general" (puCif/valor sin desglosar) es la suma ponderada de los
// mercados que SÍ aparecen abajo (nunca el PU CIF facturado de TODO el
// histórico): si se usara el PU CIF de todo el portafolio, mercados ya
// liquidados al 100% en kg (sin nada pendiente) igual pesarían en el
// denominador y el "general" terminaría pareciéndose al mercado más
// grande del histórico completo en vez de reflejar lo que realmente
// está pendiente — detectado porque DEMEA (más barato) apenas movía el
// general pese a ser ~2% del kg pendiente.
export function calcularPorLiquidar(filas: FilaFacturacion[]): PorLiquidarResumen {
  let kg = 0;
  const kgPorMercado = new Map<string, number>();
  for (const f of filas) {
    const kgPendiente = f.netWeight - kgLiquidadoValido(f);
    kg += kgPendiente;
    kgPorMercado.set(f.market, (kgPorMercado.get(f.market) ?? 0) + kgPendiente);
  }

  const facturadoPorMercado = new Map(agruparPorDimension(filas, "market").map((d) => [d.etiqueta, d]));

  const lista = [...kgPorMercado.entries()]
    .map(([mercado, kgPendiente]) => {
      const facturado = facturadoPorMercado.get(mercado);
      const puCif = facturado && facturado.netWeight > 0 ? facturado.invoicedAmount / facturado.netWeight : null;
      return { mercado, kg: kgPendiente, valor: puCif !== null ? kgPendiente * puCif : 0, puCif };
    })
    .filter((m) => Math.abs(m.kg) > 0.01)
    .sort((a, b) => b.kg - a.kg);

  const valor = lista.reduce((acc, m) => acc + m.valor, 0);
  return { kg, valor, puCif: kg > 0 ? valor / kg : null, porMercado: lista };
}

export type FilaVariedadMercadoSerie = {
  mercado: string;
  kg: number;
  /** % que representa este mercado sobre el total de kg de la variedad. */
  pct: number;
  /** PU CIF ponderado de esta combinación variedad+mercado (ver valorPonderado): liquidado para lo ya LIQUIDADO, facturado para lo pendiente, entre el total de kg facturado. */
  puCifFacturado: number;
  /** N° de embarques (PO) distintos. */
  embarques: number;
};
export type FilaVariedadMercado = { variedad: string; totalKg: number; porMercado: FilaVariedadMercadoSerie[] };

// Kg exportados por variedad, segmentado por mercado — % que representa
// cada mercado dentro del total de esa variedad, y el PU CIF ponderado
// (ver valorPonderado) de cada combinación variedad+mercado.
export function calcularExportacionesPorVariedadYMercado(filas: FilaFacturacion[]): FilaVariedadMercado[] {
  const porVariedad = new Map<string, Map<string, { kg: number; valor: number; pos: Set<string> }>>();
  for (const f of filas) {
    const porMercado = porVariedad.get(f.variety) ?? new Map<string, { kg: number; valor: number; pos: Set<string> }>();
    const actual = porMercado.get(f.market) ?? { kg: 0, valor: 0, pos: new Set<string>() };
    actual.kg += f.netWeight;
    actual.valor += valorPonderado(f);
    actual.pos.add(f.po);
    porMercado.set(f.market, actual);
    porVariedad.set(f.variety, porMercado);
  }
  return [...porVariedad.entries()]
    .map(([variedad, porMercado]) => {
      const totalKg = [...porMercado.values()].reduce((acc, t) => acc + t.kg, 0);
      const series = [...porMercado.entries()]
        .map(([mercado, t]) => ({
          mercado,
          kg: t.kg,
          pct: totalKg > 0 ? (t.kg / totalKg) * 100 : 0,
          puCifFacturado: t.kg > 0 ? t.valor / t.kg : 0,
          embarques: t.pos.size,
        }))
        .sort((a, b) => a.mercado.localeCompare(b.mercado));
      return { variedad, totalKg, porMercado: series };
    })
    .sort((a, b) => b.totalKg - a.totalKg);
}

export type FilaVariedadTipoSerie = {
  tipo: string;
  kg: number;
  /** % que representa este tipo sobre el total de kg de la variedad. */
  pct: number;
  /** PU CIF ponderado de esta combinación variedad+tipo (ver valorPonderado): liquidado para lo ya LIQUIDADO, facturado para lo pendiente, entre el total de kg facturado. */
  puCifFacturado: number;
};
export type FilaVariedadTipo = { variedad: string; totalKg: number; porTipo: FilaVariedadTipoSerie[] };

// Kg exportados por variedad, segmentado por tipo (PREMIUM/CONVENCIONAL) —
// % que representa cada tipo dentro del total de esa variedad, y el PU
// CIF ponderado (ver valorPonderado) de cada combinación.
export function calcularExportacionesPorVariedadYTipo(filas: FilaFacturacion[]): FilaVariedadTipo[] {
  const porVariedad = new Map<string, Map<string, { kg: number; valor: number }>>();
  for (const f of filas) {
    const porTipo = porVariedad.get(f.variety) ?? new Map<string, { kg: number; valor: number }>();
    const actual = porTipo.get(f.type) ?? { kg: 0, valor: 0 };
    actual.kg += f.netWeight;
    actual.valor += valorPonderado(f);
    porTipo.set(f.type, actual);
    porVariedad.set(f.variety, porTipo);
  }
  return [...porVariedad.entries()]
    .map(([variedad, porTipo]) => {
      const totalKg = [...porTipo.values()].reduce((acc, t) => acc + t.kg, 0);
      const series = [...porTipo.entries()].map(([tipo, t]) => ({
        tipo,
        kg: t.kg,
        pct: totalKg > 0 ? (t.kg / totalKg) * 100 : 0,
        puCifFacturado: t.kg > 0 ? t.valor / t.kg : 0,
      }));
      return { variedad, totalKg, porTipo: series };
    })
    .sort((a, b) => b.totalKg - a.totalKg);
}

export type FilaVariedadEtiquetaSerie = {
  etiqueta: string;
  kg: number;
  /** % que representa esta etiqueta sobre el total de kg PREMIUM de la variedad. */
  pct: number;
  /** PU CIF ponderado de esta combinación variedad+etiqueta (ver valorPonderado): liquidado para lo ya LIQUIDADO, facturado para lo pendiente, entre el total de kg facturado. */
  puCifFacturado: number;
};
export type FilaVariedadEtiqueta = { variedad: string; totalKg: number; porEtiqueta: FilaVariedadEtiquetaSerie[] };

// Mezcla de etiquetas (JB/SB/S&C) solo dentro de lo PREMIUM, por
// variedad — % que representa cada etiqueta sobre el total PREMIUM de
// esa variedad (no sobre el total general), y el PU CIF ponderado (ver
// valorPonderado) de cada combinación. YL no aparece acá porque en los
// datos solo se usa para CONVENCIONAL.
export function calcularExportacionesPorVariedadYEtiquetaPremium(filas: FilaFacturacion[]): FilaVariedadEtiqueta[] {
  const soloPremium = filas.filter((f) => f.type === "PREMIUM");
  const porVariedad = new Map<string, Map<string, { kg: number; valor: number }>>();
  for (const f of soloPremium) {
    const porEtiqueta = porVariedad.get(f.variety) ?? new Map<string, { kg: number; valor: number }>();
    const actual = porEtiqueta.get(f.label) ?? { kg: 0, valor: 0 };
    actual.kg += f.netWeight;
    actual.valor += valorPonderado(f);
    porEtiqueta.set(f.label, actual);
    porVariedad.set(f.variety, porEtiqueta);
  }
  return [...porVariedad.entries()]
    .map(([variedad, porEtiqueta]) => {
      const totalKg = [...porEtiqueta.values()].reduce((acc, t) => acc + t.kg, 0);
      const series = [...porEtiqueta.entries()].map(([etiqueta, t]) => ({
        etiqueta,
        kg: t.kg,
        pct: totalKg > 0 ? (t.kg / totalKg) * 100 : 0,
        puCifFacturado: t.kg > 0 ? t.valor / t.kg : 0,
      }));
      return { variedad, totalKg, porEtiqueta: series };
    })
    .sort((a, b) => b.totalKg - a.totalKg);
}
