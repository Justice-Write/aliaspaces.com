import { deflateRawSync } from 'node:zlib';
function crc(bytes) { let n = 0xffffffff; for (const b of bytes) { n ^= b; for (let i = 0; i < 8; i++) n = (n >>> 1) ^ ((n & 1) ? 0xedb88320 : 0); } return (n ^ 0xffffffff) >>> 0; }
export function zipFixture(entries, compressed = false) {
  const locals = [], central = []; let offset = 0;
  for (const [name, content] of entries) {
    const bytes = Buffer.from(content), filename = Buffer.from(name), data = compressed ? deflateRawSync(bytes) : bytes;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(compressed ? 8 : 0, 8); local.writeUInt32LE(crc(bytes), 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(filename.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(compressed ? 8 : 0, 10); c.writeUInt32LE(crc(bytes), 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(bytes.length, 24); c.writeUInt16LE(filename.length, 28); c.writeUInt32LE(offset, 42);
    locals.push(local, filename, data); central.push(c, filename); offset += local.length + filename.length + data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
