"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearPrecioAction } from "@/lib/actions/gestion-precios-actions";
import type { TipoPrecio, UnidadPrecio } from "@prisma/client";

const UNIDAD_LABEL: Record<UnidadPrecio, string> = { USD_KG: "USD / Kg", USD_CAJA: "USD / Caja" };
const TIPO_PRECIO_LABEL: Record<TipoPrecio, string> = {
  FOB: "FOB",
  FREIGHT: "Freight",
  INTERNATIONAL_INSURANCE: "International Insurance",
  CIF: "CIF",
};

export function NuevoPrecioForm({ po, embarqueId }: { po: string; embarqueId: string | null }) {
  const router = useRouter();
  const [productoSku, setProductoSku] = useState("");
  const [variedad, setVariedad] = useState("");
  const [precioUnitario, setPrecioUnitario] = useState("");
  const [moneda, setMoneda] = useState("USD");
  const [unidad, setUnidad] = useState<UnidadPrecio>("USD_KG");
  const [incoterm, setIncoterm] = useState("");
  const [tipoPrecio, setTipoPrecio] = useState<TipoPrecio>("FOB");
  const [guardando, startGuardado] = useTransition();

  function alGuardar() {
    const precio = Number(precioUnitario);
    if (!(precio > 0)) {
      toast.error("Ingresa un precio unitario válido.");
      return;
    }
    startGuardado(async () => {
      const resultado = await crearPrecioAction({
        po,
        embarqueId,
        productoSku: productoSku || null,
        variedad: variedad || null,
        precioUnitario: precio,
        moneda,
        unidad,
        incoterm: incoterm || null,
        tipoPrecio,
        vigenteDesde: null,
        vigenteHasta: null,
      });
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Precio registrado");
      setProductoSku("");
      setVariedad("");
      setPrecioUnitario("");
      setIncoterm("");
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label>Producto / SKU</Label>
        <Input value={productoSku} onChange={(e) => setProductoSku(e.target.value)} placeholder="Opcional" />
      </div>
      <div className="space-y-1.5">
        <Label>Variedad</Label>
        <Input value={variedad} onChange={(e) => setVariedad(e.target.value)} placeholder="Opcional" />
      </div>
      <div className="space-y-1.5">
        <Label>Tipo de precio</Label>
        <Select value={tipoPrecio} onValueChange={(v) => setTipoPrecio(v as TipoPrecio)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TIPO_PRECIO_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Precio unitario</Label>
        <Input type="number" step="0.0001" value={precioUnitario} onChange={(e) => setPrecioUnitario(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Moneda</Label>
        <Input value={moneda} onChange={(e) => setMoneda(e.target.value.toUpperCase())} maxLength={3} />
      </div>
      <div className="space-y-1.5">
        <Label>Unidad</Label>
        <Select value={unidad} onValueChange={(v) => setUnidad(v as UnidadPrecio)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(UNIDAD_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Incoterm</Label>
        <Input value={incoterm} onChange={(e) => setIncoterm(e.target.value)} placeholder="Ej. FOB, CIF..." />
      </div>
      <div className="flex items-end sm:col-span-3">
        <Button type="button" onClick={alGuardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar precio"}
        </Button>
      </div>
    </div>
  );
}
