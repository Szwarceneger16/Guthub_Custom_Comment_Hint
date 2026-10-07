import { build } from 'esbuild';
import { mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';

const output = new URL('../dist/extension/', import.meta.url);
// Recreate only the generated runtime directory so stale files cannot enter a release.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('../LICENSE', import.meta.url), new URL('LICENSE', output));
for (const path of ['manifest.json', 'icons', '_locales']) {
  await cp(new URL(`../src/${path}`, import.meta.url), new URL(path, output), { recursive: true });
}
await mkdir(new URL('options/', output), { recursive: true });
for (const path of ['index.html', 'options.css']) {
  await cp(new URL(`../src/options/${path}`, import.meta.url), new URL(`options/${path}`, output));
}
await build({
  entryPoints: { background: 'src/background.js', content: 'src/content.js', 'options/options': 'src/options/options.js' },
  bundle: true, outdir: 'dist/extension', format: 'iife', platform: 'browser', target: ['firefox140'],
  legalComments: 'none', charset: 'utf8',
  banner: { js: '/* GitHub Custom Comment Hint. Copyright (c) 2026 Szwarceneger16. MIT; see LICENSE. */' },
});
const manifest = JSON.parse(await readFile(new URL('manifest.json', output), 'utf8'));
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
if (manifest.version !== pkg.version) throw new Error('Package and manifest versions differ');
await writeFile(new URL('../dist/build-info.json', import.meta.url), JSON.stringify({ version: pkg.version, target: 'firefox140' }, null, 2) + '\n');
console.log(`Prepared Firefox extension ${pkg.version} in dist/extension`);
