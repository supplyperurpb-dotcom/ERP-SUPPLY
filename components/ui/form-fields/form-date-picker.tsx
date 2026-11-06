import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { FormField } from "./form-field";

export type FormDatePickerProps = Omit<InputProps, "type"> & {
  label?: string;
  error?: string;
  required?: boolean;
  description?: string;
};

/**
 * Input nativo `type="date"` + FormField. La app no usa un calendario
 * propio en ningún lado (siempre `<input type="date">`), así que este
 * componente sigue ese mismo criterio en vez de introducir una librería
 * de calendario nueva.
 */
export const FormDatePicker = React.forwardRef<HTMLInputElement, FormDatePickerProps>(
  ({ label, error, required, description, id, ...props }, ref) => (
    <FormField label={label} htmlFor={id} required={required} error={error} description={description}>
      <Input id={id} type="date" ref={ref} aria-invalid={!!error} {...props} />
    </FormField>
  )
);
FormDatePicker.displayName = "FormDatePicker";
