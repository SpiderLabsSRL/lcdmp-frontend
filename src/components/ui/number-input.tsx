import * as React from "react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export interface NumberInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type" | "onBlur"> {
  value: number | undefined | null;
  onChange: (value: number) => void;
  onBlur?: (value: number) => void;
  /** Allow decimal values (prices). Defaults to integers only (quantities/portions). */
  decimal?: boolean;
  /** Value applied when the field is left empty or invalid on blur. Defaults to 0. */
  fallback?: number;
}

const parse = (raw: string, decimal: boolean): number =>
  decimal ? parseFloat(raw) : parseInt(raw, 10);

// Un <input type="number"> controlado ingenuo (value={x || 0}, onChange con
// parseInt(...) || 0) hace que el campo "salte" de vuelta a su valor por
// defecto en cada tecla mientras está vacío/inválido — al usuario le parece
// que no puede borrar el número, o que escribir "2" después de borrar el "1"
// produce "12" (porque el campo ya volvió a mostrar "1" antes de que termine
// de escribir). Este componente mantiene el TEXTO tal cual lo escribe el
// usuario (incluyendo vacío) como estado local, y solo aplica un valor por
// defecto al perder el foco si lo dejó vacío o inválido — nunca mientras
// escribe.
export function NumberInput({
  value,
  onChange,
  onBlur,
  decimal = false,
  fallback = 0,
  ...props
}: NumberInputProps) {
  const [text, setText] = useState(value === undefined || value === null ? "" : String(value));

  useEffect(() => {
    setText(value === undefined || value === null ? "" : String(value));
  }, [value]);

  return (
    <Input
      type="number"
      {...props}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw === "") return;
        const parsed = parse(raw, decimal);
        if (!Number.isNaN(parsed)) onChange(parsed);
      }}
      onBlur={(e) => {
        const parsed = parse(text, decimal);
        if (text === "" || Number.isNaN(parsed)) {
          setText(String(fallback));
          onChange(fallback);
          onBlur?.(fallback);
        } else {
          onBlur?.(parsed);
        }
      }}
    />
  );
}
