import { validHistoryRecord } from './account-history.js';
export const STORAGE_KEY = 'aliaspaces.pantry.local.v1';
export const CATEGORIES = ['New artists', 'Recipes', 'Projects', 'Items to buy', 'Creator skit ideas'];
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
export function select(state, { day = '', status = '', query = '' } = {}) {
  const term = query.trim().toLowerCase();
  return state.items.filter(x => (!day || x.day === day) && (!status || x.status === status) && `${x.content} ${x.tags.join(' ')}`.toLowerCase().includes(term));
}
export function parse(raw) {
  const state = JSON.parse(raw);
  if (state?.version !== 1 || !Array.isArray(state.categories) || !state.categories.every(x => typeof x === 'string' && x.trim()) || !Array.isArray(state.items)) throw Error('Invalid Akashic records backup.');
  const ids = new Set();
  for (const x of state.items) {
    if (!x || typeof x.id !== 'string' || !x.id || ids.has(x.id) || typeof x.content !== 'string' || !x.content.trim() || !(validDay(x.day) || (x.source === 'account-history' && x.day === 'unknown')) || !['pending', 'approved', 'rejected'].includes(x.status) || !['manual', 'account-history'].includes(x.source) || !Array.isArray(x.tags) || !x.tags.every(t => typeof t === 'string') || typeof x.capturedAt !== 'string' || Number.isNaN(Date.parse(x.capturedAt))) throw Error('Invalid Akashic records item; nothing imported.');
    if (x.source === 'account-history' && (!validHistoryRecord(x.history) || x.id !== x.history.id || x.day !== (x.history.viewedAt?.slice(0, 10) || 'unknown'))) throw Error('Invalid account-history provenance; nothing imported.');
    ids.add(x.id);
  }
  return state;
}
export function merge(state, incoming) {
  const ids = new Set(state.items.map(x => x.id));
  return { ...state, categories: [...new Set([...state.categories, ...incoming.categories])], items: [...state.items, ...incoming.items.filter(x => !ids.has(x.id))] };
}
