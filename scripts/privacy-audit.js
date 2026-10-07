import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { root } from './release-files.js';
import { privacyFindings, prohibitedPath } from './privacy-rules.js';

const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 128 * 1024 * 1024 });
const report = { scope: 'Nonignored project files; optional all local Git objects and prepared ZIP entries. Values are never reported.', worktree: { checked: 0, findings: [] } };
const names = [...new Set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).toString('utf8').split('\0').filter(Boolean))];
for (const name of names) {
  let bytes;
  try { bytes = await readFile(path.join(root, name)); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  const kinds = privacyFindings(bytes);
  if (prohibitedPath(name)) kinds.push('retired-private-material');
  report.worktree.checked++;
  if (kinds.length) report.worktree.findings.push({ file: name, kinds });
}
if (process.argv.includes('--history')) {
  const objects = git(['cat-file', '--batch-all-objects', '--batch']);
  report.git_objects = { checked: 0, findings: [] };
  let offset = 0;
  while (offset < objects.length) {
    const newline = objects.indexOf(10, offset);
    const [oid, type, length] = objects.toString('ascii', offset, newline).split(' ');
    const size = Number(length);
    if (newline < 0 || !Number.isSafeInteger(size)) throw new Error('Invalid Git object batch');
    const bytes = objects.subarray(newline + 1, newline + 1 + size);
    const kinds = type === 'tree' ? [] : privacyFindings(bytes);
    if (type === 'tree') {
      for (let position = 0; position < bytes.length;) {
        const space = bytes.indexOf(32, position);
        const nul = bytes.indexOf(0, space);
        if (prohibitedPath(bytes.toString('utf8', space + 1, nul))) kinds.push('retired-private-material');
        position = nul + 21;
      }
    }
    report.git_objects.checked++;
    if (kinds.length) report.git_objects.findings.push({ object: oid, type, kinds: [...new Set(kinds)] });
    offset = newline + 1 + size + 1;
  }
}
if (process.argv.includes('--packages')) {
  const release = JSON.parse(await readFile(path.join(root, 'artifacts/release-report.json'), 'utf8'));
  report.packages = { archives: release.packages.length, checked: 0, findings: [] };
  for (const item of release.packages) {
    for (const [name, bytes] of Object.entries(unzipSync(await readFile(path.join(root, item.path))))) {
      const kinds = privacyFindings(bytes);
      if (prohibitedPath(name)) kinds.push('retired-private-material');
      report.packages.checked++;
      if (kinds.length) report.packages.findings.push({ archive: path.basename(item.path), file: name, kinds });
    }
  }
}
await mkdir(path.join(root, 'artifacts'), { recursive: true });
await writeFile(path.join(root, 'artifacts/privacy-audit.json'), JSON.stringify(report, null, 2) + '\n');
let failures = 0;
for (const [name, section] of Object.entries(report)) {
  if (typeof section !== 'object') continue;
  failures += section.findings.length;
  console.log(`${name}: ${section.checked} checked, ${section.findings.length} flagged.`);
  for (const finding of section.findings) console.error(`${finding.file || finding.object}: ${finding.kinds.join(', ')}`);
}
if (failures) process.exitCode = 1;
