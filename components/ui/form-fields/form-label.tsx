import * as React from "react";
import { Label } from "@/components/ui/label";

/** Label con asterisco opcional para campos obligatorios. */
export function FormLabel({
  required,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof Label> & { required?: boolean }) {
  return (
    <Label {...props}>
      {children}
      {required && (
        <span className="ml-0.5 text-destructive" aria-hidden="true">
          *
        </span>
      )}
    </Label>
  );
}
