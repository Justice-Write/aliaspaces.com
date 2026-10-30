import test from 'node:test';
import assert from 'node:assert/strict';
import { zipFixture } from './fixtures/history-zip.mjs';
import { empty, parse, review } from '../src/domain/pantry.js';
import { parseAccountHistory, importAccountHistory, sourceTime } from '../src/domain/account-history.js';
import { readHistoryArchive } from '../src/domain/history-archive.js';
const youtube = [{ title: 'Watched recipe video', titleUrl: 'https://www.youtube.com/watch?v=one&utm_source=ignored', time: '2026-10-20T01:02:03Z' }, { title: 'Unavailable video', time: '2026-10-20T03:00:00Z' }];
const decode = (provider, data, extras = {}) => parseAccountHistory({ provider, account: 'personal', filename: 'watch-history.json', text: JSON.stringify(data), ...extras });
test('YouTube account exports retain watched, unavailable and unconfirmed activity without relevance filtering', async () => {
  const result = await decode('youtube', [...youtube, { title: 'Searched for dinner', time: '2026-10-20T03:00:00Z' }], { filename: 'MyActivity.json' });
  assert.equal(result.records.length, 3); assert.equal(result.records[0].kind, 'watched');
  assert.equal(result.records[0].url, 'https://www.youtube.com/watch?v=one');
  assert.equal(result.report.unresolved, 2); assert.equal(result.report.otherActivity, 2);
  assert.equal(result.records[2].kind, 'account-activity-unconfirmed');
  assert.deepEqual(result.records[1].raw, youtube[1]);
});
test('TikTok native JSON and watch-history text preserve app-recorded source fields', async () => {
  const row = { Date: '2026-10-20 10:00:00', Link: 'https://www.tiktok.com/@creator/video/123', 'Post title': 'Skit' };
  for (const data of [{ 'Your Activity': { 'Watch History': { VideoList: [row] } } }, { Activity: { 'Video Browsing History': { VideoList: [row] } } }]) {
    const result = await decode('tiktok', data, { offset: '+00:00' });
    assert.equal(result.records[0].viewedAt, '2026-10-20T10:00:00.000Z'); assert.equal(result.records[0].title, 'Skit');
  }
  const txt = await parseAccountHistory({ provider: 'tiktok', account: 'personal', filename: 'Watch History.txt', text: 'Date: 2026-10-20 10:00:00\nVideo Link: https://www.tiktok.com/@creator/video/123\n', offset: '' });
  assert.equal(txt.records.length, 1); assert.equal(txt.records[0].viewedAt, null); assert.equal(txt.report.unknownTime, 1);
});
test('Meta recognized watched containers and impression containers remain distinguishable', async () => {
  const fb = await decode('facebook', { videos_watched_v2: [{ timestamp: 1792458123, data: [{ name: 'Watched video', uri: 'https://facebook.com/watch/?v=123' }] }] });
  const ig = await decode('instagram', { impressions_history_videos_watched: [{ string_map_data: { Media: { value: '<script>literal</script>', href: 'https://instagram.com/reel/123/', timestamp: 1792458123 } } }] });
  assert.equal(fb.records[0].kind, 'watched'); assert.equal(ig.records[0].kind, 'video-exposure');
  await assert.rejects(decode('instagram', { likes_media_likes: [] }), /no recognized viewing-history/);
});
test('unknown times are retained, invalid dates rejected, and fixed timezone choices are explicit', async () => {
  for (const value of ['bad', '2026-02-30T12:00:00Z', '2026-10-20 10:00:00']) assert.equal(sourceTime(value), null);
  assert.equal(sourceTime('2026-10-20 10:00:00', '-08:00'), '2026-10-20T18:00:00.000Z');
  const result = await decode('youtube', [{ title: 'Unknown time and URL' }]);
  const state = importAccountHistory(empty(), result.records).state;
  assert.equal(state.items[0].day, 'unknown'); assert.equal(state.items[0].history.viewedAt, null);
  assert.deepEqual(parse(JSON.stringify(state)), state);
});
test('repeat imports preserve approvals, rejections, manual records and account separation', async () => {
  const result = await decode('youtube', youtube);
  let state = importAccountHistory(empty(), result.records).state;
  state = review(state, state.items[0].id, 'approved', 'My tag'); state = review(state, state.items[1].id, 'rejected', '');
  const repeated = importAccountHistory(state, result.records);
  assert.equal(repeated.added, 0); assert.equal(repeated.duplicates, 2); assert.deepEqual(repeated.state, state);
  const second = await decode('youtube', youtube, { account: 'other-account' });
  assert.equal(importAccountHistory(state, second.records).added, 2);
  const undatedA = await decode('youtube', [{ title: 'No time' }]); const undatedB = await decode('youtube', [{ title: 'No time' }]);
  assert.equal(undatedA.records[0].id, undatedB.records[0].id);
  assert.deepEqual(parse(JSON.stringify(state)), state);
});
test('invalid input, unsupported sources and malformed backups do not partially mutate data', async () => {
  await assert.rejects(parseAccountHistory({ provider: 'youtube', account: '', text: '[]' }));
  await assert.rejects(parseAccountHistory({ provider: 'youtube', account: 'x', text: '{' }));
  await assert.rejects(decode('browser-observed', []));
  const records = (await decode('youtube', youtube)).records;
  const state = empty(); assert.throws(() => importAccountHistory(state, [records[0], { ...records[1], provider: 'unknown' }]));
  assert.equal(state.items.length, 0);
  const imported = importAccountHistory(state, records).state;
  const corrupted = structuredClone(imported); corrupted.items[0].history.viewedAt = 'wrong';
  assert.throws(() => parse(JSON.stringify(corrupted)));
});
test('ZIP ingestion reads stored and deflated history, skips unrelated private files, and verifies integrity', async () => {
  for (const compressed of [false, true]) {
    const result = await readHistoryArchive(zipFixture([['Takeout/YouTube/history/watch-history.json', JSON.stringify(youtube)], ['messages/private.json', '{not opened}']], compressed), 'youtube');
    assert.equal(result.files.length, 1); assert.equal(result.skipped, 1); assert.deepEqual(JSON.parse(result.files[0].text), youtube);
  }
  await assert.rejects(readHistoryArchive(zipFixture([['../watch-history.json', '[]']]), 'youtube'), /Unsafe ZIP/);
  const broken = zipFixture([['watch-history.json', '[]']]); broken[broken.indexOf(Buffer.from('[]'))] = 32;
  await assert.rejects(readHistoryArchive(broken, 'youtube'), /integrity/);
  await assert.rejects(readHistoryArchive(Buffer.from('not a zip'), 'youtube'));
  await assert.rejects(readHistoryArchive(zipFixture([['messages/private.json', '{}']]), 'youtube'), /No recognized history/);
});
