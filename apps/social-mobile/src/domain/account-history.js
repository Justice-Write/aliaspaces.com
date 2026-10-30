import { suggest } from './pantry.js';

export const PROVIDERS = Object.freeze({
  youtube: { name: 'YouTube', hosts: ['youtube.com', 'youtu.be'], exportUrl: 'https://takeout.google.com/', help: 'Request YouTube history in JSON from Google Takeout. Upload watch-history.json, a YouTube MyActivity.json, or its ZIP. Account history can include phone-app activity that Google retained.', automatic: 'Not connected. Recurring Google Data Portability authorization requires an approved, configured backend.' },
  tiktok: { name: 'TikTok', hosts: ['tiktok.com'], exportUrl: 'https://support.tiktok.com/en/account-and-privacy/personalized-ads-and-data/requesting-your-data', help: 'In TikTok settings, request your data in JSON. Import the file containing Watch History or Video Browsing History. A watch-history-only text file is also supported.', automatic: 'Not connected. TikTok portability requires app and Login Kit approval; current eligibility is EEA/UK users.' },
  facebook: { name: 'Facebook', hosts: ['facebook.com', 'fb.watch'], exportUrl: 'https://www.facebook.com/dyi/', help: 'Request JSON in Accounts Center > Your information and permissions > Export/Download your information. Include watched-video activity if offered. Upload the watched-video JSON or ZIP. Availability varies; an empty or missing category is not complete history.', automatic: 'Not connected. No complete watched-history transfer API has been verified for this implementation.' },
  instagram: { name: 'Instagram', hosts: ['instagram.com'], exportUrl: 'https://www.instagram.com/download/request/', help: 'Request JSON through Accounts Center. Import a watched-video history file if provided. Video-impression records, when present, are labeled as exposures rather than proof of watching. Likes, saves and your posts are not viewing history.', automatic: 'Not connected. Export contents may differ from the Watch history shown in the app; no complete transfer API has been verified here.' },
});
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export function safeLink(value, provider) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || !PROVIDERS[provider].hosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h))) return '';
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (!['v', 'id', 'story_fbid'].includes(key)) u.searchParams.delete(key);
    return u.href;
  } catch { return ''; }
}
export function sourceTime(value, offset) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value * 1000); return Number.isNaN(date.valueOf()) ? null : date.toISOString();
  }
  if (typeof value !== 'string') return null;
  let text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(text)) {
    if (!/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(offset || '')) return null;
    text = text.replace(' ', 'T') + offset;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return null;
  if (Number(text.slice(11, 13)) > 23 || Number(text.slice(14, 16)) > 59 || Number(text.slice(17, 19)) > 59) return null;
  // Date.parse normalizes impossible calendar dates; reject them explicitly.
  const day = text.slice(0, 10); const dateOnly = new Date(day);
  if (Number.isNaN(dateOnly.valueOf()) || dateOnly.toISOString().slice(0, 10) !== day) return null;
  const date = new Date(text); return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (isObject(value)) return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
async function hash(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(stable(value))));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
}
function rowsFor(provider, data, filename) {
  if (provider === 'youtube' && Array.isArray(data)) return { rows: data, kind: 'account-activity', watchOnly: /watch[-_ ]?history/i.test(filename) };
  if (provider === 'tiktok') {
    for (const group of [data?.['Your Activity']?.['Watch History'], data?.Activity?.['Video Browsing History'], data?.['Watch History'], data?.['Video Browsing History']]) {
      if (Array.isArray(group)) return { rows: group, kind: 'watched' };
      if (Array.isArray(group?.VideoList)) return { rows: group.VideoList, kind: 'watched' };
    }
    if (Array.isArray(data) && /watch|video[-_ ]?browsing/i.test(filename)) return { rows: data, kind: 'watched' };
  }
  for (const key of provider === 'facebook' ? ['videos_watched_v2', 'videos_watched'] : provider === 'instagram' ? ['videos_watched', 'impressions_history_videos_watched'] : []) {
    if (Array.isArray(data?.[key])) return { rows: data[key], kind: key.startsWith('impressions_') ? 'video-exposure' : 'watched' };
  }
  throw Error('This file has no recognized viewing-history section. Nothing imported. Likes, saves, posts and messages are not substituted for watched history.');
}
function textRows(text) {
  const rows = []; let current = {};
  for (const line of text.split(/\r?\n/)) {
    const date = line.match(/^Date:\s*(.*)$/i); const link = line.match(/^(?:Video (?:Link|landing page link)|Link):\s*(.*)$/i);
    if (date) { if (Object.keys(current).length) rows.push(current); current = { Date: date[1] }; }
    else if (link) current.Link = link[1];
    else if (/^(?:Title|Post title):/i.test(line)) current.Title = line.replace(/^[^:]+:\s*/, '');
  }
  if (Object.keys(current).length) rows.push(current);
  if (!rows.length) throw Error('Unrecognized TikTok watch-history text. Use the watch-history file or request JSON.');
  return { rows, kind: 'watched' };
}
export async function parseAccountHistory({ provider, account, text, filename = '', offset = '' }) {
  if (!Object.hasOwn(PROVIDERS, provider)) throw Error('Choose a supported account platform.');
  account = String(account || '').trim();
  if (!account || account.length > 100) throw Error('Enter a stable account label, up to 100 characters. Use the same label for repeat imports.');
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 20 * 1024 * 1024) throw Error('History text must be smaller than 20 MB.');
  const section = provider === 'tiktok' && /\.txt$/i.test(filename) && /watch|browsing/i.test(filename) ? textRows(text) : rowsFor(provider, JSON.parse(text.replace(/^\uFEFF/, '')), filename);
  if (section.rows.length > 10000) throw Error('Use a smaller export range: at most 10,000 history rows per batch.');
  const records = []; let unknownTime = 0; let unresolved = 0; let otherActivity = 0;
  for (const raw of section.rows) {
    const row = isObject(raw) ? raw : { unavailable: raw };
    const fields = Object.values(isObject(row.string_map_data) ? row.string_map_data : {}).filter(isObject);
    const data = Array.isArray(row.data) ? row.data.filter(isObject) : [];
    const controls = Array.isArray(row.activityControls) ? row.activityControls.join(' ') : String(row.activityControls || '');
    let kind = section.kind;
    if (provider === 'youtube') {
      const title = String(row.title || '');
      if (section.watchOnly || /^Watched\b/i.test(title) || /YouTube watch history/i.test(controls)) kind = 'watched';
      else { kind = 'account-activity-unconfirmed'; otherActivity++; }
    }
    const rawTime = row.time ?? row.Date ?? row.timestamp ?? fields.find(x => x.timestamp !== undefined)?.timestamp ?? null;
    const viewedAt = sourceTime(rawTime, offset);
    const originalUrl = row.titleUrl || row.Link || row['Video Link'] || row['Video landing page link'] || fields.find(x => x.href)?.href || data.find(x => x.uri)?.uri || '';
    const url = safeLink(originalUrl, provider);
    let title = String(row.title || row.Title || row['Post title'] || fields.find(x => x.value)?.value || data.find(x => x.name)?.name || 'Unavailable history item');
    if (!viewedAt) unknownTime++;
    if (!url) unresolved++;
    if (JSON.stringify(raw).length > 100000) throw Error('A history row exceeds 100 KB; nothing imported. Request a history-only export.');
    // Preserve raw source values, including unavailable/deleted content. Never assign import time as viewing time.
    const id = 'account-history:' + await hash([provider, account, kind, viewedAt, url, viewedAt && url ? '' : raw]);
    records.push({ id, provider, account, kind, title, url, viewedAt, originalTime: rawTime, offset: offset || null, raw });
  }
  return { records, report: { provider, account, file: filename, sourceRows: section.rows.length, unknownTime, unresolved, otherActivity, coverage: 'Only records retained by the platform and included in this supplied export. Phone and desktop activity are not distinguished unless the source says so. No automatic connection is active.' } };
}
export function validHistoryRecord(record) {
  return isObject(record) && typeof record.id === 'string' && record.id.startsWith('account-history:') && Object.hasOwn(PROVIDERS, record.provider) && typeof record.account === 'string' && !!record.account.trim() && ['watched', 'video-exposure', 'account-activity-unconfirmed'].includes(record.kind) && typeof record.title === 'string' && typeof record.url === 'string' && (!record.url || safeLink(record.url, record.provider) === record.url) && (record.viewedAt === null || (typeof record.viewedAt === 'string' && sourceTime(record.viewedAt) === record.viewedAt)) && Object.hasOwn(record, 'raw');
}
export function importAccountHistory(state, records) {
  if (!Array.isArray(records) || records.length > 10000 || !records.every(validHistoryRecord)) throw Error('Invalid history batch; nothing imported.');
  const ids = new Set(state.items.map(x => x.id)); const added = [];
  for (const history of records) {
    if (ids.has(history.id)) continue; ids.add(history.id);
    const content = [history.title, history.url].filter(Boolean).join('\n');
    added.push({ id: history.id, content, day: history.viewedAt?.slice(0, 10) || 'unknown', tags: suggest(content, state.categories), status: 'pending', source: 'account-history', capturedAt: new Date().toISOString(), history });
  }
  return { state: { ...state, items: [...state.items, ...added] }, added: added.length, duplicates: records.length - added.length };
}
