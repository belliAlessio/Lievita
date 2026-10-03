import { describe, expect, it } from 'vitest';
import { decodeSavedState, encodeSavedState, inspectSavedState } from './persistence';

describe('stato locale versionato', () => {
  const isStringRecord = (value: unknown): value is { value: string } => Boolean(value && typeof value === 'object' && 'value' in value && typeof value.value === 'string');
  it('accetta un record valido e ignora JSON corrotto, schema obsoleto o struttura invalida', () => {
    expect(decodeSavedState(encodeSavedState({ value: '0.45' }), isStringRecord)).toEqual({ value: '0.45' });
    expect(decodeSavedState('{', isStringRecord)).toBeNull();
    expect(decodeSavedState(JSON.stringify({ schemaVersion: 99, state: { value: 'ok' } }), isStringRecord)).toBeNull();
    expect(decodeSavedState(encodeSavedState({ value: 2 }), isStringRecord)).toBeNull();
  });

  it('espone il motivo dello scarto di versione senza cancellare i dati', () => {
    const oldVersion = JSON.stringify({ schemaVersion: 1, state: { value: 'stale' } });
    expect(inspectSavedState(oldVersion, isStringRecord).reason).toBe('version');
    expect(inspectSavedState(JSON.stringify({ schemaVersion: 2, state: { value: 'stale' } }), isStringRecord).reason).toBe('version');
  });
});
