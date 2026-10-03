import type { FieldError } from './numbers';

export type DoughInput = {
  totalMassGrams: number;
  percentages: { water: number; salt: number; oil?: number; yeast?: number };
};
export type DoughMasses = { flour: number; water: number; salt: number; oil: number; yeast: number; total: number };
export type DoughResult = { ok: true; masses: DoughMasses } | { ok: false; errors: FieldError[] };

/** Baker's formula: flour = total raw dough mass / (1 + sum(baker percentages)/100). */
export function calculateDough(input: DoughInput): DoughResult {
  const errors: FieldError[] = [];
  if (!Number.isFinite(input.totalMassGrams)) errors.push({ field: 'totalMassGrams', code: 'invalid_number' });
  else if (input.totalMassGrams <= 0) errors.push({ field: 'totalMassGrams', code: 'not_positive' });
  for (const [key, value] of Object.entries(input.percentages)) {
    if (!Number.isFinite(value) || value < 0) errors.push({ field: `percentages.${key}`, code: value < 0 ? 'negative' : 'invalid_number' });
  }
  if (errors.length) return { ok: false, errors };
  const { water, salt, oil = 0, yeast = 0 } = input.percentages;
  const flour = input.totalMassGrams / (1 + (water + salt + oil + yeast) / 100);
  if (!Number.isFinite(flour) || flour <= 0) return { ok: false, errors: [{ field: 'totalMassGrams', code: 'out_of_range' }] };
  const portion = (percent: number) => flour * percent / 100;
  const masses = { flour, water: portion(water), salt: portion(salt), oil: portion(oil), yeast: portion(yeast), total: input.totalMassGrams };
  return { ok: true, masses };
}
