import { Sprout } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Sprout className="h-8 w-8 text-primary" />
          <h1 className="text-lg font-semibold">Sistema Arándanos</h1>
          <p className="text-sm text-muted-foreground">Gestión integral · Ica, Perú</p>
        </div>
        {children}
      </div>
    </div>
  );
}
