import { describe, expect, it } from 'vitest';
import { doughMassForTray } from './area';
import { calculateDough } from './dough';
import { computeRecipe, freshYeastPercent, proteinBand } from './model';
import { parseLocalDateTime, planSchedule, type ScheduleInput } from './schedule';
import { formatDoseGrams } from '../i18n/format';
import { parseLocalizedNumber } from './numbers';
import { groupTimelineActivities } from '../components/timelineGroups';

const base: ScheduleInput = { start: new Date('2026-06-15T09:00:00+02:00'), service: new Date('2026-06-15T19:00:00+02:00'), method: 'hand', program: 'room', itemCount: 4, style: 'napoletana', band: 'medium' };
describe('indicative recipe model', () => {
  it.each([[10.99, 'weak'], [11, 'medium'], [12.5, 'medium'], [12.51, 'strong']] as const)('protein %s belongs to %s', (protein, band) => expect(proteinBand(protein)).toBe(band));
  it.each([5, 21, NaN, Infinity])('rejects out of range protein %s', (protein) => expect(() => proteinBand(protein)).toThrow());
  it.each([
    ['napoletana', 57, 60, 62.5], ['teglia', 68, 72, 78], ['romana', 55, 58, 60],
  ] as const)('%s hydration follows protein band', (style, weak, medium, strong) => {
    for (const [protein, expected] of [[10, weak], [12.5, medium], [13, strong]]) expect(computeRecipe({ style, proteinPercent: protein, yeast: 'fresh', program: 'room', fermentationHours: 8 }).percentages.water).toBe(expected);
  });
  it('uses decreasing dose anchors and converts fresh to dry exactly once', () => {
    for (const [hours, dose] of [[2, 2.5], [4, 1.5], [8, 0.5], [12, 0.25], [24, 0.1], [48, 0.05], [72, 0.03]]) expect(freshYeastPercent(hours, 'room')).toBeCloseTo(dose);
    for (const [hours, dose] of [[12, 0.6], [24, 0.4], [48, 0.25], [72, 0.15]]) expect(freshYeastPercent(hours, 'fridge')).toBeCloseTo(dose);
    for (const program of ['room', 'fridge'] as const) for (let h = 12; h < 71; h++) expect(freshYeastPercent(h + 1, program)).toBeLessThanOrEqual(freshYeastPercent(h, program));
    const input = { style: 'teglia' as const, proteinPercent: 12, program: 'fridge' as const, fermentationHours: 24 };
    expect(computeRecipe({ ...input, yeast: 'dry' }).percentages.yeast).toBeCloseTo(computeRecipe({ ...input, yeast: 'fresh' }).percentages.yeast / 3);
  });
  it('preserves baker percentages and exact tray mass, with positive microdoses', () => {
    const calculated = calculateDough({ totalMassGrams: 1000, percentages: { water: 60, salt: 2.5, yeast: 0.1 } });
    expect(calculated.ok).toBe(true);
    if (calculated.ok) { expect(calculated.masses.flour).toBeCloseTo(615.00615); expect(calculated.masses.total).toBeCloseTo(1000); }
    expect(doughMassForTray({ kind: 'rectangle', lengthCm: 30, widthCm: 40 }, 0.5)).toBe(600);
    expect(doughMassForTray({ kind: 'circle', diameterCm: 30 }, 0.5)).toBeCloseTo(353.42917);
    expect(formatDoseGrams(0.04, 0.1, 'it', 'g')).toBe('< 0,1 g');
    expect(parseLocalizedNumber('1.000,5', 'it')).toMatchObject({ ok: true, value: 1000.5 });
    expect(parseLocalizedNumber('1.000', 'it').ok).toBe(false);
    expect(parseLocalizedNumber('2,500', 'en').ok).toBe(false);
  });
});
describe('automatic schedule', () => {
  it('allocates the room phases without overlap and schedules successive pizzas', () => {
    const plan = planSchedule(base);
    expect(plan.status).toBe('ok');
    const byCode = (code: string) => plan.activities.find((item) => item.code === code)!;
    expect(byCode('kneading').start).toEqual(base.start);
    expect(byCode('puntata').end).toEqual(byCode('dividing').start);
    expect(byCode('dividing').end).toEqual(byCode('appretto').start);
    expect(byCode('cooking').end).toEqual(base.service);
    expect(plan.fermentationHours).toBeCloseTo((10 * 60 - 20 - 14 - 4 - 5) / 60);
    expect(plan.lastFermentationHours).toBeCloseTo(plan.fermentationHours + 3 * 11 / 60);
    expect(plan.warnings).toEqual([]);
    expect(plan.activities.filter((item) => item.code === 'cooking')).toHaveLength(4);
    const grouped = groupTimelineActivities(plan.activities);
    expect(grouped.filter((item) => item.code === 'cooking')).toHaveLength(1);
    expect(grouped.find((item) => item.code === 'batch_group')).toMatchObject({ count: 4, cadenceMinutes: 11 });
    expect(plan.activities.find((item) => item.code === 'preheat')?.parallel).toBe(true);
    const manual = plan.activities.filter((item) => ['kneading', 'dividing', 'shaping', 'cooking', 'recovery'].includes(item.code));
    for (let i = 1; i < manual.length; i++) expect(manual[i]!.start.getTime()).toBeGreaterThanOrEqual(manual[i - 1]!.end.getTime());
  });
  it('schedules bulk fridge rest followed by cold dividing and ball rest for round styles', () => {
    const fridge = planSchedule({ ...base, program: 'fridge', service: new Date(base.service.getTime() + 14 * 3_600_000) });
    expect(fridge.status).toBe('ok');
    expect(fridge.activities.find((item) => item.code === 'fridge')).toBeDefined();
    const sequential = fridge.activities.filter((item) => !item.parallel);
    expect(sequential.map((item) => item.code).slice(0, 6)).toEqual(['kneading', 'puntata', 'fridge', 'dividing', 'appretto', 'shaping']);
    expect(fridge.activities.find((item) => item.code === 'appretto')!.end.getTime() - fridge.activities.find((item) => item.code === 'appretto')!.start.getTime()).toBe(3 * 3_600_000);
    expect(fridge.activities.find((item) => item.code === 'dividing')?.tipCode).toBe('cold_dividing');
    expect(fridge.activities.some((item) => item.code === 'out_fridge')).toBe(false);
    expect(planSchedule({ ...base, band: 'weak', program: 'fridge' }).status).toBe('fridge_weak_flour');
    expect(planSchedule({ ...base, band: 'weak', program: 'fridge', service: new Date(base.start.getTime() + 30 * 60_000) }).status).toBe('fridge_weak_flour');
    const shortFridge = planSchedule({ ...base, program: 'fridge' });
    expect(shortFridge.status).toBe('fridge_too_short');
    const fridgeFixed = 20 + 14 + 4 + 5;
    expect(shortFridge.alternative!.getTime()).toBe(base.start.getTime() + (fridgeFixed + 60 + 180 + 360) * 60_000);
    expect(planSchedule({ ...base, program: 'fridge', service: shortFridge.alternative! }).status).toBe('ok');
  });
  it.each(['napoletana', 'romana', 'teglia'] as const)('uses correct manual/rest ordering for %s in both programs', (style) => {
    for (const program of ['room', 'fridge'] as const) {
      const input = { ...base, style, program, service: new Date(base.start.getTime() + (program === 'fridge' ? 24 : 10) * 3_600_000) };
      const plan = planSchedule(input);
      expect(plan.status).toBe('ok');
      const activities = plan.activities.filter((item) => !item.parallel);
      const codes = activities.map((item) => item.code);
      const beforeBatches = codes.slice(0, codes.indexOf('cooking'));
      if (style === 'teglia') {
        expect(beforeBatches).toEqual(program === 'fridge'
          ? ['kneading', 'puntata', 'fridge', 'out_fridge', 'tray_spread', 'tray_rest', 'topping']
          : ['kneading', 'puntata', 'dividing', 'appretto', 'tray_spread', 'tray_rest', 'topping']);
        const trayRest = activities.find((item) => item.code === 'tray_rest')!;
        const spread = activities.find((item) => item.code === 'tray_spread')!;
        const topping = activities.find((item) => item.code === 'topping')!;
        expect(trayRest.start.getTime()).toBe(spread.end.getTime());
        expect(trayRest.end.getTime()).toBe(topping.start.getTime());
        expect(trayRest.end.getTime() - trayRest.start.getTime()).toBe(3_600_000);
        expect(topping.end.getTime() - topping.start.getTime()).toBe(5 * 60_000);
        expect(activities.find((item) => item.code === 'tray_spread')!.end.getTime() - spread.start.getTime()).toBe(18 * 60_000);
        if (program === 'fridge') {
          expect(activities.find((item) => item.code === 'out_fridge')!.end.getTime() - activities.find((item) => item.code === 'out_fridge')!.start.getTime()).toBe(3_600_000);
          expect(codes.indexOf('fridge')).toBeLessThan(codes.indexOf('tray_spread'));
        } else {
          expect(activities.find((item) => item.code === 'dividing')!.end.getTime() - activities.find((item) => item.code === 'dividing')!.start.getTime()).toBe(14 * 60_000);
          expect(activities.find((item) => item.code === 'puntata')!.end.getTime() - activities.find((item) => item.code === 'puntata')!.start.getTime()).toBe(5 * 3_600_000 + 12 * 60_000);
        }
      } else {
        expect(beforeBatches).toEqual(program === 'fridge'
          ? ['kneading', 'puntata', 'fridge', 'dividing', 'appretto', 'shaping']
          : ['kneading', 'puntata', 'dividing', 'appretto', 'shaping']);
        if (program === 'fridge') expect(codes.indexOf('fridge')).toBeLessThan(codes.indexOf('dividing'));
        expect(activities.find((item) => item.code === 'dividing')!.end.getTime() - activities.find((item) => item.code === 'dividing')!.start.getTime()).toBe(14 * 60_000);
      }
      const rests = activities.filter((item) => ['puntata', 'fridge', 'appretto', 'out_fridge', 'tray_rest'].includes(item.code));
      expect(rests.reduce((sum, item) => sum + item.end.getTime() - item.start.getTime(), 0) / 3_600_000).toBeCloseTo(plan.fermentationHours);
      expect(activities.find((item) => item.id === 'cooking-1')?.end).toEqual(input.service);
      for (const item of activities) expect(item.end.getTime()).toBeGreaterThan(item.start.getTime());
      for (let index = 1; index < activities.length; index++) expect(activities[index]!.start.getTime()).toBeGreaterThanOrEqual(activities[index - 1]!.end.getTime());
      const preheat = plan.activities.find((item) => item.code === 'preheat')!;
      expect(preheat.parallel).toBe(true);
      expect(preheat.end.getTime() - preheat.start.getTime()).toBe(45 * 60_000);
      expect(preheat.end.getTime()).toBe(activities.find((item) => item.code === 'cooking')!.start.getTime());
    }
  });
  it.each([10, 24])('keeps room-only tray bulk near 2/3 before tray rest at %ih available', (availableHours) => {
    const plan = planSchedule({ ...base, style: 'teglia', program: 'room', service: new Date(base.start.getTime() + availableHours * 3_600_000) });
    expect(plan.status).toBe('ok');
    const duration = (code: 'puntata' | 'appretto' | 'tray_rest') => {
      const item = plan.activities.find((activity) => activity.code === code)!;
      return item.end.getTime() - item.start.getTime();
    };
    const bulk = duration('puntata');
    const balls = duration('appretto');
    expect(bulk / (bulk + balls)).toBeCloseTo(2 / 3, 5);
    expect(bulk).toBeGreaterThanOrEqual(30 * 60_000);
    expect(balls).toBeGreaterThanOrEqual(30 * 60_000);
    expect(duration('tray_rest')).toBe(3_600_000);
    expect(bulk + balls + duration('tray_rest')).toBeCloseTo(plan.fermentationHours * 3_600_000, 4);
    expect(bulk).toBeGreaterThan(4 * 3_600_000);
  });
  it('does not shorten either room-only tray rest below 30 minutes at the minimum', () => {
    const fixedMinutes = 20 + 14 + 18 + 5 + 15;
    const input = { ...base, style: 'teglia' as const, service: new Date(base.start.getTime() + (fixedMinutes + 119) * 60_000) };
    const tooShort = planSchedule(input);
    expect(tooShort.status).toBe('too_short');
    const minimum = planSchedule({ ...input, service: tooShort.alternative! });
    expect(minimum.status).toBe('ok');
    for (const code of ['puntata', 'appretto'] as const) {
      const rest = minimum.activities.find((item) => item.code === code)!;
      expect(rest.end.getTime() - rest.start.getTime()).toBe(30 * 60_000);
    }
  });
  it.each(['napoletana', 'romana', 'teglia'] as const)('offers achievable earliest fridge service for %s', (style) => {
    const input = { ...base, style, program: 'fridge' as const, service: new Date(base.start.getTime() + 7 * 3_600_000) };
    const outcome = planSchedule(input);
    expect(['too_short', 'fridge_too_short']).toContain(outcome.status);
    expect(outcome.alternative).toBeDefined();
    const proposed = planSchedule({ ...input, service: outcome.alternative! });
    expect(proposed.status).toBe('ok');
    expect(proposed.activities.find((item) => item.code === 'fridge')!.end.getTime() - proposed.activities.find((item) => item.code === 'fridge')!.start.getTime()).toBe(6 * 3_600_000);
    const tooShort = planSchedule({ ...input, service: new Date(input.start.getTime() + 30 * 60_000) });
    expect(tooShort.status).toBe('too_short');
    expect(planSchedule({ ...input, service: tooShort.alternative! }).status).toBe('ok');
  });
  it.each(['room', 'fridge'] as const)('tray %s alternatives and serial-window bounds account for stretching', (program) => {
    const input = { ...base, style: 'teglia' as const, program, service: new Date(base.start.getTime() + (program === 'fridge' ? 50 : 30) * 3_600_000) };
    const late = planSchedule(input);
    expect(late.status).toBe('too_long');
    const adjusted = planSchedule({ ...input, start: late.alternative! });
    expect(adjusted.status).toBe('ok');
    expect(adjusted.lastFermentationHours).toBeCloseTo(program === 'fridge' ? 48 : 24);
    expect(planSchedule({ ...input, itemCount: 200 }).status).toBe('service_window_too_long');
  });
  it('returns alternative dates for too short or too long without stretching phases', () => {
    const short = planSchedule({ ...base, service: new Date(base.start.getTime() + 60 * 60_000) });
    expect(short.status).toBe('too_short'); expect(short.alternative!.getTime()).toBeGreaterThan(base.start.getTime());
    const long = planSchedule({ ...base, start: new Date(base.service.getTime() - 30 * 3_600_000) });
    expect(long.status).toBe('too_long');
    expect(long.alternative!.getTime()).toBeGreaterThan(base.service.getTime() - 30 * 3_600_000);
    expect(long.alternative!.getTime()).toBeLessThan(base.service.getTime());
    expect(planSchedule({ ...base, start: long.alternative! }).status).toBe('ok');
    const shortFridge = planSchedule({ ...base, program: 'fridge', service: new Date(base.start.getTime() + 60 * 60_000) });
    expect(shortFridge.status).toBe('too_short');
    expect(planSchedule({ ...base, program: 'fridge', service: shortFridge.alternative! }).status).toBe('ok');
    expect(planSchedule({ ...base, itemCount: 201 }).status).toBe('invalid_count');
  });
  it('rejects baking windows that would over-ferment the last item', () => {
    const many = planSchedule({ ...base, itemCount: 200, band: 'medium' });
    expect(many.status).toBe('service_window_too_long');
    expect(many.activities).toHaveLength(0);
    const strong = planSchedule({ ...base, itemCount: 200, band: 'strong' });
    expect(strong.status).toBe('ok');
    const lastShaping = strong.activities.find((item) => item.id === 'shaping-200')!;
    const dividing = strong.activities.find((item) => item.id === 'dividing')!;
    const kneading = strong.activities.find((item) => item.id === 'kneading')!;
    expect((lastShaping.start.getTime() - strong.activities[0]!.start.getTime() - (kneading.end.getTime() - kneading.start.getTime()) - (dividing.end.getTime() - dividing.start.getTime())) / 3_600_000).toBeGreaterThan(24);
    expect(groupTimelineActivities(strong.activities)).toHaveLength(8);
  });
  it('proposes a later start when only the initial fermentation makes the last batch too late', () => {
    const fixedMinutes = 20 + 14 + 4 + 5;
    const service = new Date(base.start.getTime() + (23 * 60 + 45 + fixedMinutes) * 60_000);
    const result = planSchedule({ ...base, service });
    expect(result.status).toBe('too_long');
    expect(result.alternative!.getTime()).toBeGreaterThan(base.start.getTime());
    const adjusted = planSchedule({ ...base, start: result.alternative!, service });
    expect(adjusted.status).toBe('ok');
    expect(adjusted.lastFermentationHours).toBeCloseTo(24);
  });
  it('warns without blocking if serial baking greatly lengthens the last item fermentation', () => {
    const plan = planSchedule({ ...base, band: 'strong', itemCount: 60 });
    expect(plan.status).toBe('ok');
    expect(plan.warnings).toEqual(['long_service_window']);
    expect(plan.lastFermentationHours!).toBeGreaterThan(plan.fermentationHours * 1.5);
    const midpoint = (plan.fermentationHours + plan.lastFermentationHours!) / 2;
    expect(computeRecipe({ style: base.style, yeast: 'fresh', proteinPercent: 13, program: 'room', fermentationHours: midpoint }).percentages.yeast)
      .toBeLessThan(computeRecipe({ style: base.style, yeast: 'fresh', proteinPercent: 13, program: 'room', fermentationHours: plan.fermentationHours }).percentages.yeast);
    expect(groupTimelineActivities(plan.activities).find((item) => item.code === 'batch_group')).toMatchObject({ count: 60 });
  });
  it('crosses midnight, multiple days and DST using elapsed instant time', () => {
    const midnight = planSchedule({ ...base, service: new Date('2026-06-16T00:15:00+02:00'), start: new Date('2026-06-15T15:00:00+02:00') });
    expect(midnight.status).toBe('ok');
    expect(midnight.activities.some((item) => item.start.getDate() !== item.end.getDate())).toBe(true);
    const multi = planSchedule({ ...base, band: 'strong', program: 'fridge', service: new Date(base.start.getTime() + 60 * 3_600_000) });
    expect(multi.status).toBe('ok');
    expect(multi.activities.find((item) => item.code === 'fridge')!.start.getDate()).not.toBe(multi.activities.find((item) => item.code === 'fridge')!.end.getDate());
    expect(parseLocalDateTime('2026-03-29T02:30').kind).toBe('nonexistent');
    expect(parseLocalDateTime('2026-10-25T02:30').kind).toBe('ambiguous');
    for (const day of ['2026-03-29', '2026-10-25']) {
      const begin = parseLocalDateTime(`${day}T00:30`);
      expect(begin.kind).toBe('valid');
      if (begin.kind !== 'valid') continue;
      const plan = planSchedule({ ...base, start: begin.date, service: new Date(begin.date.getTime() + 15 * 3_600_000) });
      expect(plan.status).toBe('ok');
      expect(plan.activities.find((item) => item.code === 'cooking')!.end.getTime()).toBe(begin.date.getTime() + 15 * 3_600_000);
    }
  });
});
