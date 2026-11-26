import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";
import { obtenerUrlFirmadaArchivo } from "@/lib/storage";
import { RechazoItemsTabla } from "./rechazo-items-tabla";

export default async function DetalleRechazoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const correo = await prisma.rechazoCorreo.findUnique({
    where: { id },
    include: {
      embarque: { select: { numero: true, shipNumber: true } },
      items: { include: { embarquePallet: { select: { palletNumber: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!correo) notFound();

  // Si el archivo ya no existe en el storage (borrado o nunca llegó a
  // subirse bien), no debe tumbar toda la página — solo se deja de
  // mostrar la captura, en vez de un error genérico sin explicación.
  let urlImagen: string | null = null;
  try {
    urlImagen = await obtenerUrlFirmadaArchivo(correo.archivoOriginalUrl, 300);
  } catch (e) {
    console.error(`No se pudo generar la URL firmada de ${correo.archivoOriginalUrl}:`, e);
  }
  const items = correo.items.map((it) => ({
    id: it.id,
    lpn: it.lpn,
    itemCode: it.itemCode,
    descripcionSku: it.descripcionSku,
    variedad: it.variedad,
    palletNumber: it.embarquePallet?.palletNumber ?? null,
    cajasOriginales: it.cajasOriginales,
    cajasRechazadas: it.cajasRechazadas,
    categoriaFinal: it.categoriaFinal,
    estado: it.estado,
    alertaLpnNoEncontrado: it.alertaLpnNoEncontrado,
    alertaVariedadNoCoincide: it.alertaVariedadNoCoincide,
    alertaExcedeOriginales: it.alertaExcedeOriginales,
  }));

  return (
    <div>
      <Link href="/comex/registro-rechazos" className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Volver a Registro de Rechazos
      </Link>
      <PageHeader
        titulo={correo.asuntoCorreo ?? "Rechazo"}
        descripcion={`${correo.embarque ? `Embarque ${correo.embarque.numero} (${correo.embarque.shipNumber}) · ` : ""}${
          correo.fechaCorreo ? `Correo del ${formatDate(correo.fechaCorreo)}` : ""
        }`}
      />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Captura original</CardTitle>
          </CardHeader>
          <CardContent>
            {urlImagen ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagen firmada temporal, no apta para el optimizador de next/image
              <img src={urlImagen} alt="Captura del correo de rechazo" className="w-full rounded-md border" />
            ) : (
              <p className="text-sm text-muted-foreground">
                El archivo original ya no está disponible en el almacenamiento.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Datos del correo</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Dato etiqueta="PO / N.º de orden" valor={correo.poNumber} />
            <Dato etiqueta="Remitente" valor={correo.remitente} />
            <Dato etiqueta="Total pallets (correo)" valor={correo.totalPalletsCorreo?.toString() ?? null} />
            <Dato etiqueta="Total cajas (correo)" valor={correo.totalCajasRechazadasCorreo?.toString() ?? null} />
          </CardContent>
        </Card>
      </div>

      <RechazoItemsTabla items={items} />
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="font-medium">{valor || "—"}</p>
    </div>
  );
}
