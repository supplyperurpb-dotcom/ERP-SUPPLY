"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatCantidad } from "@/lib/utils";

type Pallet = {
  id: string;
  palletNumber: string;
  variedad: string;
  descripcionSku: string | null;
  label: string | null;
  fruitType: string | null;
  cases: number;
  pesoNetoKg: number;
  fechaCosecha: Date | null;
  lpnDriscolls: string | null;
  trazabilityCodeDoc: string | null;
};

// Filtro en el navegador (no recarga la página): la cantidad de pallets de
// un embarque es chica (decenas), no hace falta un viaje al servidor para
// acotar la tabla — pedido explícito: filtrar por LPN, Variedad y SKU.
export function EmbarquePalletsTabla({ pallets }: { pallets: Pallet[] }) {
  const [lpn, setLpn] = useState("");
  const [variedad, setVariedad] = useState("");
  const [sku, setSku] = useState("");

  const palletsFiltrados = useMemo(() => {
    const lpnBuscado = lpn.trim().toLowerCase();
    const variedadBuscada = variedad.trim().toLowerCase();
    const skuBuscado = sku.trim().toLowerCase();
    return pallets.filter(
      (p) =>
        (!lpnBuscado || (p.lpnDriscolls ?? "").toLowerCase().includes(lpnBuscado)) &&
        (!variedadBuscada || p.variedad.toLowerCase().includes(variedadBuscada)) &&
        (!skuBuscado || (p.descripcionSku ?? "").toLowerCase().includes(skuBuscado))
    );
  }, [pallets, lpn, variedad, sku]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Pallets ({palletsFiltrados.length}
          {palletsFiltrados.length !== pallets.length ? ` de ${pallets.length}` : ""})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="filtroLpn">LPN</Label>
            <Input id="filtroLpn" placeholder="Ej. 2014545790" value={lpn} onChange={(e) => setLpn(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="filtroVariedad">Variedad</Label>
            <Input id="filtroVariedad" placeholder="Ej. RAYMI" value={variedad} onChange={(e) => setVariedad(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="filtroSku">SKU</Label>
            <Input id="filtroSku" placeholder="Ej. PINTA" value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Pallet</TableHead>
                <TableHead>Variedad</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Tipo fruta</TableHead>
                <TableHead numeric>Cases</TableHead>
                <TableHead numeric>Net Weight</TableHead>
                <TableHead>Cosecha</TableHead>
                <TableHead>LPN</TableHead>
                <TableHead>Trazabilidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {palletsFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
                    Sin pallets que coincidan con el filtro.
                  </TableCell>
                </TableRow>
              ) : (
                palletsFiltrados.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono font-medium">{p.palletNumber}</TableCell>
                    <TableCell>{p.variedad}</TableCell>
                    <TableCell>{p.descripcionSku ?? "—"}</TableCell>
                    <TableCell>{p.label ?? "—"}</TableCell>
                    <TableCell>{p.fruitType ?? "—"}</TableCell>
                    <TableCell numeric>{formatCantidad(p.cases)}</TableCell>
                    <TableCell numeric>{formatCantidad(p.pesoNetoKg)}</TableCell>
                    <TableCell>{p.fechaCosecha ? formatDate(p.fechaCosecha) : "—"}</TableCell>
                    <TableCell className="font-mono">{p.lpnDriscolls ?? "—"}</TableCell>
                    <TableCell className="font-mono">{p.trazabilityCodeDoc ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
