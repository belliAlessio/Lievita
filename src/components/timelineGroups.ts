import type { Activity } from '../domain/schedule';

export type TimelineEntry = Activity | { id: 'remaining-batches'; code: 'batch_group'; start: Date; end: Date; count: number; cadenceMinutes: number };

/** Group only the presentation: the schedule retains every batch and its exact instants. */
export function groupTimelineActivities(activities: readonly Activity[]): TimelineEntry[] {
  const cooks = activities.filter((item) => item.code === 'cooking');
  if (cooks.length < 2) return [...activities];
  const second = activities.find((item) => (item.code === 'shaping' || item.code === 'topping') && item.batch === 2)!;
  const last = cooks[cooks.length - 1]!;
  const cadenceMinutes = (cooks[1]!.end.getTime() - cooks[0]!.end.getTime()) / 60_000;
  const grouped: TimelineEntry = { id: 'remaining-batches', code: 'batch_group', start: second.start, end: last.end, count: cooks.length, cadenceMinutes };
  return [...activities.filter((item) => !item.batch || item.batch === 1), grouped]
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}
