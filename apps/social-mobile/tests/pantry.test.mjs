import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/domain/pantry.js';
const capture = (state, text, day = '2026-10-27') => { let id = state.items.length; return api.capture(state, text, day, () => String(++id)); };
test('capture retains all entries, duplicates, unclassified and multiple suggestions', () => {
  const state = capture(api.empty(), 'recipe video idea\nunknown\nunknown\nhttps://example.com');
  assert.equal(state.items.length, 4);
  assert.deepEqual(state.items[0].tags, ['Recipes', 'Creator skit ideas']);
  assert.deepEqual(state.items[1].tags, []);
  assert.ok(state.items.every(x => x.status === 'pending' && x.source === 'manual'));
});
test('setup guides suggestions including custom categories without limiting classification', () => {
  const state = capture({ ...api.empty(), categories: ['Astronomy'] }, 'Astronomy skit');
  assert.deepEqual(state.items[0].tags, ['Astronomy']);
  const next = api.review(state, '1', 'approved', 'Creator skit ideas, Astronomy, Astronomy');
  assert.deepEqual(next.items[0].tags, ['Creator skit ideas', 'Astronomy']);
  assert.equal(state.items[0].status, 'pending');
});
test('daily inbox includes all statuses and Pantry searches only approved content and tags', () => {
  let state = capture(api.empty(), 'recipe\nmystery');
  state = api.review(state, '1', 'approved', 'Dinner');
  state = api.review(state, '2', 'rejected', '');
  state = capture(state, 'song', '2026-10-26');
  assert.equal(api.select(state, { day: '2026-10-27' }).length, 2);
  assert.equal(api.select(state, { status: 'approved', query: 'dInNeR' }).length, 1);
  assert.equal(api.select(state, { status: 'approved', query: 'mystery' }).length, 0);
  state = api.review(state, '2', 'pending', '');
  assert.equal(state.items.length, 3);
  assert.equal(api.select(state, { status: 'pending' }).length, 2);
});
test('backup roundtrip and merge preserve existing review and prevent duplicate IDs', () => {
  const state = capture(api.empty(), 'skit');
  const restored = api.parse(JSON.stringify(state));
  assert.deepEqual(restored, state);
  const approved = api.review(state, '1', 'approved', 'Mine');
  assert.deepEqual(api.merge(approved, restored), approved);
  const more = capture(restored, 'unknown');
  assert.equal(api.merge(approved, more).items.length, 2);
});
test('invalid dates and malformed backups are rejected atomically', () => {
  assert.throws(() => capture(api.empty(), 'x', '2026-02-30'));
  assert.throws(() => capture(api.empty(), ' '));
  const state = capture(api.empty(), 'x');
  for (const change of [{ status: 'published' }, { source: 'synced' }, { tags: [null] }, { day: 'bad' }]) {
    assert.throws(() => api.parse(JSON.stringify({ ...state, items: [{ ...state.items[0], ...change }] })));
  }
  assert.throws(() => api.parse(JSON.stringify({ ...state, items: [state.items[0], state.items[0]] })));
  assert.throws(() => api.review(state, '1', 'published', ''));
});
