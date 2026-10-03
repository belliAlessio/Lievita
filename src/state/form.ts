import { parseLocalizedNumber, type FieldError } from '../domain/numbers';
import { PROTEIN_MAX, PROTEIN_MIN, type Program, type Style, type Yeast } from '../domain/model';
import { parseLocalDateTime } from '../domain/planner';

export type Locale = 'it' | 'en';

/** Normalize a valid numeric input without grouping when switching UI locale. */
export function normalizeNumericInputLocale(value: string, from: Locale, to: Locale): string {
  if (from === to || value.trim() === '') return value;
  const parsed = parseLocalizedNumber(value, from);
  if (!parsed.ok) return value;
  const normalized = parsed.value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 100 });
  return to === 'it' ? normalized.replace('.', ',') : normalized;
}

export const MAX_PIECE_WEIGHT = 5000;
export const MAX_TRAY_DIMENSION = 200;

export type FormState = {
  style: Style; protein: string; yeast: Yeast; method: 'hand' | 'mixer';
  count: string; pieceWeight: string; shape: 'rectangle' | 'circle';
  length: string; width: string; diameter: string;
  start: string; service: string; program: Program;
  startChoice?: 'first' | 'second'; serviceChoice?: 'first' | 'second';
};
export type NumericFormField = 'protein' | 'count' | 'pieceWeight' | 'length' | 'width' | 'diameter';
export type ForeignInvalid = Partial<Record<NumericFormField, FieldError['code']>>;

/** Canonicalize only for storage: never let an invalid *hidden* field block a visible,
 * valid form or silently turn an invalid visible field into a persisted value.
 */
export function formForPersistence(form: FormState, locale: Locale, foreignInvalid: ForeignInvalid = {}): FormState {
  const canonical = { ...form };
  const normalize = (field: NumericFormField, fallback?: string, max?: number) => {
    const parsed = parseFormNumber(form[field], locale, field, field === 'count');
    // A source-locale error remains authoritative even if the current locale now
    // happens to interpret the unchanged raw text as a plausible number.
    const usable = !foreignInvalid[field] && parsed.ok && parsed.value > 0 && (max === undefined || parsed.value <= max);
    canonical[field] = usable ? normalizeNumericInputLocale(form[field], locale, 'it') : fallback ?? form[field];
  };
  normalize('protein'); normalize('count');
  normalize('pieceWeight', form.style === 'teglia' ? '250' : undefined, MAX_PIECE_WEIGHT);
  normalize('length', form.style !== 'teglia' || form.shape === 'circle' ? '30' : undefined, MAX_TRAY_DIMENSION);
  normalize('width', form.style !== 'teglia' || form.shape === 'circle' ? '40' : undefined, MAX_TRAY_DIMENSION);
  normalize('diameter', form.style !== 'teglia' || form.shape === 'rectangle' ? '30' : undefined, MAX_TRAY_DIMENSION);
  return canonical;
}

/** Validate the entire persisted record before rehydrating; hidden dimension fields may stay blank. */
export function isFormState(value: unknown): value is FormState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const form = value as Record<string, unknown>;
  if (!['napoletana', 'teglia', 'romana'].includes(String(form.style)) || !['fresh', 'dry'].includes(String(form.yeast)) ||
      !['hand', 'mixer'].includes(String(form.method)) || !['rectangle', 'circle'].includes(String(form.shape)) ||
      !['room', 'fridge'].includes(String(form.program))) return false;
  if (['protein', 'count', 'pieceWeight', 'length', 'width', 'diameter', 'start', 'service'].some((key) => typeof form[key] !== 'string')) return false;
  if (['startChoice', 'serviceChoice'].some((key) => form[key] !== undefined && !['first', 'second'].includes(String(form[key])))) return false;
  const numeric = (key: string, min: number, max: number, integer = false) => {
    const parsed = parseLocalizedNumber(form[key] as string, 'it', key);
    return parsed.ok && parsed.value >= min && parsed.value <= max && (!integer || Number.isSafeInteger(parsed.value));
  };
  if (!numeric('protein', PROTEIN_MIN, PROTEIN_MAX) || !numeric('count', 1, 200, true) || !numeric('pieceWeight', Number.MIN_VALUE, MAX_PIECE_WEIGHT) ||
      !numeric('length', Number.MIN_VALUE, MAX_TRAY_DIMENSION) || !numeric('width', Number.MIN_VALUE, MAX_TRAY_DIMENSION) || !numeric('diameter', Number.MIN_VALUE, MAX_TRAY_DIMENSION)) return false;
  return ['start', 'service'].every((key) => ['valid', 'ambiguous'].includes(parseLocalDateTime(form[key] as string).kind));
}

export function parseFormNumber(value: string, locale: Locale, field: string, integer = false) {
  const result = parseLocalizedNumber(value, locale, field);
  if (result.ok && integer && !Number.isSafeInteger(result.value)) return { ok: false as const, error: { field, code: 'not_integer' as const } };
  return result;
}
