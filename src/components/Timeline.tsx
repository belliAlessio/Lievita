import { useTranslation } from 'react-i18next';
import type { Activity } from '../domain/schedule';
import type { Locale } from '../state/form';
import type { Style } from '../domain/model';
import { groupTimelineActivities } from './timelineGroups';

export function Timeline({ activities, locale, style }: { activities: Activity[]; locale: Locale; style: Style }) {
  const { t } = useTranslation();
  const date = (value: Date) => new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-GB', { dateStyle: 'full' }).format(value);
  const time = (value: Date) => new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-GB', { timeStyle: 'short' }).format(value);
  const batchCount = activities.filter((activity) => activity.code === 'cooking').length;
  let previous = '';
  return <div className="timeline"><h3>{t('labels.timeline')}</h3><ol>
    {groupTimelineActivities(activities).map((activity) => {
      const day = `${activity.start.getFullYear()}-${activity.start.getMonth()}-${activity.start.getDate()}`;
      const newDay = day !== previous;
      previous = day;
      return <li key={activity.id} className={'parallel' in activity && activity.parallel ? 'parallel' : ''}>
        {newDay && <div className="timeline-day">{date(activity.start)}</div>}
        {'count' in activity ? <><div className="timeline-item"><div className="timeline-time">{time(activity.start)}–{time(activity.end)}</div><div><strong>{t(activity.count === 2
          ? style === 'teglia' ? 'timelineLabels.singleTray' : 'timelineLabels.singlePizza'
          : style === 'teglia' ? 'result.batchGroupTrays' : 'result.batchGroupRound', { count: activity.count, minutes: activity.cadenceMinutes, time: time(activity.end) })}</strong></div></div>{activity.start.toDateString() !== activity.end.toDateString() && <div className="timeline-day">{date(activity.end)}</div>}</>
          : <div className="timeline-item"><div className="timeline-time">{time(activity.start)}–{time(activity.end)}</div><div><strong>{t(`activities.${activity.code}`)}{activity.batch && batchCount > 1 ? ` · ${t(style === 'teglia' ? 'timelineLabels.firstTray' : 'timelineLabels.firstPizza')}` : ''}</strong><p>{t(`tips.${activity.tipCode ?? activity.code}`)}</p></div></div>}
      </li>;
    })}
  </ol></div>;
}
