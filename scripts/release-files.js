import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function tree(directory) {
  const result = {};
  async function visit(folder, prefix = '') {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const name = prefix + entry.name;
      if (entry.isDirectory()) await visit(path.join(folder, entry.name), `${name}/`);
      else if (entry.isFile()) result[name] = await readFile(path.join(folder, entry.name));
      else throw new Error(`Nonregular release input: ${name}`);
    }
  }
  await visit(directory);
  return Object.fromEntries(Object.keys(result).sort().map(name => [name, result[name]]));
}

export function hashes(files) {
  return Object.fromEntries(Object.keys(files).sort().map(name => [name, sha256(files[name])]));
}

export function compareFiles(actual, expected, label) {
  const actualHashes = hashes(actual);
  const expectedHashes = hashes(expected);
  compareHashes(actualHashes, expectedHashes, label);
}

export function compareHashes(actual, expected, label) {
  const changed = [...new Set([...Object.keys(actual), ...Object.keys(expected)])]
    .filter(name => actual[name] !== expected[name]);
  if (changed.length) throw new Error(`${label}: changed, missing or extra files: ${changed.join(', ')}`);
}
