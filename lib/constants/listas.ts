// Catálogos editables desde Logística > Listas. Cada entrada acá es un
// tipo de lista con su slug de URL (/logistica/listas/[slug]) y el nombre
// que se le muestra al usuario. Para agregar una lista nueva: sumar el
// valor al enum TipoLista (prisma/schema.prisma) y una entrada aquí — la
// UI (tiles + tabla) es genérica y no necesita más cambios.
export const TIPOS_LISTA = [
  { tipo: "CENTRO_COSTO", slug: "centro-costos", nombre: "Centro de costos", nombreSingular: "centro de costo" },
  { tipo: "CAMPO", slug: "campos", nombre: "Campo / Fundo", nombreSingular: "campo" },
] as const;

export type TipoListaCodigo = (typeof TIPOS_LISTA)[number]["tipo"];

export function configTipoLista(slug: string) {
  return TIPOS_LISTA.find((t) => t.slug === slug);
}
