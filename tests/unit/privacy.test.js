import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { zipSync } from 'fflate';
import { privacyFindings, privacyPathFindings, prohibitedPath } from '../../scripts/privacy-rules.js';

const png = readFileSync('src/icons/hint-16.png');
const token = ['github', 'pat', ''].join('_') + 'A'.repeat(40);
const encryptedHeader = ['-----BEGIN ', 'ENCRYPTED ', 'PRIVATE KEY-----'].join('');
function chunk(type, value) {
  const bytes = Buffer.from(value); const header = Buffer.alloc(8);
  header.writeUInt32BE(bytes.length); header.write(type, 4, 'ascii');
  return Buffer.concat([header, bytes, Buffer.alloc(4)]);
}
function withPathAuditFixture(run) {
  mkdirSync('.cache',{recursive:true});const directory=mkdtempSync(path.resolve('.cache/privacy-path-fixture-'));
  const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>!name.startsWith('GIT_')));
  try {
    mkdirSync(path.join(directory,'scripts'));mkdirSync(path.join(directory,'artifacts'));
    for(const name of ['privacy-audit.js','privacy-rules.js','release-files.js'])copyFileSync('scripts/'+name,path.join(directory,'scripts',name));
    writeFileSync(path.join(directory,'package.json'),'{"type":"module"}');writeFileSync(path.join(directory,'.gitignore'),'artifacts/\n');
    execFileSync('git',['init','--quiet','--template='],{cwd:directory,env});
    run(directory,env);
  } finally {rmSync(directory,{recursive:true,force:true});}
}
function runPathAudit(directory,env) {
  const result=spawnSync(process.execPath,['scripts/privacy-audit.js','--history','--packages'],{cwd:directory,env,encoding:'utf8'});
  const report=JSON.parse(readFileSync(path.join(directory,'artifacts/privacy-audit.json'),'utf8'));
  return {result,report,output:JSON.stringify(report)+result.stdout+result.stderr};
}

test('path-only sensitive values fail worktree, nested Git-tree and ZIP audits without exposing names',()=>{
  const cases=[
    {name:'docs/'+token+'.txt',kind:'github-token',sensitive:token},
    {name:'docs/'+token+'/note.txt',kind:'github-token',sensitive:token},
    {name:'docs/'+['api','key'].join('_')+'='+'A'.repeat(32)+'/note.txt',kind:'literal-secret',sensitive:'A'.repeat(32)},
    {name:'links/https:'+'\\\\'+'github.com'+String.fromCharCode(92)+'demo'+String.fromCharCode(92)+['project','private'].join('-')+'/note.txt',kind:'private-repository-reference',sensitive:['project','private'].join('-')},
    {name:'docs/'+['person','mail.company'].join('@')+'/note.txt',kind:'contact-email',sensitive:['person','mail.company'].join('@')},
    {name:'docs/memory/note.txt',kind:'retired-private-material',sensitive:'docs/memory'},
  ];
  for(const {name,kind,sensitive} of cases)withPathAuditFixture((directory,env)=>{
    const bytes=Buffer.from('Public fixture\n');mkdirSync(path.dirname(path.join(directory,name)),{recursive:true});writeFileSync(path.join(directory,name),bytes);
    execFileSync('git',['add','--',name],{cwd:directory,env});
    const tree=execFileSync('git',['write-tree'],{cwd:directory,env,encoding:'utf8'}).trim();
    writeFileSync(path.join(directory,'artifacts/package.zip'),zipSync({[name]:bytes}));
    writeFileSync(path.join(directory,'artifacts/release-report.json'),JSON.stringify({packages:[{path:'artifacts/package.zip'}]}));
    const {result,report,output}=runPathAudit(directory,env);
    assert.equal(result.status,1,'Path-only values must fail the audit');
    assert.ok(report.worktree.findings.some(f=>f.kinds.includes(kind)),'Worktree paths must be checked');
    assert.ok(report.git_objects.findings.some(f=>f.object===tree&&f.type==='tree'&&f.kinds.includes(kind)),'Full nested paths must be checked in the root tree');
    assert.ok(report.packages.findings.some(f=>f.kinds.includes(kind)),'ZIP entry paths must be checked');
    assert.ok(!output.includes(sensitive),'Reports and console output must redact sensitive path values');
    assert.ok(!output.includes(name),'Reports must not retain the original sensitive path');
  });
});
test('sensitive release archive names fail without leaking their location; safe Unicode paths remain allowed',()=>{
  for(const sensitive of [false,true])withPathAuditFixture((directory,env)=>{
    const name='docs/Łódź 🧪/public\tname\n.txt';const bytes=Buffer.from('Public fixture\n');
    mkdirSync(path.dirname(path.join(directory,name)),{recursive:true});writeFileSync(path.join(directory,name),bytes);
    execFileSync('git',['add','--',name],{cwd:directory,env});execFileSync('git',['write-tree'],{cwd:directory,env});
    const archive='artifacts/'+(sensitive?token:'public')+'.zip';
    writeFileSync(path.join(directory,archive),zipSync({[name]:bytes}));
    writeFileSync(path.join(directory,'artifacts/release-report.json'),JSON.stringify({packages:[{path:archive}]}));
    const {result,report,output}=runPathAudit(directory,env);
    assert.equal(result.status,sensitive?1:0);
    assert.equal(report.worktree.findings.length,0);assert.equal(report.git_objects.findings.length,0);
    if(sensitive)assert.ok(report.packages.findings.some(f=>f.kinds.includes('github-token')));
    else assert.equal(report.packages.findings.length,0);
    assert.ok(!output.includes(token),'Archive location must be redacted too');
  });
});

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
test('path rules apply every byte pattern and preserve Windows and URL spellings',()=>{
  const cases=[
    [encryptedHeader,'private-key'],[token,'github-token'],
    [['AK','IA'].join('')+'A'.repeat(16),'aws-access-key'],
    [['xox','b-'].join('')+'A'.repeat(24),'service-token'],
    [String.fromCharCode(47)+['home','demo','file'].join('/'),'local-machine-path'],
    ['C:'+String.fromCharCode(92)+['Users','demo','file'].join(String.fromCharCode(92)),'local-machine-path'],
    ['https://'+['account','password'].join(':')+'@service.test/','credential-url'],
    ['https:'+String.fromCharCode(92).repeat(2)+['github.com','demo',['project','private'].join('-')].join(String.fromCharCode(92)),'private-repository-reference'],
    [['codex','clipboard'].join('-')+'-'+'a'.repeat(8)+'-0000-0000-0000-000000000000.png','conversation-identifier'],
    [['api','key'].join('_')+'='+'A'.repeat(32),'literal-secret'],
    [['person','mail.company'].join('@'),'contact-email'],
    [['docs','memory','file'].join(String.fromCharCode(92)),'retired-private-material'],
  ];
  for(const [value,kind] of cases) {
    assert.ok(privacyPathFindings('nested/'+value+'/file').includes(kind),kind);
    assert.ok(!JSON.stringify(privacyPathFindings(value)).includes(value));
  }
  assert.deepEqual(privacyPathFindings('docs/Łódź 🧪/public.md'),[]);
  assert.deepEqual(privacyPathFindings('docs/'+['api','key'].join('_')+'=local-preflight-'+'A'.repeat(32)),[]);
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
