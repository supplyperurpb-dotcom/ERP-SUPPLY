import type { Metadata } from "next";
import { Toaster } from "sonner";
import { PwaBanners } from "@/components/shared/pwa-banners";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP Supply Chain | Ica",
  description: "Sistema de gestión integral para productora y exportadora de arándanos",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport = {
  themeColor: "#073c92",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">
        <PwaBanners />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
