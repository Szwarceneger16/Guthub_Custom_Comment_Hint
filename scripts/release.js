import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import { root, tree, hashes, sha256, compareFiles } from './release-files.js';

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(root, 'src/manifest.json'), 'utf8'));
const metadata = JSON.parse(await readFile(path.join(root, 'amo/metadata/listed.json'), 'utf8'));
if (pkg.version !== manifest.version || pkg.license !== metadata.version.license) {
  throw new Error('Package, manifest and listing version/license disagree');
}
for (const locale of ['en-US', 'pl']) {
  if (!metadata.summary[locale] || metadata.summary[locale].length > 250) throw new Error(`Invalid ${locale} summary`);
}
if (manifest.background.persistent !== undefined || manifest.browser_specific_settings.gecko_android) {
  throw new Error('Expected Firefox MV3 Desktop event page');
}
if (JSON.stringify(manifest.permissions) !== '["storage"]' ||
    JSON.stringify(manifest.optional_permissions) !== '["history"]' ||
    JSON.stringify(manifest.host_permissions) !== '["https://github.com/*"]') {
  throw new Error('Unexpected release permissions');
}
const defaults = JSON.parse(await readFile(path.join(root, 'src/lib/default-config.json'), 'utf8'));
if (Object.keys(defaults.repositories).length) throw new Error('Release defaults contain repository assignments');

const runtime = await tree(path.join(root, 'dist/extension'));
const artifacts = path.join(root, 'artifacts');
await mkdir(artifacts, { recursive: true });
const prefix = `github_custom_comment_hint-${pkg.version}`;
const unsignedPath = `artifacts/${prefix}.zip`;
const unsignedBytes = await readFile(path.join(root, unsignedPath));
const unpacked = Object.fromEntries(Object.entries(unzipSync(unsignedBytes)).filter(([name]) => !name.endsWith('/')));
compareFiles(unpacked, runtime, 'Unsigned package');
const builtManifest = JSON.parse(Buffer.from(runtime['manifest.json']).toString('utf8'));
if (builtManifest.version !== pkg.version) throw new Error('Build is stale; run pnpm release:prepare');

// Explicit build-input allowlist: never include recovered conversations, profiles or caches.
const source = {};
for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'mise.toml', '.nvmrc', 'LICENSE', 'SOURCE_BUILD.md',
  'scripts/build.js', 'scripts/check-source.js', 'scripts/release-files.js']) {
  source[name] = await readFile(path.join(root, name));
}
for (const [name, bytes] of Object.entries(await tree(path.join(root, 'src')))) source[`src/${name}`] = bytes;
source['runtime-sha256.json'] = strToU8(JSON.stringify({ version: pkg.version, files: hashes(runtime) }, null, 2) + '\n');
const zipEntries = Object.fromEntries(Object.keys(source).sort().map(name => [name, [source[name], {
  mtime: new Date('2020-01-01T00:00:00Z'), os: 3, attrs: 0o100644 << 16,
}]]));
const sourceBytes = zipSync(zipEntries, { level: 9 });
const sourcePath = `artifacts/${prefix}-source.zip`;
await writeFile(path.join(root, sourcePath), sourceBytes);
compareFiles(unzipSync(sourceBytes), source, 'Source package');

const listing = await tree(path.join(root, 'amo'));
const listingBytes = zipSync(Object.fromEntries(Object.entries(listing).map(([name, bytes]) => [name, [bytes, {
  mtime: new Date('2020-01-01T00:00:00Z'), os: 3, attrs: 0o100644 << 16,
}]])), { level: 9 });
const listingPath = `artifacts/${prefix}-amo-listing.zip`;
await writeFile(path.join(root, listingPath), listingBytes);
const report = {
  version: pkg.version, addon_id: manifest.browser_specific_settings.gecko.id, license: pkg.license,
  runtime_files: hashes(runtime), source_files: hashes(source), listing_files: hashes(listing),
  packages: [
    { kind: 'unsigned-extension', path: unsignedPath, bytes: unsignedBytes.length, sha256: sha256(unsignedBytes) },
    { kind: 'reviewer-source', path: sourcePath, bytes: sourceBytes.length, sha256: sha256(sourceBytes) },
    { kind: 'listing-materials', path: listingPath, bytes: listingBytes.length, sha256: sha256(listingBytes) },
  ],
  source_rebuild_verified: false, signed: false, submitted_to_amo: false,
};
await writeFile(path.join(artifacts, 'release-report.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(path.join(artifacts, `SHA256SUMS-${pkg.version}.txt`), report.packages.map(item => `${item.sha256}  ${path.basename(item.path)}`).join('\n') + '\n');
console.log(`Prepared ${pkg.version}: unsigned extension, reviewer source and AMO listing materials.`);
console.log('Run pnpm release:verify to rebuild the extracted source before submitting. No signing/upload was performed.');
