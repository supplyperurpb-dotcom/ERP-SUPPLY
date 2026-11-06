"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Banner "Instala la app en tu pantalla" (Chrome/Edge disparan
// beforeinstallprompt cuando la PWA es instalable) y banner "Hay una
// nueva versión de la plataforma" (cuando el service worker detecta una
// versión nueva ya instalada, esperando a que el usuario confirme antes
// de activarla y recargar). Montado una sola vez en el layout raíz.
export function PwaBanners() {
  const [eventoInstalar, setEventoInstalar] = useState<BeforeInstallPromptEvent | null>(null);
  const [mostrarInstalar, setMostrarInstalar] = useState(false);
  const [mostrarActualizar, setMostrarActualizar] = useState(false);
  const workerEnEspera = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    function alDispararInstalacion(e: Event) {
      e.preventDefault();
      setEventoInstalar(e as BeforeInstallPromptEvent);
      setMostrarInstalar(true);
    }
    function alInstalar() {
      setMostrarInstalar(false);
      setEventoInstalar(null);
    }
    window.addEventListener("beforeinstallprompt", alDispararInstalacion);
    window.addEventListener("appinstalled", alInstalar);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registro) => {
          // Si ya hay un SW controlando la página y aparece otro "waiting",
          // es una actualización real (no la primera instalación).
          if (registro.waiting && navigator.serviceWorker.controller) {
            workerEnEspera.current = registro.waiting;
            setMostrarActualizar(true);
          }
          registro.addEventListener("updatefound", () => {
            const nuevo = registro.installing;
            if (!nuevo) return;
            nuevo.addEventListener("statechange", () => {
              if (nuevo.state === "installed" && navigator.serviceWorker.controller) {
                workerEnEspera.current = nuevo;
                setMostrarActualizar(true);
              }
            });
          });
        })
        .catch(() => {});

      let recargando = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (recargando) return;
        recargando = true;
        window.location.reload();
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", alDispararInstalacion);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  async function instalar() {
    if (!eventoInstalar) return;
    await eventoInstalar.prompt();
    await eventoInstalar.userChoice;
    setEventoInstalar(null);
    setMostrarInstalar(false);
  }

  function actualizar() {
    workerEnEspera.current?.postMessage({ type: "SKIP_WAITING" });
    setMostrarActualizar(false);
  }

  if (mostrarActualizar) {
    return (
      <div className="flex items-center justify-center gap-3 bg-emerald-600 px-4 py-2 text-sm text-white">
        <RefreshCw className="h-4 w-4 shrink-0" />
        <span>Hay una nueva versión de la plataforma</span>
        <button
          onClick={actualizar}
          className="rounded-full bg-white px-4 py-1 font-medium text-emerald-700 hover:bg-emerald-50"
        >
          Actualizar ahora
        </button>
      </div>
    );
  }

  if (mostrarInstalar) {
    return (
      <div className="flex items-center justify-center gap-3 bg-emerald-600 px-4 py-2 text-sm text-white">
        <Download className="h-4 w-4 shrink-0" />
        <span>Instala la app en tu pantalla</span>
        <button
          onClick={instalar}
          className="rounded-full bg-white px-4 py-1 font-medium text-emerald-700 hover:bg-emerald-50"
        >
          Instalar
        </button>
        <button onClick={() => setMostrarInstalar(false)} aria-label="Cerrar" className="text-white/80 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return null;
}
