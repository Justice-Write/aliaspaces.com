import { PROVIDERS, parseAccountHistory, importAccountHistory } from '../domain/account-history.js';
import { readHistoryArchive } from '../domain/history-archive.js';
export function mountAccountHistory({ getState, save, message, revealHistory }) {
  const $ = id => document.getElementById(id);
  let prepared = null; let generation = 0;
  const report = $('account-history-report');
  function invalidate() { generation++; prepared = null; $('account-history-commit').disabled = true; }
  function describe() {
    invalidate();
    const source = PROVIDERS[$('account-history-provider').value];
    $('account-history-help').textContent = source.help;
    $('account-history-automatic').textContent = source.automatic;
    $('account-history-link').href = source.exportUrl;
    report.textContent = 'No file selected. Use the same account label for repeated imports.';
  }
  for (const [key, source] of Object.entries(PROVIDERS)) { const option = document.createElement('option'); option.value = key; option.textContent = source.name; $('account-history-provider').append(option); }
  $('account-history-provider').onchange = describe;
  for (const id of ['account-history-label', 'account-history-offset']) $(id).oninput = () => { invalidate(); report.textContent = 'Settings changed. Choose the file again to refresh its preview.'; };
  $('account-history-file').onchange = async event => {
    invalidate(); const token = generation;
    const provider = $('account-history-provider').value, account = $('account-history-label').value, offset = $('account-history-offset').value;
    const isCurrent = () => token === generation;
    try {
      const file = event.target.files[0]; if (!file) return;
      if (file.size > 30 * 1024 * 1024) throw Error('Choose a file smaller than 30 MB.');
      const archive = /\.zip$/i.test(file.name) ? await readHistoryArchive(await file.arrayBuffer(), provider) : { files: [{ name: file.name, text: await file.text() }], skipped: 0 };
      const records = []; const reports = [];
      for (const entry of archive.files) {
        const result = await parseAccountHistory({ provider, account, offset, filename: entry.name, text: entry.text });
        records.push(...result.records); reports.push(result.report);
      }
      if (!isCurrent()) return;
      if (records.length > 10000) throw Error('Combined history exceeds 10,000 records. Request a smaller date range.');
      prepared = records;
      const merged = importAccountHistory(getState(), records);
      report.textContent = `${records.length} source rows across ${reports.length} history file(s); ${merged.added} new, ${merged.duplicates} already present. ${reports.reduce((n, x) => n + x.unknownTime, 0)} unknown viewing times, ${reports.reduce((n, x) => n + x.unresolved, 0)} unresolved links, ${reports.reduce((n, x) => n + x.otherActivity, 0)} activity records not confirmed as watched. ${archive.skipped} unrelated ZIP entries skipped. Nothing saved until you import. Coverage is only the supplied platform export; no account is connected.`;
      $('account-history-sample').replaceChildren();
      for (const record of records.slice(0, 5)) { const p = document.createElement('p'); p.textContent = `${record.kind} | ${record.viewedAt || 'Viewing time unknown'} | ${record.title}`; $('account-history-sample').append(p); }
      $('account-history-commit').disabled = !records.length;
    } catch (error) { if (isCurrent()) { prepared = null; report.textContent = `Nothing imported: ${error.message}`; $('account-history-sample').replaceChildren(); } }
    finally { event.target.value = ''; }
  };
  $('account-history-commit').onclick = () => {
    try {
      if (!prepared) throw Error('Select a history file first.');
      const result = importAccountHistory(getState(), prepared);
      save(result.state); // Only acknowledge after storage succeeds.
      report.textContent = `${result.added} account-history records saved to pending review; ${result.duplicates} duplicates preserved without changing earlier reviews. This was a file import, not an automatic sync.`;
      invalidate(); revealHistory(); message('Account history imported. Unknown dates and unclassified items are retained.');
    } catch (error) { message(error.message); }
  };
  describe();
}
