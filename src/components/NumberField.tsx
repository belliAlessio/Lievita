import type { ChangeEvent } from 'react';

type Props = {
  id: string; label: string; value: string; onChange: (value: string) => void;
  error?: string; integer?: boolean; hint?: string; disabled?: boolean;
};

export function NumberField({ id, label, value, onChange, error, integer = false, hint, disabled = false }: Props) {
  const description = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <input id={id} type="text" inputMode={integer ? 'numeric' : 'decimal'} value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)} aria-describedby={description}
      aria-invalid={error ? true : undefined} disabled={disabled} />
    {hint && <small id={`${id}-hint`}>{hint}</small>}
    {error && <small className="field-error" id={`${id}-error`}>{error}</small>}
  </div>;
}
