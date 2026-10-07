import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeConfig, saveConfig } from '../../src/lib/storage.js';
import { Draft } from '../../src/options/draft.js';
import { validateConfig } from '../../src/lib/config.js';

const config=()=>({version:1,layouts:{ci:[{label:'CI',value:'/ci-now',mode:'replace'}]},repositories:{Alice:{repo:['ci']}}});
test('public fresh-install defaults are valid example layouts without personal repository assignments', async()=>{
  let written;
  const api={storage:{local:{get:async()=>({}),set:async value=>{written=value;}}}};
  const result=await initializeConfig(api);
  assert.deepEqual(validateConfig(result),[]);
  assert.deepEqual(result.repositories,{});
  assert.deepEqual(Object.keys(result.layouts),['ci','codex']);
  assert.deepEqual(written.config,result);
});
test('initialize only missing storage; updates and invalid stored values are preserved',async()=>{
  for(const stored of [{},{config:config()},{config:{version:999}},{config:null}]) {
    const writes=[];const api={storage:{local:{get:async()=>stored,set:async value=>writes.push(value)}}};
    const result=await initializeConfig(api);
    assert.equal(writes.length,Object.hasOwn(stored,'config')?0:1);
    if(Object.hasOwn(stored,'config')) assert.equal(result,stored.config);
  }
});
test('invalid configuration never reaches storage and write failures propagate',async()=>{
  let writes=0;const api={storage:{local:{set:async()=>{writes++;throw new Error('quota');}}}};
  await assert.rejects(saveConfig(api,{version:2}));assert.equal(writes,0);
  await assert.rejects(saveConfig(api,config()));assert.equal(writes,1);
});
test('forms and JSON preserve a common draft; invalid JSON blocks forms and can be discarded',()=>{
  const draft=new Draft(config());draft.draft.layouts.ci[0].label='🧪 Zażółć';draft.changed();draft.switchView('json');
  draft.raw='{invalid';assert.throws(()=>draft.switchView('assignments'));assert.equal(draft.view,'json');assert.ok(draft.dirty);
  draft.discardJSON();draft.switchView('assignments');assert.equal(draft.draft.layouts.ci[0].label,'🧪 Zażółć');
  assert.equal(JSON.parse(draft.export()).layouts.ci[0].label,'🧪 Zażółć');
});
test('external storage changes preserve dirty drafts and reload clean ones',()=>{
  const draft=new Draft(config());draft.draft.layouts.ci[0].value='draft';draft.changed();
  const updated=config();updated.layouts.ci[0].value='external';
  assert.equal(draft.receiveExternal(updated),false);assert.equal(draft.draft.layouts.ci[0].value,'draft');
  draft.reset(updated);assert.equal(draft.dirty,false);assert.equal(draft.receiveExternal(config()),true);
});
test('unsupported saved configuration is exposed as JSON without a default replacement',()=>{
  const draft=new Draft({version:999});assert.equal(draft.view,'json');assert.equal(draft.lastValid,null);
  assert.equal(draft.dirty,false);assert.equal(draft.discardJSON(),false);
});

test('a pending external change keeps a reverted draft dirty, including removed or invalid storage',()=>{
  for (const external of [null, undefined, {version:999}, {...config(),repositories:{}}]) {
    const original=config();const draft=new Draft(original);
    draft.draft.layouts.ci[0].value='unsaved';draft.changed();draft.receiveExternal(external);
    draft.imported(original);
    assert.equal(draft.dirty,true);
    draft.reset(external);
    assert.equal(draft.dirty,false);
  }
});
