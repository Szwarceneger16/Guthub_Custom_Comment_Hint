import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const command = process.argv[2];
if (!['lint','build'].includes(command)) throw new Error('Expected lint or build');
const args = ['exec','web-ext',command,'--source-dir','dist/extension','--no-config-discovery'];
if (command === 'build') args.push('--artifacts-dir','artifacts','--overwrite-dest');
// Android is intentionally unsupported (no gecko_android key). web-ext 10 still checks its inherited minimum.
if (command === 'lint') args.push('--warnings-as-errors','--output=json');
const result = spawnSync('pnpm', args, {
  stdio:command === 'lint' ? 'pipe' : 'inherit', encoding:'utf8',
  env:{...process.env, NO_UPDATE_NOTIFIER:'1', XDG_CONFIG_HOME:path.resolve('.cache/config')},
});
if (result.error) console.error(result.error.message);
if (command === 'lint' && !result.error) {
  if(result.stderr) process.stderr.write(result.stderr);
  try {
    const report = JSON.parse(result.stdout);
    const ignored = report.warnings.filter(warning => warning.code === 'KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION');
    const otherWarnings = report.warnings.filter(warning => !ignored.includes(warning));
    const manifest = JSON.parse(readFileSync('dist/extension/manifest.json','utf8'));
    const desktopOnly = !Object.hasOwn(manifest.browser_specific_settings,'gecko_android');
    mkdirSync('artifacts',{recursive:true});
    writeFileSync('artifacts/lint-report.json',JSON.stringify(report,null,2)+'\n');
    console.log(`web-ext: ${report.errors.length} errors, ${report.notices.length} notices, ${report.warnings.length} warnings.`);
    if(ignored.length && desktopOnly) console.log('Desktop-only exception: Android minimum-version warning retained in artifacts/lint-report.json.');
    for(const issue of [...report.errors,...otherWarnings]) console.error(`${issue.code}: ${issue.message} (${issue.file})`);
    const allowedStatus = result.status === 0 || (result.status === 1 && ignored.length > 0 && desktopOnly);
    process.exitCode = allowedStatus && !report.errors.length && !otherWarnings.length && (!ignored.length || desktopOnly) ? 0 : 1;
  } catch {
    if(result.stdout) process.stdout.write(result.stdout);
    console.error('Could not read the web-ext validation report.');
    process.exitCode=1;
  }
} else process.exitCode = result.status ?? 1;
