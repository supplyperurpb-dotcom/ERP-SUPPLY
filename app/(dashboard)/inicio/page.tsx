import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { getUsuarioActual } from "@/lib/auth/session";
import { tienePermiso, type Modulo } from "@/lib/auth/constants";
import { NAV_GRUPOS } from "@/lib/nav-config";

export default async function InicioPage() {
  const usuario = await getUsuarioActual();
  const roles = usuario?.roles ?? [];
  const gruposVisibles = NAV_GRUPOS.filter((grupo) => tienePermiso(roles, grupo.modulo as Modulo));

  return (
    <div>
      <PageHeader
        titulo={`Hola, ${usuario?.nombres ?? ""}`}
        descripcion="Selecciona un módulo para comenzar a trabajar."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {gruposVisibles.map((grupo) => {
          const Icono = grupo.icono;
          return (
            <Link key={grupo.modulo} href={grupo.items[0]?.href ?? "#"}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <Icono className="mb-2 h-6 w-6 text-primary" />
                  <CardTitle className="text-base">{grupo.titulo}</CardTitle>
                  <CardDescription>{grupo.items.length} submódulos</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
