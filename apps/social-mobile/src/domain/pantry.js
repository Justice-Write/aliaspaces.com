import { validHistoryRecord } from './account-history.js';
export const STORAGE_KEY = 'aliaspaces.pantry.local.v1';
export const CATEGORIES = ['New artists', 'Recipes', 'Projects', 'Items to buy', 'Creator skit ideas'];
export const VIEW_SOURCES = ['manual', 'youtube', 'tiktok', 'facebook', 'instagram'];
const rules = [ /artist|music|song|album/i, /recipe|cook|bake|ingredient/i, /project|build|craft|diy/i, /buy|shop|product|price/i, /skit|comedy|creator|video idea/i ];
export const empty = () => ({ version: 1, categories: [...CATEGORIES], items: [] });
export function tags(value) {
  return [...new Set(String(value).split(',').map(x => x.trim()).filter(Boolean))];
}
export function suggest(text, categories) {
  return categories.filter(category => {
    const index = CATEGORIES.indexOf(category);
    return index >= 0 ? rules[index].test(text) : text.toLowerCase().includes(category.toLowerCase());
  });
}
export function validDay(day) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
}
export function capture(state, text, day, uuid = () => crypto.randomUUID()) {
  if (!validDay(day)) throw Error('Choose a valid capture date.');
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!lines.length) throw Error('Paste at least one item.');
  if (lines.length > 1000 || lines.some(x => x.length > 10000)) throw Error('Use at most 1,000 items of 10,000 characters each per capture.');
  return { ...state, items: [...state.items, ...lines.map(content => ({ id: uuid(), content, day, tags: suggest(content, state.categories), status: 'pending', source: 'manual', capturedAt: new Date().toISOString() }))] };
}
export function review(state, id, status, value) {
  if (!['pending', 'approved', 'rejected'].includes(status)) throw Error('Invalid review status.');
  return { ...state, items: state.items.map(item => item.id === id ? { ...item, status, tags: tags(value) } : item) };
}
export function reflect(state, id, values, now = new Date().toISOString()) {
  const current = state.items.find(x => x.id === id);
  if (!current) throw Error('That record is no longer available.');
  const reflection = { ...current.reflection, ...values, updatedAt: now };
  validateReflection(reflection);
  for (const key of ['note', 'effect', 'nextStep']) reflection[key] = reflection[key].trim();
  return { ...state, items: state.items.map(x => x.id === id ? { ...x, reflection } : x) };
}
function validateReflection(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object' ||
      typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt)) ||
      typeof value.note !== 'string' || value.note.length > 5000 ||
      typeof value.effect !== 'string' || value.effect.length > 2000 ||
      typeof value.nextStep !== 'string' || value.nextStep.length > 2000) throw Error('Invalid reflection; notes must fit the displayed limits.');
}
export function viewPreferences(state) {
  return state.viewPreferences || { enabled: false, hiddenTags: [], hiddenTerms: [], hiddenSources: [] };
}
function validatePreferences(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object' || typeof value.enabled !== 'boolean') throw Error('Invalid view preferences.');
  for (const key of ['hiddenTags', 'hiddenTerms', 'hiddenSources']) {
    if (!Array.isArray(value[key]) || value[key].length > 100 ||
        !value[key].every(x => typeof x === 'string' && x.trim() && x.length <= 200)) throw Error('Use at most 100 view rules of 200 characters each.');
  }
  if (!value.hiddenSources.every(x => VIEW_SOURCES.includes(x))) throw Error('Unknown view-rule source.');
}
export function setViewPreferences(state, value) {
  validatePreferences(value);
  const normalized = { enabled: value.enabled };
  for (const key of ['hiddenTags', 'hiddenTerms', 'hiddenSources']) {
    normalized[key] = [...new Set(value[key].map(x => x.trim().toLowerCase()))];
  }
  return { ...state, viewPreferences: normalized };
}
function hiddenByPreferences(item, prefs) {
  const source = item.source === 'account-history' ? item.history.provider : 'manual';
  const content = `${item.content} ${item.tags.join(' ')}`.toLowerCase();
  return prefs.hiddenSources.includes(source) ||
    item.tags.some(tag => prefs.hiddenTags.some(x => x.toLowerCase() === tag.toLowerCase())) ||
    prefs.hiddenTerms.some(term => content.includes(term.toLowerCase()));
}
export function select(state, { day = '', status = '', query = '', ignoreViewRules = false } = {}) {
  const term = query.trim().toLowerCase();
  const prefs = viewPreferences(state);
  return state.items.filter(x => (!day || x.day === day) && (!status || x.status === status) &&
    `${x.content} ${x.tags.join(' ')} ${x.reflection?.note || ''} ${x.reflection?.effect || ''} ${x.reflection?.nextStep || ''}`.toLowerCase().includes(term) &&
    (ignoreViewRules || !prefs.enabled || !hiddenByPreferences(x, prefs)));
}
export function parse(raw) {
  const state = JSON.parse(raw);
  if (state?.version !== 1 || !Array.isArray(state.categories) || !state.categories.every(x => typeof x === 'string' && x.trim()) || !Array.isArray(state.items)) throw Error('Invalid Akashic records backup.');
  const ids = new Set();
  if (state.viewPreferences !== undefined) validatePreferences(state.viewPreferences);
  for (const x of state.items) {
    if (!x || typeof x.id !== 'string' || !x.id || ids.has(x.id) || typeof x.content !== 'string' || !x.content.trim() || !(validDay(x.day) || (x.source === 'account-history' && x.day === 'unknown')) || !['pending', 'approved', 'rejected'].includes(x.status) || !['manual', 'account-history'].includes(x.source) || !Array.isArray(x.tags) || !x.tags.every(t => typeof t === 'string') || typeof x.capturedAt !== 'string' || Number.isNaN(Date.parse(x.capturedAt))) throw Error('Invalid Akashic records item; nothing imported.');
    if (x.source === 'account-history' && (!validHistoryRecord(x.history) || x.id !== x.history.id || x.day !== (x.history.viewedAt?.slice(0, 10) || 'unknown'))) throw Error('Invalid account-history provenance; nothing imported.');
    if (x.reflection !== undefined) validateReflection(x.reflection);
    ids.add(x.id);
  }
  return state;
}
export function merge(state, incoming) {
  const ids = new Set(state.items.map(x => x.id));
  const result = { ...state, categories: [...new Set([...state.categories, ...incoming.categories])], items: [...state.items, ...incoming.items.filter(x => !ids.has(x.id))] };
  if (state.viewPreferences === undefined && incoming.viewPreferences !== undefined) result.viewPreferences = incoming.viewPreferences;
  return result;
}
export function exportCopy(state, { storageBlocked = false, raw = null } = {}) {
  if (storageBlocked) {
    if (typeof raw !== 'string') throw Error('Storage cannot be accessed. No empty recovery copy was created.');
    return { payload: JSON.stringify({ format: 'aliaspaces-akasha-storage-recovery-v1', storageKey: STORAGE_KEY, rawStorage: raw }, null, 2), filename: 'aliaspaces-akasha-recovery.json', recovery: true };
  }
  return { payload: JSON.stringify(state, null, 2), filename: 'aliaspaces-akashic-records-local.json', recovery: false };
}
