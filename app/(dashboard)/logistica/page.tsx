import Link from "next/link";
import {
  ClipboardList,
  List,
  Package,
  PackageMinus,
  PackageSearch,
  ShoppingCart,
  Users,
  Warehouse,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsuarioActual } from "@/lib/auth/session";
import { gruposVisiblesParaUsuario } from "@/lib/auth/acceso-modulos";
import { MODULOS } from "@/lib/auth/constants";

const TILES = [
  {
    titulo: "Solicitudes de pedido",
    descripcion: "Solicitudes internas de compra, punto de partida hacia las órdenes de compra.",
    href: "/logistica/solicitudes-pedido",
    icono: ClipboardList,
  },
  {
    titulo: "Órdenes de compra",
    descripcion: "Órdenes de compra y servicio emitidas a proveedores.",
    href: "/logistica/ordenes-compra",
    icono: ShoppingCart,
  },
  {
    titulo: "Proveedores",
    descripcion: "Catálogo de proveedores de insumos, agroquímicos y servicios.",
    href: "/logistica/proveedores",
    icono: Users,
  },
  {
    titulo: "Creación de Materiales",
    descripcion: "Catálogo de códigos de producto e insumo.",
    href: "/logistica/sku",
    icono: Package,
  },
  {
    titulo: "Inventario",
    descripcion: "Stock disponible en todos los almacenes.",
    href: "/logistica/inventario",
    icono: PackageSearch,
  },
  {
    titulo: "Almacenes",
    descripcion: "Catálogo de almacenes generales y sub-almacenes.",
    href: "/logistica/almacenes",
    icono: Warehouse,
  },
  {
    titulo: "Solicitudes de despacho",
    descripcion: "Pide que Almacén te despache stock disponible de un producto.",
    href: "/logistica/solicitudes-despacho",
    icono: PackageMinus,
  },
  {
    titulo: "Listas",
    descripcion: "Catálogos editables usados en las Solpeds, como el centro de costo y el campo/fundo.",
    href: "/logistica/listas",
    icono: List,
  },
];

export default async function LogisticaInicioPage() {
  const usuario = await getUsuarioActual();
  const grupo = gruposVisiblesParaUsuario(usuario?.roles ?? [], usuario?.accesoHrefs ?? null).find(
    (g) => g.modulo === MODULOS.LOGISTICA
  );
  const hrefsVisibles = new Set(grupo?.items.map((i) => i.href) ?? []);
  const tiles = TILES.filter((tile) => hrefsVisibles.has(tile.href));

  return (
    <div>
      <PageHeader titulo="Logística / Compras" descripcion="Elige un submódulo para continuar." />
      {tiles.length === 0 ? (
        <EmptyState
          icono={Warehouse}
          titulo="Sin submódulos disponibles"
          descripcion="No tienes acceso a ningún submódulo de Logística / Compras."
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
