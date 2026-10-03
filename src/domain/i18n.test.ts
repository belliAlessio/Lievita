import { describe, expect, it } from 'vitest';
import italian from '../i18n/locales/it.json';
import english from '../i18n/locales/en.json';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const leaves = (value: unknown, prefix = ''): string[] => typeof value === 'string' ? [prefix] : value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key)) : [];
const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(directory, entry.name)] : []);

describe('translation catalogs', () => {
  it('have identical nonempty nested keys and no dotted keys', () => {
    expect(leaves(italian).sort()).toEqual(leaves(english).sort());
    const verify = (value: unknown): void => {
      if (typeof value === 'string') { expect(value.trim()).not.toBe(''); return; }
      expect(value && typeof value === 'object' && !Array.isArray(value)).toBe(true);
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) { expect(key).not.toContain('.'); verify(child); }
    };
    verify(italian); verify(english);
  });
  it('resolves all literal t() keys in both languages', () => {
    const available = new Set(leaves(italian));
    for (const file of sourceFiles(join(process.cwd(), 'src'))) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/\bt\(\s*(['"])([^'"\n]+)\1/g)) {
        expect(available.has(match[2]!), `${file}: ${match[2]}`).toBe(true);
      }
    }
    for (const code of ['kneading', 'puntata', 'dividing', 'tray_spread', 'tray_rest', 'appretto', 'fridge', 'out_fridge', 'shaping', 'topping', 'cooking', 'recovery', 'preheat']) {
      expect(available.has(`activities.${code}`)).toBe(true);
      expect(available.has(`tips.${code}`)).toBe(true);
    }
    expect(available.has('tips.cold_dividing')).toBe(true);
    for (const code of ['ok', 'too_short', 'too_long', 'service_window_too_long', 'fridge_weak_flour', 'fridge_too_short', 'invalid_date', 'invalid_count']) expect(available.has(`result.status.${code}`)).toBe(true);
    for (const code of ['too_short', 'too_long', 'service_window_too_long', 'fridge_weak_flour', 'fridge_too_short', 'invalid_date', 'invalid_count']) expect(available.has(`result.message.${code}`)).toBe(true);
    expect(available.has('scheduleWarnings.long_service_window')).toBe(true);
  });
});
