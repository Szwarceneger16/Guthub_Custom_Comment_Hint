import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { unzipSync } from 'fflate';
import { root, sha256, hashes, tree, compareHashes } from './release-files.js';

const reportPath = path.join(root, 'artifacts/release-report.json');
const report = JSON.parse(await readFile(reportPath, 'utf8'));
for (const item of report.packages) {
  if (sha256(await readFile(path.join(root, item.path))) !== item.sha256) throw new Error(`Package changed: ${item.path}`);
}
const item = report.packages.find(item => item.kind === 'reviewer-source');
const source = unzipSync(await readFile(path.join(root, item.path)));
compareHashes(hashes(source), report.source_files, 'Archived source');
await mkdir(path.join(root, '.cache'), { recursive: true });
const extracted = await mkdtemp(path.join(root, '.cache/reviewer-source-'));
try {
for (const [name, bytes] of Object.entries(source)) {
  if (name.startsWith('/') || name.includes('\\') || name.split('/').includes('..')) throw new Error(`Unsafe source archive entry: ${name}`);
  const destination = path.join(extracted, name);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
}
function run(args) {
  const result = spawnSync('pnpm', args, { cwd: extracted, stdio: 'inherit', env: { ...process.env, NO_UPDATE_NOTIFIER: '1' } });
  if (result.error || result.status !== 0) throw new Error(`Reviewer command failed: pnpm ${args.join(' ')}`);
}
run(['install', '--frozen-lockfile', '--offline', '--store-dir', path.join(root, '.pnpm-store'), '--state-dir', path.join(root, '.cache/pnpm')]);
run(['prepare:extension']);
run(['source:check']);
compareHashes(hashes(await tree(path.join(extracted, 'dist/extension'))), report.runtime_files, 'Extracted source vs submitted runtime');
compareHashes(hashes(await tree(path.join(root, 'dist/extension'))), report.runtime_files, 'Current runtime');
report.source_rebuild_verified = true;
report.source_rebuild = { source_sha256: item.sha256, runtime_file_count: Object.keys(report.runtime_files).length, method: 'Extract ZIP, frozen offline PNPM install, build, compare all runtime bytes' };
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(`Source reproduction verified for ${report.version}. No AMO request was made.`);
} finally {
  await rm(extracted, { recursive: true, force: true });
}
