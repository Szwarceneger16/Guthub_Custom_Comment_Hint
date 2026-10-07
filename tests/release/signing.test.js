import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root } from '../../scripts/release-files.js';

// Intercept the PNPM subprocess. These checks cannot upload or use real credentials.
async function harness() {
  const directory = await mkdtemp(path.join(root, '.cache/signing-preflight-'));
  const capture = path.join(directory, 'args.json');
  await writeFile(path.join(directory, 'pnpm'), '#!/usr/bin/env node\nimport { writeFileSync } from "node:fs";\nwriteFileSync(process.env.PUBLICATION_TEST_CAPTURE, JSON.stringify(process.argv.slice(2)));\n', { mode: 0o755 });
  return { directory, capture, run(channel, credentials = true) {
    return spawnSync(process.execPath, ['scripts/sign.js', channel], { cwd: root, encoding: 'utf8', env: {
      ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}`,
      PUBLICATION_TEST_CAPTURE: capture,
      WEB_EXT_API_KEY: credentials ? 'local-preflight-dummy-key' : '',
      WEB_EXT_API_SECRET: credentials ? 'local-preflight-dummy-secret' : '',
    } });
  } };
}

for (const channel of ['listed', 'unlisted']) {
  test(`${channel} attaches matching source and never exposes credentials as arguments`, async () => {
    const mock = await harness();
    try {
      const result = mock.run(channel);
      assert.equal(result.status, 0, result.stderr);
      const args = JSON.parse(await readFile(mock.capture, 'utf8'));
      const value = option => args[args.indexOf(option) + 1];
      assert.deepEqual(args.slice(0, 3), ['exec', 'web-ext', 'sign']);
      assert.equal(value('--channel'), channel);
      assert.equal(value('--upload-source-code'), 'artifacts/github_custom_comment_hint-1.0.0-source.zip');
      assert.equal(args.includes('--amo-metadata'), channel === 'listed');
      assert.ok(args.includes('--no-config-discovery'));
      assert.ok(!args.includes('--api-key') && !args.includes('--api-secret'));
      assert.ok(!args.some(arg => arg.includes('dummy')));
    } finally { await rm(mock.directory, { recursive: true, force: true }); }
  });
}
test('missing credentials fail before spawning the signer', async () => {
  const mock = await harness();
  try {
    const result = mock.run('listed', false);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Set WEB_EXT_API_KEY and WEB_EXT_API_SECRET/);
    await assert.rejects(readFile(mock.capture));
  } finally { await rm(mock.directory, { recursive: true, force: true }); }
});
for (const [folder, message] of [
  ['dist/extension', 'Runtime changed since preparation'],
  ['src', 'Source changed since preparation'],
  ['amo', 'Listing changed since preparation'],
]) {
  test(`${folder} additions invalidate signing before spawning the signer`, async () => {
    const mock = await harness();
    const extra = path.join(root, folder, `${path.basename(mock.directory)}.txt`);
    try {
      await writeFile(extra, 'Local preflight fixture\n', { flag: 'wx' });
      const result = mock.run('listed');
      assert.notEqual(result.status, 0);
      assert.ok(result.stderr.includes(message), result.stderr);
      await assert.rejects(readFile(mock.capture));
    } finally {
      await rm(extra, { force: true });
      await rm(mock.directory, { recursive: true, force: true });
    }
  });
}
