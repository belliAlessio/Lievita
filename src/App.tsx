import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { doughMassForTray } from './domain/area';
import { calculateDough } from './domain/dough';
import { computeRecipe, maxFermentationHours, proteinBand, PROTEIN_MAX, PROTEIN_MIN, TRAY_LOAD, type Style } from './domain/model';
import { parseLocalDateTime, planSchedule } from './domain/schedule';
import { MAX_PIECE_WEIGHT, MAX_TRAY_DIMENSION, normalizeNumericInputLocale, parseFormNumber, type ForeignInvalid, type FormState, type Locale } from './state/form';
import { NumberField } from './components/NumberField';
import { Segmented } from './components/Segmented';
import { ResultCard } from './components/ResultCard';
import { PizzaLogo } from './components/PizzaLogo';
import { formatDoseGrams } from './i18n/format';

const numericFields = ['protein', 'count', 'pieceWeight', 'length', 'width', 'diameter'] as const;
type NumericField = typeof numericFields[number];
const defaultForm = (locale: Locale): FormState => ({ style: 'napoletana', protein: locale === 'it' ? '12,5' : '12.5', yeast: 'fresh', method: 'hand', count: '4', pieceWeight: '250', shape: 'rectangle', length: '30', width: '40', diameter: '30', start: '', service: '', program: 'room' });
const convertForm = (form: FormState, from: Locale, to: Locale): FormState => ({ ...form, ...Object.fromEntries(numericFields.map((key) => [key, normalizeNumericInputLocale(form[key], from, to)])) });

export default function App() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'it';
  const [form, setForm] = useState<FormState>(() => defaultForm(locale));
  // Text invalid in its source language must not become valid simply because a
  // different locale interprets the same punctuation differently.
  const [foreignInvalid, setForeignInvalid] = useState<ForeignInvalid>({});
  const [cleared, setCleared] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const languagePicker = useRef<HTMLDivElement>(null);
  const languageTrigger = useRef<HTMLButtonElement>(null);
  const focusLastLanguage = useRef(false);

  useEffect(() => {
    if (!languageOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!languagePicker.current?.contains(event.target as Node)) setLanguageOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    const options = languagePicker.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
    (focusLastLanguage.current ? options?.[options.length - 1] : languagePicker.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]'))?.focus();
    focusLastLanguage.current = false;
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [languageOpen]);

  useEffect(() => {
    try {
      localStorage.removeItem('ricetta-pi-saved-state');
      localStorage.removeItem('ricetta-pi-language');
    } catch { /* Storage may be unavailable. */ }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t('app.documentTitle');
  }, [locale, t]);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setCleared(false);
    if (numericFields.some((field) => field === key)) setForeignInvalid((current) => {
      const updated = { ...current };
      delete updated[key as NumericField];
      return updated;
    });
    setForm((current) => ({ ...current, [key]: value, ...(key === 'start' ? { startChoice: undefined } : key === 'service' ? { serviceChoice: undefined } : {}) }));
  };
  const changeStyle = (style: Style) => {
    setCleared(false);
    if (style !== 'teglia') setForeignInvalid((current) => {
      const updated = { ...current };
      delete updated.pieceWeight;
      return updated;
    });
    setForm((current) => ({ ...current, style, pieceWeight: style === 'romana' ? '180' : style === 'napoletana' ? '250' : current.pieceWeight }));
  };
  const changeLanguage = (next: Locale) => {
    if (next === locale) return;
    setCleared(false);
    const invalid = { ...foreignInvalid };
    for (const field of numericFields) {
      if (invalid[field]) continue;
      const parsed = parseFormNumber(form[field], locale, field, field === 'count');
      if (!parsed.ok) invalid[field] = parsed.error.code;
    }
    setForeignInvalid(invalid);
    setForm((current) => convertForm(current, locale, next));
    void i18n.changeLanguage(next);
  };
  const onLanguageKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setLanguageOpen(false);
      languageTrigger.current?.focus();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
      const current = options.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
        : (current + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length;
      options[next]?.focus();
      event.preventDefault();
    }
  };

  const derived = useMemo(() => {
    const errors: Record<string, string> = {};
    const planningErrors: Record<string, string> = {};
    const number = (key: NumericField, destination = errors, integer = false): number | undefined => {
      if (foreignInvalid[key]) { destination[key] = t(`errors.${foreignInvalid[key]}`); return; }
      const value = parseFormNumber(form[key], locale, key, integer);
      if (!value.ok) { destination[key] = t(`errors.${value.error.code}`); return; }
      return value.value;
    };
    const protein = number('protein');
    if (protein !== undefined && (protein < PROTEIN_MIN || protein > PROTEIN_MAX)) errors.protein = t('errors.protein_range');
    const count = number('count', errors, true);
    if (count !== undefined && (count < 1 || count > 200)) errors.count = t('errors.invalid_count');
    let weight: number | undefined;
    let length: number | undefined;
    let width: number | undefined;
    let diameter: number | undefined;
    if (form.style !== 'teglia') {
      weight = number('pieceWeight');
      if (weight !== undefined && (weight <= 0 || weight > MAX_PIECE_WEIGHT)) errors.pieceWeight = t(weight <= 0 ? 'errors.not_positive' : 'errors.piece_weight_range');
    } else if (form.shape === 'rectangle') {
      length = number('length'); width = number('width');
      if (length !== undefined && (length <= 0 || length > MAX_TRAY_DIMENSION)) errors.length = t(length <= 0 ? 'errors.not_positive' : 'errors.dimension_range');
      if (width !== undefined && (width <= 0 || width > MAX_TRAY_DIMENSION)) errors.width = t(width <= 0 ? 'errors.not_positive' : 'errors.dimension_range');
    } else {
      diameter = number('diameter');
      if (diameter !== undefined && (diameter <= 0 || diameter > MAX_TRAY_DIMENSION)) errors.diameter = t(diameter <= 0 ? 'errors.not_positive' : 'errors.dimension_range');
    }
    const start = parseLocalDateTime(form.start);
    const service = parseLocalDateTime(form.service);
    if (form.start || form.service) {
      for (const [field, parsed, choice] of [['start', start, form.startChoice], ['service', service, form.serviceChoice]] as const) {
        if (parsed.kind === 'invalid' || parsed.kind === 'nonexistent') planningErrors[field] = t(`errors.${parsed.code}`);
        if (parsed.kind === 'ambiguous' && !choice) planningErrors[field] = t('errors.ambiguous_local_time');
      }
    }
    const choose = (value: typeof start, choice?: 'first' | 'second') => value.kind === 'valid' ? value.date : value.kind === 'ambiguous' && choice ? value.dates[choice === 'first' ? 0 : 1] : undefined;
    const begin = choose(start, form.startChoice);
    const ready = choose(service, form.serviceChoice);
    let plan;
    if (begin && ready && count !== undefined && !errors.count && protein !== undefined && !errors.protein) plan = planSchedule({ start: begin, service: ready, program: form.program, method: form.method, itemCount: count, style: form.style, band: proteinBand(protein) });
    const band = protein !== undefined && !errors.protein ? proteinBand(protein) : undefined;
    // An invalid plan has no actionable yeast dose. Use a bounded fraction only for
    // the internal mass split so flour + other ingredients + withheld yeast stays at M.
    // With a valid serial plan the midpoint is an explicit APP CHOICE: later items
    // ferment longer than the first, so anchor the single yeast dose between them.
    const indicativeHours = plan?.status === 'ok' && plan.lastFermentationHours !== undefined
      ? (plan.fermentationHours + plan.lastFermentationHours) / 2 : plan?.fermentationHours;
    const fermentationHours = band ? Math.min(Math.max(Number.isFinite(indicativeHours) ? indicativeHours! : 8, 2), maxFermentationHours(band, form.program)) : 8;
    const recipe = band ? computeRecipe({ style: form.style, proteinPercent: protein!, yeast: form.yeast, program: form.program, fermentationHours }) : undefined;
    let dough;
    if (recipe && count !== undefined && !Object.keys(errors).length) {
      try {
        const mass = form.style === 'teglia' ? count * doughMassForTray(form.shape === 'rectangle' ? { kind: 'rectangle', lengthCm: length!, widthCm: width! } : { kind: 'circle', diameterCm: diameter! }, TRAY_LOAD) : count * weight!;
        const outcome = calculateDough({ totalMassGrams: mass, percentages: recipe.percentages });
        if (outcome.ok) dough = outcome.masses;
        else errors[form.style === 'teglia' ? form.shape === 'circle' ? 'diameter' : 'length' : 'pieceWeight'] = t('errors.out_of_range');
      } catch { errors[form.style === 'teglia' ? form.shape === 'circle' ? 'diameter' : 'length' : 'pieceWeight'] = t('errors.out_of_range'); }
    }
    return { errors, planningErrors, dough, recipe, plan, start, service };
  }, [form, foreignInvalid, locale, t]);

  const field = (key: typeof numericFields[number], label: string, integer = false) => <NumberField id={key} label={label} value={form[key]} onChange={(value) => set(key, value)} error={derived.errors[key]} integer={integer} />;
  const dateField = (key: 'start' | 'service') => {
    const parsed = derived[key];
    const dateLabel = t(`labels.${key}`);
    return <div className="field"><label htmlFor={key}>{dateLabel}</label><input id={key} type="datetime-local" value={form[key]} aria-invalid={Boolean(derived.planningErrors[key])} aria-describedby={derived.planningErrors[key] ? `${key}-error` : undefined} onChange={(event) => set(key, event.target.value)} />
      {derived.planningErrors[key] && <small className="field-error" id={`${key}-error`}>{derived.planningErrors[key]}</small>}
      {parsed.kind === 'ambiguous' && <fieldset className="dst-choice"><legend>{t('ui.dateChoice', { field: dateLabel })}</legend>{(['first', 'second'] as const).map((choice, index) => <label key={choice}><input type="radio" name={`${key}-occurrence`} checked={form[`${key}Choice`] === choice} onChange={() => set(`${key}Choice`, choice)} />{t(choice === 'first' ? 'ui.firstOccurrence' : 'ui.secondOccurrence')} — {new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-GB', { timeStyle: 'short', timeZoneName: 'short' }).format(parsed.dates[index])}</label>)}</fieldset>}
    </div>;
  };
  const summary = { ...derived.errors, ...derived.planningErrors };
  const resetForm = () => {
    if (!window.confirm(t('actions.confirmReset'))) return;
    setLanguageOpen(false);
    setForeignInvalid({});
    setForm(defaultForm('it')); setCleared(true);
    void i18n.changeLanguage('it');
  };

  const liveMessage = cleared ? t('actions.resetFeedback') : Object.keys(summary).length
    ? t('ui.errorsCount', { count: Object.keys(summary).length })
    : derived.dough ? t('ui.liveResult', { mass: formatDoseGrams(derived.dough.total, 1, locale, t('units.grams')), status: derived.plan ? t(`result.status.${derived.plan.status}`) : t(form.start || form.service ? 'labels.noTimeline' : 'labels.timelinePrompt') }) : '';

  return <div className="page-shell"><header className="site-header"><div className="brand"><PizzaLogo /><div><p className="eyebrow">{t('app.eyebrow')}</p><h1>{t('app.title')}<span className="brand-period">.</span></h1><p className="subtitle">{t('app.subtitle')}</p></div></div><div className="language-picker" ref={languagePicker} onKeyDown={onLanguageKeyDown} onBlur={(event) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setLanguageOpen(false);
  }}>
    <button ref={languageTrigger} type="button" className="language-trigger" aria-label={`${t('app.language')}: ${t(locale === 'it' ? 'app.languageItalian' : 'app.languageEnglish')} (${locale.toUpperCase()})`} aria-haspopup="menu" aria-expanded={languageOpen} aria-controls={languageOpen ? 'language-menu' : undefined} onClick={() => { focusLastLanguage.current = false; setLanguageOpen((open) => !open); }} onKeyDown={(event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); event.stopPropagation();
        if (languageOpen) languagePicker.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')[event.key === 'ArrowUp' ? 1 : 0]?.focus();
        else { focusLastLanguage.current = event.key === 'ArrowUp'; setLanguageOpen(true); }
      }
    }}><span aria-hidden="true" className="language-globe">◎</span>{locale.toUpperCase()}<span aria-hidden="true" className="language-chevron" /></button>
    {languageOpen && <div id="language-menu" className="language-menu" role="menu" aria-label={t('app.language')}>
      {(['it', 'en'] as const).map((value) => <button key={value} type="button" role="menuitemradio" tabIndex={-1} aria-checked={locale === value} className="language-option" onClick={() => { changeLanguage(value); setLanguageOpen(false); languageTrigger.current?.focus(); }}>{t(value === 'it' ? 'app.languageItalian' : 'app.languageEnglish')}<span aria-hidden="true">{locale === value ? '✓' : ''}</span></button>)}
    </div>}
  </div></header>
    <main>{Object.keys(summary).length > 0 && <div className="error-summary"><strong>{t('ui.inputErrors')}</strong><ul>{Object.entries(summary).map(([key, message]) => <li key={key}><a href={`#${key}`}>{message} — {t(key === 'count' ? form.style === 'teglia' ? 'labels.countTrays' : 'labels.countRound' : `labels.${key}`)}</a></li>)}</ul></div>}
      <div className="workspace"><div className="step-stack">
        <section className="step-card"><div className="step-heading"><span className="step-number">01</span><div><h2>{t('steps.style')}</h2><p>{t('steps.styleHint')}</p></div></div><Segmented name="style" label={t('labels.style')} value={form.style} options={(['napoletana', 'teglia', 'romana'] as Style[]).map((value) => ({ value, label: t(`styles.${value}`) }))} onChange={changeStyle} /></section>
        <section className="step-card"><div className="step-heading"><span className="step-number">02</span><div><h2>{t('steps.flour')}</h2><p>{t('steps.flourHint')}</p></div></div><div className="step-fields">{field('protein', t('labels.protein'))}<Segmented name="yeast" label={t('labels.yeast')} value={form.yeast} options={[{ value: 'fresh', label: t('labels.fresh') }, { value: 'dry', label: t('labels.dry') }]} onChange={(value) => set('yeast', value)} /><Segmented name="method" label={t('labels.method')} value={form.method} options={[{ value: 'hand', label: t('labels.hand') }, { value: 'mixer', label: t('labels.mixer') }]} onChange={(value) => set('method', value)} /></div></section>
        <section className="step-card"><div className="step-heading"><span className="step-number">03</span><div><h2>{t('steps.quantity')}</h2><p>{t('steps.quantityHint')}</p></div></div><div className="step-fields">{field('count', t(form.style === 'teglia' ? 'labels.countTrays' : 'labels.countRound'), true)}{form.style !== 'teglia' ? field('pieceWeight', t('labels.pieceWeight')) : <><Segmented name="shape" label={t('labels.shape')} value={form.shape} options={[{ value: 'rectangle', label: t('labels.rectangle') }, { value: 'circle', label: t('labels.circle') }]} onChange={(value) => set('shape', value)} />{form.shape === 'rectangle' ? <div className="dimension-fields">{field('length', t('labels.length'))}{field('width', t('labels.width'))}</div> : field('diameter', t('labels.diameter'))}</>}</div></section>
        <section className="step-card"><div className="step-heading"><span className="step-number">04</span><div><h2>{t('steps.planning')}</h2><p>{t('steps.planningHint')}</p></div></div><div className="step-fields"><div className="dimension-fields">{dateField('start')}{dateField('service')}</div><Segmented name="program" label={t('labels.program')} value={form.program} options={[{ value: 'room', label: t('labels.room') }, { value: 'fridge', label: t('labels.fridge') }]} onChange={(value) => set('program', value)} /></div></section>
      </div><ResultCard dough={derived.dough} recipe={derived.recipe} plan={derived.plan} locale={locale} form={form} planningStarted={Boolean(form.start || form.service)} /></div>
    </main><footer><p>{t('app.footer')}</p><button type="button" className="clear-button" onClick={resetForm}>{t('actions.resetForm')}</button><div className={cleared ? 'reset-feedback' : 'sr-only'} aria-live="polite">{liveMessage}</div></footer></div>;
}
