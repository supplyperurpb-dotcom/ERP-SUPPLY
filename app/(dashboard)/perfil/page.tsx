import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsuarioActual } from "@/lib/auth/session";
import { GERENCIAS_SOLPED } from "@/lib/constants/compras";
import { VacacionesBoton } from "./vacaciones-boton";

export default async function PerfilPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");

  const gerencia = GERENCIAS_SOLPED.find((g) => g.valor === usuario.area)?.nombre ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader titulo="Perfil" descripcion="Tus datos registrados en el sistema." />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Datos del usuario</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Nombres</p>
            <p className="font-medium">{usuario.nombres}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Apellidos</p>
            <p className="font-medium">{usuario.apellidos}</p>
          </div>
          <div>
            <p className="text-muted-foreground">DNI</p>
            <p className="font-medium">{usuario.dni ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Correo</p>
            <p className="font-medium">{usuario.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Gerencia</p>
            <p className="font-medium">{gerencia}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Área</p>
            <p className="font-medium">{usuario.areaDetalle ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Vacaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Si eres aprobador especial de Órdenes de Compra/Servicio (Gerente de Supply Chain, District Controller o
            Gerencia General), mientras estés de vacaciones tus aprobaciones pendientes las resuelve tu reemplazo:
            Gerente de Supply Chain → District Controller → Gerencia General.
          </p>
          <VacacionesBoton enVacaciones={usuario.enVacaciones} />
        </CardContent>
      </Card>
    </div>
  );
}
