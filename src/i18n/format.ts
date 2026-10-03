export type DisplayLocale = 'it' | 'en';

export function formatNumber(value: number, locale: DisplayLocale, maximumFractionDigits = 2): string {
  if (!Number.isFinite(value)) throw new RangeError('invalid_number');
  return new Intl.NumberFormat(locale === 'it' ? 'it-IT' : 'en-GB', { maximumFractionDigits }).format(value);
}

export function formatDoseGrams(value: number, resolutionGrams: number, locale: DisplayLocale, gramUnit: string): string {
  if (!Number.isFinite(value) || value < 0 || !Number.isFinite(resolutionGrams) || resolutionGrams <= 0) throw new RangeError('invalid_dose');
  const precision = (number: number): number => {
    const text = number.toString().toLowerCase();
    if (text.includes('e-')) {
      const [mantissa, exponent] = text.split('e-');
      return Number(exponent) + (mantissa?.split('.')[1]?.length ?? 0);
    }
    return text.split('.')[1]?.length ?? 0;
  };
  const digits = Math.min(10, Math.max(0, precision(resolutionGrams)));
  const format = (number: number) => new Intl.NumberFormat(locale === 'it' ? 'it-IT' : 'en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(number);
  if (value > 0 && value < resolutionGrams) return `< ${format(resolutionGrams)} ${gramUnit}`;
  const rounded = Math.round((value + Number.EPSILON) / resolutionGrams) * resolutionGrams;
  // A positive dose at the scale's resolution must never be rendered as zero.
  if (value > 0 && rounded === 0) return `< ${format(resolutionGrams)} ${gramUnit}`;
  return `${format(rounded)} ${gramUnit}`;
}
