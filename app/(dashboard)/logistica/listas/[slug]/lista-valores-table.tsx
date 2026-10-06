"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Power } from "lucide-react";
import { toast } from "sonner";
import type { ListaValor } from "@prisma/client";
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
import { crearListaValorAction, renombrarListaValorAction, toggleActivoListaValorAction } from "@/lib/actions/lista-actions";
import type { TipoListaCodigo } from "@/lib/constants/listas";

export function ListaValoresTable({
  tipo,
  valores,
  nombreSingular,
}: {
  tipo: TipoListaCodigo;
  valores: ListaValor[];
  nombreSingular: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(valor: ListaValor) {
    startTransition(async () => {
      const resultado = await toggleActivoListaValorAction(valor.id);
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(valor.activo ? `"${valor.nombre}" desactivado` : `"${valor.nombre}" activado`);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Valores</CardTitle>
        <ValorFormDialog tipo={tipo} nombreSingular={nombreSingular} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {valores.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Aún no hay valores. Crea el primero.
                </TableCell>
              </TableRow>
            )}
            {valores.map((valor) => (
              <TableRow key={valor.id}>
                <TableCell className="font-medium">{valor.nombre}</TableCell>
                <TableCell>
                  <Badge variant={valor.activo ? "success" : "secondary"}>{valor.activo ? "Activo" : "Inactivo"}</Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <ValorFormDialog tipo={tipo} nombreSingular={nombreSingular} valor={valor} />
                  <Button variant="ghost" size="icon" disabled={isPending} onClick={() => handleToggle(valor)}>
                    <Power className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ValorFormDialog({
  tipo,
  nombreSingular,
  valor,
}: {
  tipo: TipoListaCodigo;
  nombreSingular: string;
  valor?: ListaValor;
}) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState(valor?.nombre ?? "");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const esEdicion = !!valor;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const resultado = esEdicion
        ? await renombrarListaValorAction({ id: valor.id, nombre })
        : await crearListaValorAction({ tipo, nombre });
      if (resultado?.error) {
        setError(resultado.error);
        return;
      }
      toast.success(esEdicion ? "Valor actualizado" : "Valor creado");
      setOpen(false);
      if (!esEdicion) setNombre("");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setNombre(valor?.nombre ?? "");
          setError(undefined);
        }
      }}
    >
      <DialogTrigger asChild>
        {esEdicion ? (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo {nombreSingular}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{esEdicion ? `Editar ${nombreSingular}` : `Nuevo ${nombreSingular}`}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
