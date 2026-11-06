import { Search } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Input de búsqueda con ícono, formaliza el patrón repetido en las tablas
 * con filtro en cliente (ver `proveedor-table.tsx`).
 */
export function TableSearch({ className, ...props }: Omit<InputProps, "type">) {
  return (
    <div className={cn("relative max-w-sm flex-1", className)}>
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input type="search" className="pl-8" {...props} />
    </div>
  );
}
