import { test, expect } from '@playwright/test';
import { openOptions, config } from './helpers.js';

const deferStartupReads=async(page,{missing=false}={})=>page.evaluate(({missing})=>{
  if(missing)delete window.__mock.storage.config;
  const get=browser.storage.local.get;
  let reads=0;
  browser.storage.local.get=async keys=>{
    const snapshot=await get(keys);
    if(keys==='config') {
      const key=++reads===1?'finishStartupRead':'finishStartupReread';
      await new Promise((resolve,reject)=>window.__mock[key]=fail=>fail?reject(new Error('startup read')):resolve());
    }
    return snapshot;
  };
}, {missing});
const startupValue=kind=>{
  const value=kind==='valid'?config():kind==='invalid'?{version:999}:kind==='null'?null:undefined;
  if(kind==='valid')value.layouts.ci[0].value='Latest startup';
  return value;
};
async function expectStartupValue(page,value) {
  await expect(page.locator('#save')).toBeEnabled();await expect(page.locator('#discard')).toBeEnabled();
  if(value?.version===1)await expect(page.getByLabel('Inserted text',{exact:true})).toHaveValue('Latest startup');
  else {
    await expect(page.locator('#tab-json')).toHaveAttribute('aria-selected','true');
    await expect(page.locator('#json-editor')).toHaveValue(JSON.stringify(value,null,2)??'');
    await page.getByRole('button',{name:'Validate',exact:true}).click();
    await expect(page.locator('#errors')).not.toHaveText('');
  }
  await expect(page.locator('#dirty')).toHaveText('No unsaved changes');
  expect(await page.evaluate(()=>window.__mock.storage.config)).toEqual(value);
  expect(await page.evaluate(()=>window.__mock.writes)).toBe(0);
}
for(const outcome of ['resolve','reject'])for(const kind of ['valid','invalid','null','removed'])test(`startup accepts a newer ${kind} event across a ${outcome} reread`,async({page})=>{
  await openOptions(page,config(),'en',{beforeOptions:deferStartupReads,waitReady:false});
  await expect.poll(()=>page.evaluate(()=>typeof window.__mock.finishStartupRead)).toBe('function');
  const first=config();first.layouts.ci[0].value='Earlier startup';const latest=startupValue(kind);
  await page.evaluate(async({first,latest,fail})=>{
    window.__mock.external(first);window.__mock.finishStartupRead(false);
    await new Promise(resolve=>setTimeout(resolve,0));
    window.__mock.external(latest);
    window.__mock.finishStartupReread?.(fail);
    await new Promise(resolve=>setTimeout(resolve,0));
  },{first,latest,fail:outcome==='reject'});
  await expectStartupValue(page,latest);
});
for(const kind of ['valid','invalid','null','removed'])test(`a failed initial settings read accepts its latest ${kind} startup notification`,async({page})=>{
  await openOptions(page,config(),'en',{beforeOptions:deferStartupReads,waitReady:false});
  await expect.poll(()=>page.evaluate(()=>typeof window.__mock.finishStartupRead)).toBe('function');
  const latest=startupValue(kind);
  await page.evaluate(({first,latest})=>{window.__mock.external(first);window.__mock.external(latest);window.__mock.finishStartupRead(true);},{first:config(),latest});
  await expectStartupValue(page,latest);
});
for(const kind of ['valid','invalid','null','removed'])test(`a stale missing-config read does not initialize defaults over a ${kind} startup event`,async({page})=>{
  await openOptions(page,config(),'en',{beforeOptions:page=>deferStartupReads(page,{missing:true}),waitReady:false});
  await expect.poll(()=>page.evaluate(()=>typeof window.__mock.finishStartupRead)).toBe('function');
  const latest=startupValue(kind);
  await page.evaluate(async latest=>{
    window.__mock.external(latest);window.__mock.finishStartupRead(false);
    await new Promise(resolve=>setTimeout(resolve,0));window.__mock.finishStartupReread?.(false);
  },latest);
  await expectStartupValue(page,latest);
});
test('a startup read failure without notifications reports failure and performs no writes',async({page})=>{
  await openOptions(page,config(),'en',{beforeOptions:deferStartupReads,waitReady:false});
  await expect.poll(()=>page.evaluate(()=>typeof window.__mock.finishStartupRead)).toBe('function');
  await page.evaluate(()=>window.__mock.finishStartupRead(true));
  await expect(page.locator('#status')).toContainText('Could not read local configuration');
  await expect(page.locator('#save')).toBeDisabled();await expect(page.locator('#discard')).toBeDisabled();
  expect(await page.evaluate(()=>window.__mock.writes)).toBe(0);
});

const deferDiscardRead=async page=>page.evaluate(()=>{
  const get=browser.storage.local.get;
  window.__mock.originalGet=get;
  browser.storage.local.get=async keys=>{
    const value=await get(keys);
    if(keys==='config')await new Promise((resolve,reject)=>window.__mock.finishDiscardRead=fail=>fail?reject(new Error('discard read')):resolve());
    return value;
  };
});
for(const state of ['dirty','clean']) for(const other of ['valid','invalid','null','removed']) test(`discard in a ${state} tab accepts the newer ${other} storage event over a stale read`,async({page})=>{
  await openOptions(page);
  if(state==='dirty')await page.getByLabel('Inserted text',{exact:true}).fill('Local draft');
  await deferDiscardRead(page);await page.getByRole('button',{name:'Discard changes',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof window.__mock.finishDiscardRead)).toBe('function');
  const interim=config();interim.layouts.ci[0].value='Earlier event';
  const next=other==='valid'?config():other==='invalid'?{version:999}:other==='null'?null:undefined;
  if(other==='valid')next.layouts.ci[0].value='Latest storage';
  await page.evaluate(({interim,next})=>{
    window.__mock.external(interim);window.__mock.external(next);
    browser.storage.local.get=window.__mock.originalGet;window.__mock.finishDiscardRead(false);
  },{interim,next});
  await expect(page.locator('#dirty')).toHaveText('No unsaved changes');
  if(other==='valid')await expect(page.getByLabel('Inserted text',{exact:true})).toHaveValue('Latest storage');
  else {
    await expect(page.locator('#tab-json')).toHaveAttribute('aria-selected','true');
    await expect(page.locator('#json-editor')).toHaveValue(JSON.stringify(next,null,2)??'');
    await page.getByRole('button',{name:'Validate',exact:true}).click();
    await expect(page.locator('#errors')).not.toHaveText('');
  }
  expect(await page.evaluate(()=>window.__mock.storage.config)).toEqual(next);
  expect(await page.evaluate(()=>window.__mock.writes)).toBe(0);
  expect(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});dispatchEvent(event);return event.defaultPrevented;})).toBe(false);
});
for(const outcome of ['resolve','reject'])test(`an edit made during a pending discard supersedes its ${outcome}`,async({page})=>{
  await openOptions(page);await page.getByLabel('Inserted text',{exact:true}).fill('First draft');
  await deferDiscardRead(page);await page.getByRole('button',{name:'Discard changes',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof window.__mock.finishDiscardRead)).toBe('function');
  const next=config();next.layouts.ci[0].value='Other tab';await page.evaluate(next=>window.__mock.external(next),next);
  await page.getByLabel('Inserted text',{exact:true}).fill('Later edit');
  await page.evaluate(async fail=>{browser.storage.local.get=window.__mock.originalGet;window.__mock.finishDiscardRead(fail);await new Promise(resolve=>setTimeout(resolve,0));},outcome==='reject');
  await expect(page.getByLabel('Inserted text',{exact:true})).toHaveValue('Later edit');await expect(page.locator('#dirty')).toHaveText('Unsaved changes');
  await expect(page.locator('#status')).toHaveText('');
  await page.getByRole('button',{name:'Discard changes',exact:true}).click();await expect(page.getByLabel('Inserted text',{exact:true})).toHaveValue('Other tab');
});
test('a failed discard read preserves the draft and newer event for a successful retry',async({page})=>{
  await openOptions(page);await page.getByLabel('Inserted text',{exact:true}).fill('Local draft');
  await deferDiscardRead(page);await page.getByRole('button',{name:'Discard changes',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof window.__mock.finishDiscardRead)).toBe('function');
  const next=config();next.layouts.ci[0].value='Other tab';
  await page.evaluate(next=>{window.__mock.external(next);browser.storage.local.get=window.__mock.originalGet;window.__mock.finishDiscardRead(true);},next);
  await expect(page.locator('#status')).toContainText('Could not read local configuration');
  await expect(page.getByLabel('Inserted text',{exact:true})).toHaveValue('Local draft');await expect(page.locator('#dirty')).toHaveText('Unsaved changes');
  await page.getByRole('button',{name:'Discard changes',exact:true}).click();await expect(page.getByLabel('Inserted text',{exact:true})).toHaveValue('Other tab');
  await expect(page.locator('#dirty')).toHaveText('No unsaved changes');
});

for(const other of ['valid','null','removed'])test(`concurrent saves preserve the local draft and warn about a ${other} competing value`,async({page})=>{
  await openOptions(page);await page.getByLabel('Inserted text',{exact:true}).fill('Local draft');
  await page.evaluate(()=>{
    const set=browser.storage.local.set;
    window.__mock.originalSet=set;
    browser.storage.local.set=async value=>{await set(value);await new Promise(resolve=>window.__mock.finishWrite=resolve);};
  });
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof window.__mock.finishWrite)).toBe('function');
  const next=other==='null'?null:other==='removed'?undefined:config();if(next)next.layouts.ci[0].value='Other tab';
  await page.evaluate(next=>{window.__mock.external(next);window.__mock.finishWrite();},next);
  await expect(page.locator('#save')).toBeEnabled();await expect(page.locator('#status')).toContainText('Your draft was preserved');
  await expect(page.locator('#dirty')).toHaveText('Unsaved changes');await expect(page.getByLabel('Inserted text',{exact:true})).toHaveValue('Local draft');
  expect(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});dispatchEvent(event);return event.defaultPrevented;})).toBe(true);
  if(other==='valid') {
    await page.getByRole('button',{name:'Discard changes',exact:true}).click();await expect(page.getByLabel('Inserted text',{exact:true})).toHaveValue('Other tab');
  } else {
    await page.evaluate(()=>browser.storage.local.set=window.__mock.originalSet);
    await page.getByRole('button',{name:'Save',exact:true}).click();
    await expect(page.locator('#status')).toHaveText('Configuration saved.');await expect(page.locator('#dirty')).toHaveText('No unsaved changes');
  }
});

test('concurrent storage changes during save verification supersede a stale read',async({page})=>{
  await openOptions(page);await page.getByLabel('Inserted text',{exact:true}).fill('Local draft');
  await page.evaluate(()=>{
    const get=browser.storage.local.get;
    browser.storage.local.get=async keys=>{const value=await get(keys);if(keys==='config')await new Promise(resolve=>window.__mock.finishRead=resolve);return value;};
  });
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof window.__mock.finishRead)).toBe('function');
  const next=config();next.layouts.ci[0].value='Latest storage';
  await page.evaluate(next=>{window.__mock.external(next);window.__mock.finishRead();},next);
  await expect(page.locator('#status')).toContainText('Your draft was preserved');await expect(page.locator('#dirty')).toHaveText('Unsaved changes');
  await expect(page.getByLabel('Inserted text',{exact:true})).toHaveValue('Local draft');
});

test('failed verification preserves the draft and does not report a confirmed save',async({page})=>{
  await openOptions(page);await page.getByLabel('Inserted text',{exact:true}).fill('Local draft');
  await page.evaluate(()=>window.__mock.failReads=true);
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#status')).toContainText('Could not verify');await expect(page.locator('#dirty')).toHaveText('Unsaved changes');
  await expect(page.getByLabel('Inserted text',{exact:true})).toHaveValue('Local draft');
  await page.evaluate(()=>window.__mock.failReads=false);await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#status')).toHaveText('Configuration saved.');await expect(page.locator('#dirty')).toHaveText('No unsaved changes');
});

test('save verification detects a competing write even before its notification arrives',async({page})=>{
  await openOptions(page);await page.getByLabel('Inserted text',{exact:true}).fill('Local draft');
  const next=config();next.layouts.ci[0].value='Other tab';
  await page.evaluate(next=>{
    const set=browser.storage.local.set;
    browser.storage.local.set=async value=>{await set(value);window.__mock.storage.config=structuredClone(next);};
  },next);
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#status')).toContainText('Your draft was preserved');await expect(page.locator('#dirty')).toHaveText('Unsaved changes');
  await expect(page.getByLabel('Inserted text',{exact:true})).toHaveValue('Local draft');
});

test('a matching concurrent save leaves no conflict and preserves edits made while saving',async({page})=>{
  await openOptions(page,config(),'pl');await page.getByLabel('Wstawiany tekst',{exact:true}).fill('Snapshot');
  await page.evaluate(()=>{
    const set=browser.storage.local.set;
    browser.storage.local.set=async value=>{await set(value);await new Promise(resolve=>window.__mock.finishWrite=resolve);};
  });
  await page.getByRole('button',{name:'Zapisz',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof window.__mock.finishWrite)).toBe('function');
  await page.getByLabel('Wstawiany tekst',{exact:true}).fill('Later edit');
  await page.evaluate(()=>{window.__mock.external(window.__mock.storage.config);window.__mock.finishWrite();});
  await expect(page.locator('#status')).toHaveText('Konfiguracja zapisana.');await expect(page.locator('#dirty')).toHaveText('Niezapisane zmiany');
  await expect(page.getByLabel('Wstawiany tekst',{exact:true})).toHaveValue('Later edit');
  await page.getByRole('button',{name:'Odrzuć zmiany',exact:true}).click();await expect(page.getByLabel('Wstawiany tekst',{exact:true})).toHaveValue('Snapshot');
  await expect(page.locator('#dirty')).toHaveText('Brak niezapisanych zmian');
});

test('history suggestions include old visits and more than 100 results while preserving the draft',async({page})=>{
  await openOptions(page);await page.getByLabel('Button label',{exact:true}).fill('Unsaved 🧪');
  await page.evaluate(()=>{window.__mock.historyItems=[...Array.from({length:128},(_,i)=>({url:`https://github.com/Visitors/repo${i}/tree/main`,title:'Not persisted',lastVisitTime:1})),{url:'https://github.com/Legacy/archive/blob/main/file',lastVisitTime:1},{url:'https://github.com/ALICE/REPO/issues/9'},{url:'https://github.com/visitors/REPO0/pull/1'},{url:'https://evil.invalid/test',title:'https://github.com/'},{url:'https://github.com/settings/profile'},{url:'https://github.com/stars/octocat'},{url:'https://github.com/STARS/octocat/lists/review-tools'},{url:'https://github.com/enterprises/demo-enterprise'},{url:'https://github.com/solutions/industry'},{url:'https://github.com/RESOURCES/articles/security'},{url:'https://github.com/readme/featured'},{url:'https://github.com/EDUCATION/students'},{url:'https://github.com/git-guides/git-remote'},{url:'https://github.com/GIT-GUIDES/git-pull'},{url:'https://github.com/partners/technology-partners'},{url:'https://github.com/TRUST-CENTER/privacy'},{url:'https://github.com/why-github/overview'}];});
  await page.getByRole('tab',{name:'Assignments',exact:true}).click();
  await page.getByRole('button',{name:'Import GitHub history',exact:true}).click();
  await expect(page.locator('#repository-status')).toContainText('Imported 130 unique repositories');
  await expect(page.locator('#known-repositories option')).toHaveCount(131);
  await expect(page.locator('#known-repositories option[value="Legacy/archive"]')).toHaveCount(1);
  await expect(page.locator('#known-repositories option[value^="stars/" i], #known-repositories option[value^="enterprises/" i], #known-repositories option[value^="solutions/" i], #known-repositories option[value^="resources/" i], #known-repositories option[value^="readme/" i], #known-repositories option[value^="education/" i], #known-repositories option[value^="git-guides/" i], #known-repositories option[value^="partners/" i], #known-repositories option[value^="trust-center/" i], #known-repositories option[value^="why-github/" i]')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__mock.permissionRequests)).toEqual([{permissions:['history']}]);
  expect(await page.evaluate(()=>window.__mock.historyQueries)).toEqual([{text:'https://github.com/',startTime:0,maxResults:2147483647}]);
  expect(await page.evaluate(()=>window.__mock.storage.config)).toEqual(config());
  await page.getByLabel('Visited or configured repository',{exact:true}).fill('visitors/REPO127');
  await page.getByRole('button',{name:'Use repository',exact:true}).click();
  await expect(page.getByLabel('Owner',{exact:true})).toHaveValue('Visitors');
  await expect(page.getByLabel('Repository',{exact:true})).toHaveValue('repo127');
  await page.getByRole('button',{name:'Add repository',exact:true}).click();
  await page.getByRole('tab',{name:'JSON',exact:true}).click();
  const draft=JSON.parse(await page.locator('#json-editor').inputValue());
  expect(draft.layouts.ci[0].label).toBe('Unsaved 🧪');expect(draft.repositories.Visitors.repo127).toEqual([]);
  expect(await page.evaluate(()=>window.__mock.storage.config)).toEqual(config());
});
test('denied history permission and import failures preserve the draft and manual entry',async({page})=>{
  await openOptions(page);await page.getByLabel('Inserted text',{exact:true}).fill('Keep draft');
  await page.getByRole('tab',{name:'Assignments',exact:true}).click();
  await page.evaluate(()=>window.__mock.permissionGranted=false);
  await page.getByRole('button',{name:'Import GitHub history',exact:true}).click();
  await expect(page.locator('#repository-status')).toContainText('History access was not granted');
  expect(await page.evaluate(()=>window.__mock.historyQueries)).toEqual([]);
  await page.evaluate(()=>{window.__mock.permissionGranted=true;window.__mock.failHistory=true;});
  await page.getByRole('button',{name:'Import GitHub history',exact:true}).click();
  await expect(page.locator('#repository-status')).toContainText('Could not import history');
  await page.evaluate(()=>{window.__mock.failHistory=false;window.__mock.failWrites=true;window.__mock.historyItems=[{url:'https://github.com/Legacy/archive'}];});
  await page.getByRole('button',{name:'Import GitHub history',exact:true}).click();
  await expect(page.locator('#repository-status')).toContainText('Could not import history');
  await page.getByLabel('Owner',{exact:true}).fill('Manual');await page.getByLabel('Repository',{exact:true}).fill('entry');
  await page.getByRole('button',{name:'Add repository',exact:true}).click();
  await page.getByRole('tab',{name:'JSON',exact:true}).click();
  expect(JSON.parse(await page.locator('#json-editor').inputValue()).layouts.ci[0].value).toBe('Keep draft');
  expect(await page.evaluate(()=>window.__mock.storage.config)).toEqual(config());
});
test('catalog changes preserve fields and focus; clearing removes only remembered repositories',async({page})=>{
  await openOptions(page);await page.getByRole('tab',{name:'Assignments',exact:true}).click();
  await page.getByLabel('Owner',{exact:true}).fill('Unfinished');
  await page.getByLabel('Repository',{exact:true}).fill('draft');
  await page.evaluate(()=>browser.storage.local.set({'repositoryCatalog:legacy/archive':{owner:'Legacy',repo:'archive'}}));
  await expect(page.locator('#known-repositories option')).toHaveCount(3);
  await expect(page.getByLabel('Owner',{exact:true})).toHaveValue('Unfinished');
  await expect(page.getByLabel('Repository',{exact:true})).toHaveValue('draft');
  await expect(page.getByLabel('Repository',{exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Clear remembered repositories',exact:true}).click();
  await expect(page.locator('#repository-status')).toContainText('Remembered repositories cleared');
  await expect(page.locator('#known-repositories option')).toHaveCount(2);
  expect(await page.evaluate(()=>window.__mock.storage.config)).toEqual(config());
  expect(await page.evaluate(()=>window.__mock.storage['repositoryCatalog:legacy/archive'])).toBeUndefined();
});
test('Polish repository suggestions work in a narrow window without overflow',async({page})=>{
  await page.setViewportSize({width:360,height:900});await openOptions(page,config(),'pl');
  await page.getByRole('tab',{name:'Przypisania',exact:true}).click();
  await expect(page.getByRole('button',{name:'Importuj historię GitHuba',exact:true})).toBeVisible();
  await page.getByLabel('Odwiedzone lub skonfigurowane repozytorium',{exact:true}).fill('Alice/repo');
  await page.getByRole('button',{name:'Wybierz repozytorium',exact:true}).click();
  await expect(page.getByLabel('Właściciel',{exact:true})).toHaveValue('Alice');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.screenshot({path:'artifacts/repository-suggestions-pl.png',fullPage:true});
});

test('form edits survive views; invalid JSON blocks forms until discarded; Save updates storage',async({page})=>{
  await openOptions(page);await page.getByLabel('Button label',{exact:true}).fill('🧪 Zażółć\nNow');
  await page.getByRole('tab',{name:'JSON',exact:true}).click();
  expect(await page.locator('#json-editor').inputValue()).toContain('🧪 Zażółć');
  await page.locator('#json-editor').fill('{bad');await page.getByRole('tab',{name:'Assignments',exact:true}).click();
  await expect(page.locator('#tab-json')).toHaveAttribute('aria-selected','true');await expect(page.locator('#errors')).toContainText('Invalid JSON');
  await page.getByRole('button',{name:'Discard JSON edits',exact:true}).click();await page.getByRole('tab',{name:'Layouts',exact:true}).click();
  await expect(page.getByLabel('Button label',{exact:true})).toHaveValue('🧪 Zażółć\nNow');
  expect(await page.evaluate(()=>window.__mock.writes)).toBe(0);
  await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('#status')).toHaveText('Configuration saved.');
  expect(await page.evaluate(()=>window.__mock.storage.config.layouts.ci[0].label)).toBe('🧪 Zażółć\nNow');
});
test('rename and confirmed deletion update references; cancelling preserves the layout',async({page})=>{
  await openOptions(page);await page.getByLabel('Layout ID',{exact:true}).nth(1).fill('shared');await page.getByRole('button',{name:'Rename',exact:true}).click();
  await page.getByRole('tab',{name:'JSON',exact:true}).click();const renamed=JSON.parse(await page.locator('#json-editor').inputValue());expect(renamed.repositories.Alice.repo).toEqual(['shared','review']);
  await page.getByRole('tab',{name:'Layouts',exact:true}).click();page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Delete layout',exact:true}).click();await expect(page.getByLabel('Layout',{exact:true})).toHaveValue('shared');
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Delete layout',exact:true}).click();
  await page.getByRole('tab',{name:'JSON',exact:true}).click();const deleted=JSON.parse(await page.locator('#json-editor').inputValue());expect(deleted.repositories.Alice.repo).toEqual(['review']);expect(deleted.layouts.shared).toBeUndefined();
});
test('create a reusable layout, edit and reorder buttons, and remove a button',async({page})=>{
  await openOptions(page);await page.getByLabel('Layout ID',{exact:true}).nth(0).fill('shared');await page.getByRole('button',{name:'Create layout',exact:true}).click();
  await page.getByRole('button',{name:'Add button',exact:true}).click();await page.getByLabel('Button label',{exact:true}).fill('First');await page.getByLabel('Inserted text',{exact:true}).fill('one');
  await page.getByRole('button',{name:'Add button',exact:true}).click();await page.getByLabel('Button label',{exact:true}).nth(1).fill('Second');await page.getByLabel('Inserted text',{exact:true}).nth(1).fill('two');
  await page.getByRole('button',{name:'Move up',exact:true}).nth(1).click();await expect(page.getByLabel('Button label',{exact:true}).nth(0)).toHaveValue('Second');
  await page.getByRole('button',{name:'Remove button',exact:true}).nth(1).click();await page.getByRole('tab',{name:'JSON',exact:true}).click();
  expect(JSON.parse(await page.locator('#json-editor').inputValue()).layouts.shared).toEqual([{label:'Second',value:'two',mode:'append'}]);
});
test('assign multiple layouts, reorder them, and reject duplicate repository names',async({page})=>{
  await openOptions(page);await page.getByRole('tab',{name:'Assignments',exact:true}).click();
  await page.getByLabel('Owner',{exact:true}).fill('ALICE');await page.getByLabel('Repository',{exact:true}).fill('REPO');await page.getByRole('button',{name:'Add repository',exact:true}).click();await expect(page.locator('#errors')).toContainText('unique ignoring letter case');
  await page.getByLabel('Repository',{exact:true}).fill('second');await page.getByRole('button',{name:'Add repository',exact:true}).click();
  const card=page.locator('.assignment-card').filter({has:page.getByRole('heading',{name:'Alice/second',exact:true})});
  await card.getByLabel('Layout',{exact:true}).selectOption('ci');await card.getByRole('button',{name:'Assign layout',exact:true}).click();
  await card.getByRole('button',{name:'Assign layout',exact:true}).click();await card.getByRole('button',{name:'Move up',exact:true}).nth(1).click();
  await page.getByRole('tab',{name:'JSON',exact:true}).click();expect(JSON.parse(await page.locator('#json-editor').inputValue()).repositories.Alice.second).toEqual(['review','ci']);
});
test('failed save and external updates preserve the draft; discard reads latest storage',async({page})=>{
  await openOptions(page);await page.getByLabel('Inserted text',{exact:true}).fill('draft');
  await page.evaluate(()=>window.__mock.failWrites=true);await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('#status')).toContainText('Save failed');await expect(page.getByLabel('Inserted text',{exact:true})).toHaveValue('draft');
  const next=config();next.layouts.ci[0].value='external';await page.evaluate(next=>window.__mock.external(next),next);await expect(page.locator('#status')).toContainText('Your draft was preserved');await expect(page.getByLabel('Inserted text',{exact:true})).toHaveValue('draft');
  await page.getByRole('button',{name:'Discard changes',exact:true}).click();await expect(page.getByLabel('Inserted text',{exact:true})).toHaveValue('external');
  next.layouts.ci[0].value='clean update';await page.evaluate(next=>window.__mock.external(next),next);await expect(page.getByLabel('Inserted text',{exact:true})).toHaveValue('clean update');
});
test('import accepts UTF-8 BOM and Unicode; invalid encoding preserves draft; export uses the draft',async({page})=>{
  await openOptions(page);await page.getByRole('tab',{name:'JSON',exact:true}).click();
  const next=config();next.layouts.ci[0].label='Łódź 🤖\nReview';
  await page.getByLabel('Import JSON',{exact:true}).setInputFiles({name:'config.json',mimeType:'application/json',buffer:Buffer.from('\uFEFF'+JSON.stringify(next),'utf8')});
  await expect(page.locator('#status')).toContainText('Imported into the draft');expect(await page.evaluate(()=>window.__mock.writes)).toBe(0);
  const before=await page.locator('#json-editor').inputValue();
  await page.getByLabel('Import JSON',{exact:true}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from([0xc3,0x28])});await expect(page.locator('#status')).toContainText('Invalid UTF-8');await expect(page.locator('#json-editor')).toHaveValue(before);
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON',exact:true}).click();const download=await downloaded;
  const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const bytes=Buffer.concat(chunks);expect(bytes.subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf]))).toBe(false);expect(JSON.parse(bytes.toString('utf8'))).toEqual(next);
});
test('imported Windows line endings survive form views, unrelated edits, Save and export',async({page})=>{
  await openOptions(page);await page.getByRole('tab',{name:'JSON',exact:true}).click();
  const next=config();next.layouts.ci[0].label='Łódź\r\nReview';next.layouts.ci[0].value='First\r\n🧪\rThird\n';
  await page.getByLabel('Import JSON',{exact:true}).setInputFiles({name:'windows.json',mimeType:'application/json',buffer:Buffer.from('\uFEFF'+JSON.stringify(next),'utf8')});
  await expect(page.locator('#status')).toContainText('Imported into the draft');
  await page.getByRole('tab',{name:'Layouts',exact:true}).click();await expect(page.getByLabel('Inserted text',{exact:true})).toHaveValue('First\n🧪\nThird\n');
  await page.getByRole('combobox',{name:'Insertion mode',exact:true}).selectOption('append');next.layouts.ci[0].mode='append';
  await page.getByRole('tab',{name:'Assignments',exact:true}).click();await page.getByRole('tab',{name:'JSON',exact:true}).click();
  expect(JSON.parse(await page.locator('#json-editor').inputValue())).toEqual(next);
  await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('#status')).toHaveText('Configuration saved.');
  expect(await page.evaluate(()=>window.__mock.storage.config)).toEqual(next);
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON',exact:true}).click();
  const stream=await (await downloaded).createReadStream();const chunks=[];for await (const chunk of stream) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString('utf8'))).toEqual(next);
});
test('unsupported stored configuration stays intact and is recoverable through JSON',async({page})=>{
  await openOptions(page,{version:999});await expect(page.locator('#tab-json')).toHaveAttribute('aria-selected','true');await expect(page.locator('#status')).toContainText('has not been overwritten');expect(await page.evaluate(()=>window.__mock.writes)).toBe(0);
  await page.getByRole('tab',{name:'Layouts',exact:true}).click();await expect(page.locator('#errors')).toContainText('version 1');
  await page.locator('#json-editor').fill(JSON.stringify(config()));await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('#status')).toHaveText('Configuration saved.');
});
test('Polish UI and keyboard tab navigation; capture settings appearance',async({page})=>{
  await openOptions(page,config(),'pl');await expect(page.getByRole('button',{name:'Zapisz',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Layouty',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'Przypisania',exact:true})).toBeFocused();
  await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'JSON',exact:true})).toBeFocused();
  await page.screenshot({path:'artifacts/settings-pl.png',fullPage:true});
});
