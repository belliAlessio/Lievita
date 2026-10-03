type Props<T extends string> = { name: string; label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void };
export function Segmented<T extends string>({ name, label, value, options, onChange }: Props<T>) {
  return <fieldset className="segmented-field"><legend>{label}</legend><div className="segmented">
    {options.map((option) => <label key={option.value} className="segment"><input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} /><span>{option.label}</span></label>)}
  </div></fieldset>;
}
