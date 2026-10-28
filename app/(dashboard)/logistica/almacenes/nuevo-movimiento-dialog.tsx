"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ChevronLeft, PackageMinus, PackagePlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AlmacenCategoriaGeneral } from "@prisma/client";

type TipoMovimiento = "INGRESO" | "TRASLADO" | "CONSUMO";

const CATEGORIAS: { valor: AlmacenCategoriaGeneral; etiqueta: string }[] = [
  { valor: "PESTICIDAS", etiqueta: "Pesticidas" },
  { valor: "FERTILIZANTES", etiqueta: "Fertilizantes" },
  { valor: "COMBUSTIBLE", etiqueta: "Combustible" },
  { valor: "SUMINISTROS", etiqueta: "Suministros" },
  { valor: "EMPAQUES", etiqueta: "Empaques" },
];

const RUTA_BASE: Record<TipoMovimiento, string> = {
  INGRESO: "/logistica/almacenes/ingresos/nuevo",
  TRASLADO: "/logistica/almacenes/traslados/nuevo",
  CONSUMO: "/logistica/almacenes/consumos/nuevo",
};

type AlmacenOpcion = { id: string; nombre: string; categoriaGeneral: AlmacenCategoriaGeneral | null; esGeneral: boolean };

// Selector en 3 pasos: tipo de movimiento -> categoría de almacén -> almacén
// puntual dentro de esa categoría. El Ingreso solo puede registrarse en un
// almacén general (ver crearIngresoAlmacenAction) — como ahora todos los
// almacenes nuevos se crean como generales, en la práctica no filtra nada,
// pero se deja la validación por si en el futuro se vuelve a usar la
// jerarquía general/sub-almacén.
export function NuevoMovimientoDialog({ almacenes }: { almacenes: AlmacenOpcion[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoMovimiento | null>(null);
  const [categoria, setCategoria] = useState<AlmacenCategoriaGeneral | null>(null);

  function cerrar() {
    setOpen(false);
    setTipo(null);
    setCategoria(null);
  }

  function irA(almacenId: string) {
    if (!tipo) return;
    const href = `${RUTA_BASE[tipo]}?almacenId=${almacenId}`;
    cerrar();
    router.push(href);
  }

  const almacenesDeCategoria = categoria
    ? almacenes.filter((a) => a.categoriaGeneral === categoria && (tipo !== "INGRESO" || a.esGeneral))
    : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setTipo(null);
          setCategoria(null);
        }
      }}
    >
      <Button
        onClick={() => {
          setOpen(true);
          setTipo(null);
          setCategoria(null);
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

        {tipo !== null && categoria === null && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTipo(null)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                Elige la categoría
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {CATEGORIAS.map((c) => (
                <Button
                  key={c.valor}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setCategoria(c.valor)}
                >
                  {c.etiqueta}
                </Button>
              ))}
            </div>
          </>
        )}

        {tipo !== null && categoria !== null && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCategoria(null)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                Elige el almacén de {CATEGORIAS.find((c) => c.valor === categoria)?.etiqueta}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {almacenesDeCategoria.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay almacenes activos en esta categoría.</p>
              )}
              {almacenesDeCategoria.map((a) => (
                <Button key={a.id} variant="outline" className="w-full justify-start" onClick={() => irA(a.id)}>
                  {a.nombre}
                </Button>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
