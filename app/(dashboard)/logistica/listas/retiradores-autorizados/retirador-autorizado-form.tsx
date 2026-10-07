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
import {
  crearRetiradorAutorizadoAction,
  actualizarRetiradorAutorizadoAction,
} from "@/lib/actions/retirador-autorizado-actions";
import type { RetiradorAutorizadoInput } from "@/lib/validations/retirador-autorizado";

export type AlmacenOpcion = { id: string; nombre: string };

export function RetiradorAutorizadoForm({
  almacenes,
  edicion,
}: {
  almacenes: AlmacenOpcion[];
  edicion?: { id: string; valoresIniciales: RetiradorAutorizadoInput };
}) {
  const router = useRouter();
  const esEdicion = !!edicion;

  const [nombres, setNombres] = useState(edicion?.valoresIniciales.nombres ?? "");
  const [apellidos, setApellidos] = useState(edicion?.valoresIniciales.apellidos ?? "");
  const [dni, setDni] = useState(edicion?.valoresIniciales.dni ?? "");
  const [area, setArea] = useState(edicion?.valoresIniciales.area ?? "");
  const [almacenesIds, setAlmacenesIds] = useState<Set<string>>(
    new Set(edicion?.valoresIniciales.almacenesPermitidosIds ?? [])
  );
  const [enviando, setEnviando] = useState(false);

  function alternarAlmacen(id: string) {
    setAlmacenesIds((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  async function handleSubmit() {
    if (!nombres.trim() || !apellidos.trim()) {
      toast.error("Nombres y apellidos son obligatorios");
      return;
    }
    if (!/^\d{8}$/.test(dni.trim())) {
      toast.error("El DNI debe tener 8 dígitos");
      return;
    }
    if (!area) {
      toast.error("Selecciona el área");
      return;
    }
    if (almacenesIds.size === 0) {
      toast.error("Selecciona al menos un almacén permitido");
      return;
    }

    const payload: RetiradorAutorizadoInput = {
      nombres,
      apellidos,
      dni,
      area: area as RetiradorAutorizadoInput["area"],
      almacenesPermitidosIds: [...almacenesIds],
    };

    setEnviando(true);
    try {
      const resultado = esEdicion
        ? await actualizarRetiradorAutorizadoAction(edicion.id, payload)
        : await crearRetiradorAutorizadoAction(payload);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(esEdicion ? "Retirador actualizado" : "Retirador creado");
      router.push("/logistica/listas/retiradores-autorizados");
    } catch (err) {
      console.error("Error al guardar el retirador autorizado:", err);
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
          <CardTitle className="text-base">Datos del retirador</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="nombres">Nombres</Label>
            <Input id="nombres" value={nombres} onChange={(e) => setNombres(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apellidos">Apellidos</Label>
            <Input id="apellidos" value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dni">DNI</Label>
            <Input
              id="dni"
              value={dni}
              maxLength={8}
              inputMode="numeric"
              onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="space-y-2">
            <Label>Área</Label>
            <Select value={area} onValueChange={setArea}>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Almacenes permitidos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Marca de qué almacenes puede retirar materiales esta persona. No todos pueden retirar de todos.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {almacenes.map((a) => (
              <label key={a.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={almacenesIds.has(a.id)}
                  onChange={() => alternarAlmacen(a.id)}
                />
                {a.nombre}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="button" disabled={enviando} onClick={handleSubmit}>
          {enviando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear retirador"}
        </Button>
      </div>
    </div>
  );
}
