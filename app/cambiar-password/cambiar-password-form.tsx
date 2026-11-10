"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cambiarPasswordPropiaAction } from "@/lib/actions/auth-actions";
import type { ActionState } from "@/lib/actions/auth-actions";

export function CambiarPasswordForm() {
  const [state, formAction] = useFormState<ActionState, FormData>(cambiarPasswordPropiaAction, undefined);
  const [mostrar, setMostrar] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cambia tu contraseña</CardTitle>
        <CardDescription>
          Por seguridad, debes elegir una contraseña nueva antes de continuar. Después de esto, solo un
          administrador puede volver a cambiártela.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nuevaPassword">Nueva contraseña</Label>
            <div className="flex gap-2">
              <Input
                id="nuevaPassword"
                name="nuevaPassword"
                type={mostrar ? "text" : "password"}
                required
                minLength={8}
              />
              <Button type="button" variant="outline" onClick={() => setMostrar((v) => !v)}>
                {mostrar ? "Ocultar" : "Mostrar"}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmarPassword">Confirma la nueva contraseña</Label>
            <Input
              id="confirmarPassword"
              name="confirmarPassword"
              type={mostrar ? "text" : "password"}
              required
              minLength={8}
            />
          </div>

          {state?.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Guardando..." : "Guardar y continuar"}
    </Button>
  );
}
