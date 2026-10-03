export const SAVED_STATE_SCHEMA_VERSION = 3;
export const SAVED_STATE_STORAGE_KEY = 'ricetta-pi-saved-state';

export type SavedStateRead<T> = { value: T | null; reason: 'missing' | 'loaded' | 'corrupt' | 'version' | 'invalid' };

export function encodeSavedState<T>(state: T): string {
  return JSON.stringify({ schemaVersion: SAVED_STATE_SCHEMA_VERSION, state });
}

export function decodeSavedState<T>(raw: string | null, validate: (value: unknown) => value is T): T | null {
  return inspectSavedState(raw, validate).value;
}

export function inspectSavedState<T>(raw: string | null, validate: (value: unknown) => value is T): SavedStateRead<T> {
  if (!raw) return { value: null, reason: 'missing' };
  let saved: unknown;
  try { saved = JSON.parse(raw); }
  catch { return { value: null, reason: 'corrupt' }; }
  if (!saved || typeof saved !== 'object' || !('schemaVersion' in saved) || !('state' in saved)) return { value: null, reason: 'corrupt' };
  const envelope = saved as { schemaVersion: unknown; state: unknown };
  if (envelope.schemaVersion !== SAVED_STATE_SCHEMA_VERSION) return { value: null, reason: 'version' };
  if (!validate(envelope.state)) return { value: null, reason: 'invalid' };
  return { value: envelope.state, reason: 'loaded' };
}
