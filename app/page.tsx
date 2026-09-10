import { redirect } from "next/navigation";

// Punto de entrada: el middleware ya garantiza que solo llega aquí un
// usuario autenticado, así que redirigimos directo al home del dashboard.
export default function RootPage() {
  redirect("/inicio");
}
