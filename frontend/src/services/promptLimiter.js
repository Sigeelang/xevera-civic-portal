const STORAGE_KEY = 'xevera_prompt_session_v1';
const MAX_DAILY = 2;

function readState() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (raw && typeof raw === 'object') return raw;
  } catch {}
  return { shown: {} };
}

function writeState(state) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function promptShown(id) {
  const state = readState();
  return !!(state.shown[id] && state.shown[id].count > 0);
}

export function tryPrompt(id) {
  const state = readState();
  const rec = state.shown[id] || { count: 0 };
  if (rec.count >= MAX_DAILY) return false;
  rec.count += 1;
  state.shown[id] = rec;
  writeState(state);
  return true;
}

export function dismissPrompt(id) {
  const state = readState();
  if (state.shown[id]) {
    state.shown[id].dismissed = true;
    writeState(state);
  }
}

export function isDismissed(id) {
  const state = readState();
  return !!(state.shown[id] && state.shown[id].dismissed);
}

export function describeSession() {
  const state = readState();
  const keys = Object.keys(state.shown || {});
  const total = keys.reduce((acc, k) => acc + (state.shown[k].count || 0), 0);
  return { total, ids: keys };
}