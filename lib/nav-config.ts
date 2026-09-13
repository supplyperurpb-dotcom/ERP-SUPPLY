import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Home,
  LayoutGrid,
  Layers,
  Package,
  PackageSearch,
  Receipt,
  Ruler,
  ShieldCheck,
  ShoppingCart,
  Snowflake,
  Tag,
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
      { titulo: "Inicio", href: "/acopio", icono: LayoutGrid },
      { titulo: "Ingreso de Materia Prima", href: "/acopio/ingresos", icono: Boxes },
      { titulo: "Tarjas", href: "/acopio/tarjas", icono: Receipt },
      { titulo: "Despacho", href: "/acopio/despacho", icono: Truck },
      { titulo: "Guías de remisión", href: "/acopio/guias-remision", icono: FileText },
      { titulo: "Ingreso IQF", href: "/acopio/ingreso-iqf", icono: Snowflake },
      { titulo: "Tarjas IQF", href: "/acopio/tarjas-iqf", icono: Tag },
      { titulo: "Despacho IQF", href: "/acopio/despacho-iqf", icono: Truck },
      { titulo: "Catálogo de taras", href: "/acopio/catalogo-taras", icono: Ruler },
      { titulo: "Reporte", href: "/acopio/reporte", icono: BarChart3 },
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
