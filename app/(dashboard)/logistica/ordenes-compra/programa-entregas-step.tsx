"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ItemParaPrograma = {
  /** Clave única dentro de este formulario (no necesariamente el id real del ítem en BD). */
  key: string;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  /** Cantidad total de esta línea en la OC/OS — el programa no puede superarla. */
  cantidad: number;
};

export type FilaEntregaProgramada = { cantidad: string; fechaTentativa: string };

function filaVacia(): FilaEntregaProgramada {
  return { cantidad: "", fechaTentativa: "" };
}

// Paso "Programa de Entregas" (pedido explícito, 2026-11-25): antes de
// guardar la OC/OS como borrador, cada línea se distribuye en una o más
// entregas con cantidad y fecha tentativa propias. Se usa igual en
// orden-compra-form.tsx (con Solped) y orden-compra-directa-form.tsx
// (Directa) — solo cambia qué ítems le pasa cada uno.
export function ProgramaEntregasStep({
  items,
  entregasPorItem,
  onChange,
  onAnterior,
  onConfirmar,
  enviando,
}: {
  items: ItemParaPrograma[];
  entregasPorItem: Record<string, FilaEntregaProgramada[]>;
  onChange: (key: string, entregas: FilaEntregaProgramada[]) => void;
  onAnterior: () => void;
  onConfirmar: () => void;
  enviando: boolean;
}) {
  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  function agregarEntrega(key: string) {
    onChange(key, [...(entregasPorItem[key] ?? []), filaVacia()]);
  }

  function actualizarEntrega(key: string, index: number, cambios: Partial<FilaEntregaProgramada>) {
    const entregas = entregasPorItem[key] ?? [];
    onChange(
      key,
      entregas.map((e, i) => (i === index ? { ...e, ...cambios } : e))
    );
  }

  function quitarEntrega(key: string, index: number) {
    const entregas = entregasPorItem[key] ?? [];
    onChange(
      key,
      entregas.filter((_, i) => i !== index)
    );
  }

  const resumenPorItem = useMemo(() => {
    return items.map((item) => {
      const entregas = entregasPorItem[item.key] ?? [];
      const programado = entregas.reduce((acc, e) => acc + (Number(e.cantidad) || 0), 0);
      const pendiente = Math.round((item.cantidad - programado) * 1000) / 1000;
      const seExcede = programado > item.cantidad;
      const algunaFilaIncompleta = entregas.some((e) => !(Number(e.cantidad) > 0) || !e.fechaTentativa);
      return { item, entregas, programado, pendiente, seExcede, algunaFilaIncompleta };
    });
  }, [items, entregasPorItem]);

  const puedeAgendar = resumenPorItem.every((r) => !r.seExcede && !r.algunaFilaIncompleta);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Programa de entregas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Distribuye cada producto en una o más fechas tentativas de entrega. Puedes dejar un producto sin
            programar del todo o solo parcialmente.
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          {resumenPorItem.map(({ item, entregas, programado, pendiente, seExcede, algunaFilaIncompleta }) => (
            <div key={item.key} className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {item.codigo ? `${item.codigo} — ` : ""}
                    {item.descripcion}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    UM: {item.unidadMedida} · Cantidad OC: {item.cantidad.toLocaleString("es-PE")} · Programado:{" "}
                    <span className={cn(seExcede && "font-medium text-destructive")}>
                      {programado.toLocaleString("es-PE")}
                    </span>{" "}
                    · Pendiente: {pendiente.toLocaleString("es-PE")}
                  </p>
                  {seExcede && (
                    <p className="text-xs font-medium text-destructive">
                      Lo programado no puede superar la cantidad de la línea.
                    </p>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => agregarEntrega(item.key)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar entrega
                </Button>
              </div>

              {entregas.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Cantidad</TableHead>
                      <TableHead className="w-44">Fecha tentativa</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entregas.map((entrega, index) => {
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <NumberInput
                              value={entrega.cantidad}
                              onChange={(v) => actualizarEntrega(item.key, index, { cantidad: v })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={entrega.fechaTentativa}
                              onChange={(e) => actualizarEntrega(item.key, index, { fechaTentativa: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => quitarEntrega(item.key, index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {algunaFilaIncompleta && (
                <p className="text-xs text-muted-foreground">
                  Completa la cantidad y la fecha de cada entrega agregada (o quítala).
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onAnterior}>
          Anterior
        </Button>
        <Button type="button" disabled={!puedeAgendar} onClick={() => setDialogoAbierto(true)}>
          Agendar Programa
        </Button>
      </div>

      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Agendar programa de entregas?</DialogTitle>
            <DialogDescription>
              Se guardará la orden junto con su programa de entregas, en estado Borrador.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={enviando} onClick={() => setDialogoAbierto(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={enviando} onClick={onConfirmar}>
              {enviando ? "Guardando..." : "Guardar como borrador"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
