import { firefox } from '@playwright/test';
import { mkdir, readFile, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root } from './release-files.js';
import { openConversation, openOptions } from '../tests/browser/helpers.js';

process.chdir(root);
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, '.cache/ms-playwright');
const browser = await firefox.launch({ headless: true });
const assets = path.join(root, 'amo/assets');
await mkdir(assets, { recursive: true });
try {
  // Rasterize the repository's original SVG; no external art, fonts or network requests.
  const iconPage = await browser.newPage({ viewport: { width: 128, height: 128 } });
  await iconPage.route('**/*', route => route.abort());
  const original = await readFile(path.join(root, 'src/icons/hint.svg'), 'utf8');
  for (const size of [16, 32, 48, 96, 128]) {
    const svg = original.replace('width="96" height="96"', `width="${size}" height="${size}"`);
    const png = await iconPage.evaluate(async ({ svg, size }) => {
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(image, 0, 0, size, size);
      return canvas.toDataURL('image/png').split(',')[1];
    }, { svg, size });
    await writeFile(path.join(root, `src/icons/hint-${size}.png`), Buffer.from(png, 'base64'));
  }
  await iconPage.close();
  await copyFile(path.join(root, 'src/icons/hint-128.png'), path.join(assets, 'icon-128.png'));
  const result = spawnSync('pnpm', ['prepare:extension'], { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('Could not prepare screenshot runtime');

  const initial = {
    version: 1,
    layouts: {
      codex: [
        { label: '🤖 Codex review', value: '@codex review', mode: 'replace' },
        { label: '🛡️ Security review', value: '@codex security review', mode: 'append' },
        { label: '🧪 Include tests', value: 'Please check the test coverage.', mode: 'append' },
      ],
      ci: [{ label: '▶️ CI now', value: '/ci-now', mode: 'replace' }],
    },
    repositories: { 'demo-team': { project: ['codex', 'ci'] } },
  };
  const screenshots = [];
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: theme });
    const body = `<style>
      :root{color-scheme:${theme};font:16px/1.55 system-ui,sans-serif;--bg:${theme === 'dark' ? '#0d1117' : '#f6f8fa'};--card:${theme === 'dark' ? '#161b22' : '#fff'};--fg:${theme === 'dark' ? '#f0f6fc' : '#1f2328'};--muted:${theme === 'dark' ? '#9198a1' : '#59636e'};--border:${theme === 'dark' ? '#3d444d' : '#d0d7de'}}
      *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg)}main{width:960px;margin:45px auto}header{display:flex;align-items:center;gap:14px}h1{font-size:30px;margin:0}h2{font-size:22px;margin:27px 0 8px}.sub{color:var(--muted);margin:8px 0 28px}.badge{border:1px solid var(--border);border-radius:20px;padding:4px 13px;font-size:13px}.demo{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:24px}button{font:inherit;color:var(--fg);background:var(--card);border:1px solid var(--border);border-radius:6px;padding:6px 15px;cursor:pointer}[role=tablist]{display:flex;gap:8px;border-bottom:1px solid var(--border);padding:0 0 9px;margin:0 0 14px}textarea{font:16px/1.6 ui-monospace,monospace;width:100%;height:148px;padding:15px;color:var(--fg);background:var(--bg);border:1px solid var(--border);border-radius:6px;resize:none}button[type=submit]{display:block;margin:14px 0 0 auto;background:#1f883d;color:#fff;border-color:#1f883d}.caption{color:var(--muted);font-size:14px;margin:14px 0 0}.features{display:flex;gap:22px;margin-top:22px;font-size:15px}.preview-pane{min-height:148px;white-space:pre-wrap}
      </style><main><header><h1>GitHub Custom Comment Hint</h1><span class="badge">Firefox · 1.0.0</span></header>
      <p class="sub">Reusable layouts. Your text, one click away.</p><section class="demo"><span class="badge">Local demonstration · demo-team/project</span><h2>Add a comment</h2>
      <form id="new_comment_form" class="js-new-comment-form" action="/demo-team/project/pull/19/comment?sticky=true" method="post"><div class="js-previewable-comment-form"><div role="tablist"><button type="button" class="write">Write</button><button type="button" class="preview-tab">Preview</button></div><textarea id="new_comment_field" name="comment[body]" aria-label="Comment" placeholder="Add your comment here…"></textarea><div class="preview-pane" hidden></div></div><button type="submit">Comment</button></form>
      <p class="caption">Hint buttons insert text. You decide when to submit it.</p></section><div class="features"><span>✓ Shared layouts</span><span>✓ Append or replace</span><span>✓ One-step Undo</span><span>✓ Local settings</span></div></main>`;
    await openConversation(page, { initial, url: 'https://github.com/demo-team/project/pull/19', body });
    await page.evaluate(mode => { document.documentElement.dataset.colorMode = mode; }, theme);
    await page.getByRole('button', { name: '🤖 Codex review', exact: true }).click();
    await page.getByRole('button', { name: '🛡️ Security review', exact: true }).click();
    await page.locator('textarea').blur();
    await page.screenshot({ path: path.join(assets, `toolbar-${theme}.png`) });
    screenshots.push({ file: `toolbar-${theme}.png`, caption: {
      'en-US': `Actual hint buttons and Undo in a ${theme} local PR-editor demonstration.`,
      pl: `Przyciski i cofanie w ${theme === 'dark' ? 'ciemnej' : 'jasnej'} demonstracji lokalnego edytora PR.`,
    } });
    await page.close();
  }
  const settings = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  await openOptions(settings, initial, 'en');
  await settings.getByRole('tab', { name: 'JSON', exact: true }).click();
  await settings.screenshot({ path: path.join(assets, 'settings-json.png'), fullPage: true });
  screenshots.push({ file: 'settings-json.png', caption: {
    'en-US': 'Actual settings UI: edit, validate, import and export a shared configuration draft (demo data).',
    pl: 'Ustawienia: edycja, walidacja, import i eksport wspólnego szkicu konfiguracji (dane demonstracyjne).',
  } });
  await settings.close();
  const assignments = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  await openOptions(assignments, initial, 'pl');
  await assignments.getByRole('tab', { name: 'Przypisania', exact: true }).click();
  await assignments.screenshot({ path: path.join(assets, 'settings-assignments-pl.png'), fullPage: true });
  screenshots.push({ file: 'settings-assignments-pl.png', caption: {
    'en-US': 'Polish settings: ordered layout assignments, grid preview and optional GitHub history import (demo data).',
    pl: 'Przypisania layoutów, podgląd siatki i opcjonalny import historii GitHuba (dane demonstracyjne).',
  } });
  await assignments.close();
  await writeFile(path.join(assets, 'captions.json'), JSON.stringify(screenshots, null, 2) + '\n');
  console.log('Prepared original PNG icons and synthetic Firefox screenshots with actual extension UI. No live profile was used.');
} finally { await browser.close(); }
