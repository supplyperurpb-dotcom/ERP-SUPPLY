import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FileUp,
  GitCompare,
  Home,
  IdCard,
  LayoutGrid,
  Layers,
  List,
  Package,
  PackageMinus,
  PackageSearch,
  PackageX,
  Receipt,
  Ruler,
  Search,
  ShieldCheck,
  ShoppingCart,
  Snowflake,
  Tag,
  Thermometer,
  Truck,
  Upload,
  Users,
  Warehouse,
  Wrench,
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
      { titulo: "Inicio", href: "/logistica", icono: LayoutGrid },
      { titulo: "Solicitudes de pedido", href: "/logistica/solicitudes-pedido", icono: ClipboardList },
      { titulo: "Órdenes de compra", href: "/logistica/ordenes-compra", icono: ShoppingCart },
      { titulo: "Gestión de Servicios", href: "/logistica/gestion-servicios", icono: Wrench },
      { titulo: "Proveedores", href: "/logistica/proveedores", icono: Users },
      { titulo: "Creación de Materiales", href: "/logistica/sku", icono: Package },
      { titulo: "Inventario", href: "/logistica/inventario", icono: PackageSearch },
      { titulo: "Almacenes", href: "/logistica/almacenes", icono: Warehouse },
      { titulo: "Solicitudes de despacho", href: "/logistica/solicitudes-despacho", icono: PackageMinus },
      { titulo: "Reportes de Trazabilidad", href: "/logistica/reportes-trazabilidad", icono: BarChart3 },
      { titulo: "Listas", href: "/logistica/listas", icono: List },
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
      { titulo: "Ingreso Industrial Planta", href: "/acopio/ingreso-industrial", icono: Snowflake },
      { titulo: "Tarjas Industrial", href: "/acopio/tarjas-industrial", icono: Tag },
      { titulo: "Despacho Industrial", href: "/acopio/despacho-industrial", icono: Truck },
      { titulo: "Catálogo de taras", href: "/acopio/catalogo-taras", icono: Ruler },
      { titulo: "Información Transporte", href: "/acopio/transporte", icono: IdCard },
      { titulo: "Reporte", href: "/acopio/reporte", icono: BarChart3 },
    ],
  },
  {
    modulo: MODULOS.USUARIOS,
    titulo: "Usuarios",
    icono: ShieldCheck,
    items: [
      { titulo: "Inicio", href: "/usuarios", icono: LayoutGrid },
      { titulo: "Usuarios", href: "/usuarios/lista", icono: Users },
      { titulo: "Roles", href: "/usuarios/roles", icono: ShieldCheck },
      { titulo: "Pendientes de aprobación", href: "/usuarios/aprobaciones", icono: ShieldCheck },
    ],
  },
  {
    modulo: MODULOS.COMEX,
    titulo: "Comex",
    icono: Snowflake,
    items: [
      { titulo: "Inicio", href: "/comex", icono: LayoutGrid },
      { titulo: "Dashboard Exportaciones", href: "/comex/dashboard-exportaciones", icono: BarChart3 },
      { titulo: "Dashboard Exportaciones - Prueba", href: "/comex/dashboard-exportaciones-prueba", icono: BarChart3 },
      { titulo: "Conciliación Excel vs Supabase", href: "/comex/conciliacion-excel-supabase", icono: GitCompare },
      { titulo: "Packing list", href: "/comex/packing-list", icono: FileSpreadsheet },
      { titulo: "Importar PL", href: "/comex/importar-pl", icono: Upload },
      { titulo: "Importar Facturación", href: "/comex/importar-facturacion-historica", icono: FileUp },
      { titulo: "Gestión de Precios", href: "/comex/gestion-precios", icono: Tag },
      { titulo: "Registro de Rechazos", href: "/comex/registro-rechazos", icono: PackageX },
      { titulo: "Consulta de Rechazos", href: "/comex/consulta-rechazos", icono: Search },
      { titulo: "Resumen de Liquidaciones", href: "/comex/resumen-liquidaciones", icono: Receipt },
      { titulo: "Stock de cámara", href: "/comex/stock-camara", icono: Thermometer },
      { titulo: "Formatos de exportación", href: "/comex/formatos-exportacion", icono: Package },
    ],
  },
];

export const NAV_INICIO: NavItem = { titulo: "Inicio", href: "/inicio", icono: Home };
