// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App from './App';
import i18n from './i18n';

describe('pizza calculator', () => {
  beforeEach(async () => { localStorage.clear(); vi.spyOn(window, 'confirm').mockReturnValue(true); await i18n.changeLanguage('it'); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

  it('renders a complete default recipe and timeline without removed controls', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Lievita.' })).toBeInTheDocument();
    expect(document.title).toContain('Lievita');
    expect(document.querySelector('.brand svg[aria-hidden="true"]')).toBeInTheDocument();
    expect(document.querySelector('.mass-total')).toBeInTheDocument();
    expect(document.querySelector('.timeline')).toBeInTheDocument();
    expect(screen.getByText('Idratazione')).toBeInTheDocument();
    expect(screen.queryByText('Carico impasto (g/cm²)')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Forno' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Fonti e limiti' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Acqua (%)')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Risultato' })).toHaveAttribute('tabindex', '0');
    expect(document.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    expect(document.querySelector('[aria-live]')).toHaveTextContent(/Impasto totale 1000 g/);
  });
  it('updates hydration when flour protein changes', async () => {
    const user = userEvent.setup(); render(<App />);
    expect(screen.getByText('60%')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Proteine della farina (%)'));
    await user.type(screen.getByLabelText('Proteine della farina (%)'), '13');
    expect(screen.getByText('62,5%')).toBeInTheDocument();
  });
  it('uses the Roman round default ball weight and fixed tray load', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('radio', { name: 'Tonda romana' }));
    expect(screen.getByLabelText('Peso panetto (g)')).toHaveValue('180');
    await user.click(screen.getByRole('radio', { name: 'Teglia' }));
    expect(screen.getByLabelText('Numero di teglie')).toBeInTheDocument();
    expect(document.querySelector('.mass-total')).toHaveTextContent('2400 g');
  });
  it('automatically includes a fridge phase when there is enough time', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('radio', { name: 'Ambiente + frigo' }));
    const start = screen.getByLabelText('Inizio impasto') as HTMLInputElement;
    const begin = new Date(start.value); const later = new Date(begin.getTime() + 24 * 3_600_000);
    const local = new Date(later.getTime() - later.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    const service = screen.getByLabelText('Prima pizza pronta');
    await user.clear(service); await user.type(service, local);
    expect(screen.getByText('Riposo in frigo (in massa)')).toBeInTheDocument();
  });
  it('schedules tray spreading only after bulk fridge rest and acclimation', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('radio', { name: 'Teglia' }));
    await user.click(screen.getByRole('radio', { name: 'Ambiente + frigo' }));
    const start = screen.getByLabelText('Inizio impasto') as HTMLInputElement;
    const later = new Date(new Date(start.value).getTime() + 24 * 3_600_000);
    const local = new Date(later.getTime() - later.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    const service = screen.getByLabelText('Prima pizza pronta');
    await user.clear(service); await user.type(service, local);
    const timeline = Array.from(document.querySelectorAll('.timeline .timeline-item strong')).map((item) => item.textContent);
    expect(timeline.indexOf('Riposo in frigo (in massa)')).toBeLessThan(timeline.indexOf('Stendi nelle teglie'));
    expect(timeline.indexOf('Acclimatamento in massa')).toBeLessThan(timeline.indexOf('Stendi nelle teglie'));
    expect(timeline.indexOf('Stendi nelle teglie')).toBeLessThan(timeline.indexOf('Riposo in teglia'));
    expect(timeline.indexOf('Riposo in teglia')).toBeLessThan(timeline.findIndex((item) => item?.startsWith('Condisci la teglia')));
    expect(screen.getByText(/Teglie 2–4:/)).toBeInTheDocument();
  });
  it('fridge too short suggests a concrete later service time', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('radio', { name: 'Ambiente + frigo' }));
    expect(screen.getByText(/Servono almeno 6 ore in frigo:.*alle \d/)).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });
  it('switches it→en→it preserving protein and a valid dough result', async () => {
    const user = userEvent.setup(); render(<App />);
    expect(screen.getByLabelText('Proteine della farina (%)')).toHaveValue('12,5');
    await user.selectOptions(screen.getByLabelText('Lingua'), 'en');
    expect(await screen.findByLabelText('Flour protein (%)')).toHaveValue('12.5');
    expect(document.querySelector('.mass-total')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Language'), 'it');
    expect(await screen.findByLabelText('Proteine della farina (%)')).toHaveValue('12,5');
  });
  it('invalid count has a field error and no dough result', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.clear(screen.getByLabelText('Numero di pizze')); await user.type(screen.getByLabelText('Numero di pizze'), '201');
    expect(screen.getByLabelText('Numero di pizze')).toHaveAttribute('aria-invalid', 'true');
    expect(document.querySelector('.mass-total')).not.toBeInTheDocument();
    expect(document.querySelector('.error-summary a[href="#count"]')).toBeInTheDocument();
    expect(document.querySelector('[aria-live]')).toHaveTextContent(/campi da correggere/);
  });
  it('keeps dough quantities visible when only the planner is invalid', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.clear(screen.getByLabelText('Prima pizza pronta'));
    expect(document.querySelector('.mass-total')).toBeInTheDocument();
    expect(document.querySelector('.timeline')).not.toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByText(/Lievito calcolato quando la pianificazione è valida/)).toBeInTheDocument();
  });
  it('ignores old schema, displays notice without overwriting it, and clears saved data on confirmation', async () => {
    const user = userEvent.setup(); const stale = JSON.stringify({ schemaVersion: 2, state: {} });
    localStorage.setItem('ricetta-pi-saved-state', stale); render(<App />);
    expect(screen.getByText(/I dati salvati appartengono a una versione precedente/)).toBeInTheDocument();
    expect(localStorage.getItem('ricetta-pi-saved-state')).toBe(stale);
    await user.click(screen.getByRole('button', { name: 'Cancella dati salvati' }));
    await waitFor(() => expect(localStorage.getItem('ricetta-pi-saved-state')).toBeNull());
    expect(screen.queryByText(/I dati salvati appartengono a una versione precedente/)).not.toBeInTheDocument();
    expect(document.querySelector('[aria-live]')).toHaveTextContent(/Dati salvati cancellati/);
  });
  it('does not overwrite an old schema during StrictMode double mount', () => {
    const stale = JSON.stringify({ schemaVersion: 2, state: {} });
    localStorage.setItem('ricetta-pi-saved-state', stale);
    render(<StrictMode><App /></StrictMode>);
    expect(localStorage.getItem('ricetta-pi-saved-state')).toBe(stale);
  });
  it('rejects ambiguous English input and retains the last valid saved form', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.selectOptions(screen.getByLabelText('Lingua'), 'en');
    const count = screen.getByLabelText('Number of pizzas');
    await user.clear(count); await user.type(count, '2,500');
    expect(count).toHaveAttribute('aria-invalid', 'true');
    expect(document.querySelector('.error-summary a[href="#count"]')).toBeInTheDocument();
    const saved = localStorage.getItem('ricetta-pi-saved-state');
    expect(JSON.parse(saved!).state.count).toBe('2');
    await user.clear(count); await user.type(count, '3');
    await waitFor(() => expect(localStorage.getItem('ricetta-pi-saved-state')).not.toBe(saved));
  });
  it('keeps a source-locale-invalid English value invalid in Italian until edited', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.selectOptions(screen.getByLabelText('Lingua'), 'en');
    const weight = screen.getByLabelText('Dough ball weight (g)');
    await user.clear(weight); await user.type(weight, '2,500');
    expect(weight).toHaveAttribute('aria-invalid', 'true');
    await user.selectOptions(screen.getByLabelText('Language'), 'it');
    expect(screen.getByLabelText('Peso panetto (g)')).toHaveValue('2,500');
    expect(screen.getByLabelText('Peso panetto (g)')).toHaveAttribute('aria-invalid', 'true');
    expect(document.querySelector('.mass-total')).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Peso panetto (g)'));
    await user.type(screen.getByLabelText('Peso panetto (g)'), '250');
    expect(screen.getByLabelText('Peso panetto (g)')).not.toHaveAttribute('aria-invalid', 'true');
    expect(document.querySelector('.mass-total')).toBeInTheDocument();
  });
  it('keeps a source-locale-invalid Italian value invalid in English until edited', async () => {
    const user = userEvent.setup(); render(<App />);
    const weight = screen.getByLabelText('Peso panetto (g)');
    await user.clear(weight); await user.type(weight, '1.000');
    expect(weight).toHaveAttribute('aria-invalid', 'true');
    await user.selectOptions(screen.getByLabelText('Lingua'), 'en');
    expect(screen.getByLabelText('Dough ball weight (g)')).toHaveValue('1.000');
    expect(screen.getByLabelText('Dough ball weight (g)')).toHaveAttribute('aria-invalid', 'true');
    expect(document.querySelector('.mass-total')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Language'), 'it');
    expect(screen.getByLabelText('Peso panetto (g)')).toHaveAttribute('aria-invalid', 'true');
    await user.clear(screen.getByLabelText('Peso panetto (g)'));
    await user.type(screen.getByLabelText('Peso panetto (g)'), '250');
    expect(document.querySelector('.mass-total')).toBeInTheDocument();
  });
  it('saves valid visible fields even if a hidden dimension is invalid', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('radio', { name: 'Teglia' }));
    await user.clear(screen.getByLabelText('Lunghezza (cm)'));
    expect(screen.getByLabelText('Lunghezza (cm)')).toHaveAttribute('aria-invalid', 'true');
    await user.click(screen.getByRole('radio', { name: 'Napoletana' }));
    const count = screen.getByLabelText('Numero di pizze');
    await user.clear(count); await user.type(count, '3');
    expect(document.querySelector('.mass-total')).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem('ricetta-pi-saved-state')!);
    expect(saved.state).toMatchObject({ style: 'napoletana', count: '3', length: '30' });
  });
  it('sanitizes a source-invalid hidden English tray length across locale switch and reload', async () => {
    const user = userEvent.setup(); const view = render(<App />);
    await user.selectOptions(screen.getByLabelText('Lingua'), 'en');
    await user.click(screen.getByRole('radio', { name: 'Tray pizza' }));
    const length = screen.getByLabelText('Length (cm)');
    await user.clear(length); await user.type(length, '2,500');
    expect(length).toHaveAttribute('aria-invalid', 'true');
    await user.click(screen.getByRole('radio', { name: 'Neapolitan' }));
    await user.selectOptions(screen.getByLabelText('Language'), 'it');
    expect(JSON.parse(localStorage.getItem('ricetta-pi-saved-state')!).state.length).toBe('30');
    view.unmount();
    render(<App />);
    await user.click(screen.getByRole('radio', { name: 'Teglia' }));
    expect(screen.getByLabelText('Lunghezza (cm)')).toHaveValue('30');
  });
  it('sanitizes a source-invalid hidden Italian ball weight when switching to English', async () => {
    const user = userEvent.setup(); const view = render(<App />);
    const weight = screen.getByLabelText('Peso panetto (g)');
    await user.clear(weight); await user.type(weight, '1.000');
    expect(weight).toHaveAttribute('aria-invalid', 'true');
    await user.click(screen.getByRole('radio', { name: 'Teglia' }));
    await user.selectOptions(screen.getByLabelText('Lingua'), 'en');
    expect(JSON.parse(localStorage.getItem('ricetta-pi-saved-state')!).state.pieceWeight).toBe('250');
    view.unmount();
    render(<App />);
    expect(JSON.parse(localStorage.getItem('ricetta-pi-saved-state')!).state.pieceWeight).toBe('250');
    await user.click(screen.getByRole('radio', { name: 'Neapolitan' }));
    expect(screen.getByLabelText('Dough ball weight (g)')).toHaveValue('250');
  });
  it('uses singular batch labels for two items and omits the batch label for one', async () => {
    const user = userEvent.setup(); render(<App />);
    const count = screen.getByLabelText('Numero di pizze');
    await user.clear(count); await user.type(count, '1');
    expect(screen.queryByText(/· 1ª pizza/)).not.toBeInTheDocument();
    await user.clear(count); await user.type(count, '2');
    expect(screen.getByText(/Pizza 2: pronta alle/)).toBeInTheDocument();
    expect(screen.queryByText(/Pizze 2–2:/)).not.toBeInTheDocument();
  });
  it('shows a non-blocking service-window warning for many pizzas', async () => {
    const user = userEvent.setup(); render(<App />);
    const protein = screen.getByLabelText('Proteine della farina (%)');
    await user.clear(protein); await user.type(protein, '13');
    const count = screen.getByLabelText('Numero di pizze');
    await user.clear(count); await user.type(count, '60');
    expect(document.querySelector('.timeline')).toBeInTheDocument();
    expect(screen.getByText(/L'ultima pizza fermenta molto più a lungo/)).toBeInTheDocument();
    expect(screen.getByText(/Pizze 2–60/)).toBeInTheDocument();
  });
  it('rejects quantity bounds without replacing the valid saved state', async () => {
    const user = userEvent.setup(); render(<App />);
    const weight = screen.getByLabelText('Peso panetto (g)');
    await user.clear(weight); await user.type(weight, '5001');
    expect(weight).toHaveAttribute('aria-invalid', 'true');
    expect(JSON.parse(localStorage.getItem('ricetta-pi-saved-state')!).state.pieceWeight).toBe('500');
    await user.click(screen.getByRole('radio', { name: 'Teglia' }));
    const length = screen.getByLabelText('Lunghezza (cm)');
    await user.clear(length); await user.type(length, '201');
    expect(length).toHaveAttribute('aria-invalid', 'true');
  });
  it('ignores corrupt storage silently and restores valid v3 data', async () => {
    localStorage.setItem('ricetta-pi-saved-state', '{');
    const first = render(<App />);
    expect(document.querySelector('.notice')).not.toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem('ricetta-pi-saved-state')!);
    saved.state.protein = '13';
    localStorage.setItem('ricetta-pi-saved-state', JSON.stringify(saved));
    first.unmount();
    render(<App />);
    expect(screen.getByLabelText('Proteine della farina (%)')).toHaveValue('13');
  });
  it('shows dry yeast and warns about the last pizza baking window', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('radio', { name: 'Secco' }));
    expect(screen.getByText('Lievito · Secco')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Numero di pizze'));
    await user.type(screen.getByLabelText('Numero di pizze'), '200');
    expect(screen.getByText(/Cuocere tutti gli elementi uno alla volta/)).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });
  it('shows alternative start for a too-long plan', async () => {
    const user = userEvent.setup(); render(<App />);
    const start = screen.getByLabelText('Inizio impasto') as HTMLInputElement;
    const later = new Date(new Date(start.value).getTime() + 30 * 3_600_000);
    const local = new Date(later.getTime() - later.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    const service = screen.getByLabelText('Prima pizza pronta');
    await user.clear(service); await user.type(service, local);
    expect(screen.getByText(/Inizio alternativo: .+\d/)).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});
