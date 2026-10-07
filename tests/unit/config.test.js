import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig, resolveButtons, renameLayout, deleteLayout, layoutAssignments, decodeConfig, exportConfig, conversationFromURL, parseConfig } from '../../src/lib/config.js';

const example = () => JSON.parse(readFileSync(new URL('../../docs/config.example.json',import.meta.url),'utf8'));
test('one shared layout serves five repositories and composes in assignment order', () => {
  const config=example(); config.repositories={Alice:Object.fromEntries(Array.from({length:5},(_,i)=>[`r${i}`,['codex','ci']]))};
  assert.deepEqual(validateConfig(config),[]);
  config.layouts.codex[0].label='🤖 Zażółć\nReview';
  for(let i=0;i<5;i++) assert.deepEqual(resolveButtons(config,'ALICE',`R${i}`).map(b=>b.label),['🤖 Zażółć\nReview','▶️ CI now']);
  assert.deepEqual(resolveButtons(config,'Bob','r0'),[]);
});
test('rename and delete update every assignment without mutating their input', () => {
  const config=example(); const renamed=renameLayout(config,'codex','review');
  assert.deepEqual(layoutAssignments(renamed,'review'),['Alice/one','Alice/two']);
  assert.ok(config.layouts.codex); assert.ok(!Object.hasOwn(renamed.layouts,'codex'));
  const deleted=deleteLayout(renamed,'review');
  assert.deepEqual(deleted.repositories.Alice.two,[]);
  assert.deepEqual(deleted.repositories.Alice.one,['ci']);
  assert.throws(()=>renameLayout(config,'ci','codex'));
});
test('invalid types, modes, references, assignments, URL names and collisions are rejected', () => {
  const changes=[c=>c.version=2,c=>c.layouts=[],c=>c.layouts.ci[0].label=1,c=>c.layouts.ci[0].value=null,
    c=>c.layouts.ci[0].mode='publish',c=>c.layouts.ci={},c=>c.repositories.Alice.x=['missing'],
    c=>c.repositories.Alice.x=['ci','ci'],c=>c.repositories.ALICE={},
    c=>c.repositories.Alice.ONE=[],c=>c.repositories['x/y']={}];
  for(const change of changes){const config=example();change(config);assert.ok(validateConfig(config).length);}
  for(const invalid of [null,1,[],true]) assert.ok(validateConfig(invalid).length);
});
test('Unicode, multiline text and empty strings round-trip with optional UTF-8 BOM', () => {
  const config=example(); config.layouts.ci[0]={label:'🤖 Zażółć gęślą\r\njaźń',value:'Pierwsza\r\nDruga 🧪\rTrzecia\n',mode:'append'};
  config.layouts.empty=[{label:'',value:'',mode:'replace'}];
  const output=exportConfig(config);assert.ok(!output.startsWith('\uFEFF'));
  assert.deepEqual(decodeConfig(new TextEncoder().encode('\uFEFF'+output)),config);
  assert.throws(()=>decodeConfig(Uint8Array.of(0xc3,0x28)),TypeError);
  assert.throws(()=>parseConfig('{bad'),SyntaxError);
});
test('prototype-like layout and repository names are treated as ordinary own keys', () => {
  const config=parseConfig('{"version":1,"layouts":{"__proto__":[],"constructor":[]},"repositories":{"__proto__":{"constructor":["__proto__"]}}}');
  const renamed=renameLayout(config,'__proto__','toString');
  assert.deepEqual(renamed.repositories.__proto__.constructor,['toString']);
  assert.equal({}.polluted,undefined);
  assert.ok(validateConfig({...config,repositories:{Alice:{repo:['toString']}}}).some(e=>e.code==='reference'));
});
test('only exact GitHub conversation URLs match; query and fragments are ignored', () => {
  assert.equal(conversationFromURL('https://github.com/A/R/pull/12?q=1#comment').key,'a/r/pull/12');
  assert.equal(conversationFromURL('https://github.com/A/R/issues/3/').kind,'issues');
  for(const url of ['https://github.com/A/R/pull/12/files','https://github.com/A/R/issues/new','https://github.com/A/R/issues/0','http://github.com/A/R/issues/1','https://example.org/A/R/issues/1','https://github.com/A%2FR/R/issues/1']) assert.equal(conversationFromURL(url),null);
});
