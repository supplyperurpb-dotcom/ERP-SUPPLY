import { z } from "zod";

// Acepta el DNI (8 dígitos) o, para cuentas que todavía no tienen uno
// asignado, el correo de siempre — loginAction decide cuál es mirando si
// trae "@". No se valida el formato acá a propósito (si se exigiera "8
// dígitos o email", una cuenta sin DNI que escribe mal su correo vería un
// mensaje de formato en vez de "credenciales inválidas", revelando de más).
export const loginSchema = z.object({
  identificador: z.string().min(1, "El DNI o correo es obligatorio"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Cambio de contraseña obligatorio (primer ingreso o después de que un
// admin se la resetee) — ver /cambiar-password y debeCambiarPassword en
// el modelo Usuario.
export const cambiarPasswordPropiaSchema = z
  .object({
    nuevaPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmarPassword: z.string().min(1, "Confirma la nueva contraseña"),
  })
  .refine((d) => d.nuevaPassword === d.confirmarPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmarPassword"],
  });

export type CambiarPasswordPropiaInput = z.infer<typeof cambiarPasswordPropiaSchema>;
