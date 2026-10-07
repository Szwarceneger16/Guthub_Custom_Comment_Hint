import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const cache = path.resolve('.cache/ms-playwright');
mkdirSync(cache, { recursive: true });
const args = process.argv.includes('--install') ? ['install', 'firefox'] : ['test', ...process.argv.slice(2)];
const result = spawnSync('pnpm', ['exec', 'playwright', ...args], {
  stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: cache, XDG_CACHE_HOME: path.resolve('.cache') },
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
