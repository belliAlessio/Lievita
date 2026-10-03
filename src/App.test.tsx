// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App from './App';
import i18n from './i18n';

const startTime = '2026-06-15T09:00';
const serviceTime = '2026-06-15T19:00';
async function enterPlan(user: ReturnType<typeof userEvent.setup>, hours = 10) {
  await user.type(screen.getByLabelText('Inizio impasto'), startTime);
  const service = new Date(new Date(startTime).getTime() + hours * 3_600_000);
  const local = new Date(service.getTime() - service.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await user.type(screen.getByLabelText('Prima pizza pronta'), local);
}
async function selectLanguage(user: ReturnType<typeof userEvent.setup>, value: 'it' | 'en') {
  await user.click(screen.getByRole('button', { name: /^(Lingua|Language):/ }));
  await user.click(screen.getByRole('menuitemradio', { name: value === 'it' ? 'Italiano' : 'English' }));
}

describe('pizza calculator', () => {
  beforeEach(async () => { localStorage.clear(); vi.spyOn(window, 'confirm').mockReturnValue(true); await i18n.changeLanguage('it'); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

  it('starts with default amounts, empty planning dates, and no timeline or initial date errors', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Lievita.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Numero di pizze')).toHaveValue('4');
    expect(screen.getByLabelText('Inizio impasto')).toHaveValue('');
    expect(screen.getByLabelText('Prima pizza pronta')).toHaveValue('');
    expect(document.querySelector('.timeline')).not.toBeInTheDocument();
    expect(document.querySelector('.error-summary')).not.toBeInTheDocument();
    expect(document.querySelector('.result-card')).toHaveTextContent(/Inserisci inizio impasto e prima pizza pronta/);
    expect(document.querySelector('.mass-total')).toHaveTextContent('1000 g');
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(document.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Risultato' })).toHaveAttribute('tabindex', '0');
    expect(screen.queryByText('Lingua')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
  it('prints a valid plan with ingredient amounts, choices and timeline in the selected language', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup(); render(<App />);
    expect(screen.queryByRole('button', { name: 'Stampa scheda' })).not.toBeInTheDocument();
    await enterPlan(user);
    const sheet = document.querySelector('.print-details');
    expect(sheet).toHaveTextContent('Scheda impasto');
    expect(sheet).toHaveTextContent('Napoletana');
    expect(sheet).toHaveTextContent('250 g');
    expect(document.querySelector('.result-card .ingredients')).toHaveTextContent('Farina');
    expect(document.querySelector('.result-card .timeline')).toHaveTextContent('Impasta');
    await selectLanguage(user, 'en');
    expect(sheet).toHaveTextContent('Dough sheet');
    expect(sheet).toHaveTextContent('Neapolitan');
    await user.click(screen.getByRole('button', { name: 'Print sheet' }));
    expect(print).toHaveBeenCalledOnce();
  });
  it('does not offer printing for a provisional or invalid plan and summarizes tray dimensions', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('radio', { name: 'Teglia' }));
    await user.type(screen.getByLabelText('Inizio impasto'), startTime);
    expect(screen.queryByRole('button', { name: 'Stampa scheda' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Prima pizza pronta'), serviceTime);
    expect(document.querySelector('.print-details')).toHaveTextContent('Rettangolare · 30 × 40 cm');
    await user.clear(screen.getByLabelText('Numero di teglie'));
    expect(screen.queryByRole('button', { name: 'Stampa scheda' })).not.toBeInTheDocument();
    expect(document.querySelector('.print-details')).not.toBeInTheDocument();
  });
  it('ignores and deletes legacy saved values and resets on remount without touching other storage', async () => {
    localStorage.setItem('ricetta-pi-saved-state', JSON.stringify({ count: '50' }));
    localStorage.setItem('ricetta-pi-language', 'en');
    localStorage.setItem('unrelated', 'keep');
    const user = userEvent.setup(); const view = render(<StrictMode><App /></StrictMode>);
    expect(localStorage.getItem('ricetta-pi-saved-state')).toBeNull();
    expect(localStorage.getItem('ricetta-pi-language')).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep');
    await enterPlan(user);
    const count = screen.getByLabelText('Numero di pizze');
    await user.clear(count); await user.type(count, '3');
    expect(document.querySelector('.timeline')).toBeInTheDocument();
    await selectLanguage(user, 'en');
    expect(localStorage.getItem('ricetta-pi-saved-state')).toBeNull();
    expect(localStorage.getItem('ricetta-pi-language')).toBeNull();
    view.unmount();
    // A real refresh also reinitializes i18n, whose default is Italian.
    await i18n.changeLanguage('it');
    render(<App />);
    expect(screen.getByLabelText('Numero di pizze')).toHaveValue('4');
    expect(screen.getByLabelText('Inizio impasto')).toHaveValue('');
    expect(document.querySelector('.timeline')).not.toBeInTheDocument();
  });
  it('resets edited fields and timeline on confirmation, with visible feedback', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('radio', { name: 'Teglia' }));
    await user.click(screen.getByRole('radio', { name: /^Tonda$/ }));
    const diameter = screen.getByLabelText('Diametro (cm)');
    await user.clear(diameter); await user.type(diameter, '45');
    await user.click(screen.getByRole('radio', { name: 'Secco' }));
    await user.click(screen.getByRole('radio', { name: 'Impastatrice' }));
    await user.click(screen.getByRole('radio', { name: 'Ambiente + frigo' }));
    await enterPlan(user, 24);
    await selectLanguage(user, 'en');
    const protein = screen.getByLabelText('Flour protein (%)');
    await user.clear(protein); await user.type(protein, '13');
    const count = screen.getByLabelText('Number of trays');
    await user.clear(count); await user.type(count, '3');
    expect(document.querySelector('.timeline')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.getByRole('button', { name: /^Lingua: Italiano/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('radio', { name: 'Napoletana' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Fresco' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'A mano' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Solo ambiente' })).toBeChecked();
    expect(screen.getByLabelText('Proteine della farina (%)')).toHaveValue('12,5');
    expect(screen.getByLabelText('Numero di pizze')).toHaveValue('4');
    expect(screen.getByLabelText('Peso panetto (g)')).toHaveValue('250');
    expect(screen.getByLabelText('Inizio impasto')).toHaveValue('');
    expect(screen.getByLabelText('Prima pizza pronta')).toHaveValue('');
    expect(document.querySelector('.timeline')).not.toBeInTheDocument();
    expect(document.querySelector('.error-summary')).not.toBeInTheDocument();
    expect(document.querySelector('.reset-feedback')).toHaveTextContent('tabella di marcia cancellata');
    await user.click(screen.getByRole('radio', { name: 'Teglia' }));
    expect(screen.getByRole('radio', { name: 'Rettangolare' })).toBeChecked();
    expect(screen.getByLabelText('Lunghezza (cm)')).toHaveValue('30');
    expect(screen.getByLabelText('Larghezza (cm)')).toHaveValue('40');
  });
  it('does not reset the form when confirmation is cancelled', async () => {
    const user = userEvent.setup(); render(<App />);
    await enterPlan(user);
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await user.click(screen.getByRole('button', { name: 'Ricomincia' }));
    expect(screen.getByLabelText('Inizio impasto')).toHaveValue(startTime);
    expect(document.querySelector('.timeline')).toBeInTheDocument();
  });
  it('updates hydration when flour protein changes', async () => {
    const user = userEvent.setup(); render(<App />);
    expect(screen.getByText('60%')).toBeInTheDocument();
    const protein = screen.getByLabelText('Proteine della farina (%)');
    await user.clear(protein); await user.type(protein, '13');
    expect(screen.getByText('62,5%')).toBeInTheDocument();
  });
  it('uses Roman round ball weight and fixed tray load', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('radio', { name: 'Tonda romana' }));
    expect(screen.getByLabelText('Peso panetto (g)')).toHaveValue('180');
    await user.click(screen.getByRole('radio', { name: 'Teglia' }));
    expect(screen.getByLabelText('Numero di teglie')).toBeInTheDocument();
    expect(document.querySelector('.mass-total')).toHaveTextContent('2400 g');
  });
  it('shows a timeline only after both dates are entered', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.type(screen.getByLabelText('Inizio impasto'), startTime);
    expect(document.querySelector('.timeline')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Prima pizza pronta')).toHaveAttribute('aria-invalid', 'true');
    await user.type(screen.getByLabelText('Prima pizza pronta'), serviceTime);
    expect(document.querySelector('.timeline')).toBeInTheDocument();
    expect(screen.getByText('Impasta')).toBeInTheDocument();
  });
  it('includes a fridge phase when enough time is provided', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('radio', { name: 'Ambiente + frigo' }));
    await enterPlan(user, 24);
    expect(screen.getByText('Riposo in frigo (in massa)')).toBeInTheDocument();
  });
  it('schedules tray spreading only after bulk fridge rest and acclimation', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('radio', { name: 'Teglia' }));
    await user.click(screen.getByRole('radio', { name: 'Ambiente + frigo' }));
    await enterPlan(user, 24);
    const timeline = Array.from(document.querySelectorAll('.timeline .timeline-item strong')).map((item) => item.textContent);
    expect(timeline.indexOf('Riposo in frigo (in massa)')).toBeLessThan(timeline.indexOf('Stendi nelle teglie'));
    expect(timeline.indexOf('Acclimatamento in massa')).toBeLessThan(timeline.indexOf('Stendi nelle teglie'));
    expect(timeline.indexOf('Stendi nelle teglie')).toBeLessThan(timeline.indexOf('Riposo in teglia'));
    expect(screen.getByText(/Teglie 2–4:/)).toBeInTheDocument();
  });
  it('suggests a later service when fridge time is too short', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('radio', { name: 'Ambiente + frigo' }));
    await enterPlan(user);
    expect(screen.getByText(/Servono almeno 6 ore in frigo:.*alle \d/)).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });
  it('switches it-en-it while preserving valid protein and dough result', async () => {
    const user = userEvent.setup(); render(<App />);
    await selectLanguage(user, 'en');
    expect(screen.getByLabelText('Flour protein (%)')).toHaveValue('12.5');
    expect(document.querySelector('.mass-total')).toBeInTheDocument();
    await selectLanguage(user, 'it');
    expect(screen.getByLabelText('Proteine della farina (%)')).toHaveValue('12,5');
  });
  it('opens a custom language menu with keyboard controls and dismisses it outside', async () => {
    const user = userEvent.setup(); render(<App />);
    const trigger = screen.getByRole('button', { name: /^Lingua: Italiano/ });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Italiano' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'English' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitemradio', { name: 'English' })).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(trigger).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitemradio', { name: 'English' })).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(trigger);
    await user.tab();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(trigger);
    await user.click(screen.getByRole('heading', { name: 'Lievita.' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
  it('keeps the menu open on a null blur target until a language is selected', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('button', { name: /^Lingua:/ }));
    fireEvent.blur(screen.getByRole('menuitemradio', { name: 'Italiano' }), { relatedTarget: null });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(screen.getByRole('menuitemradio', { name: 'English' }));
    expect(screen.getByRole('button', { name: /^Language: English/ })).toHaveAttribute('aria-expanded', 'false');
  });
  it('shows errors for invalid counts and withholds dough results', async () => {
    const user = userEvent.setup(); render(<App />);
    const count = screen.getByLabelText('Numero di pizze');
    await user.clear(count); await user.type(count, '201');
    expect(count).toHaveAttribute('aria-invalid', 'true');
    expect(document.querySelector('.mass-total')).not.toBeInTheDocument();
    expect(document.querySelector('.error-summary a[href="#count"]')).toBeInTheDocument();
  });
  it('keeps dough quantities visible but withholds yeast when planning is invalid', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.type(screen.getByLabelText('Inizio impasto'), startTime);
    expect(document.querySelector('.mass-total')).toBeInTheDocument();
    expect(document.querySelector('.timeline')).not.toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByText(/Lievito calcolato quando la pianificazione è valida/)).toBeInTheDocument();
  });
  it('keeps source-locale-invalid English text invalid in Italian until edited', async () => {
    const user = userEvent.setup(); render(<App />);
    await selectLanguage(user, 'en');
    const weight = screen.getByLabelText('Dough ball weight (g)');
    await user.clear(weight); await user.type(weight, '2,500');
    await selectLanguage(user, 'it');
    expect(screen.getByLabelText('Peso panetto (g)')).toHaveValue('2,500');
    expect(screen.getByLabelText('Peso panetto (g)')).toHaveAttribute('aria-invalid', 'true');
    await user.clear(screen.getByLabelText('Peso panetto (g)'));
    await user.type(screen.getByLabelText('Peso panetto (g)'), '250');
    expect(document.querySelector('.mass-total')).toBeInTheDocument();
  });
  it('keeps source-locale-invalid Italian text invalid in English until edited', async () => {
    const user = userEvent.setup(); render(<App />);
    const weight = screen.getByLabelText('Peso panetto (g)');
    await user.clear(weight); await user.type(weight, '1.000');
    await selectLanguage(user, 'en');
    expect(screen.getByLabelText('Dough ball weight (g)')).toHaveAttribute('aria-invalid', 'true');
    await selectLanguage(user, 'it');
    expect(screen.getByLabelText('Peso panetto (g)')).toHaveAttribute('aria-invalid', 'true');
  });
  it('groups repeated batches and warns about a long service window', async () => {
    const user = userEvent.setup(); render(<App />);
    await enterPlan(user);
    const protein = screen.getByLabelText('Proteine della farina (%)');
    await user.clear(protein); await user.type(protein, '13');
    const count = screen.getByLabelText('Numero di pizze');
    await user.clear(count); await user.type(count, '60');
    expect(document.querySelector('.timeline')).toBeInTheDocument();
    expect(screen.getByText(/L'ultima pizza fermenta molto più a lungo/)).toBeInTheDocument();
    expect(screen.getByText(/Pizze 2–60/)).toBeInTheDocument();
  });
  it('rejects quantity bounds and shows alternative start for a too-long plan', async () => {
    const user = userEvent.setup(); render(<App />);
    const weight = screen.getByLabelText('Peso panetto (g)');
    await user.clear(weight); await user.type(weight, '5001');
    expect(weight).toHaveAttribute('aria-invalid', 'true');
    await user.clear(weight); await user.type(weight, '250');
    await enterPlan(user, 30);
    expect(screen.getByText(/Inizio alternativo: .+\d/)).toBeInTheDocument();
  });
});
