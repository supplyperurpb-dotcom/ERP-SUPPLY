"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GERENCIAS_SOLPED, areasDeGerenciaSolped, type GerenciaSolpedCodigo } from "@/lib/constants/compras";
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
  const [apellidoPaterno, setApellidoPaterno] = useState(edicion?.valoresIniciales.apellidoPaterno ?? "");
  const [apellidoMaterno, setApellidoMaterno] = useState(edicion?.valoresIniciales.apellidoMaterno ?? "");
  const [dni, setDni] = useState(edicion?.valoresIniciales.dni ?? "");
  const [gerencia, setGerencia] = useState<GerenciaSolpedCodigo | "">(
    (edicion?.valoresIniciales.area as GerenciaSolpedCodigo | undefined) ?? ""
  );
  const [areaDetalle, setAreaDetalle] = useState(edicion?.valoresIniciales.areaDetalle ?? "");
  const [almacenesIds, setAlmacenesIds] = useState<Set<string>>(
    new Set(edicion?.valoresIniciales.almacenesPermitidosIds ?? [])
  );
  const [enviando, setEnviando] = useState(false);

  const areasDeGerenciaActual = gerencia ? areasDeGerenciaSolped(gerencia) : [];

  function cambiarGerencia(valor: string) {
    const nuevaGerencia = valor as GerenciaSolpedCodigo;
    setGerencia(nuevaGerencia);
    // Mismo criterio que el selector de Usuario: si la gerencia no se
    // subdivide, el área queda precargada sola (no se muestra el segundo
    // selector, ver areasDeGerenciaActual.length > 1 más abajo).
    const primeraArea = areasDeGerenciaSolped(nuevaGerencia)[0]?.valor;
    setAreaDetalle(primeraArea ?? "");
  }

  function alternarAlmacen(id: string) {
    setAlmacenesIds((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  const todosSeleccionados = almacenes.length > 0 && almacenes.every((a) => almacenesIds.has(a.id));
  function alternarTodos() {
    setAlmacenesIds(todosSeleccionados ? new Set() : new Set(almacenes.map((a) => a.id)));
  }

  async function handleSubmit() {
    if (!nombres.trim() || !apellidoPaterno.trim() || !apellidoMaterno.trim()) {
      toast.error("Nombres, apellido paterno y apellido materno son obligatorios");
      return;
    }
    if (!/^\d{8}$/.test(dni.trim())) {
      toast.error("El DNI debe tener 8 dígitos");
      return;
    }
    if (!gerencia) {
      toast.error("Selecciona la gerencia");
      return;
    }
    if (!areaDetalle) {
      toast.error("Selecciona el área");
      return;
    }
    if (almacenesIds.size === 0) {
      toast.error("Selecciona al menos un almacén permitido");
      return;
    }

    const payload: RetiradorAutorizadoInput = {
      nombres,
      apellidoPaterno,
      apellidoMaterno,
      dni,
      area: gerencia,
      areaDetalle,
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
            <Label htmlFor="apellidoPaterno">Apellido paterno</Label>
            <Input id="apellidoPaterno" value={apellidoPaterno} onChange={(e) => setApellidoPaterno(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apellidoMaterno">Apellido materno</Label>
            <Input id="apellidoMaterno" value={apellidoMaterno} onChange={(e) => setApellidoMaterno(e.target.value)} />
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
            <Label>Gerencia</Label>
            <Select value={gerencia} onValueChange={cambiarGerencia}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona la gerencia" />
              </SelectTrigger>
              <SelectContent>
                {GERENCIAS_SOLPED.map((g) => (
                  <SelectItem key={g.valor} value={g.valor}>
                    {g.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Área</Label>
            <Select value={areaDetalle} onValueChange={setAreaDetalle} disabled={!gerencia}>
              <SelectTrigger>
                <SelectValue placeholder={gerencia ? "Selecciona el área" : "Selecciona primero la gerencia"} />
              </SelectTrigger>
              <SelectContent>
                {areasDeGerenciaActual.map((a) => (
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
        <CardContent className="space-y-3">
          <label className="flex w-fit items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={todosSeleccionados}
              onChange={alternarTodos}
            />
            Seleccionar todos
          </label>
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
