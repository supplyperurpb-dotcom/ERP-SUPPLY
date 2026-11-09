import Link from "next/link";
import { FileSpreadsheet, Package, Snowflake, Thermometer } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsuarioActual } from "@/lib/auth/session";
import { gruposVisiblesParaUsuario } from "@/lib/auth/acceso-modulos";
import { MODULOS } from "@/lib/auth/constants";

const TILES = [
  {
    titulo: "Packing list",
    descripcion: "Listas de empaque de los embarques de exportación.",
    href: "/comex/packing-list",
    icono: FileSpreadsheet,
  },
  {
    titulo: "Stock de cámara",
    descripcion: "Existencias disponibles en cámara de frío.",
    href: "/comex/stock-camara",
    icono: Thermometer,
  },
  {
    titulo: "Formatos de exportación",
    descripcion: "Catálogo de formatos y presentaciones para exportación.",
    href: "/comex/formatos-exportacion",
    icono: Package,
  },
];

export default async function ComexInicioPage() {
  const usuario = await getUsuarioActual();
  const grupo = gruposVisiblesParaUsuario(usuario?.roles ?? [], usuario?.accesoHrefs ?? null).find(
    (g) => g.modulo === MODULOS.COMEX
  );
  const hrefsVisibles = new Set(grupo?.items.map((i) => i.href) ?? []);
  const tiles = TILES.filter((tile) => hrefsVisibles.has(tile.href));

  return (
    <div>
      <PageHeader titulo="Comex" descripcion="Elige un submódulo para continuar." />
      {tiles.length === 0 ? (
        <EmptyState
          icono={Snowflake}
          titulo="Sin submódulos disponibles"
          descripcion="No tienes acceso a ningún submódulo de Comex."
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
