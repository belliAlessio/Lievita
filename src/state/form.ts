import { parseLocalizedNumber, type FieldError } from '../domain/numbers';
import type { Program, Style, Yeast } from '../domain/model';

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

export function parseFormNumber(value: string, locale: Locale, field: string, integer = false) {
  const result = parseLocalizedNumber(value, locale, field);
  if (result.ok && integer && !Number.isSafeInteger(result.value)) return { ok: false as const, error: { field, code: 'not_integer' as const } };
  return result;
}
