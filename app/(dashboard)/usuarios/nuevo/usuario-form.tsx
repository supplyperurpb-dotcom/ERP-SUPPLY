"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AREAS_EMPRESA } from "@/lib/constants/compras";
import { crearUsuarioSchema, type CrearUsuarioInput } from "@/lib/validations/usuarios";
import { crearUsuarioAction } from "@/lib/actions/usuario-actions";

function generarPassword() {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let resultado = "";
  for (let i = 0; i < 10; i++) resultado += caracteres[Math.floor(Math.random() * caracteres.length)];
  return resultado;
}

export function UsuarioForm() {
  const router = useRouter();
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const form = useForm<CrearUsuarioInput>({
    resolver: zodResolver(crearUsuarioSchema),
    defaultValues: {
      nombres: "",
      apellidos: "",
      email: "",
      telefono: "",
      password: generarPassword(),
      tipoRol: "REGULAR",
    },
  });

  const tipoRol = form.watch("tipoRol");

  async function onSubmit(data: CrearUsuarioInput) {
    let resultado;
    try {
      resultado = await crearUsuarioAction(data);
    } catch (err) {
      console.error("Error al crear el usuario:", err);
      const detalle = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo crear: ${detalle}`);
      return;
    }
    if (resultado?.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(`Usuario creado. Comparte la contraseña "${data.password}" con ${data.nombres} por un canal seguro.`);
    router.push("/usuarios");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la cuenta</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nombres">Nombres</Label>
            <Input id="nombres" {...form.register("nombres")} />
            {form.formState.errors.nombres && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.nombres.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="apellidos">Apellidos</Label>
            <Input id="apellidos" {...form.register("apellidos")} />
            {form.formState.errors.apellidos && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.apellidos.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono">Teléfono (opcional)</Label>
            <Input id="telefono" {...form.register("telefono")} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="password">Contraseña temporal</Label>
            <div className="flex gap-2">
              <Input id="password" type={mostrarPassword ? "text" : "password"} {...form.register("password")} />
              <Button type="button" variant="outline" onClick={() => setMostrarPassword((v) => !v)}>
                {mostrarPassword ? "Ocultar" : "Mostrar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => form.setValue("password", generarPassword())}>
                Regenerar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Compártela tú mismo con el usuario por un canal seguro; el sistema no envía correos de invitación.
            </p>
            {form.formState.errors.password && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rol</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de usuario</Label>
            <Controller
              control={form.control}
              name="tipoRol"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REGULAR">Usuario regular</SelectItem>
                    <SelectItem value="APROBADOR">Usuario aprobador</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              {tipoRol === "APROBADOR"
                ? "Solo verá y podrá aprobar/rechazar las solicitudes y órdenes del área elegida abajo."
                : "Puede crear solicitudes y órdenes, y ve todas las áreas."}
            </p>
          </div>

          {tipoRol === "APROBADOR" && (
            <div className="space-y-2">
              <Label>Área que aprueba</Label>
              <Controller
                control={form.control}
                name="areaAprobador"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un área" />
                    </SelectTrigger>
                    <SelectContent>
                      {AREAS_EMPRESA.map((a) => (
                        <SelectItem key={a.valor} value={a.valor}>
                          {a.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.areaAprobador && (
                <p className="text-sm font-medium text-destructive">{form.formState.errors.areaAprobador.message}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creando..." : "Crear usuario"}
        </Button>
      </div>
    </form>
  );
}
