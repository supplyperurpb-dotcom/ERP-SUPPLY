"use client";

import { useState, useTransition } from "react";
import { Plus, Power } from "lucide-react";
import { toast } from "sonner";
import type { Familia, Subfamilia } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  crearFamiliaAction,
  crearSubfamiliaAction,
  cambiarActivoFamiliaAction,
  cambiarActivoSubfamiliaAction,
} from "@/lib/actions/familia-actions";

type FamiliaConSubfamilias = Familia & { subfamilias: Subfamilia[] };

export function CategoriasView({ familias }: { familias: FamiliaConSubfamilias[] }) {
  const [isPending, startTransition] = useTransition();

  function handleToggleFamilia(f: Familia) {
    startTransition(async () => {
      const resultado = await cambiarActivoFamiliaAction(f.id, !f.activo);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(f.activo ? `"${f.nombre}" desactivada` : `"${f.nombre}" activada`);
    });
  }

  function handleToggleSubfamilia(s: Subfamilia) {
    startTransition(async () => {
      const resultado = await cambiarActivoSubfamiliaAction(s.id, !s.activo);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(s.activo ? `"${s.nombre}" desactivada` : `"${s.nombre}" activada`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <FamiliaFormDialog />
      </div>

      {familias.map((f) => (
        <Card key={f.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{f.nombre}</CardTitle>
              <Badge variant="outline">{f.prefijo}</Badge>
              <Badge variant={f.activo ? "success" : "secondary"}>{f.activo ? "Activa" : "Inactiva"}</Badge>
              <Button variant="ghost" size="icon" disabled={isPending} onClick={() => handleToggleFamilia(f)}>
                <Power className="h-4 w-4" />
              </Button>
            </div>
            <SubfamiliaFormDialog familiaId={f.id} familiaNombre={f.nombre} />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subfamilia</TableHead>
                  <TableHead>Prefijo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {f.subfamilias.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Aún no hay subfamilias. Crea la primera.
                    </TableCell>
                  </TableRow>
                )}
                {f.subfamilias.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nombre}</TableCell>
                    <TableCell>{s.prefijo ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.activo ? "success" : "secondary"}>{s.activo ? "Activa" : "Inactiva"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" disabled={isPending} onClick={() => handleToggleSubfamilia(s)}>
                        <Power className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FamiliaFormDialog() {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [prefijo, setPrefijo] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const resultado = await crearFamiliaAction({ nombre, prefijo });
      if (resultado?.error) {
        setError(resultado.error);
        return;
      }
      toast.success("Familia creada");
      setOpen(false);
      setNombre("");
      setPrefijo("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nueva familia
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva familia</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="familia-nombre">Nombre</Label>
            <Input id="familia-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="familia-prefijo">Prefijo del código (2 letras)</Label>
            <Input
              id="familia-prefijo"
              value={prefijo}
              onChange={(e) => setPrefijo(e.target.value.toUpperCase())}
              maxLength={6}
              required
            />
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubfamiliaFormDialog({ familiaId, familiaNombre }: { familiaId: string; familiaNombre: string }) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [prefijo, setPrefijo] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const resultado = await crearSubfamiliaAction({ familiaId, nombre, prefijo });
      if (resultado?.error) {
        setError(resultado.error);
        return;
      }
      toast.success("Subfamilia creada");
      setOpen(false);
      setNombre("");
      setPrefijo("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nueva subfamilia
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva subfamilia de {familiaNombre}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subfamilia-nombre">Nombre</Label>
            <Input
              id="subfamilia-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subfamilia-prefijo">Prefijo del código (2 letras, opcional)</Label>
            <Input
              id="subfamilia-prefijo"
              value={prefijo}
              onChange={(e) => setPrefijo(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="Se deriva del nombre si se deja vacío"
            />
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
