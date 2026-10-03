import { maxFermentationHours, type Band, type Program, type Style } from './model';
export { parseLocalDateTime } from './planner';

export type ActivityCode = 'kneading' | 'puntata' | 'dividing' | 'tray_spread' | 'tray_rest' | 'appretto' | 'fridge' | 'out_fridge' | 'shaping' | 'topping' | 'cooking' | 'recovery' | 'preheat';
export type Activity = { id: string; code: ActivityCode; start: Date; end: Date; parallel?: boolean; batch?: number; tipCode?: 'cold_dividing' };
export type ScheduleStatus = 'ok' | 'too_short' | 'too_long' | 'service_window_too_long' | 'fridge_weak_flour' | 'fridge_too_short' | 'invalid_date' | 'invalid_count';
export type ScheduleWarning = 'long_service_window';
export type ScheduleInput = { start: Date; service: Date; program: Program; method: 'hand' | 'mixer'; itemCount: number; style: Style; band: Band };
export type Schedule = { status: ScheduleStatus; activities: Activity[]; fermentationHours: number; lastFermentationHours?: number; warnings: ScheduleWarning[]; alternative?: Date; maxHours: number };
const MIN = 60_000;
const HOUR = 60 * MIN;

/** Documentary context for the app-chosen phase order (consulted 2026-10-03):
 * https://www.lacucinaitaliana.it/  https://www.confraternitadellapizza.com/
 * https://www.dissapore.com/  https://www.molinovigevano.com/
 * https://blog.giallozafferano.it/  https://www.pizzadose.it/
 * https://www.scattidigusto.it/
 * These sources do not validate the app's exact durations, yeast curve or oven timings.
 * Cold storage is ALWAYS in bulk; tray stretching happens afterwards. The room-only
 * tray sequence has both dividing and later tray spreading, unlike the fridge sequence.
 */
/** First serving is the END of the first bake. All arithmetic is elapsed-time/instant arithmetic (DST safe).
 * The chosen start is fixed; an out-of-bounds interval is never compressed or silently extended.
 * F = all rest time after kneading and before the first item's shaping/topping: subtract
 * kneading, any dividing/spreading, topping/shaping and cooking from start→first service.
 * Each later item's extra wait (including others' serial work and baking) still counts
 * toward that item's fermentation limit; the preheat is parallel and never added to F.
 */
export function planSchedule(input: ScheduleInput): Schedule {
  const { start, service, program, method, itemCount, style, band } = input;
  const maxHours = maxFermentationHours(band, program);
  const empty = (status: ScheduleStatus, hours = 0, alternative?: Date): Schedule => ({ status, activities: [], fermentationHours: hours, maxHours, warnings: [], alternative });
  if (!Number.isFinite(start?.getTime()) || !Number.isFinite(service?.getTime())) return empty('invalid_date');
  if (!Number.isSafeInteger(itemCount) || itemCount < 1 || itemCount > 200) return empty('invalid_count');
  const isTray = style === 'teglia';
  const kneading = (method === 'hand' ? 20 : 15) * MIN;
  const dividing = (10 + itemCount) * MIN;
  const traySpread = (10 + 2 * itemCount) * MIN;
  const preBakeWork = isTray ? traySpread + (program === 'room' ? dividing : 0) : dividing;
  const shaping = { napoletana: 4, romana: 5, teglia: 5 }[style] * MIN;
  const cooking = { napoletana: 5, romana: 6, teglia: 15 }[style] * MIN;
  const fixed = kneading + preBakeWork + shaping + cooking;
  const ferment = service.getTime() - start.getTime() - fixed;
  const hours = ferment / HOUR;
  // Round cold: 1h bulk + >=6h cold + 3h ball rest. Tray cold: 1h bulk
  // + >=6h cold + 1h acclimation in bulk + 1h rest *after* spreading.
  const ambientAroundFridge = isTray ? 3 * HOUR : 4 * HOUR;
  const earliestFerment = program === 'fridge' ? ambientAroundFridge + 6 * HOUR : 2 * HOUR;
  const earliestService = new Date(start.getTime() + fixed + earliestFerment);
  const serialWindow = (itemCount - 1) * (2 * MIN + shaping + cooking);
  if (program === 'fridge' && band === 'weak') return empty('fridge_weak_flour', hours);
  if (earliestFerment + serialWindow > maxHours * HOUR + MIN) return empty('service_window_too_long', hours);
  // A room-only tray needs a full 1h tray rest plus >=30min for each earlier
  // rest; do not use datetime-local tolerance to make either rest shorter.
  if (ferment < 2 * HOUR - MIN || (isTray && program === 'room' && ferment < 2 * HOUR)) return empty('too_short', hours, earliestService);
  if (program === 'fridge' && ferment - ambientAroundFridge < 6 * HOUR - MIN) return empty('fridge_too_short', hours, earliestService);
  // Each later item waits for the previous bake, recovery and its own shaping; its dough
  // continues fermenting. Enforce the limit for the LAST item, not only the first serving.
  const lastFerment = ferment + serialWindow;
  if (lastFerment > maxHours * HOUR + MIN) {
    // Keep first service fixed: shifting dough start later by this amount makes the
    // LAST shaping (not merely the first serving) meet the declared fermentation cap.
    return empty('too_long', hours, new Date(service.getTime() - fixed - maxHours * HOUR + serialWindow));
  }

  const activities: Activity[] = [];
  let cursor = start.getTime();
  const add = (id: string, code: ActivityCode, duration: number, batch?: number) => {
    const begin = cursor;
    cursor += duration;
    activities.push({ id, code, start: new Date(begin), end: new Date(cursor), ...(batch ? { batch } : {}) });
  };
  add('kneading', 'kneading', kneading);
  if (program === 'room') {
    const trayRest = isTray ? HOUR : 0;
    const restBeforeSpreading = ferment - trayRest;
    // Tray: ~2/3 of pre-tray-rest time for bulk with NO 4h cap; keep >=30min
    // for bulk and ball rest. Only round styles retain their F/3 and 4h cap.
    const bulk = isTray
      ? Math.min(Math.max(restBeforeSpreading * 2 / 3, 30 * MIN), restBeforeSpreading - 30 * MIN)
      : Math.min(Math.max(ferment / 3, 30 * MIN), 4 * HOUR, ferment - 30 * MIN);
    add('puntata', 'puntata', bulk);
    add('dividing', 'dividing', dividing);
    add('appretto', 'appretto', restBeforeSpreading - bulk);
    if (isTray) {
      add('tray_spread', 'tray_spread', traySpread);
      add('tray_rest', 'tray_rest', trayRest);
    }
  } else {
    add('puntata', 'puntata', HOUR);
    add('fridge', 'fridge', ferment - ambientAroundFridge);
    if (isTray) {
      add('out_fridge', 'out_fridge', HOUR);
      add('tray_spread', 'tray_spread', traySpread);
      add('tray_rest', 'tray_rest', HOUR);
    } else {
      add('dividing', 'dividing', dividing);
      activities[activities.length - 1]!.tipCode = 'cold_dividing';
      add('appretto', 'appretto', 3 * HOUR);
    }
  }
  add('shaping-1', isTray ? 'topping' : 'shaping', shaping, 1);
  add('cooking-1', 'cooking', cooking, 1);
  for (let batch = 2; batch <= itemCount; batch++) {
    add(`recovery-${batch}`, 'recovery', 2 * MIN, batch);
    add(`shaping-${batch}`, isTray ? 'topping' : 'shaping', shaping, batch);
    add(`cooking-${batch}`, 'cooking', cooking, batch);
  }
  const firstCookStart = service.getTime() - cooking;
  activities.push({ id: 'preheat', code: 'preheat', start: new Date(firstCookStart - 45 * MIN), end: new Date(firstCookStart), parallel: true });
  activities.sort((a, b) => a.start.getTime() - b.start.getTime() || Number(Boolean(b.parallel)) - Number(Boolean(a.parallel)));
  return { status: 'ok', activities, fermentationHours: hours, lastFermentationHours: lastFerment / HOUR,
    warnings: lastFerment > 1.5 * ferment ? ['long_service_window'] : [], maxHours };
}
