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
  variety: string;
  type: string;
  label: string;
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
      cifLiquidatedTariffs: acc.cifLiquidatedTariffs + f.cifLiquidatedTariffs,
      netWeight: acc.netWeight + f.netWeight,
      netKilosLiquidated: acc.netKilosLiquidated + f.netKilosLiquidated,
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
};

// Evolución semanal del precio unitario CIF: PU facturado (invoicedAmount
// / netWeight) y PU liquidado (cifLiquidatedTariffs / netKilosLiquidated)
// de cada semana de despacho (misma semana que usa el filtro principal),
// con sus kg para mostrar en el tooltip.
export function calcularEvolucionPrecioSemanal(filas: FilaFacturacion[]): PuntoEvolucionPrecio[] {
  const mapa = new Map<
    number,
    { invoicedAmount: number; netWeight: number; cifLiquidatedTariffs: number; netKilosLiquidated: number }
  >();
  for (const f of filas) {
    const actual = mapa.get(f.dispWeek) ?? {
      invoicedAmount: 0,
      netWeight: 0,
      cifLiquidatedTariffs: 0,
      netKilosLiquidated: 0,
    };
    actual.invoicedAmount += f.invoicedAmount;
    actual.netWeight += f.netWeight;
    actual.cifLiquidatedTariffs += f.cifLiquidatedTariffs;
    actual.netKilosLiquidated += f.netKilosLiquidated;
    mapa.set(f.dispWeek, actual);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a - b)
    .map(([semana, t]) => ({
      semana,
      puFacturado: t.netWeight > 0 ? t.invoicedAmount / t.netWeight : null,
      kgFacturado: t.netWeight,
      puLiquidado: t.netKilosLiquidated > 0 ? t.cifLiquidatedTariffs / t.netKilosLiquidated : null,
      kgLiquidado: t.netKilosLiquidated,
    }));
}

export type Participacion = {
  etiqueta: string;
  netWeight: number;
  participacionPct: number;
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
  }));
}

// Misma idea que calcularParticipacion, pero sobre KG LIQUIDADOS
// (netKilosLiquidated) en vez de kg facturado — para comparar, p. ej.,
// Premium vs. Convencional tanto en lo facturado como en lo ya liquidado.
export function calcularParticipacionLiquidado(filas: FilaFacturacion[], campo: CampoDimension): Participacion[] {
  const mapa = new Map<string, number>();
  for (const f of filas) {
    const etiqueta = f[campo];
    mapa.set(etiqueta, (mapa.get(etiqueta) ?? 0) + f.netKilosLiquidated);
  }
  const totalKg = [...mapa.values()].reduce((acc, v) => acc + v, 0);
  if (totalKg === 0) return [];
  return [...mapa.entries()]
    .map(([etiqueta, kg]) => ({ etiqueta, netWeight: kg, participacionPct: (kg / totalKg) * 100 }))
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

export type FilaPrecioPorKg = { etiqueta: string; cifPorKg: number; netWeight: number };

// "2_PRECIO POR KG - CIF": $CIF/kg promedio ponderado (= CIF total / kg
// total del grupo, no el promedio simple de cada línea), por variedad o
// por tipo de producto.
export function calcularPrecioPorKg(filas: FilaFacturacion[], campo: "variety" | "type"): FilaPrecioPorKg[] {
  const mapa = new Map<string, { kg: number; cif: number }>();
  for (const f of filas) {
    const etiqueta = f[campo];
    const actual = mapa.get(etiqueta) ?? { kg: 0, cif: 0 };
    actual.kg += f.netWeight;
    actual.cif += f.invoicedAmount;
    mapa.set(etiqueta, actual);
  }
  return [...mapa.entries()]
    .map(([etiqueta, t]) => ({ etiqueta, cifPorKg: t.kg > 0 ? t.cif / t.kg : 0, netWeight: t.kg }))
    .sort((a, b) => b.netWeight - a.netWeight);
}

// "3_ESTATUS DE EMBARQUES POR CONTENEDOR": embarques (PO distintas) por
// semana ETA o ATA, segmentados por estado (ARRIBADO / EN TRANSITO). Las
// filas sin esa semana (todavía sin ETA/ATA) se excluyen, no se agrupan
// como "sin dato" inventado.
export function contarEmbarquesPorSemanaYEstado(
  filas: FilaFacturacion[],
  campoSemana: "weekEta" | "weekAta"
): { puntos: PuntoApilado[]; series: string[] } {
  const porSemana = new Map<number, Map<string, Set<string>>>();
  const estados = new Set<string>();
  for (const f of filas) {
    const semana = f[campoSemana];
    if (semana === null) continue;
    estados.add(f.statusEmbarque);
    const porEstado = porSemana.get(semana) ?? new Map<string, Set<string>>();
    const pos = porEstado.get(f.statusEmbarque) ?? new Set<string>();
    pos.add(f.po);
    porEstado.set(f.statusEmbarque, pos);
    porSemana.set(semana, porEstado);
  }
  const series = [...estados].sort();
  const puntos = [...porSemana.entries()]
    .sort(([a], [b]) => a - b)
    .map(([semana, porEstado]) => {
      const punto: PuntoApilado = { categoria: String(semana) };
      for (const estado of series) punto[estado] = porEstado.get(estado)?.size ?? 0;
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

// "3_ESTATUS DE EMBARQUES VALORIZADO": lo mismo que arriba pero en USD
// facturado en vez de conteo de embarques.
export function calcularValorizadoPorSemanaYEstado(
  filas: FilaFacturacion[],
  campoSemana: "weekEta" | "weekAta"
): { puntos: PuntoApilado[]; series: string[] } {
  const porSemana = new Map<number, Map<string, number>>();
  const estados = new Set<string>();
  for (const f of filas) {
    const semana = f[campoSemana];
    if (semana === null) continue;
    estados.add(f.statusEmbarque);
    const porEstado = porSemana.get(semana) ?? new Map<string, number>();
    porEstado.set(f.statusEmbarque, (porEstado.get(f.statusEmbarque) ?? 0) + f.invoicedAmount);
    porSemana.set(semana, porEstado);
  }
  const series = [...estados].sort();
  const puntos = [...porSemana.entries()]
    .sort(([a], [b]) => a - b)
    .map(([semana, porEstado]) => {
      const punto: PuntoApilado = { categoria: String(semana) };
      for (const estado of series) punto[estado] = porEstado.get(estado) ?? 0;
      return punto;
    });
  return { puntos, series };
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
  // Para "type": orden fijo Premium abajo / Convencional arriba en la
  // barra apilada (pedido explícito), no alfabético. Para "label" se
  // mantiene el orden alfabético, que no se pidió cambiar.
  const series =
    campo === "type"
      ? (["PREMIUM", "CONVENCIONAL"] as const).filter((t) => valores.has(t))
      : [...valores].sort();
  const puntos = [...porSemana.entries()]
    .sort(([a], [b]) => a - b)
    .map(([semana, porValor]) => {
      const punto: PuntoApilado = { categoria: String(semana) };
      for (const v of series) punto[v] = porValor.get(v) ?? 0;
      return punto;
    });
  return { puntos, series };
}

export type PorLiquidarMercado = { mercado: string; kg: number; valor: number };
export type PorLiquidarResumen = { kg: number; valor: number; porMercado: PorLiquidarMercado[] };

// Kg ya facturados que todavía no se liquidan (netWeight - netKilosLiquidated)
// y el valor facturado correspondiente a esa diferencia (invoicedAmount -
// cifLiquidatedTariffs), total y por mercado. Solo se listan los mercados
// con kg pendiente de liquidar (> 0) — nunca una lista fija de mercados.
export function calcularPorLiquidar(filas: FilaFacturacion[]): PorLiquidarResumen {
  let kg = 0;
  let valor = 0;
  const porMercado = new Map<string, { kg: number; valor: number }>();
  for (const f of filas) {
    const kgPendiente = f.netWeight - f.netKilosLiquidated;
    const valorPendiente = f.invoicedAmount - f.cifLiquidatedTariffs;
    kg += kgPendiente;
    valor += valorPendiente;
    const actual = porMercado.get(f.market) ?? { kg: 0, valor: 0 };
    actual.kg += kgPendiente;
    actual.valor += valorPendiente;
    porMercado.set(f.market, actual);
  }
  const lista = [...porMercado.entries()]
    .map(([mercado, t]) => ({ mercado, kg: t.kg, valor: t.valor }))
    .filter((m) => m.kg > 0.01)
    .sort((a, b) => b.kg - a.kg);
  return { kg, valor, porMercado: lista };
}
