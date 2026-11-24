import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { RegistroRechazoForm } from "./registro-rechazo-form";

export default function NuevoRegistroRechazoPage() {
  return (
    <div>
      <Link href="/comex/registro-rechazos" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Volver a Registro de Rechazos
      </Link>
      <PageHeader
        titulo="Nueva importación de Rechazo"
        descripcion="Sube la captura del correo (PNG/JPG/WEBP). Se lee por OCR en el navegador, se cruza por LPN con los Packing List ya importados y puedes editar lo que no se haya reconocido antes de confirmar."
      />
      <RegistroRechazoForm />
    </div>
  );
}
