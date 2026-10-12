"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AREAS_EMPRESA } from "@/lib/constants/compras";
import { TIPOS_VEHICULO } from "@/lib/validations/vehiculo";
import { crearVehiculoAction, actualizarVehiculoAction } from "@/lib/actions/vehiculo-actions";
import type { VehiculoInput } from "@/lib/validations/vehiculo";

export function VehiculoForm({
  edicion,
}: {
  edicion?: { id: string; valoresIniciales: VehiculoInput };
}) {
  const router = useRouter();
  const esEdicion = !!edicion;

  const [placa, setPlaca] = useState(edicion?.valoresIniciales.placa ?? "");
  const [codigoEquipo, setCodigoEquipo] = useState(edicion?.valoresIniciales.codigoEquipo ?? "");
  const [areaUsuaria, setAreaUsuaria] = useState(edicion?.valoresIniciales.areaUsuaria ?? "");
  const [tipo, setTipo] = useState(edicion?.valoresIniciales.tipo ?? "");
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit() {
    if (!placa.trim()) {
      toast.error("La placa es obligatoria");
      return;
    }
    if (!areaUsuaria) {
      toast.error("Selecciona el área usuaria");
      return;
    }
    if (!tipo) {
      toast.error("Selecciona el tipo de vehículo");
      return;
    }

    const payload: VehiculoInput = {
      placa,
      codigoEquipo,
      areaUsuaria: areaUsuaria as VehiculoInput["areaUsuaria"],
      tipo: tipo as VehiculoInput["tipo"],
    };

    setEnviando(true);
    try {
      const resultado = esEdicion
        ? await actualizarVehiculoAction(edicion.id, payload)
        : await crearVehiculoAction(payload);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(esEdicion ? "Vehículo actualizado" : "Vehículo creado");
      router.push("/logistica/listas/vehiculos");
    } catch (err) {
      console.error("Error al guardar el vehículo:", err);
      const detalle = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo guardar: ${detalle}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del vehículo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="placa">Número de placa</Label>
            <Input
              id="placa"
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
              placeholder="Ej. ABC-123"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="codigoEquipo">Código de equipo (opcional)</Label>
            <Input
              id="codigoEquipo"
              value={codigoEquipo}
              onChange={(e) => setCodigoEquipo(e.target.value.toUpperCase())}
              placeholder="Ej. EQ-045"
            />
          </div>
          <div className="space-y-2">
            <Label>Área usuaria</Label>
            <Select value={areaUsuaria} onValueChange={setAreaUsuaria}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el área" />
              </SelectTrigger>
              <SelectContent>
                {AREAS_EMPRESA.map((a) => (
                  <SelectItem key={a.valor} value={a.valor}>
                    {a.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de vehículo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_VEHICULO.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="button" disabled={enviando} onClick={handleSubmit}>
          {enviando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear vehículo"}
        </Button>
      </div>
    </div>
  );
}
