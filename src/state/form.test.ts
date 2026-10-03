import { describe, expect, it } from 'vitest';
import { formForPersistence, isFormState, normalizeNumericInputLocale, parseFormNumber } from './form';

describe('form parsing', () => {
  it('rejects fractional and ambiguous counts', () => {
    expect(parseFormNumber('2,5', 'it', 'count', true)).toMatchObject({ ok: false, error: { code: 'not_integer' } });
    expect(parseFormNumber('2,500', 'en', 'count', true)).toMatchObject({ ok: false, error: { code: 'ambiguous_separator' } });
  });
  it('normalizes locale input without changing its numerical value', () => {
    expect(normalizeNumericInputLocale('12,5', 'it', 'en')).toBe('12.5');
    expect(normalizeNumericInputLocale('12.5', 'en', 'it')).toBe('12,5');
    expect(normalizeNumericInputLocale('not a number', 'it', 'en')).toBe('not a number');
  });
  it('rejects malformed persisted forms', () => {
    const form = { style: 'napoletana', protein: '12,5', yeast: 'fresh', method: 'hand', count: '4', pieceWeight: '250', shape: 'rectangle', length: '30', width: '40', diameter: '30', start: '2026-06-15T09:00', service: '2026-06-15T19:00', program: 'room' };
    expect(isFormState(form)).toBe(true);
    expect(isFormState({ ...form, count: '201' })).toBe(false);
    expect(isFormState({ ...form, protein: '21' })).toBe(false);
    expect(isFormState({ ...form, pieceWeight: '5001' })).toBe(false);
    expect(isFormState({ ...form, length: '201' })).toBe(false);
    expect(isFormState({ ...form, start: '2026-03-29T02:30' })).toBe(false);
    expect(isFormState({ ...form, style: 'unavailable' })).toBe(false);
  });
  it('sanitizes only invalid hidden fields when saving', () => {
    const form = { style: 'napoletana' as const, protein: '12,5', yeast: 'fresh' as const, method: 'hand' as const, count: '3', pieceWeight: '250', shape: 'rectangle' as const, length: '', width: '40', diameter: '30', start: '2026-06-15T09:00', service: '2026-06-15T19:00', program: 'room' as const };
    const saved = formForPersistence(form, 'it');
    expect(saved.length).toBe('30');
    expect(isFormState(saved)).toBe(true);
    const invalidVisible = formForPersistence({ ...form, style: 'teglia' }, 'it');
    expect(invalidVisible.length).toBe('');
    expect(isFormState(invalidVisible)).toBe(false);
    const foreignHidden = formForPersistence({ ...form, length: '2,500' }, 'it', { length: 'ambiguous_separator' });
    expect(foreignHidden.length).toBe('30');
    const foreignVisible = formForPersistence({ ...form, pieceWeight: '1.000' }, 'en', { pieceWeight: 'ambiguous_separator' });
    expect(foreignVisible.pieceWeight).toBe('1.000');
    expect(isFormState(foreignVisible)).toBe(false);
  });
});
