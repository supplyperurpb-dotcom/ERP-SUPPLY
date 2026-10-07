"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, PackageMinus, PackagePlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type TipoMovimiento = "INGRESO" | "TRASLADO" | "CONSUMO";

export function NuevoMovimientoDialog({
  almacenesGenerales,
  almacenesTodos,
  solicitudesTraslado,
}: {
  almacenesGenerales: { id: string; nombre: string }[];
  almacenesTodos: { id: string; nombre: string }[];
  solicitudesTraslado: { id: string; numero: string; almacenOrigenNombre: string; almacenDestinoNombre: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoMovimiento | null>(null);

  function cerrar() {
    setOpen(false);
    setTipo(null);
  }

  function irA(href: string) {
    cerrar();
    router.push(href);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setTipo(null);
      }}
    >
      <Button
        onClick={() => {
          setOpen(true);
          setTipo(null);
        }}
      >
        <Plus className="mr-2 h-4 w-4" />
        Nuevo Movimiento
      </Button>
      <DialogContent className="sm:max-w-lg">
        {tipo === null && (
          <>
            <DialogHeader>
              <DialogTitle>¿Qué movimiento quieres registrar?</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card
                className="cursor-pointer transition-colors hover:border-primary hover:bg-accent/40"
                onClick={() => setTipo("INGRESO")}
              >
                <CardHeader className="items-center text-center">
                  <PackagePlus className="mb-2 h-6 w-6 text-primary" />
                  <CardTitle className="text-sm">Ingreso</CardTitle>
                </CardHeader>
              </Card>
              <Card
                className="cursor-pointer transition-colors hover:border-primary hover:bg-accent/40"
                onClick={() => setTipo("TRASLADO")}
              >
                <CardHeader className="items-center text-center">
                  <ArrowLeftRight className="mb-2 h-6 w-6 text-primary" />
                  <CardTitle className="text-sm">Traslado</CardTitle>
                </CardHeader>
              </Card>
              <Card
                className="cursor-pointer transition-colors hover:border-primary hover:bg-accent/40"
                onClick={() => setTipo("CONSUMO")}
              >
                <CardHeader className="items-center text-center">
                  <PackageMinus className="mb-2 h-6 w-6 text-primary" />
                  <CardTitle className="text-sm">Consumo</CardTitle>
                </CardHeader>
              </Card>
            </div>
          </>
        )}

        {tipo === "INGRESO" && (
          <>
            <DialogHeader>
              <DialogTitle>Ingreso — elige el almacén general</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {almacenesGenerales.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay almacenes generales activos.</p>
              )}
              {almacenesGenerales.map((a) => (
                <Button
                  key={a.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => irA(`/logistica/almacenes/ingresos/nuevo?almacenId=${a.id}`)}
                >
                  {a.nombre}
                </Button>
              ))}
            </div>
          </>
        )}

        {tipo === "CONSUMO" && (
          <>
            <DialogHeader>
              <DialogTitle>Consumo — elige el almacén</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {almacenesTodos.length === 0 && <p className="text-sm text-muted-foreground">No hay almacenes activos.</p>}
              {almacenesTodos.map((a) => (
                <Button
                  key={a.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => irA(`/logistica/almacenes/consumos/nuevo?almacenId=${a.id}`)}
                >
                  {a.nombre}
                </Button>
              ))}
            </div>
          </>
        )}

        {tipo === "TRASLADO" && (
          <>
            <DialogHeader>
              <DialogTitle>Traslado — elige la solicitud pendiente</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {solicitudesTraslado.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No hay solicitudes de traslado pendientes de ejecutar. Créala primero desde Solicitudes de traslado.
                </p>
              )}
              {solicitudesTraslado.map((s) => (
                <Button
                  key={s.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => irA(`/logistica/almacenes/traslados/nuevo?solicitudId=${s.id}`)}
                >
                  {s.numero} — {s.almacenOrigenNombre} → {s.almacenDestinoNombre}
                </Button>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
