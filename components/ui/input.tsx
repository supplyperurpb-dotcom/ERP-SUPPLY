import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, onWheel, onKeyDown, ...props }, ref) => {
    const esNumero = type === "number";
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          // Un campo numérico solo cambia borrando y escribiendo: sin
          // flechitas de spinner, sin que la rueda del mouse o las flechas
          // del teclado lo suban o bajen por accidente.
          esNumero && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
        onWheel={
          esNumero
            ? (e) => {
                e.currentTarget.blur();
                onWheel?.(e);
              }
            : onWheel
        }
        onKeyDown={
          esNumero
            ? (e) => {
                if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
                onKeyDown?.(e);
              }
            : onKeyDown
        }
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
