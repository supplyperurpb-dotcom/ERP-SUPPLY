import * as React from "react";
import { Textarea, type TextareaProps } from "@/components/ui/textarea";
import { FormField } from "./form-field";

export type FormTextareaProps = TextareaProps & {
  label?: string;
  error?: string;
  required?: boolean;
  description?: string;
};

/** Textarea + FormField en uno. Compatible con `{...form.register("campo")}`. */
export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, required, description, id, ...props }, ref) => (
    <FormField label={label} htmlFor={id} required={required} error={error} description={description}>
      <Textarea id={id} ref={ref} aria-invalid={!!error} {...props} />
    </FormField>
  )
);
FormTextarea.displayName = "FormTextarea";
