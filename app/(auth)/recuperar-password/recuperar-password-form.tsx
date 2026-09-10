"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recuperarPasswordAction, type ActionState } from "@/lib/actions/auth-actions";

export function RecuperarPasswordForm() {
  const [state, formAction] = useFormState<ActionState, FormData>(recuperarPasswordAction, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar contraseña</CardTitle>
        <CardDescription>Te enviaremos un enlace para restablecerla.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" name="email" type="email" placeholder="nombre@empresa.com" required />
          </div>

          {state?.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}

          <SubmitButton />

          <div className="text-center text-sm">
            <a href="/login" className="text-muted-foreground hover:text-primary hover:underline">
              Volver a iniciar sesión
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
      {pending ? "Enviando..." : "Enviar enlace"}
    </Button>
  );
}
