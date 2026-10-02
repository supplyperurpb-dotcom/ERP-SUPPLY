import { createClient } from "@supabase/supabase-js";

// Cliente con la clave de servicio: permite crear/eliminar usuarios de
// Supabase Auth directamente (API de administración). SOLO debe importarse
// desde Server Actions o Route Handlers ("use server") — nunca desde
// código que pueda ejecutarse en el navegador, ya que la service role key
// se salta Row Level Security por completo.
export function createSupabaseAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
