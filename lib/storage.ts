import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "documentos";

// Supabase Storage rechaza ("Invalid key") rutas con tildes/ñ u otros
// caracteres fuera de un set seguro — varios llamadores de subirArchivo
// construyen la ruta a partir de archivo.name (nombre real que sube el
// usuario, con acentos/espacios), así que se sanitiza acá una sola vez
// para todos, en vez de en cada callsite. Los "/" del path no se tocan.
function sanitizarRuta(ruta: string): string {
  return ruta
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9/._-]/g, "_");
}

// Sube un archivo al bucket privado de Storage. SOLO debe llamarse desde
// Server Actions o Route Handlers (usa la service role key, ver
// lib/auth/supabase-admin.ts). Devuelve la ruta dentro del bucket (no una
// URL pública: el bucket no es público, ver obtenerUrlFirmadaArchivo).
export async function subirArchivo(ruta: string, archivo: File): Promise<string> {
  const rutaSegura = sanitizarRuta(ruta);
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(rutaSegura, archivo, {
    contentType: archivo.type || "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);
  return rutaSegura;
}

// URL firmada de corta duración para descargar/ver un archivo privado. Se
// genera en cada pedido (nunca se guarda la URL en la base de datos) porque
// expira — ver GET /api/almacenes/ingresos/[id]/guia.
export async function obtenerUrlFirmadaArchivo(ruta: string, expiraEnSegundos = 60): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, expiraEnSegundos);
  if (error || !data) throw new Error(`No se pudo generar el enlace de descarga: ${error?.message ?? "desconocido"}`);
  return data.signedUrl;
}

// Descarga el contenido de un archivo privado directamente (sin pasar por
// una URL firmada) — usado al generar un PDF que necesita incrustar la
// imagen (p. ej. la firma de un consumo), no solo enlazarla.
export async function descargarArchivo(ruta: string): Promise<Uint8Array> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(ruta);
  if (error || !data) throw new Error(`No se pudo descargar el archivo: ${error?.message ?? "desconocido"}`);
  return new Uint8Array(await data.arrayBuffer());
}
