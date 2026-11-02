import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/domain/pantry.js';
function sample() { let id = 0; return api.capture(api.empty(), 'recipe [literal]\nAstronomy\nother', '2026-10-30', () => String(++id)); }
const note = { note: 'Remember this', effect: 'I felt curious', nextStep: 'Read more' };
const rules = { enabled: true, hiddenTags: [], hiddenTerms: [], hiddenSources: [] };

test('personal reflections preserve original records and are searchable without classification', () => {
  const before = sample(); const original = JSON.stringify(before);
  const after = api.reflect(before, '1', note, '2026-10-30T12:00:00Z');
  assert.equal(JSON.stringify(before), original);
  assert.equal(after.items[0].content, before.items[0].content);
  assert.equal(after.items[0].status, 'pending');
  assert.equal(after.items[0].reflection.effect, note.effect);
  assert.equal(api.select(after, { query: 'CURIOUS' })[0].id, '1');
  assert.throws(() => api.reflect(before, 'missing', note));
});

test('legacy backups remain unchanged and optional notes/rules roundtrip', () => {
  const old = sample(); assert.deepEqual(api.parse(JSON.stringify(old)), old);
  const next = api.setViewPreferences(api.reflect(old, '1', note), { ...rules, hiddenTags: [' Recipes ', 'recipes'] });
  assert.deepEqual(next.viewPreferences.hiddenTags, ['recipes']);
  assert.deepEqual(api.parse(api.exportCopy(next).payload), next);
  assert.equal(JSON.parse(api.exportCopy(next).payload).items.length, 3);
});

test('merge keeps newer personal reflection and rule choices, restoring missing optional data', () => {
  const backup = api.setViewPreferences(api.reflect(sample(), '1', note), { ...rules, hiddenTerms: ['recipe'] });
  const edited = api.setViewPreferences(api.reflect(backup, '1', { ...note, note: 'My later decision' }), { ...rules, enabled: false });
  assert.deepEqual(api.merge(edited, backup), edited);
  assert.deepEqual(api.merge(api.empty(), backup), backup);
});

test('view rules hide exact tags or literal phrases only from the selected view', () => {
  const original = sample(); const raw = JSON.stringify(original);
  const byTag = api.setViewPreferences(original, { ...rules, hiddenTags: ['RECIPES'] });
  assert.equal(api.select(byTag).length, 2);
  const byPhrase = api.setViewPreferences(original, { ...rules, hiddenTerms: ['[literal]'] });
  assert.equal(api.select(byPhrase).length, 2);
  assert.equal(api.select(byPhrase, { ignoreViewRules: true }).length, 3);
  const allHidden = api.setViewPreferences(original, { ...rules, hiddenSources: ['manual'] });
  assert.equal(api.select(allHidden).length, 0);
  assert.equal(JSON.parse(api.exportCopy(allHidden).payload).items.length, 3);
  assert.equal(JSON.stringify(original), raw);
});

test('reflection text does not silently become a rule for hiding original content', () => {
  const state = api.setViewPreferences(api.reflect(sample(), '1', { ...note, effect: 'Astronomy' }), { ...rules, hiddenTerms: ['Astronomy'] });
  assert.ok(api.select(state).some(x => x.id === '1'));
  assert.ok(!api.select(state).some(x => x.id === '2'));
});

test('invalid reflection or preferences are refused before any state mutation', () => {
  const state = sample(); const before = JSON.stringify(state);
  for (const value of [{ ...note, note: 2 }, { ...note, effect: 'x'.repeat(2001) }]) assert.throws(() => api.reflect(state, '1', value));
  for (const value of [{ ...rules, enabled: 'yes' }, { ...rules, hiddenSources: ['unknown'] }, { ...rules, hiddenTerms: Array(101).fill('x') }]) assert.throws(() => api.setViewPreferences(state, value));
  assert.throws(() => api.parse(JSON.stringify({ ...state, items: [{ ...state.items[0], reflection: { ...note, updatedAt: 'invalid' } }] })));
  assert.equal(JSON.stringify(state), before);
});

test('recovery export preserves unreadable raw storage exactly rather than exporting empty state', () => {
  const raw = '{broken\u0000\ud800<literal>';
  const copy = api.exportCopy(api.empty(), { storageBlocked: true, raw });
  assert.equal(copy.recovery, true);
  assert.equal(JSON.parse(copy.payload).rawStorage, raw);
  assert.equal(JSON.parse(copy.payload).storageKey, api.STORAGE_KEY);
  assert.throws(() => api.parse(copy.payload));
  assert.throws(() => api.exportCopy(api.empty(), { storageBlocked: true }));
});

test('bounded native recovery avoids JSON escaping expansion without raising the payload limit', () => {
  const raw = '\0'.repeat(2 * 1024 * 1024) + '\ud800literal\udfff';
  const legacy = api.exportCopy(api.empty(), { storageBlocked: true, raw });
  assert.ok(Buffer.byteLength(legacy.payload) > api.NATIVE_EXPORT_MAX_BYTES);
  const compact = api.exportCopy(api.empty(), { storageBlocked: true, raw, maxBytes: api.NATIVE_EXPORT_MAX_BYTES });
  assert.equal(JSON.parse(compact.payload).encoding, 'utf-16le-base64');
  assert.ok(Buffer.byteLength(compact.payload) < api.NATIVE_EXPORT_MAX_BYTES);
  assert.equal(api.decodeRecoveryCopy(compact.payload), raw);
  assert.equal(api.decodeRecoveryCopy(legacy.payload), raw);
  assert.throws(() => api.parse(compact.payload), /Invalid/);
});

test('native preflight accepts the exact UTF-8 cap and refuses over-budget copies without mutation', () => {
  const state = sample(); const before = JSON.stringify(state);
  const size = Buffer.byteLength(api.exportCopy(state).payload);
  assert.equal(api.exportCopy(state, { maxBytes: size }).payload, api.exportCopy(state).payload);
  assert.throws(() => api.exportCopy(state, { maxBytes: size - 1 }), /exceeds/);
  assert.equal(JSON.stringify(state), before);
  const raw = 'x'.repeat(11 * 1024 * 1024);
  assert.throws(() => api.exportCopy(state, { storageBlocked: true, raw, maxBytes: api.NATIVE_EXPORT_MAX_BYTES }), /Original storage is unchanged/);
  for (const maxBytes of [0, -1, NaN, 1.5]) assert.throws(() => api.exportCopy(state, { maxBytes }), /Invalid/);
  assert.throws(() => api.decodeRecoveryCopy('{"format":"other"}'), /Invalid/);
  assert.throws(() => api.decodeRecoveryCopy(JSON.stringify({ format: 'aliaspaces-akasha-storage-recovery-v2', storageKey: api.STORAGE_KEY, encoding: 'utf-16le-base64', rawStorageBase64: 'AA==' })), /Invalid UTF-16/);
});
