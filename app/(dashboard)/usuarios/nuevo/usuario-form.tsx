"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AREAS_EMPRESA, ROLES_APROBADOR_ESPECIAL } from "@/lib/constants/compras";
import { GRUPOS_ACCESO_ASIGNABLE } from "@/lib/auth/acceso-modulos";
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
      dni: "",
      telefono: "",
      cargo: "",
      password: generarPassword(),
      tipoRol: "REGULAR",
      area: "PRODUCCION",
      rolEspecial: undefined,
      accesoHrefs: [],
      esComprador: false,
    },
  });

  const tipoRol = form.watch("tipoRol");
  const rolesEspecialesAsignables = ROLES_APROBADOR_ESPECIAL.filter((r) => r.valor !== "GERENTE_RRHH");
  const accesoHrefs = form.watch("accesoHrefs");

  function alternarItem(href: string, marcado: boolean) {
    const actual = form.getValues("accesoHrefs");
    form.setValue(
      "accesoHrefs",
      marcado ? Array.from(new Set([...actual, href])) : actual.filter((h) => h !== href),
      { shouldValidate: true }
    );
  }

  function alternarGrupo(hrefsGrupo: string[], marcarTodo: boolean) {
    const actual = form.getValues("accesoHrefs");
    const sinGrupo = actual.filter((h) => !hrefsGrupo.includes(h));
    form.setValue("accesoHrefs", marcarTodo ? [...sinGrupo, ...hrefsGrupo] : sinGrupo, { shouldValidate: true });
  }

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
    toast.success(
      `Usuario creado. Comparte su DNI (${data.dni}) y la contraseña "${data.password}" con ${data.nombres} por un canal seguro — le va a pedir cambiarla al ingresar.`
    );
    router.push("/usuarios/lista");
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
            <Label htmlFor="dni">DNI</Label>
            <Input id="dni" inputMode="numeric" maxLength={8} placeholder="12345678" {...form.register("dni")} />
            <p className="text-xs text-muted-foreground">Es con lo que va a iniciar sesión.</p>
            {form.formState.errors.dni && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.dni.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono">Teléfono (opcional)</Label>
            <Input id="telefono" {...form.register("telefono")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cargo">Cargo (opcional)</Label>
            <Input id="cargo" placeholder="p. ej. Gerente de Producción" {...form.register("cargo")} />
            <p className="text-xs text-muted-foreground">
              Aparece junto a su nombre en el PDF de las solicitudes/órdenes que apruebe.
            </p>
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
                    <SelectItem value="APROBADOR">Usuario aprobador (de su área)</SelectItem>
                    <SelectItem value="APROBADOR_GENERAL">Aprobador general (sin restricción de área)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              {tipoRol === "APROBADOR"
                ? "Además de ver solo su área, podrá aprobar/rechazar las solicitudes y órdenes de esa área."
                : tipoRol === "APROBADOR_GENERAL"
                  ? "Puede aprobar/rechazar cualquier Solped y firmar cualquier OC/OS en el rol especial que ocupe, de cualquier área."
                  : "Puede crear solicitudes y órdenes, pero solo ve y gestiona las de su área."}
            </p>
          </div>

          {tipoRol === "APROBADOR_GENERAL" && (
            <div className="space-y-2">
              <Label>Rol especial</Label>
              <Controller
                control={form.control}
                name="rolEspecial"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {rolesEspecialesAsignables.map((r) => (
                        <SelectItem key={r.valor} value={r.valor}>
                          {r.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Determina qué firma cubre en las OC/OS (ver &quot;Aprobadores por área&quot; para reasignarlo después).
              </p>
              {form.formState.errors.rolEspecial && (
                <p className="text-sm font-medium text-destructive">{form.formState.errors.rolEspecial.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Área</Label>
            <Controller
              control={form.control}
              name="area"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
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
            <p className="text-xs text-muted-foreground">
              Acota qué solicitudes y órdenes puede ver este usuario, sea o no aprobador.
            </p>
            {form.formState.errors.area && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.area.message}</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center gap-2">
              <Controller
                control={form.control}
                name="esComprador"
                render={({ field }) => (
                  <Checkbox id="esComprador" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                )}
              />
              <Label htmlFor="esComprador" className="font-normal">
                Comprador
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Único rol que puede crear/editar Órdenes de compra y servicio y &quot;cerrar posición&quot; (Solped y OC/OS).
              Sin esto, el usuario solo puede VER una orden a la que llegue (p. ej. por seguimiento de su Solped), sin
              poder modificarla.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acceso a módulos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Marca exactamente qué módulos y submódulos del menú lateral podrá ver y usar este usuario. Si marcas
            solo algunos submódulos de un módulo, solo esos quedan disponibles — no hace falta marcarlos todos.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {GRUPOS_ACCESO_ASIGNABLE.map((grupo) => {
            const hrefsGrupo = grupo.items.map((item) => item.href);
            const marcadosDelGrupo = hrefsGrupo.filter((h) => accesoHrefs.includes(h));
            const todoMarcado = marcadosDelGrupo.length === hrefsGrupo.length;
            return (
              <div key={grupo.modulo} className="rounded-lg border p-4">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <Checkbox checked={todoMarcado} onCheckedChange={(v) => alternarGrupo(hrefsGrupo, v === true)} />
                  {grupo.titulo}
                  <span className="font-normal text-muted-foreground">
                    ({marcadosDelGrupo.length}/{hrefsGrupo.length})
                  </span>
                </label>
                <div className="mt-3 grid grid-cols-1 gap-2 pl-6 sm:grid-cols-2 lg:grid-cols-3">
                  {grupo.items.map((item) => (
                    <label key={item.href} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={accesoHrefs.includes(item.href)}
                        onCheckedChange={(v) => alternarItem(item.href, v === true)}
                      />
                      {item.titulo}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          {form.formState.errors.accesoHrefs && (
            <p className="text-sm font-medium text-destructive">{form.formState.errors.accesoHrefs.message}</p>
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
