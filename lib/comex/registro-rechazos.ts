// Parsea el texto YA EXTRAÍDO POR OCR (tesseract.js, corrido en el
// navegador — ver registro-rechazos/nuevo/registro-rechazo-form.tsx) de una
// captura de correo de rechazo. Puro: no toca Prisma ni Supabase, ni sabe
// nada del cruce con Packing List (eso vive en el server action, que sí
// tiene acceso a la base).
//
// Diseñado contra una captura REAL (correo "Rechazo DOTA - RAC
// (DEPE026-1865)"), no contra una estructura genérica adivinada. Un
// hallazgo importante al correr el OCR real: las líneas con fondo
// resaltado de color ("Item:...", "Disposition Option: ...") no siempre
// las reconoce Tesseract (se pierden en el texto extraído), mientras que
// "Ranch:"/"Variety:"/"LPN:" (sin resaltado) sí se leen bien siempre. Por
// eso el parser usa esos 3 campos como ancla principal (son los que de
// verdad importan para el cruce por LPN) y busca "Item:"/"Disposition
// Option" como dato OPCIONAL más cercano, no como estructura obligatoria
// — si el proveedor no resalta esas líneas (u otro formato de correo sí
// las deja leer), igual se capturan.

export type LpnExtraido = {
  ranch: string | null;
  variedad: string | null;
  lpn: string;
  cajasRechazadas: number;
  itemCode: string | null;
  descripcionSku: string | null;
  // Texto de "Disposition Option" tal cual vino del correo — solo se usa
  // para derivar el mejor intento de categoriaFinal (ver
  // categoriaDesdeDisposicion); no se persiste aparte, ya queda el OCR
  // completo en RechazoCorreo.textoExtraido para auditoría.
  disposicionTexto: string | null;
};

export type ResultadoParseRechazo = {
  shipNumber: string | null;
  asuntoCorreo: string | null;
  remitente: string | null;
  fechaCorreo: Date | null;
  totalPalletsCorreo: number | null;
  totalCajasRechazadasCorreo: number | null;
  items: LpnExtraido[];
  advertencias: string[];
};

function limpiarEspacios(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

// "DEPE026-1865" vs "DEPE026- 2201" (el mismo embarque puede traer o no un
// espacio según de dónde salga el número) — se compara siempre sin
// espacios.
export function normalizarShipNumber(valor: string): string {
  return valor.replace(/\s+/g, "").toUpperCase();
}

export function parsearTextoRechazoEmail(textoOcr: string): ResultadoParseRechazo {
  const texto = textoOcr.replace(/\r\n/g, "\n");
  const lineas = texto.split("\n").map((l) => l.trim());
  const advertencias: string[] = [];

  // --- Asunto / Ship Number: primera línea con "(...)" al final, o si no
  // aparece ahí, "embarque <code>" en el cuerpo.
  let shipNumber: string | null = null;
  let asuntoCorreo: string | null = null;
  const lineaAsunto = lineas.find((l) => /\([A-Za-z0-9-]{5,}\)\s*$/.test(l));
  if (lineaAsunto) {
    asuntoCorreo = lineaAsunto;
    const m = lineaAsunto.match(/\(([A-Za-z0-9-]{5,})\)\s*$/);
    if (m) shipNumber = m[1];
  }
  if (!shipNumber) {
    const mCuerpo = texto.match(/embarque\s+([A-Za-z0-9-]{5,})/i);
    if (mCuerpo) shipNumber = mCuerpo[1];
  }
  if (!shipNumber) advertencias.push("No se pudo identificar el Ship Number del correo — complétalo a mano.");

  // --- Remitente: nombre antes de "<...@...>". El OCR suele ensuciar esta
  // línea (iconos de la barra de herramientas del correo se mezclan con el
  // texto) — si no se reconoce, queda null a propósito, no se inventa.
  let remitente: string | null = null;
  const lineaRemitente = lineas.find((l) => /<[^<>]*@[^<>]*>?/.test(l));
  if (lineaRemitente) {
    const m = lineaRemitente.match(/([A-Za-zÀ-ÿ.'\s]{3,}?)\s*<[^<>]*@/);
    if (m) remitente = limpiarEspacios(m[1]);
  }

  // --- Fecha: DD/MM/AAAA [HH:MM] en la misma línea.
  let fechaCorreo: Date | null = null;
  const mFecha = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (mFecha) {
    const [, dia, mes, anio, hora, minuto] = mFecha;
    fechaCorreo = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia), Number(hora ?? 0), Number(minuto ?? 0)));
  }

  // --- Rejection Summary: N pallets ( M cases)
  let totalPalletsCorreo: number | null = null;
  let totalCajasRechazadasCorreo: number | null = null;
  const mResumen = texto.match(/Rejection\s+Summary\s*:?\s*(\d+)\s*pallets?\s*\(\s*(\d+)\s*cases?\s*\)/i);
  if (mResumen) {
    totalPalletsCorreo = Number(mResumen[1]);
    totalCajasRechazadasCorreo = Number(mResumen[2]);
  } else {
    advertencias.push('No se encontró la línea "Rejection Summary" — no se puede comparar el total contra la suma de líneas.');
  }

  // --- Posiciones de "Item:" y "Disposition Option" en el texto completo,
  // para asociarlos (si existen) al grupo Ranch/Variety/LPN más cercano —
  // opcional, no bloquea nada si el OCR no los reconoció.
  const itemsEncontrados: { pos: number; codigo: string; descripcion: string }[] = [];
  for (const m of texto.matchAll(/Item\s*:?\s*(\d+)\s*\(([^)]+)\)/gi)) {
    itemsEncontrados.push({ pos: m.index ?? 0, codigo: m[1], descripcion: limpiarEspacios(m[2]) });
  }
  const disposicionesEncontradas: { pos: number; texto: string }[] = [];
  for (const m of texto.matchAll(/Disposition\s+Option\s*:?\s*([A-Za-zÀ-ÿ /-]{3,}?)(?:\.|,|\n|$)/gi)) {
    disposicionesEncontradas.push({ pos: m.index ?? 0, texto: limpiarEspacios(m[1]) });
  }

  // --- Grupos Ranch/Variety/LPN: el dato que de verdad se usa para el
  // cruce — se lee bien incluso cuando el OCR pierde "Item:"/"Disposition".
  const items: LpnExtraido[] = [];
  const regexGrupo = /Ranch\s*:?\s*(\d+)\s*\n\s*Variety\s*:?\s*([A-Za-zÀ-ÿ]+)\s*\n\s*LPN\s*:?\s*(\d+)\s*\(\s*(\d+)\s*cases?\s*\)/gi;
  for (const m of texto.matchAll(regexGrupo)) {
    const pos = m.index ?? 0;
    const itemCercano = [...itemsEncontrados].reverse().find((it) => it.pos < pos);
    const disposicionCercana = disposicionesEncontradas.find((d) => d.pos > pos);
    items.push({
      ranch: m[1],
      variedad: limpiarEspacios(m[2]),
      lpn: m[3],
      cajasRechazadas: Number(m[4]),
      itemCode: itemCercano?.codigo ?? null,
      descripcionSku: itemCercano?.descripcion ?? null,
      disposicionTexto: disposicionCercana?.texto ?? null,
    });
  }

  if (items.length === 0) {
    advertencias.push("No se pudo identificar ningún grupo Ranch/Variety/LPN en el texto — revisa la imagen o completa a mano.");
  }
  if (totalCajasRechazadasCorreo !== null) {
    const suma = items.reduce((acc, i) => acc + i.cajasRechazadas, 0);
    if (suma !== totalCajasRechazadasCorreo) {
      advertencias.push(`La suma de cajas de las líneas (${suma}) no coincide con el total del correo (${totalCajasRechazadasCorreo}).`);
    }
  }

  return { shipNumber, asuntoCorreo, remitente, fechaCorreo, totalPalletsCorreo, totalCajasRechazadasCorreo, items, advertencias };
}

// Disposiciones reales que trae el correo: "Terminal Market", "Non-Fresh" y
// "Donation" para fruta rechazada, "Pass" para fruta buena. Es solo el
// mejor intento a partir del texto del correo — queda como punto de
// partida de la (única) disposición final, que se puede cambiar a mano en
// cualquier momento; si no se reconoce ninguna, se deja sin definir (null)
// en vez de inventar una categoría.
export function categoriaDesdeDisposicion(disposicion: string | null): "TERMINAL_MARKET" | "NON_FRESH" | "DONATION" | "PASS" | null {
  if (!disposicion) return null;
  const normalizado = disposicion.toLowerCase();
  if (normalizado.includes("terminal market")) return "TERMINAL_MARKET";
  if (normalizado.includes("non-fresh") || normalizado.includes("non fresh") || normalizado.includes("nonfresh")) return "NON_FRESH";
  if (normalizado.includes("donation")) return "DONATION";
  if (normalizado.includes("pass")) return "PASS";
  return null;
}
