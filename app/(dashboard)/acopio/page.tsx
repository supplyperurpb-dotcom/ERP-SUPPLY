import Link from "next/link";
import { BarChart3, Boxes, FileText, Receipt, Ruler, Snowflake, Tag, Truck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TILES = [
  {
    titulo: "Ingreso de Materia Prima",
    descripcion: "Registro de llegada de camiones con arándano fresco del fundo.",
    href: "/acopio/ingresos",
    icono: Boxes,
  },
  {
    titulo: "Tarjas",
    descripcion: "Etiquetas de los pallets armados desde Ingreso de Materia Prima.",
    href: "/acopio/tarjas",
    icono: Receipt,
  },
  {
    titulo: "Despacho",
    descripcion: "Salida de pallets con tarja generada hacia su siguiente destino.",
    href: "/acopio/despacho",
    icono: Truck,
  },
  {
    titulo: "Guías de remisión",
    descripcion: "Documentos de traslado asociados a un ingreso de fruta.",
    href: "/acopio/guias-remision",
    icono: FileText,
  },
  {
    titulo: "Ingreso IQF",
    descripcion: "Registro de descarte de planta, independiente de la fruta.",
    href: "/acopio/ingreso-iqf",
    icono: Snowflake,
  },
  {
    titulo: "Tarjas IQF",
    descripcion: "Etiquetas de pallets de descarte, de campo o de planta.",
    href: "/acopio/tarjas-iqf",
    icono: Tag,
  },
  {
    titulo: "Despacho IQF",
    descripcion: "Salida de pallets IQF despachados hacia su destino.",
    href: "/acopio/despacho-iqf",
    icono: Truck,
  },
  {
    titulo: "Catálogo de taras",
    descripcion: "Tipos de bandeja y pallet con su peso tara registrado.",
    href: "/acopio/catalogo-taras",
    icono: Ruler,
  },
  {
    titulo: "Reporte",
    descripcion: "Resumen de kilos aprovechables y nacionales por variedad y semana.",
    href: "/acopio/reporte",
    icono: BarChart3,
  },
];

export default function AcopioInicioPage() {
  return (
    <div>
      <PageHeader titulo="Acopio" descripcion="Elige un submódulo para continuar." />
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
