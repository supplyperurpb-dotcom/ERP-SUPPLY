import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "./form-field";

export type FormSelectOption = { value: string; label: string; disabled?: boolean };

/**
 * Select (shadcn/Radix) + FormField en uno. A diferencia de FormInput,
 * no se usa con `register()` — el Select de Radix no es un input nativo,
 * así que se controla con value/onValueChange (el mismo patrón que ya
 * usa el resto de la app vía `Controller` de react-hook-form).
 *
 * @example
 * <Controller
 *   control={form.control}
 *   name="proveedorId"
 *   render={({ field }) => (
 *     <FormSelect label="Proveedor" required value={field.value} onValueChange={field.onChange}
 *       options={proveedores.map((p) => ({ value: p.id, label: p.razonSocial }))} />
 *   )}
 * />
 */
export function FormSelect({
  label,
  error,
  required,
  description,
  id,
  name,
  value,
  onValueChange,
  placeholder = "Selecciona...",
  options,
  disabled,
}: {
  label?: string;
  error?: string;
  required?: boolean;
  description?: string;
  id?: string;
  /** Solo necesario si el Select se envía vía `<form action={...}>` nativo (sin react-hook-form). */
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  options: FormSelectOption[];
  disabled?: boolean;
}) {
  return (
    <FormField label={label} htmlFor={id} required={required} error={error} description={description}>
      <Select name={name} value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id={id} aria-invalid={!!error}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}
