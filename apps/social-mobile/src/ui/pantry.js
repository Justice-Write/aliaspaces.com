import { mountAccountHistory } from './account-history.js';
import * as api from '../domain/pantry.js';
const $ = id => document.getElementById(id);
let state = api.empty();
let storageBlocked = false;
let savedRaw = null;
function message(text) { $('message').textContent = text; }
try { savedRaw = localStorage.getItem(api.STORAGE_KEY); if (savedRaw) state = api.parse(savedRaw); }
catch { storageBlocked = true; message('Existing storage could not be read. Capture is paused to preserve it. You can still export or inspect this page.'); }
function save(next) {
  if (storageBlocked) throw Error('Storage is paused to preserve unreadable data.');
  if (localStorage.getItem(api.STORAGE_KEY) !== savedRaw) throw Error('Akasha changed in another tab. Reload before saving; your existing data was preserved.');
  const raw = JSON.stringify(next);
  localStorage.setItem(api.STORAGE_KEY, raw);
  savedRaw = raw;
  state = next;
  render();
}
function guarded(action) { try { action(); } catch (error) { message(error.message); } }
const today = new Date();
$('day').value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
$('filter-day').value = $('day').value;
function categories() {
  for (const name of api.CATEGORIES) {
    const label = document.createElement('label');
    const input = document.createElement('input'); input.type = 'checkbox'; input.value = name; input.checked = state.categories.includes(name);
    label.append(input, document.createTextNode(name)); $('categories').append(label);
  }
  $('custom').value = state.categories.filter(x => !api.CATEGORIES.includes(x)).join(', ');
}
function render() {
  const items = api.select(state, { day: $('filter-day').value, status: $('collection').value, query: $('search').value });
  $('count').textContent = `${items.length} shown · ${state.items.length} captured total · ${state.items.filter(x => x.status === 'approved').length} saved in Akasha`;
  $('items').replaceChildren();
  if (!items.length) $('items').textContent = 'No items match this view. Clear the day or search to see other captures.';
  for (const item of items) {
    const card = document.createElement('article'); card.className = 'card';
    const content = document.createElement('p'); content.textContent = item.content;
    const meta = document.createElement('p'); meta.textContent = `${item.history ? (item.history.viewedAt || "Viewing time unknown") + " / " + item.history.provider + " / account label: " + item.history.account + " / " + item.history.kind : item.day + " / manual capture"} · ${item.status} · ${item.tags.length ? 'editable tags' : 'Unclassified'}`;
    const label = document.createElement('label'); label.textContent = 'Tags (comma separated)';
    const input = document.createElement('input'); input.value = item.tags.join(', '); label.append(input);
    card.append(content, meta, label);
    if (item.history) {
      const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Original account-history record';
      const source = document.createElement('pre'); source.textContent = JSON.stringify(item.history.raw, null, 2); source.style.whiteSpace = 'pre-wrap'; source.style.overflowWrap = 'anywhere';
      details.append(summary, source); card.append(details);
    }
    for (const [name, status] of [['Save tags', item.status], ['Save to Akashic records', 'approved'], ['Reject', 'rejected'], ['Return to inbox', 'pending']]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = name;
      button.onclick = () => guarded(() => { save(api.review(state, item.id, status, input.value)); message('Saved on this device.'); }); card.append(button);
    }
    $('items').append(card);
  }
}
$('setup').onsubmit = event => { event.preventDefault(); guarded(() => { save({ ...state, categories: [...new Set([...$('categories').querySelectorAll('input:checked')].map(x => x.value).concat(api.tags($('custom').value)))] }); message('Category preferences saved.'); }); };
$('capture').onsubmit = event => { event.preventDefault(); guarded(() => { save(api.capture(state, $('content').value, $('day').value)); $('filter-day').value = $('day').value; $('collection').value = ''; $('search').value = ''; $('content').value = ''; render(); message('Every pasted item was added, including unclassified items.'); }); };
for (const id of ['filter-day', 'collection', 'search']) $(id).oninput = render;
$('export').onclick = () => guarded(() => {
  if (window.AliaSpacesAndroid && typeof window.AliaSpacesAndroid.postMessage === 'function') {
    window.AliaSpacesAndroid.postMessage(JSON.stringify({ action: 'export', payload: JSON.stringify(state, null, 2) }));
    message('Choose where to save your private backup. Android will confirm whether it was saved.');
    return;
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'aliaspaces-akashic-records-local.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('import').onchange = async event => {
  try {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) throw Error('Backup must be under 10 MB.');
    save(api.merge(state, api.parse(await file.text())));
    $('categories').querySelectorAll('label').forEach(x => x.remove()); categories();
    message('Backup merged. Existing items were preserved. Clear date filters to inspect other days.');
  } catch (error) { message(error.message); }
  event.target.value = '';
};
categories(); render();


mountAccountHistory({ getState: () => state, save, message, revealHistory: () => { $('filter-day').value = ''; $('collection').value = ''; $('search').value = ''; render(); } });
