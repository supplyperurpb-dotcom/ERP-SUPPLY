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
};

export default nextConfig;
