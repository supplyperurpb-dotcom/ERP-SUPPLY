import Link from "next/link";
import {
  ClipboardList,
  List,
  Package,
  PackageSearch,
  Repeat,
  ShoppingCart,
  Users,
  Warehouse,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    titulo: "SKU",
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
    titulo: "Solicitudes de traslado",
    descripcion: "Solicitudes internas para mover stock entre almacenes, punto de partida de los traslados.",
    href: "/logistica/solicitudes-traslado",
    icono: Repeat,
  },
  {
    titulo: "Listas",
    descripcion: "Catálogos editables usados en las Solpeds, como el centro de costo y el campo/fundo.",
    href: "/logistica/listas",
    icono: List,
  },
];

export default function LogisticaInicioPage() {
  return (
    <div>
      <PageHeader titulo="Logística / Compras" descripcion="Elige un submódulo para continuar." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => (
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
    </div>
  );
}
