export interface FieldError {
  field: string;
  code: 'required' | 'invalid_number' | 'ambiguous_separator' | 'negative' | 'not_positive' | 'not_integer' | 'out_of_range';
  params?: Record<string, string | number>;
}

export type ParseNumberResult = { ok: true; value: number } | { ok: false; error: FieldError };

/** Use the active locale's decimal mark; Italian also accepts an unambiguous point, while English never treats a comma as decimal. Thousands separators are never guessed. */
export function parseLocalizedNumber(input: string, locale: 'it' | 'en', field = 'value', allowNegative = false): ParseNumberResult {
  const text = input.trim();
  if (text === '') return { ok: false, error: { field, code: 'required' } };
  const decimalSeparator = locale === 'it' && text.includes(',') ? ',' : '.';
  const otherSeparator = locale === 'it' ? '.' : ',';
  const sign = allowNegative ? '-?' : '\\+?';
  const ambiguousThousands = new RegExp(`^${sign}[1-9]\\d{0,2}(?:\\${otherSeparator}\\d{3})+$`);
  const groupedItalian = locale === 'it' && new RegExp(`^${sign}[1-9]\\d{0,2}(?:\\.\\d{3})+,\\d+$`).test(text);
  if (ambiguousThousands.test(text)) return { ok: false, error: { field, code: 'ambiguous_separator' } };
  if (groupedItalian) {
    const normalizedGrouped = text.replaceAll('.', '').replace(',', '.');
    return { ok: true, value: Number(normalizedGrouped) };
  }
  const decimalBody = locale === 'it' ? '(?:\\d+(?:[,.]\\d*)?|[,.]\\d+)' : '(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  const decimal = new RegExp(`^${sign}${decimalBody}$`);
  if (!decimal.test(text)) return { ok: false, error: { field, code: 'invalid_number' } };
  const normalized = text.replace(decimalSeparator, '.');
  const value = Number(normalized);
  if (!Number.isFinite(value)) return { ok: false, error: { field, code: 'invalid_number' } };
  if (!allowNegative && value < 0) return { ok: false, error: { field, code: 'negative' } };
  return { ok: true, value };
}
