"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** Recuadro de firma táctil/mouse: dibuja en un <canvas> y entrega el trazo como PNG (File) vía onChange. */
export function FirmaCanvas({ onChange }: { onChange: (archivo: File | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const vacio = useRef(true);
  const [tieneTrazo, setTieneTrazo] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Resolución real = tamaño visible x devicePixelRatio, para que la
    // firma no se vea pixelada en pantallas de celular.
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#111827";
    }
  }, []);

  function posicion(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = posicion(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = posicion(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    vacio.current = false;
    setTieneTrazo(true);
  }

  function handlePointerUp() {
    dibujando.current = false;
    exportar();
  }

  function exportar() {
    const canvas = canvasRef.current;
    if (!canvas || vacio.current) {
      onChange(null);
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      onChange(new File([blob], "firma.png", { type: "image/png" }));
    }, "image/png");
  }

  function limpiar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const ratio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    vacio.current = true;
    setTieneTrazo(false);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="h-40 w-full touch-none rounded-md border bg-white"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Firma con el dedo o el mouse en el recuadro de arriba.</p>
        <Button type="button" variant="outline" size="sm" onClick={limpiar} disabled={!tieneTrazo}>
          Limpiar
        </Button>
      </div>
    </div>
  );
}
