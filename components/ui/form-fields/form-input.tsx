import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { FormField } from "./form-field";

export type FormInputProps = InputProps & {
  label?: string;
  error?: string;
  required?: boolean;
  description?: string;
};

/**
 * Input + FormField en uno. Compatible con react-hook-form: acepta ref,
 * así que funciona con `{...form.register("campo")}` igual que un
 * `<Input>` suelto.
 *
 * @example
 * <FormInput label="Nombre del conductor" required {...form.register("nombre")} error={errors.nombre?.message} />
 */
export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, required, description, id, ...props }, ref) => (
    <FormField label={label} htmlFor={id} required={required} error={error} description={description}>
      <Input id={id} ref={ref} aria-invalid={!!error} {...props} />
    </FormField>
  )
);
FormInput.displayName = "FormInput";
