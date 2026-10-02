"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AREAS_EMPRESA, type AreaEmpresaCodigo } from "@/lib/constants/compras";
import { configurarAprobadoresAreaAction } from "@/lib/actions/solicitud-pedido-actions";

type UsuarioOpcion = { id: string; nombre: string };

export function AprobadoresAreaForm({
  usuarios,
  asignacionesIniciales,
}: {
  usuarios: UsuarioOpcion[];
  asignacionesIniciales: Record<AreaEmpresaCodigo, string>;
}) {
  const router = useRouter();
  const [asignaciones, setAsignaciones] = useState<Record<AreaEmpresaCodigo, string>>(asignacionesIniciales);
  const [guardando, setGuardando] = useState(false);

  async function handleGuardar() {
    setGuardando(true);
    try {
      const resultado = await configurarAprobadoresAreaAction({
        asignaciones: Object.entries(asignaciones)
          .filter(([, usuarioId]) => usuarioId)
          .map(([area, usuarioId]) => ({ area: area as AreaEmpresaCodigo, usuarioId })),
      });
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Aprobadores guardados");
      router.push("/logistica/solicitudes-pedido");
    } catch (err) {
      console.error("Error al guardar los aprobadores:", err);
      const detalle = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo guardar: ${detalle}`);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aprobador por área</CardTitle>
        <p className="text-sm text-muted-foreground">
          Elige qué usuario debe aprobar o rechazar las solicitudes de pedido de cada área (p. ej. el Gerente de
          Producción para las de Producción). Un administrador siempre puede aprobar cualquier solicitud.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {AREAS_EMPRESA.map((area) => (
          <div key={area.valor} className="grid grid-cols-1 gap-2 sm:grid-cols-[200px_1fr] sm:items-center">
            <Label>{area.nombre}</Label>
            <Select
              value={asignaciones[area.valor] ?? ""}
              onValueChange={(v) => setAsignaciones((prev) => ({ ...prev, [area.valor]: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin aprobador asignado" />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="button" disabled={guardando} onClick={handleGuardar}>
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
