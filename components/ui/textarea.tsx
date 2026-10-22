import * as React from "react";
import { cn } from "@/lib/utils";
import { forzarMayusculaEnCambio } from "./forzar-mayuscula";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  // Ver forzar-mayuscula.ts — un textarea puntual puede pedir no
  // convertir a mayúscula con preserveCase.
  preserveCase?: boolean;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, onChange, preserveCase, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        onChange={(e) => {
          if (!preserveCase) forzarMayusculaEnCambio(e);
          onChange?.(e);
        }}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
