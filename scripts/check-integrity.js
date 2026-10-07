import { readFileSync } from 'node:fs';
import { validateConfig } from '../src/lib/config.js';

const json = name => JSON.parse(readFileSync(name, 'utf8'));
const pkg = json('package.json');
const manifest = json('src/manifest.json');
const mise = readFileSync('mise.toml', 'utf8');
const node = readFileSync('.nvmrc', 'utf8').trim();
const failures = [];
if (!mise.includes(`node = "${node}"`) || !mise.includes(`pnpm = "${pkg.packageManager.split('@')[1]}"`)) failures.push('Runtime pins differ');
if (pkg.version !== manifest.version) failures.push('Package and manifest versions differ');
const en = json('src/_locales/en/messages.json');
const pl = json('src/_locales/pl/messages.json');
if (JSON.stringify(Object.keys(en).sort()) !== JSON.stringify(Object.keys(pl).sort())) failures.push('Localization keys differ');
for (const name of ['src/lib/default-config.json', 'docs/config.example.json']) {
  if (validateConfig(json(name)).length) failures.push(`Invalid example configuration: ${name}`);
}
if (Object.keys(json('src/lib/default-config.json').repositories).length) failures.push('Fresh-install defaults contain assignments');
const metadata = json('amo/metadata/listed.json');
if (pkg.license !== metadata.version.license) failures.push('Package and AMO license differ');
if (metadata.version.approval_notes !== readFileSync('amo/REVIEWER_NOTES.md', 'utf8')) failures.push('Reviewer notes differ');
const policy = json('amo/metadata/eula-policy.json');
for (const locale of ['en-US', 'pl']) {
  if (policy.privacy_policy[locale] !== readFileSync(`amo/privacy.${locale}.md`, 'utf8')) failures.push(`Privacy translation differs: ${locale}`);
}
if (failures.length) { for (const failure of failures) console.error(failure); process.exitCode = 1; }
else console.log('Runtime pins, versions, locales, example configs, license, reviewer notes and privacy translations verified.');
