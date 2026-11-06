import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/** Checkbox + label en línea (a diferencia de los demás Form*, el label va al lado, no arriba). */
export function FormCheckbox({
  id,
  label,
  checked,
  onCheckedChange,
  error,
  disabled,
}: {
  id: string;
  label?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Checkbox id={id} checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} disabled={disabled} />
        {label && (
          <Label htmlFor={id} className="cursor-pointer font-normal">
            {label}
          </Label>
        )}
      </div>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
