import * as React from "react";
import { cn } from "@/lib/utils";
import { FormLabel } from "./form-label";

/**
 * Layout base de un campo de formulario: label + control + mensaje de
 * error/descripción. Es lo que FormInput/FormSelect/FormTextarea/etc.
 * usan por dentro — también se puede usar solo, envolviendo cualquier
 * control a medida.
 */
export function FormField({
  label,
  htmlFor,
  required,
  error,
  description,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  /** Si viene, se muestra en rojo y oculta "description" (un campo no necesita las dos cosas a la vez). */
  error?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <FormLabel htmlFor={htmlFor} required={required}>
          {label}
        </FormLabel>
      )}
      {children}
      {error ? (
        <p className="text-sm font-medium text-destructive">{error}</p>
      ) : (
        description && <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
