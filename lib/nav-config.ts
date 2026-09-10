import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Home,
  Layers,
  Package,
  PackageSearch,
  Receipt,
  Ruler,
  ShieldCheck,
  ShoppingCart,
  Snowflake,
  Thermometer,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { MODULOS, type Modulo } from "@/lib/auth/constants";

export type NavItem = {
  titulo: string;
  href: string;
  icono: LucideIcon;
};

export type NavGrupo = {
  modulo: Modulo;
  titulo: string;
  icono: LucideIcon;
  items: NavItem[];
};

export const NAV_GRUPOS: NavGrupo[] = [
  {
    modulo: MODULOS.LOGISTICA,
    titulo: "Logística / Compras",
    icono: Truck,
    items: [
      { titulo: "Solicitudes de pedido", href: "/logistica/solicitudes-pedido", icono: ClipboardList },
      { titulo: "Órdenes de compra", href: "/logistica/ordenes-compra", icono: ShoppingCart },
      { titulo: "Proveedores", href: "/logistica/proveedores", icono: Users },
      { titulo: "SKU", href: "/logistica/sku", icono: Package },
      { titulo: "Inventario", href: "/logistica/inventario", icono: PackageSearch },
      { titulo: "Almacenes", href: "/logistica/almacenes", icono: Warehouse },
    ],
  },
  {
    modulo: MODULOS.ACOPIO,
    titulo: "Acopio",
    icono: Layers,
    items: [
      { titulo: "Ingresos de fruta", href: "/acopio/ingresos", icono: Boxes },
      { titulo: "Tarjas", href: "/acopio/tarjas", icono: Receipt },
      { titulo: "Guías de remisión", href: "/acopio/guias-remision", icono: FileText },
      { titulo: "Catálogo de taras", href: "/acopio/catalogo-taras", icono: Ruler },
    ],
  },
  {
    modulo: MODULOS.USUARIOS,
    titulo: "Usuarios",
    icono: ShieldCheck,
    items: [
      { titulo: "Roles", href: "/usuarios/roles", icono: Users },
      { titulo: "Pendientes de aprobación", href: "/usuarios/aprobaciones", icono: ShieldCheck },
    ],
  },
  {
    modulo: MODULOS.COMEX,
    titulo: "Comex",
    icono: Snowflake,
    items: [
      { titulo: "Packing list", href: "/comex/packing-list", icono: FileSpreadsheet },
      { titulo: "Stock de cámara", href: "/comex/stock-camara", icono: Thermometer },
      { titulo: "Formatos de exportación", href: "/comex/formatos-exportacion", icono: Package },
    ],
  },
];

export const NAV_INICIO: NavItem = { titulo: "Inicio", href: "/inicio", icono: Home };
