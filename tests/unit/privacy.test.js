import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { zipSync } from 'fflate';
import { privacyFindings, prohibitedPath } from '../../scripts/privacy-rules.js';

const png = readFileSync('src/icons/hint-16.png');
const token = ['github', 'pat', ''].join('_') + 'A'.repeat(40);
const encryptedHeader = ['-----BEGIN ', 'ENCRYPTED ', 'PRIVATE KEY-----'].join('');
function chunk(type, value) {
  const bytes = Buffer.from(value); const header = Buffer.alloc(8);
  header.writeUInt32BE(bytes.length); header.write(type, 4, 'ascii');
  return Buffer.concat([header, bytes, Buffer.alloc(4)]);
}

test('privacy checks flag sensitive content without returning its values', () => {
  const cases = [
    [String.fromCharCode(47) + ['home', 'demo', 'config'].join('/'), 'local-machine-path'],
    [['github', 'pat', ''].join('_') + 'A'.repeat(40), 'github-token'],
    ['https://' + ['account', 'password'].join(':') + '@service.test/', 'credential-url'],
    ['person' + '@' + 'mail.company', 'contact-email'],
    [JSON.stringify({ ['thread' + '_id']: 'a'.repeat(8) + '-0000-0000-0000-000000000000' }), 'conversation-identifier'],
    [JSON.stringify({ ['api'+'_key']: 'A'.repeat(24) }), 'literal-secret'],
    [['api', 'secret'].join('_')+'="'+'A'.repeat(24)+'"', 'literal-secret'],
    ["'"+['pass', 'word'].join('')+"': '"+'A'.repeat(24)+"'", 'literal-secret'],
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
  assert.deepEqual(privacyFindings(png), []);
});
test('private-key headers include encrypted PKCS8 while public keys and certificates remain allowed', () => {
  for (const kind of ['', 'RSA ', 'EC ', 'DSA ', 'OPENSSH ', 'ENCRYPTED ']) {
    const header=['-----BEGIN ',kind,'PRIVATE KEY-----'].join('');
    for (const bytes of [Buffer.from(header),Buffer.concat([png,Buffer.from('\n'+header+'\n')])]) {
      assert.deepEqual(privacyFindings(bytes),['private-key']);
      assert.ok(!JSON.stringify(privacyFindings(bytes)).includes(header));
    }
  }
  for (const kind of ['PUBLIC KEY','RSA PUBLIC KEY','CERTIFICATE']) {
    assert.deepEqual(privacyFindings(Buffer.from(['-----BEGIN ',kind,'-----'].join(''))),[]);
  }
});
test('credential assignments accept optional key/value quotes and preserve placeholder exclusions', () => {
  const keys=[['WEB','EXT','API','KEY'].join('_'),['WEB','EXT','API','SECRET'].join('_'),['pass','word'].join(''),['api','key'].join('_'),['api','secret'].join('_')];
  for (const key of keys) for (const separator of ['=',': ']) for (const keyQuote of ['',"'",'"']) for (const quote of ['',"'",'"']) {
    const assignment=value=>keyQuote+key+keyQuote+separator+quote+value+quote;
    const secret=assignment('A'.repeat(32));
    for (const bytes of [Buffer.from(secret),Buffer.concat([png,Buffer.from('\n'+secret+'\n')])]) {
      assert.deepEqual(privacyFindings(bytes),['literal-secret']);
      assert.ok(!JSON.stringify(privacyFindings(bytes)).includes(secret));
    }
    for (const placeholder of ['local-preflight-'+'A'.repeat(32),'${'+'EXAMPLE_SECRET'.repeat(3)+'}','<'+'redacted'.repeat(5)+'>']) {
      assert.deepEqual(privacyFindings(Buffer.from(assignment(placeholder))),[]);
    }
  }
});

test('PNG trailing bytes receive every general privacy check without disclosing matched values', () => {
  const cases = [
    [['-----BEGIN ', 'OPENSSH ', 'PRIVATE KEY-----'].join(''), 'private-key'],
    [token, 'github-token'],
    [['AK', 'IA'].join('')+'A'.repeat(16), 'aws-access-key'],
    [['xox', 'b-'].join('')+'A'.repeat(24), 'service-token'],
    [String.fromCharCode(47)+['home', 'demo', 'file'].join('/'), 'local-machine-path'],
    ['https://'+['account', 'password'].join(':')+'@service.test/', 'credential-url'],
    ['https://github.com/demo/'+['project', 'private'].join('-'), 'private-repository-reference'],
    [JSON.stringify({['thread'+'_id']:'a'.repeat(8)+'-0000-0000-0000-000000000000'}), 'conversation-identifier'],
    [JSON.stringify({['api'+'_key']:'A'.repeat(24)}), 'literal-secret'],
    [['person', 'mail.company'].join('@'), 'contact-email'],
  ];
  for (const [value, expected] of cases) {
    const findings=privacyFindings(Buffer.concat([png,Buffer.from('\n'+value+'\n')]));
    assert.ok(findings.includes(expected), expected);
    assert.ok(findings.every(finding => !finding.includes(value)));
  }
});

test('PNG chunk content and malformed chunk sizes cannot bypass byte scanning; metadata remains flagged', () => {
  const signature=png.subarray(0,8); const end=chunk('IEND','');
  for (const type of ['eXIf','tEXt','zTXt','iTXt']) {
    assert.deepEqual(privacyFindings(Buffer.concat([signature,chunk(type,'\n'+token+'\n'),chunk(type,''),end])), ['image-metadata','github-token']);
  }
  assert.deepEqual(privacyFindings(Buffer.concat([signature,chunk('raNd','\n'+token+'\n'),end])), ['github-token']);
  const oversized=Buffer.alloc(8); oversized.writeUInt32BE(0xffffffff); oversized.write('IDAT',4);
  assert.deepEqual(privacyFindings(Buffer.concat([signature,oversized,Buffer.from('\n'+token+'\n')])), ['github-token']);
  assert.deepEqual(privacyFindings(Buffer.concat([signature,Buffer.from('\n'+token+'\n')])), ['github-token']);
});

for (const specimen of [
  {name:'image.png',label:'PNG trailers',value:token,kind:'github-token',bytes:Buffer.concat([png,Buffer.from('\n'+token+'\n')])},
  {name:'key.pem',label:'encrypted PKCS8 keys',value:encryptedHeader,kind:'private-key',bytes:Buffer.from(encryptedHeader+'\n')},
]) test(`the privacy audit rejects ${specimen.label} in files, unreachable Git blobs and release ZIP entries`, () => {
  mkdirSync('.cache', {recursive:true}); const directory=mkdtempSync(path.resolve('.cache/privacy-fixture-'));
  // Never let inherited Git overrides redirect synthetic blobs into the project.
  const env=Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
  try {
    mkdirSync(path.join(directory,'scripts')); mkdirSync(path.join(directory,'artifacts'));
    for (const name of ['privacy-audit.js','privacy-rules.js','release-files.js']) copyFileSync('scripts/'+name,path.join(directory,'scripts',name));
    writeFileSync(path.join(directory,'package.json'), '{"type":"module"}');
    writeFileSync(path.join(directory,'.gitignore'), 'artifacts/\n');
    execFileSync('git',['init','--quiet','--template='],{cwd:directory,env});
    const {name,bytes,kind,value}=specimen;
    writeFileSync(path.join(directory,name),bytes);
    const oid=execFileSync('git',['hash-object','-w','--stdin'],{cwd:directory,env,input:bytes,encoding:'utf8'}).trim();
    writeFileSync(path.join(directory,'artifacts/package.zip'),zipSync({[name]:bytes}));
    writeFileSync(path.join(directory,'artifacts/release-report.json'),JSON.stringify({packages:[{path:'artifacts/package.zip'}]}));
    const result=spawnSync(process.execPath,['scripts/privacy-audit.js','--history','--packages'],{cwd:directory,env,encoding:'utf8'});
    assert.equal(result.status,1,result.stderr);
    const report=JSON.parse(readFileSync(path.join(directory,'artifacts/privacy-audit.json'),'utf8'));
    assert.deepEqual(report.worktree.findings,[{file:name,kinds:[kind]}]);
    assert.deepEqual(report.git_objects.findings,[{object:oid,type:'blob',kinds:[kind]}]);
    assert.deepEqual(report.packages.findings,[{archive:'package.zip',file:name,kinds:[kind]}]);
    assert.ok(!(JSON.stringify(report)+result.stdout+result.stderr).includes(value));
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
