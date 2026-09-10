import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente de Supabase para usar en Server Components, Server Actions y
// Route Handlers. Lee/escribe la sesión desde las cookies de Next.js.
// `cookies()` es asíncrono desde Next.js 15.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Se puede ignorar si se invoca desde un Server Component:
            // la sesión se refresca en el middleware.
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            cookieStore.set(name, "", options);
          } catch {
            // Idem set().
          }
        },
      },
    }
  );
}
