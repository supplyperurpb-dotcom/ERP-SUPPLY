"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { actualizarLineaRechazoAction } from "@/lib/actions/registro-rechazos-actions";
import type { CategoriaRechazo, EstadoRechazoItem } from "@prisma/client";

const CATEGORIA_LABEL: Record<CategoriaRechazo, string> = {
  TERMINAL_MARKET: "Terminal Market",
  NON_FRESH: "Non-Fresh",
  DONATION: "Donation",
  PASS: "Pass (fruta buena)",
};

const ESTADO_LABEL: Record<EstadoRechazoItem, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  ANULADO: "Anulado",
  DISPUTADO: "Disputado",
};

const SIN_CATEGORIA_FINAL = "__sin_definir__";

type Item = {
  id: string;
  lpn: string;
  itemCode: string | null;
  descripcionSku: string | null;
  variedad: string | null;
  palletNumber: string | null;
  cajasOriginales: number | null;
  cajasRechazadas: number;
  categoriaFinal: CategoriaRechazo | null;
  estado: EstadoRechazoItem;
  alertaLpnNoEncontrado: boolean;
  alertaVariedadNoCoincide: boolean;
  alertaExcedeOriginales: boolean;
};

// Una sola disposición por línea (sin "sugerida" aparte, pedido
// explícito) — acá se fija/cambia en cualquier momento, junto al estado.
export function RechazoItemsTabla({ items }: { items: Item[] }) {
  const [filas, setFilas] = useState(items);
  const [, startTransition] = useTransition();

  function guardar(id: string, cambios: Partial<Pick<Item, "categoriaFinal" | "estado">>) {
    setFilas((actual) => actual.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
    startTransition(async () => {
      const resultado = await actualizarLineaRechazoAction(id, cambios);
      if (resultado.error) toast.error(resultado.error);
      else toast.success("Actualizado");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Líneas ({filas.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>LPN</TableHead>
                <TableHead>Pallet</TableHead>
                <TableHead>Variedad</TableHead>
                <TableHead>Item / SKU</TableHead>
                <TableHead numeric>Cajas PL</TableHead>
                <TableHead numeric>Cajas rechazadas</TableHead>
                <TableHead>Disposición final</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Alertas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono font-medium">{f.lpn}</TableCell>
                  <TableCell>{f.palletNumber ?? "—"}</TableCell>
                  <TableCell>{f.variedad ?? "—"}</TableCell>
                  <TableCell>
                    {f.itemCode ?? "—"} {f.descripcionSku ? `(${f.descripcionSku})` : ""}
                  </TableCell>
                  <TableCell numeric>{f.cajasOriginales ?? "—"}</TableCell>
                  <TableCell numeric>{f.cajasRechazadas}</TableCell>
                  <TableCell>
                    <Select
                      value={f.categoriaFinal ?? SIN_CATEGORIA_FINAL}
                      onValueChange={(v) => guardar(f.id, { categoriaFinal: v === SIN_CATEGORIA_FINAL ? null : (v as CategoriaRechazo) })}
                    >
                      <SelectTrigger className="w-[170px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SIN_CATEGORIA_FINAL}>Sin definir</SelectItem>
                        {Object.entries(CATEGORIA_LABEL).map(([valor, etiqueta]) => (
                          <SelectItem key={valor} value={valor}>
                            {etiqueta}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={f.estado} onValueChange={(v) => guardar(f.id, { estado: v as EstadoRechazoItem })}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ESTADO_LABEL).map(([valor, etiqueta]) => (
                          <SelectItem key={valor} value={valor}>
                            {etiqueta}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="space-y-1">
                    {f.alertaLpnNoEncontrado && <Badge variant="destructive">LPN no encontrado</Badge>}
                    {f.alertaVariedadNoCoincide && <Badge variant="warning">Variedad no coincide</Badge>}
                    {f.alertaExcedeOriginales && <Badge variant="destructive">Supera cajas originales</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
