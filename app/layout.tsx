import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { PwaBanners } from "@/components/shared/pwa-banners";
import "./globals.css";

// Identidad tipográfica (Fase 3 — identidad visual): IBM Plex Sans para
// todo el texto de UI (pensada para software empresarial denso en datos,
// no el system-ui/Inter por defecto) + IBM Plex Mono reservada para
// códigos reales (SKU, placas, DNI, documentos — ver DESIGN_SYSTEM.md).
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ERP Supply Chain | Ica",
  description: "Sistema de gestión integral para productora y exportadora de arándanos",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport = {
  themeColor: "#4C3A8C",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="font-sans antialiased">
        <PwaBanners />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
