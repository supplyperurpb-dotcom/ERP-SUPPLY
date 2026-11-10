-- Login por DNI + cambio de contraseña obligatorio (nueva cuenta o
-- reseteo por un admin). Aditiva: agrega columnas, sin tocar nada
-- existente.

ALTER TABLE "usuarios" ADD COLUMN "dni" TEXT;
CREATE UNIQUE INDEX "usuarios_dni_key" ON "usuarios"("dni");

ALTER TABLE "usuarios" ADD COLUMN "debeCambiarPassword" BOOLEAN NOT NULL DEFAULT true;

-- Las cuentas que ya existían antes de este campo no deben quedar
-- forzadas a cambiar su contraseña de golpe: solo aplica para cuentas
-- nuevas (ya tienen el default true) y para resets de contraseña desde
-- ahora en adelante (editarUsuarioAction los pone en true explícitamente).
UPDATE "usuarios" SET "debeCambiarPassword" = false;
