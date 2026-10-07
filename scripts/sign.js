import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, tree, hashes, compareHashes, sha256 } from './release-files.js';

const channel = process.argv[2];
if (!['listed', 'unlisted'].includes(channel)) throw new Error('Expected listed or unlisted');
// web-ext reads these environment variables; never print credentials or pass them as CLI arguments.
if (!process.env.WEB_EXT_API_KEY || !process.env.WEB_EXT_API_SECRET) {
  throw new Error('Set WEB_EXT_API_KEY and WEB_EXT_API_SECRET in your local environment. Do not store them in the repository.');
}
const report = JSON.parse(await readFile(path.join(root, 'artifacts/release-report.json'), 'utf8'));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (report.version !== pkg.version || !report.source_rebuild_verified) throw new Error('Run pnpm release:prepare and pnpm release:verify first');
for (const item of report.packages) {
  if (sha256(await readFile(path.join(root, item.path))) !== item.sha256) throw new Error(`Release package changed: ${item.path}`);
}
compareHashes(hashes(await tree(path.join(root, 'dist/extension'))), report.runtime_files, 'Runtime changed since preparation');
compareHashes(hashes(await tree(path.join(root, 'amo'))), report.listing_files, 'Listing changed since preparation');
const expectedSource = Object.fromEntries(Object.entries(report.source_files)
  .filter(([name]) => name.startsWith('src/')).map(([name, hash]) => [name.slice(4), hash]));
compareHashes(hashes(await tree(path.join(root, 'src'))), expectedSource, 'Source changed since preparation');
for (const [name, expected] of Object.entries(report.source_files)) {
  if (name === 'runtime-sha256.json') continue;
  if (sha256(await readFile(path.join(root, name))) !== expected) throw new Error(`Source changed since preparation: ${name}`);
}
const source = report.packages.find(item => item.kind === 'reviewer-source');
const args = ['exec', 'web-ext', 'sign', '--channel', channel, '--source-dir', 'dist/extension',
  '--artifacts-dir', 'artifacts/signed', '--upload-source-code', source.path, '--no-config-discovery'];
if (channel === 'listed') args.push('--amo-metadata', 'amo/metadata/listed.json');
console.log(`Submitting ${report.version} to AMO (${channel}) with matching reviewer sources.`);
const result = spawnSync('pnpm', args, { cwd: root, stdio: 'inherit', env: { ...process.env, NO_UPDATE_NOTIFIER: '1', XDG_CONFIG_HOME: path.join(root, '.cache/config') } });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
