import { describe, expect, it } from 'vitest';
import { normalizeNumericInputLocale, parseFormNumber } from './form';

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
});
