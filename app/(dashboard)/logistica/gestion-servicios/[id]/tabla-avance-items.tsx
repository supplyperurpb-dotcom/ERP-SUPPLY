"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCantidad, formatMoneda } from "@/lib/utils";
import { registrarAvanceServicioAction, type TipoRegistroAvanceInput } from "@/lib/actions/servicio-gestionado-actions";

export type FilaAvanceItem = {
  itemServicioGestionadoId: string;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  cantidadTotal: number;
  precioUnitario: number;
  moneda: string;
  saldoCantidad: number;
  saldoValor: number;
};

export function TablaAvanceItems({ filas }: { filas: FilaAvanceItem[] }) {
  if (filas.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">Todavía no hay ítems en seguimiento. Usa &quot;Añadir Items&quot;.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead numeric>Cant.</TableHead>
            <TableHead numeric>Valorizado</TableHead>
            <TableHead className="min-w-[160px]">Tipo de registro</TableHead>
            <TableHead className="min-w-[220px]">Avance a registrar</TableHead>
            <TableHead numeric>Saldo cant.</TableHead>
            <TableHead numeric>Saldo valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((fila) => (
            <FilaAvance key={fila.itemServicioGestionadoId} fila={fila} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FilaAvance({ fila }: { fila: FilaAvanceItem }) {
  const [tipo, setTipo] = useState<TipoRegistroAvanceInput | "">("");
  const [valor, setValor] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const valorNumerico = Number(valor);
  const esValido = tipo !== "" && valor.trim() !== "" && Number.isFinite(valorNumerico) && valorNumerico > 0;

  const preview = useMemo(() => {
    if (!esValido) return null;
    const cantidad = tipo === "PORCENTUAL" ? (fila.cantidadTotal * valorNumerico) / 100 : valorNumerico;
    const valorizado = cantidad * fila.precioUnitario;
    return { cantidad, valorizado };
  }, [esValido, tipo, valorNumerico, fila.cantidadTotal, fila.precioUnitario]);

  function handleRegistrar() {
    if (!esValido || !tipo) return;
    startTransition(async () => {
      const resultado = await registrarAvanceServicioAction(fila.itemServicioGestionadoId, tipo, valorNumerico);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Avance registrado");
      setValor("");
      router.refresh();
    });
  }

  return (
    <TableRow>
      <TableCell className="font-mono font-medium">{fila.codigo}</TableCell>
      <TableCell className="max-w-xs">{fila.descripcion}</TableCell>
      <TableCell numeric>
        {formatCantidad(fila.cantidadTotal)} {fila.unidadMedida}
      </TableCell>
      <TableCell numeric>{formatMoneda((fila.cantidadTotal * fila.precioUnitario).toString(), fila.moneda)}</TableCell>
      <TableCell>
        <Select value={tipo} onValueChange={(v) => setTipo(v as TipoRegistroAvanceInput)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PORCENTUAL">Avance Porcentual</SelectItem>
            <SelectItem value="CANTIDAD">Avance por Cantidad</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        {tipo !== "" && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step="any"
                placeholder={tipo === "PORCENTUAL" ? "% de avance" : `Cantidad (${fila.unidadMedida})`}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-28"
              />
              <Button type="button" size="sm" disabled={!esValido || pending} onClick={handleRegistrar}>
                Registrar
              </Button>
            </div>
            {preview && (
              <p className="text-xs text-muted-foreground">
                {tipo === "PORCENTUAL" && `${valorNumerico.toFixed(1)}% = `}
                {formatCantidad(preview.cantidad)} {fila.unidadMedida} · {formatMoneda(preview.valorizado.toString(), fila.moneda)}
              </p>
            )}
          </div>
        )}
      </TableCell>
      <TableCell numeric className="font-medium">
        {formatCantidad(fila.saldoCantidad)} {fila.unidadMedida}
      </TableCell>
      <TableCell numeric className="font-medium">
        {formatMoneda(fila.saldoValor.toString(), fila.moneda)}
      </TableCell>
    </TableRow>
  );
}
