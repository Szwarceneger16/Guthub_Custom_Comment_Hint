import { readFile } from 'node:fs/promises';
import { root, tree, hashes, compareHashes } from './release-files.js';
import path from 'node:path';

const expected = JSON.parse(await readFile(path.join(root, 'runtime-sha256.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(root, 'dist/extension/manifest.json'), 'utf8'));
if (manifest.version !== expected.version) throw new Error('Source archive and built manifest versions differ');
const actual = await tree(path.join(root, 'dist/extension'));
compareHashes(hashes(actual), expected.files, 'Reviewer source rebuild');
console.log(`Verified ${Object.keys(actual).length} runtime files for ${expected.version}; bytes match the submission.`);
