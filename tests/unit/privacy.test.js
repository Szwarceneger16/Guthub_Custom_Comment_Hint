import test from 'node:test';
import assert from 'node:assert/strict';
import { privacyFindings, prohibitedPath } from '../../scripts/privacy-rules.js';

test('privacy checks flag sensitive content without returning its values', () => {
  const cases = [
    [String.fromCharCode(47) + ['home', 'demo', 'config'].join('/'), 'local-machine-path'],
    [['github', 'pat', ''].join('_') + 'A'.repeat(40), 'github-token'],
    ['https://' + ['account', 'password'].join(':') + '@service.test/', 'credential-url'],
    ['person' + '@' + 'mail.company', 'contact-email'],
    [JSON.stringify({ ['thread' + '_id']: 'a'.repeat(8) + '-0000-0000-0000-000000000000' }), 'conversation-identifier'],
  ];
  for (const [value, expected] of cases) {
    const findings = privacyFindings(Buffer.from(value));
    assert.ok(findings.includes(expected));
    assert.ok(findings.every(finding => !finding.includes(value)));
  }
});
test('public identity, fictional data and original PNGs remain allowed', () => {
  assert.deepEqual(privacyFindings(Buffer.from('123+demo@users.noreply.github.com person@example.com https://github.com/demo/project')), []);
  assert.equal(prohibitedPath('docs/' + ['RECOVERED', 'CONVERSATION.md'].join('_')), true);
  assert.equal(prohibitedPath('docs/CONFIGURATION.md'), false);
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 73, 69, 78, 68, 0, 0, 0, 0]);
  assert.deepEqual(privacyFindings(png), []);
});
