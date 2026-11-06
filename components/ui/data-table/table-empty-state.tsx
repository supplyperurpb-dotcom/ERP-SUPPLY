/**
 * Mensaje de "sin resultados" para cuando un filtro/búsqueda no encuentra
 * coincidencias dentro de una tabla que sí tiene registros (ver
 * `proveedor-table.tsx`). Para el caso de "no hay ningún registro todavía"
 * (tabla vacía de origen) usa en cambio `EmptyState` de
 * `components/shared/empty-state.tsx`, que lleva ícono y es el patrón ya
 * usado en esa situación.
 */
export function TableEmptyState({ mensaje }: { mensaje: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{mensaje}</p>;
}
