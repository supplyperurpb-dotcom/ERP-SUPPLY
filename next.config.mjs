/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Provocó varios crashes del dev server en este entorno ("Could not
    // find the module ...segment-explorer-node.js#SegmentViewNode" /
    // "__webpack_modules__[moduleId] is not a function"), reproducibles
    // tras varios ciclos de Fast Refresh. Es una herramienta de DevTools,
    // no afecta build de producción ni funcionalidad de la app.
    devtoolSegmentExplorer: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  webpack: (config, { dev }) => {
    // El caché persistente de webpack en disco (.next/cache/webpack) se
    // corrompió varias veces en este entorno durante `next dev`
    // ("Cannot find module './NNN.js'", manifests desincronizados),
    // tumbando rutas con 500 sin relación con los cambios de código.
    // Desactivarlo en dev cambia recompilar-desde-cero por no volver a
    // caerse — un cambio razonable frente a crashes recurrentes.
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
