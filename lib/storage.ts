import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "documentos";

// Sube un archivo al bucket privado de Storage. SOLO debe llamarse desde
// Server Actions o Route Handlers (usa la service role key, ver
// lib/auth/supabase-admin.ts). Devuelve la ruta dentro del bucket (no una
// URL pública: el bucket no es público, ver obtenerUrlFirmadaArchivo).
export async function subirArchivo(ruta: string, archivo: File): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, {
    contentType: archivo.type || "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);
  return ruta;
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
