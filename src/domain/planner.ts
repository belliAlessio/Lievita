export type LocalDateTimeResult =
  | { kind: 'valid'; date: Date }
  | { kind: 'nonexistent'; code: 'nonexistent_local_time' }
  | { kind: 'ambiguous'; dates: [Date, Date]; code: 'ambiguous_local_time' }
  | { kind: 'invalid'; code: 'invalid_local_datetime' };

/** Resolve local wall time without guessing across DST gaps or repeated hours. */
export function parseLocalDateTime(value: string): LocalDateTimeResult {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return { kind: 'invalid', code: 'invalid_local_datetime' };
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const dateCheck = new Date(naive);
  if (dateCheck.getUTCFullYear() !== year || dateCheck.getUTCMonth() !== month - 1 || dateCheck.getUTCDate() !== day || hour > 23 || minute > 59) return { kind: 'invalid', code: 'invalid_local_datetime' };
  const matches: Date[] = [];
  for (let epoch = naive - 16 * 60 * 60_000; epoch <= naive + 16 * 60 * 60_000; epoch += 60_000) {
    const date = new Date(epoch);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && date.getHours() === hour && date.getMinutes() === minute) matches.push(date);
  }
  if (!matches.length) return { kind: 'nonexistent', code: 'nonexistent_local_time' };
  if (matches.length > 1) return { kind: 'ambiguous', dates: [matches[0]!, matches[matches.length - 1]!], code: 'ambiguous_local_time' };
  return { kind: 'valid', date: matches[0]! };
}
