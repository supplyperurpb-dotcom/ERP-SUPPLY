import { prisma } from "@/lib/db/prisma";
import type { TipoListaCodigo } from "@/lib/constants/listas";

// Nombres de los valores activos de una lista, en el orden en que deben
// ofrecerse en un <Select> (por `orden`, luego alfabético).
export async function obtenerValoresActivos(tipo: TipoListaCodigo): Promise<string[]> {
  const valores = await prisma.listaValor.findMany({
    where: { tipo, activo: true },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
  });
  return valores.map((v) => v.nombre);
}
