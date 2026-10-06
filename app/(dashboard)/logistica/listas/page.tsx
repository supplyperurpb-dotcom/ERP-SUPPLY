import Link from "next/link";
import { List } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TIPOS_LISTA } from "@/lib/constants/listas";

export default function ListasInicioPage() {
  return (
    <div>
      <PageHeader titulo="Listas" descripcion="Catálogos editables usados en las solicitudes de pedido." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TIPOS_LISTA.map((lista) => (
          <Link key={lista.slug} href={`/logistica/listas/${lista.slug}`}>
            <Card className="h-full transition-colors hover:border-primary hover:bg-accent/40">
              <CardHeader>
                <List className="mb-2 h-6 w-6 text-primary" />
                <CardTitle className="text-base">{lista.nombre}</CardTitle>
                <CardDescription>Agrega, renombra o desactiva valores de esta lista.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
