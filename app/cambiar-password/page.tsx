import Image from "next/image";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth/session";
import { CambiarPasswordForm } from "./cambiar-password-form";

// Pantalla de cambio de contraseña obligatorio — no vive bajo
// (dashboard) a propósito: mientras usuario.debeCambiarPassword sea
// true, el layout del dashboard redirige acá (ver
// app/(dashboard)/layout.tsx), así que esta página no debe depender de
// ese mismo layout ni mostrar el sidebar normal.
export default async function CambiarPasswordPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");
  if (!usuario.debeCambiarPassword) redirect("/inicio");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="relative h-16 w-16">
            <Image src="/logo-rpb.jpg" alt="Logo de ERP Supply Chain" fill sizes="64px" className="object-contain" />
          </div>
          <h1 className="text-lg font-semibold">ERP Supply Chain</h1>
          <p className="text-sm text-muted-foreground">Gestión integral · Ica, Perú</p>
        </div>
        <CambiarPasswordForm />
      </div>
    </div>
  );
}
