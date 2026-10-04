"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ROLES_APROBADOR_ESPECIAL, type RolAprobadorEspecialCodigo } from "@/lib/constants/compras";
import { configurarAprobadoresEspecialesAction } from "@/lib/actions/solicitud-pedido-actions";

type UsuarioOpcion = { id: string; nombre: string };

export function AprobadoresEspecialesForm({
  usuarios,
  asignacionesIniciales,
}: {
  usuarios: UsuarioOpcion[];
  asignacionesIniciales: Record<RolAprobadorEspecialCodigo, string>;
}) {
  const router = useRouter();
  const [asignaciones, setAsignaciones] = useState<Record<RolAprobadorEspecialCodigo, string>>(asignacionesIniciales);
  const [guardando, setGuardando] = useState(false);

  async function handleGuardar() {
    setGuardando(true);
    try {
      const resultado = await configurarAprobadoresEspecialesAction({
        asignaciones: Object.entries(asignaciones)
          .filter(([, usuarioId]) => usuarioId)
          .map(([rol, usuarioId]) => ({ rol: rol as RolAprobadorEspecialCodigo, usuarioId })),
      });
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Aprobadores especiales guardados");
      router.push("/logistica/solicitudes-pedido");
    } catch (err) {
      console.error("Error al guardar los aprobadores especiales:", err);
      const detalle = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo guardar: ${detalle}`);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aprobadores especiales</CardTitle>
        <p className="text-sm text-muted-foreground">
          Gerente de Supply, District Controller y Gerente General pueden aprobar cualquier Solped sin
          restricción de área, y junto con el Gerente de RRHH firman las OC/OS según su monto (y si tienen ítems
          de RRHH) — ver la sección &quot;Aprobaciones requeridas&quot; de cada orden.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {ROLES_APROBADOR_ESPECIAL.map((rol) => (
          <div key={rol.valor} className="grid grid-cols-1 gap-2 sm:grid-cols-[200px_1fr] sm:items-center">
            <Label>{rol.nombre}</Label>
            <Select
              value={asignaciones[rol.valor] ?? ""}
              onValueChange={(v) => setAsignaciones((prev) => ({ ...prev, [rol.valor]: v }))}
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
