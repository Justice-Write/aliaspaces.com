// Read selected text entries in memory. Never extract paths, execute HTML, or load media.
export function historyFilename(name, provider) {
  const file = name.replaceAll('\\', '/').split('/').at(-1);
  if (provider === 'youtube') return /^(?:watch[-_ ]?history|my[-_ ]?activity)\.json$/i.test(file);
  if (provider === 'tiktok') return /(?:user_data|watch[-_ ]?history|video[-_ ]?browsing|browsing[-_ ]?history).*\.(?:json|txt)$/i.test(file);
  return /(?:videos?[-_ ]?watched|watched[-_ ]?videos?).*\.json$/i.test(file);
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
async function inflate(bytes, maximum) {
  let stream;
  try { stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')); }
  catch { throw Error('This browser cannot unzip this archive. Unzip it yourself and select the history JSON file.'); }
  const reader = stream.getReader(); const chunks = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > maximum) { await reader.cancel(); throw Error('ZIP content exceeds its safe size limit.'); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const output = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; } return output;
}
export async function readHistoryArchive(buffer, provider) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length > 30 * 1024 * 1024) throw Error('Use a ZIP smaller than 30 MB or select the unzipped history file.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at--) {
    if (view.getUint32(at, true) === 0x06054b50 && at + 22 + view.getUint16(at + 20, true) === bytes.length) { end = at; break; }
  }
  if (end < 0) throw Error('Invalid ZIP directory.');
  const count = view.getUint16(end + 10, true); const directory = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count === 65535 || directory === 0xffffffff || count > 5000) throw Error('Split, ZIP64 or oversized archives are not supported. Select unzipped history JSON.');
  let at = directory; let total = 0; const files = []; let skipped = 0;
  for (let index = 0; index < count; index++) {
    if (at + 46 > end || view.getUint32(at, true) !== 0x02014b50) throw Error('Corrupt ZIP entry.');
    const flags = view.getUint16(at + 8, true), method = view.getUint16(at + 10, true), crc = view.getUint32(at + 16, true);
    const compressed = view.getUint32(at + 20, true), size = view.getUint32(at + 24, true), nameSize = view.getUint16(at + 28, true);
    const next = at + 46 + nameSize + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    if (next > end) throw Error('Corrupt ZIP filename.');
    const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(at + 46, at + 46 + nameSize)).replaceAll('\\', '/');
    const local = view.getUint32(at + 42, true); at = next;
    if (name.startsWith('/') || /^[a-z]:/i.test(name) || name.includes('\0') || name.split('/').includes('..')) throw Error('Unsafe ZIP path rejected.');
    if (!historyFilename(name, provider)) { skipped++; continue; }
    if ((flags & 1) || ![0, 8].includes(method)) throw Error('Encrypted or unsupported ZIP compression. Select the unzipped JSON instead.');
    total += size;
    if (size > 20 * 1024 * 1024 || total > 40 * 1024 * 1024 || compressed === 0xffffffff) throw Error('Selected ZIP history exceeds the size limit.');
    if (local + 30 > directory || view.getUint32(local, true) !== 0x04034b50) throw Error('Corrupt ZIP local header.');
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + compressed > directory) throw Error('Truncated ZIP content.');
    const data = bytes.subarray(start, start + compressed);
    const content = method === 0 ? data : await inflate(data, Math.min(size, 20 * 1024 * 1024));
    if (content.length !== size || crc32(content) !== crc) throw Error('ZIP history failed its integrity check.');
    files.push({ name, text: new TextDecoder('utf-8', { fatal: true }).decode(content) });
  }
  if (!files.length) throw Error('No recognized history filename in this ZIP. Select the history-only JSON file directly; no data was imported.');
  return { files, skipped };
}
