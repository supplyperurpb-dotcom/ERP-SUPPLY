import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "El correo es obligatorio").email("Correo inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const recuperarPasswordSchema = z.object({
  email: z.string().min(1, "El correo es obligatorio").email("Correo inválido"),
});

export type RecuperarPasswordInput = z.infer<typeof recuperarPasswordSchema>;
