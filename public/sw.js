// Service worker mínimo: no cachea nada (esta app siempre necesita datos
// en vivo de Supabase/Prisma, no tiene sentido funcionar offline), solo
// existe para que el navegador permita instalar la PWA y para avisar
// cuando hay una versión nueva desplegada (ver components/shared/pwa-banners.tsx).

// No se llama a skipWaiting() acá: se espera a que el usuario confirme
// "Actualizar ahora" para no cambiarle la versión de la app a mitad de
// una tarea sin avisar.
self.addEventListener("install", () => {});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Sin caché propio: deja pasar todas las peticiones tal cual.
self.addEventListener("fetch", () => {});
