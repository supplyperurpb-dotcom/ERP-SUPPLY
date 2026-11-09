import Link from "next/link";
import { Users, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsuarioActual } from "@/lib/auth/session";
import { gruposVisiblesParaUsuario } from "@/lib/auth/acceso-modulos";
import { MODULOS } from "@/lib/auth/constants";

const TILES = [
  {
    titulo: "Usuarios",
    descripcion: "Cuentas con acceso al sistema y su rol.",
    href: "/usuarios/lista",
    icono: Users,
  },
  {
    titulo: "Roles",
    descripcion: "Roles disponibles y qué módulos puede usar cada uno.",
    href: "/usuarios/roles",
    icono: ShieldCheck,
  },
  {
    titulo: "Pendientes de aprobación",
    descripcion: "Bandeja de documentos esperando una decisión de aprobación.",
    href: "/usuarios/aprobaciones",
    icono: ShieldCheck,
  },
];

export default async function UsuariosInicioPage() {
  const usuario = await getUsuarioActual();
  const grupo = gruposVisiblesParaUsuario(usuario?.roles ?? [], usuario?.accesoHrefs ?? null).find(
    (g) => g.modulo === MODULOS.USUARIOS
  );
  const hrefsVisibles = new Set(grupo?.items.map((i) => i.href) ?? []);
  const tiles = TILES.filter((tile) => hrefsVisibles.has(tile.href));

  return (
    <div>
      <PageHeader titulo="Usuarios" descripcion="Elige un submódulo para continuar." />
      {tiles.length === 0 ? (
        <EmptyState
          icono={ShieldCheck}
          titulo="Sin submódulos disponibles"
          descripcion="No tienes acceso a ningún submódulo de Usuarios."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => (
            <Link key={tile.href} href={tile.href}>
              <Card className="h-full transition-colors hover:border-primary hover:bg-accent/40">
                <CardHeader>
                  <tile.icono className="mb-2 h-6 w-6 text-primary" />
                  <CardTitle className="text-base">{tile.titulo}</CardTitle>
                  <CardDescription>{tile.descripcion}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
