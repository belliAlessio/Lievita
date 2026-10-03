import { useTranslation } from 'react-i18next';
import { formatDoseGrams, formatNumber } from '../i18n/format';
import type { DoughMasses } from '../domain/dough';
import type { computeRecipe } from '../domain/model';
import type { Schedule } from '../domain/schedule';
import type { Locale } from '../state/form';
import type { Style } from '../domain/model';
import { Timeline } from './Timeline';

type Recipe = ReturnType<typeof computeRecipe>;
export function ResultCard({ dough, recipe, plan, locale, style }: { dough?: DoughMasses; recipe?: Recipe; plan?: Schedule; locale: Locale; style: Style }) {
  const { t } = useTranslation();
  const grams = (value: number, resolution = 1) => formatDoseGrams(value, resolution, locale, t('units.grams'));
  const date = (value: Date) => new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
  return <aside className="result-card" role="region" tabIndex={0} aria-labelledby="result-heading">
    <h2 className="sr-only" id="result-heading">{t('labels.result')}</h2>
    <div className="result-top"><span className="result-mark">✦</span><span className="result-badge">{t('result.badge')}</span></div>
    {dough && recipe ? <>
      <p className="result-caption">{t('labels.total')}</p><p className="mass-total">{grams(dough.total)}</p>
      <h3>{t('labels.ingredients')}</h3><dl className="ingredients">
        {(['flour', 'water', 'salt', ...(dough.oil > 0 ? ['oil' as const] : []), 'yeast'] as const).map((key) => <div key={key}><dt>{t(key === 'yeast' ? 'labels.yeastAmount' : `labels.${key}`)}{key === 'yeast' ? ` · ${t(recipe.yeast === 'dry' ? 'labels.dry' : 'labels.fresh')}` : ''}</dt><dd>{key === 'yeast' && plan?.status !== 'ok' ? '—' : grams(dough[key], key === 'yeast' ? 0.1 : 1)}</dd></div>)}
      </dl>
      <h3>{t('labels.calculated')}</h3><div className="parameter-chips">
        {([['hydration', recipe.percentages.water], ['salt', recipe.percentages.salt], ['oil', recipe.percentages.oil], ['yeastAmount', recipe.percentages.yeast]] as const).map(([key, amount]) => <div className="chip" key={key}><small>{t(`labels.${key}`)}</small><strong>{key === 'yeastAmount' && plan?.status !== 'ok' ? '—' : `${formatNumber(amount, locale, 4)}%`}</strong></div>)}
        <div className="chip"><small>{t('labels.band')}</small><strong>{t(`labels.${recipe.band}`)}</strong></div>
      </div>
    </> : <p className="result-empty">{t('labels.noDough')}</p>}
    {plan && <div className="plan-result"><span className={`plan-badge ${plan.status === 'ok' ? 'success' : 'warning'}`}>{t(`result.status.${plan.status}`)}</span>
      {plan.status !== 'ok' && <p className="plan-warning">{t(`result.message.${plan.status}`, { date: plan.alternative ? date(plan.alternative) : '' })}</p>}
      {plan.status === 'ok' && <><p className="fermentation-time">{t('labels.fermentation')}: <strong>{formatNumber(plan.fermentationHours, locale, 1)} {t('units.hours')}</strong></p><Timeline activities={plan.activities} locale={locale} style={style} /></>}
      {plan.warnings.map((code) => <p className="plan-warning" key={code}>{t(`scheduleWarnings.${code}`)}</p>)}
    </div>}
    {dough && plan?.status !== 'ok' && <p className="result-empty">{t('provisional')}</p>}
    {!plan && <p className="result-empty">{t('labels.noTimeline')}</p>}
    <p className="disclaimer">{t('result.disclaimer')}</p>
  </aside>;
}
