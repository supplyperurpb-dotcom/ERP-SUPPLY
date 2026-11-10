import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RUTAS_PUBLICAS = ["/login"];

export async function middleware(request: NextRequest) {
  // Reenvía la ruta actual como header — es la forma de que un Server
  // Component (el layout del dashboard) sepa qué ruta se está pidiendo,
  // para el control de acceso real por módulo/submódulo (ver rutaPermitida
  // en lib/auth/acceso-modulos.ts).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.cookies.set(name, value, options);
        },
        remove(name: string, options: Record<string, unknown>) {
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.cookies.set(name, "", options);
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const esRutaPublica = RUTAS_PUBLICAS.some((ruta) => request.nextUrl.pathname.startsWith(ruta));

  if (!user && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/pdf|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
