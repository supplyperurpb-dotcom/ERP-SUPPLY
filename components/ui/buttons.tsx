import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Alias semánticos sobre el Button existente (variant=default ya usa
 * --primary, la paleta corporativa). No duplican estilos: cada uno solo
 * fija el variant/size correcto para su propósito.
 */
export function PrimaryButton(props: Omit<ButtonProps, "variant">) {
  return <Button variant="default" {...props} />;
}

export function SecondaryButton(props: Omit<ButtonProps, "variant">) {
  return <Button variant="secondary" {...props} />;
}

export function DangerButton(props: Omit<ButtonProps, "variant">) {
  return <Button variant="destructive" {...props} />;
}

/** Botón solo-ícono (size=icon), variant="ghost" por defecto — el uso más común en tablas (editar/eliminar). */
export function IconButton({ variant = "ghost", ...props }: Omit<ButtonProps, "size">) {
  return <Button variant={variant} size="icon" {...props} />;
}
