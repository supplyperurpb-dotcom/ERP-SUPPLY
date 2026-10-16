import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="relative h-16 w-16">
            <Image
              src="/logo-rpb.jpg"
              alt="Logo de ERP Supply Chain"
              fill
              sizes="64px"
              className="object-contain"
            />
          </div>
          <h1 className="text-lg font-semibold">ERP Supply Chain</h1>
          <p className="text-sm text-muted-foreground">Gestión integral · Ica, Perú</p>
        </div>
        {children}
      </div>
    </div>
  );
}
