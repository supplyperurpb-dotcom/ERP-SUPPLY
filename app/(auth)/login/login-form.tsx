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
        <CardDescription>Ingresa con tu correo corporativo.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" name="email" type="email" placeholder="nombre@empresa.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" required />
          </div>

          {state?.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}

          <SubmitButton />

          <div className="text-center text-sm">
            <a href="/recuperar-password" className="text-muted-foreground hover:text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
          </div>
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
