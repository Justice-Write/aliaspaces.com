import { mountAccountHistory } from './account-history.js';
import * as api from '../domain/pantry.js';
const $ = id => document.getElementById(id);
let state = api.empty();
let storageBlocked = false;
let savedRaw = null;
let bypassRules = false;
const reflectionDrafts = new Map();
function message(text) { $('message').textContent = text; }
try { savedRaw = localStorage.getItem(api.STORAGE_KEY); if (savedRaw !== null) state = api.parse(savedRaw); }
catch { storageBlocked = true; message('Existing storage could not be read. Changes are paused. Export a recovery copy to preserve the original stored text before repair.'); }
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
function populateRules() {
  const prefs = api.viewPreferences(state);
  $('rules-enabled').checked = prefs.enabled;
  $('rules-tags').value = prefs.hiddenTags.join(', ');
  $('rules-terms').value = prefs.hiddenTerms.join('\n');
  $('rules-sources').querySelectorAll('label').forEach(x => x.remove());
  for (const source of api.VIEW_SOURCES) {
    const label = document.createElement('label'); label.className = 'check';
    const input = document.createElement('input'); input.type = 'checkbox'; input.value = source; input.checked = prefs.hiddenSources.includes(source);
    label.append(input, document.createTextNode(source === 'manual' ? 'Manual captures' : source)); $('rules-sources').append(label);
  }
}
function render() {
  if (storageBlocked) { $('count').textContent = 'Stored records unavailable; the original storage has not been changed.'; $('items').replaceChildren(); return; }
  const filter = { day: $('filter-day').value, status: $('collection').value, query: $('search').value };
  const items = api.select(state, { ...filter, ignoreViewRules: bypassRules });
  const hidden = api.select(state, { ...filter, ignoreViewRules: true }).length - items.length;
  $('view-rules-status').textContent = bypassRules ? 'Showing everything that matches your day/search/collection. Saved rules are unchanged.' : `${hidden} hidden by your view rules. All original records are retained.`;
  $('rules-bypass').textContent = bypassRules ? 'Apply saved view rules again' : 'Show everything without changing rules';
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
    const reflection = document.createElement('details'); reflection.className = 'reflection';
    const summary = document.createElement('summary'); summary.textContent = item.reflection ? 'My reflection (saved)' : 'Add my reflection';
    const form = document.createElement('form');
    const hint = document.createElement('p'); hint.textContent = 'Your own private notes, not an AI assessment. Save explicitly; they are included in your local backup.';
    form.append(hint);
    const values = reflectionDrafts.get(item.id) || item.reflection || { note: '', effect: '', nextStep: '' };
    const fields = {};
    for (const [key, text, limit] of [['note', 'What do I want to remember?', 5000], ['effect', 'How did this affect me?', 2000], ['nextStep', 'What, if anything, do I want to do next?', 2000]]) {
      const fieldLabel = document.createElement('label'); fieldLabel.textContent = text;
      const field = document.createElement('textarea'); field.rows = 2; field.maxLength = limit; field.value = values[key]; field.dataset.reflectionField = key; fields[key] = field;
      field.oninput = () => reflectionDrafts.set(item.id, Object.fromEntries(Object.entries(fields).map(([name, element]) => [name, element.value])));
      fieldLabel.append(field); form.append(fieldLabel);
    }
    const saveReflection = document.createElement('button'); saveReflection.textContent = 'Save my reflection';
    form.append(saveReflection);
    form.onsubmit = event => { event.preventDefault(); guarded(() => { save(api.reflect(state, item.id, Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value])))); reflectionDrafts.delete(item.id); render(); message('Reflection saved on this device.'); }); };
    reflection.append(summary, form); card.append(reflection);
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
$('view-rules').onsubmit = event => { event.preventDefault(); guarded(() => {
  save(api.setViewPreferences(state, { enabled: $('rules-enabled').checked, hiddenTags: api.tags($('rules-tags').value), hiddenTerms: $('rules-terms').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean), hiddenSources: [...$('rules-sources').querySelectorAll('input:checked')].map(x => x.value) }));
  bypassRules = false; populateRules(); render(); message('View rules saved. Original records and other apps are unchanged.');
}); };
$('rules-bypass').onclick = () => { bypassRules = !bypassRules; render(); };
$('capture').onsubmit = event => { event.preventDefault(); guarded(() => { save(api.capture(state, $('content').value, $('day').value)); $('filter-day').value = $('day').value; $('collection').value = ''; $('search').value = ''; $('content').value = ''; render(); message('Every pasted item was added, including unclassified items.'); }); };
for (const id of ['filter-day', 'collection', 'search']) $(id).oninput = render;
$('export').onclick = () => guarded(() => {
  if (localStorage.getItem(api.STORAGE_KEY) !== savedRaw) throw Error('Akasha changed in another tab. Reload before exporting to avoid an outdated backup.');
  const copy = api.exportCopy(state, { storageBlocked, raw: savedRaw });
  if (window.AliaSpacesAndroid && typeof window.AliaSpacesAndroid.postMessage === 'function') {
    window.AliaSpacesAndroid.postMessage(JSON.stringify({ action: 'export', payload: copy.payload, recovery: copy.recovery }));
    message(copy.recovery ? 'Choose where to save the recovery copy. It preserves stored text and is not a regular import backup.' : 'Choose where to save your private backup. Android will confirm whether it was saved.');
    return;
  }
  const url = URL.createObjectURL(new Blob([copy.payload], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = copy.filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('import').onchange = async event => {
  try {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) throw Error('Backup must be under 10 MB.');
    save(api.merge(state, api.parse(await file.text())));
    $('categories').querySelectorAll('label').forEach(x => x.remove()); categories(); populateRules();
    message('Backup merged. Existing items were preserved. Clear date filters to inspect other days.');
  } catch (error) { message(error.message); }
  event.target.value = '';
};
categories(); populateRules(); render();


mountAccountHistory({ getState: () => state, save, message, revealHistory: () => { $('filter-day').value = ''; $('collection').value = ''; $('search').value = ''; render(); } });
