"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type ActionState } from "@/lib/actions/auth-actions";

export function LoginForm() {
  const [state, formAction] = useFormState<ActionState, FormData>(loginAction, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>Ingresa con tu DNI.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identificador">DNI</Label>
            <Input id="identificador" name="identificador" type="text" placeholder="12345678" required />
            <p className="text-xs text-muted-foreground">
              Si todavía no tienes un DNI asignado, ingresa con tu correo.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" required />
          </div>

          {state?.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}

          <SubmitButton />

          <p className="text-center text-xs text-muted-foreground">
            ¿Olvidaste tu contraseña? Pídele a un administrador que te la restablezca.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Ingresando..." : "Ingresar"}
    </Button>
  );
}
