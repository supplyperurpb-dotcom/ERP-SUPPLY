"use client";

import { Fragment, useState, useTransition } from "react";
import { Plus, Power } from "lucide-react";
import { toast } from "sonner";
import type { Familia, Subfamilia, Grupo } from "@prisma/client";
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
  crearGrupoAction,
  cambiarActivoGrupoAction,
} from "@/lib/actions/familia-actions";

type SubfamiliaConGrupos = Subfamilia & { grupos: Grupo[] };
type FamiliaConSubfamilias = Familia & { subfamilias: SubfamiliaConGrupos[] };

// Tercer nivel, debajo de Subfamilia — hoy solo tiene sentido (y datos)
// para la familia Suministros (pedido explícito del usuario), así que la
// fila de Grupos solo se muestra ahí.
const FAMILIA_CON_GRUPO = "Suministros";

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

  function handleToggleGrupo(g: Grupo) {
    startTransition(async () => {
      const resultado = await cambiarActivoGrupoAction(g.id, !g.activo);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(g.activo ? `"${g.nombre}" desactivado` : `"${g.nombre}" activado`);
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
                  <Fragment key={s.id}>
                    <TableRow>
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
                    {f.nombre === FAMILIA_CON_GRUPO && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={4}>
                          <div className="flex flex-wrap items-center gap-2 pl-4">
                            <span className="text-xs text-muted-foreground">Grupo:</span>
                            {s.grupos.length === 0 && (
                              <span className="text-xs text-muted-foreground">Sin grupos.</span>
                            )}
                            {s.grupos.map((g) => (
                              <Badge
                                key={g.id}
                                variant={g.activo ? "outline" : "secondary"}
                                className="flex items-center gap-1 cursor-pointer"
                                onClick={() => handleToggleGrupo(g)}
                              >
                                {g.nombre}
                                {!g.activo && " (inactivo)"}
                              </Badge>
                            ))}
                            <GrupoFormDialog subfamiliaId={s.id} subfamiliaNombre={s.nombre} />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
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

function GrupoFormDialog({ subfamiliaId, subfamiliaNombre }: { subfamiliaId: string; subfamiliaNombre: string }) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const resultado = await crearGrupoAction({ subfamiliaId, nombre });
      if (resultado?.error) {
        setError(resultado.error);
        return;
      }
      toast.success("Grupo creado");
      setOpen(false);
      setNombre("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
          <Plus className="mr-1 h-3 w-3" />
          Nuevo grupo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo grupo de {subfamiliaNombre}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="grupo-nombre">Nombre</Label>
            <Input id="grupo-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
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
