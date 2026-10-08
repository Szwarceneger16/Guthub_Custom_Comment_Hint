import { test, expect } from '@playwright/test';
import { openConversation, form, config } from './helpers.js';
import { readFileSync } from 'node:fs';

const toolbar=page=>page.locator('[data-comment-hint]');
for (const mode of ['replace','append']) test(`Undo restores text and selection after ${mode} with normalized line endings`,async({page})=>{
  const values=['Zażółć\r\n🧪\r\n','Zażółć\r🧪\r','Zażółć\r\n🧪\rEnd\n'];
  const initial=config();initial.layouts.ci=values.map((value,index)=>({label:`Insert ${index}`,value,mode}));initial.repositories.Alice.repo=['ci'];
  await openConversation(page,{initial});await expect(toolbar(page)).toHaveCount(1);
  const editor=page.locator('#new_comment_field');const undo=page.getByRole('button',{name:'Undo',exact:true});
  for (let index=0;index<values.length;index++) {
    for (const before of ['', 'Draft 🧪\nSecond line']) {
      await editor.fill(before);await editor.evaluate(node=>node.setSelectionRange(1,4,'backward'));
      const selection=await editor.evaluate(node=>[node.selectionStart,node.selectionEnd,node.selectionDirection]);
      await page.getByRole('button',{name:`Insert ${index}`,exact:true}).click();
      const expected=(mode==='append'&&before?before+'\n':'')+values[index].replace(/\r\n?/g,'\n');
      await expect(editor).toHaveValue(expected);await expect(editor).toBeFocused();
      expect(await editor.evaluate(node=>[node.selectionStart,node.selectionEnd])).toEqual([expected.length,expected.length]);
      await undo.click();await expect(editor).toHaveValue(before);
      expect(await editor.evaluate(node=>[node.selectionStart,node.selectionEnd,node.selectionDirection])).toEqual(selection);
      await expect(undo).toBeDisabled();
    }
  }
  await page.getByRole('button',{name:'Insert 0',exact:true}).click();
  const first=await editor.inputValue();
  await page.getByRole('button',{name:'Insert 1',exact:true}).click();await undo.click();await expect(editor).toHaveValue(first);
  expect(await page.evaluate(()=>window.__mock.storage.config)).toEqual(initial);
  expect(await page.evaluate(()=>window.submissions)).toBe(0);
});

test('a silent page mutation after normalized insertion cannot be undone over the new text',async({page})=>{
  const initial=config();initial.layouts.ci[0].value='First\r\nSecond\r';
  await openConversation(page,{initial});await expect(toolbar(page)).toHaveCount(1);
  await page.getByRole('button',{name:'▶️ CI now',exact:true}).click();
  const editor=page.locator('#new_comment_field');await editor.evaluate(node=>{node.value='Later draft';node.setSelectionRange(1,4,'backward');});
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(editor).toHaveValue('Later draft');
  expect(await editor.evaluate(node=>[node.selectionStart,node.selectionEnd,node.selectionDirection])).toEqual([1,4,'backward']);
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
});

for(const kind of ['pull','issues'])test(`insertion and Undo refresh the Comment button's form validity on ${kind}`,async({page})=>{
  const initial=config();initial.layouts.ci=[
    {label:'Replace',value:'/review',mode:'replace'},
    {label:'Append',value:'/security',mode:'append'},
    {label:'Clear',value:'',mode:'replace'},
  ];initial.repositories.Alice.repo=['ci'];
  const body=readFileSync('tests/fixtures/new-comment-pull.html','utf8').replace('/DemoOrg/project/pull/42/comment?sticky=true',`/Alice/repo/${kind}/12/comment`);
  await openConversation(page,{initial,url:`https://github.com/Alice/repo/${kind}/12`,body});
  const submit=page.getByRole('button',{name:'Comment',exact:true});const editor=page.locator('#new_comment_field');
  await expect(toolbar(page)).toHaveCount(1);await expect(submit).toBeDisabled();
  await page.getByRole('button',{name:'Replace',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(editor).toHaveValue('/review');await expect(submit).toBeEnabled();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(editor).toHaveValue('');await expect(submit).toBeDisabled();
  await page.getByRole('button',{name:'Preview',exact:true}).click();
  await page.getByRole('button',{name:'Append',exact:true}).click();await expect(submit).toBeEnabled();
  await page.getByRole('button',{name:'Write',exact:true}).click();await expect(editor).toHaveValue('/security');
  await page.getByRole('button',{name:'Clear',exact:true}).click();await expect(editor).toHaveValue('');await expect(submit).toBeDisabled();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(editor).toHaveValue('/security');await expect(submit).toBeEnabled();
  expect(await page.evaluate(()=>window.submissions)).toBe(0);
});

test('insertion preserves other GitHub form constraints instead of enabling submission directly',async({page})=>{
  const body=readFileSync('tests/fixtures/new-comment-pull.html','utf8')
    .replace('/DemoOrg/project/pull/42/comment?sticky=true','/Alice/repo/pull/12/comment')
    .replace('<fieldset','<input required aria-label="Required field"><fieldset');
  await openConversation(page,{body});await expect(toolbar(page)).toHaveCount(1);
  const submit=page.getByRole('button',{name:'Comment',exact:true});
  await page.getByRole('button',{name:'▶️ CI now',exact:true}).click();
  await expect(page.locator('#new_comment_field')).toHaveValue('/ci-now');await expect(submit).toBeDisabled();
  await page.getByLabel('Required field',{exact:true}).fill('valid');await page.keyboard.press('Tab');
  await expect(submit).toBeEnabled();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(submit).toBeDisabled();
  expect(await page.evaluate(()=>window.submissions)).toBe(0);
});

test('synthetic insertion and undo cannot expose configured values or change text and selection',async({page})=>{
  await openConversation(page);await expect(toolbar(page)).toHaveCount(1);
  const editor=page.locator('#new_comment_field');await editor.fill('Private draft');
  await editor.evaluate(node=>node.setSelectionRange(1,4,'backward'));
  const before=await page.evaluate(()=>window.inputs);
  await toolbar(page).evaluate(host=>{
    for(const button of host.shadowRoot.querySelectorAll('.action')) {
      button.click();button.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));
    }
  });
  await expect(editor).toHaveValue('Private draft');
  expect(await editor.evaluate(node=>[node.selectionStart,node.selectionEnd,node.selectionDirection])).toEqual([1,4,'backward']);
  expect(await page.evaluate(()=>window.inputs)).toBe(before);
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'▶️ CI now',exact:true}).click();
  await toolbar(page).evaluate(host=>{
    const undo=host.shadowRoot.querySelector('.undo');undo.click();undo.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));
  });
  await expect(editor).toHaveValue('/ci-now');
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Undo',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(editor).toHaveValue('Private draft');
  expect(await editor.evaluate(node=>[node.selectionStart,node.selectionEnd,node.selectionDirection])).toEqual([1,4,'backward']);
});

test('GitHub-style main pull comment action mounts all configured buttons above tabs',async({page})=>{
  const initial={version:1,layouts:{ci:[{label:'▶️ CI now',value:'/ci-now',mode:'replace'}],codex:[{label:'🤖 Codex review',value:'@codex review',mode:'replace'},{label:'🤖 Codex security review',value:'@codex security review',mode:'append'}]},repositories:{DemoOrg:{project:['codex','ci'],another:['codex']}}};
  await openConversation(page,{initial,url:'https://github.com/DemoOrg/project/pull/42',body:readFileSync('tests/fixtures/new-comment-pull.html','utf8')});
  await expect(toolbar(page)).toHaveCount(1);
  await expect(toolbar(page).locator('.action')).toHaveText(['🤖 Codex review','🤖 Codex security review','▶️ CI now']);
  expect(await toolbar(page).evaluate(host=>host.nextElementSibling.tagName)).toBe('TAB-CONTAINER');
  await page.getByRole('button',{name:'🤖 Codex review',exact:true}).click();
  await page.getByRole('button',{name:'🤖 Codex security review',exact:true}).click();
  await expect(page.locator('#new_comment_field')).toHaveValue('@codex review\n@codex security review');
  await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(page.locator('.preview-pane')).toHaveText('@codex review\n@codex security review');
  await page.getByRole('button',{name:'Write',exact:true}).click();await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(page.locator('#new_comment_field')).toHaveValue('@codex review');
  expect(await page.evaluate(()=>window.submissions)).toBe(0);
  await page.screenshot({path:'artifacts/demo-pull-toolbar.png'});
});
test('numbered comment action rejects a stale conversation number, kind or host',async({page})=>{
  await openConversation(page,{body:form({id:'new_comment_form',action:'/Alice/repo/pull/12/comment?sticky=true'})});
  await expect(toolbar(page)).toHaveCount(1);
  await toolbar(page).evaluate(host=>host.shadowRoot.querySelector('.action').addEventListener('click',()=>{
    document.querySelector('form').action='/Alice/repo/pull/13/comment';
  },{capture:true,once:true}));
  await page.getByRole('button',{name:'▶️ CI now',exact:true}).click();
  await expect(page.locator('#new_comment_field')).toHaveValue('');
  await expect(toolbar(page)).toHaveCount(0);
  for(const action of ['/Alice/repo/pull/13/comment','/Alice/repo/issues/12/comment','https://evil.invalid/Alice/repo/pull/12/comment']) {
    await page.locator('form').evaluate((node,action)=>node.action=action,action);await expect(toolbar(page)).toHaveCount(0);
  }
  await page.evaluate(()=>{history.pushState({},'','/Alice/repo/issues/12');document.querySelector('form').action='/Alice/repo/issues/12/comment';});
  await expect(toolbar(page)).toHaveCount(1);
});
test('repository visits persist without assignments and across SPA navigation outside conversations',async({page})=>{
  const initial={version:1,layouts:{},repositories:{}};
  await openConversation(page,{initial,url:'https://github.com/Alice/one/tree/main',body:''});
  await expect.poll(()=>page.evaluate(()=>window.__mock.storage['repositoryCatalog:alice/one'])).toEqual({owner:'Alice',repo:'one'});
  await page.evaluate(()=>history.pushState({},'','/Bob/two/blob/main/readme.md'));
  await expect.poll(()=>page.evaluate(()=>window.__mock.storage['repositoryCatalog:bob/two'])).toEqual({owner:'Bob',repo:'two'});
  expect(await page.evaluate(()=>window.__mock.storage.config)).toEqual(initial);
  await expect(toolbar(page)).toHaveCount(0);
  const messages=await page.evaluate(()=>window.__mock.messages.length);
  for (const path of ['/settings/profile','/stars/octocat','/STARS/octocat/lists/review-tools','/enterprises/demo-enterprise','/solutions/industry','/RESOURCES/articles/security','/readme/featured','/EDUCATION/students','/git-guides/git-remote','/GIT-GUIDES/git-pull','/partners/technology-partners','/TRUST-CENTER/privacy','/why-github/overview','/mcp/DemoOrg/server','/MCP/DemoOrg/server']) {
    await page.evaluate(path=>{history.pushState({},'',path);dispatchEvent(new Event('popstate'));},path);
    // Wait for the periodic observer as well as the navigation event.
    await page.waitForTimeout(500);
    expect(await page.evaluate(()=>window.__mock.messages.length)).toBe(messages);
    expect(await page.evaluate(()=>Object.keys(window.__mock.storage).filter(key=>key.startsWith('repositoryCatalog:')).sort())).toEqual(['repositoryCatalog:alice/one','repositoryCatalog:bob/two']);
  }
});
for (const {name,path,event} of [
  {name:'a profile',path:'/Alice?tab=repositories',event:'popstate'},
  {name:'the registry',path:'/mcp/DemoOrg/server',event:'turbo:load'},
  {name:'the home page without a navigation event',path:'/',event:null},
]) test(`a cleared catalog returns after visiting ${name}`,async({page})=>{
  await openConversation(page);
  await expect.poll(()=>page.evaluate(()=>window.__mock.storage['repositoryCatalog:alice/repo'])).toEqual({owner:'Alice',repo:'repo'});
  await page.locator('#new_comment_field').fill('Keep draft');
  await page.evaluate(async()=>{await browser.storage.local.remove('repositoryCatalog:alice/repo');dispatchEvent(new Event('turbo:render'));});
  await page.waitForTimeout(500);
  expect(await page.evaluate(()=>window.__mock.messages.length)).toBe(1);
  expect(await page.evaluate(()=>window.__mock.storage['repositoryCatalog:alice/repo'])).toBeUndefined();
  await page.evaluate(({path,event})=>{history.pushState({},'',path);if(event)dispatchEvent(new Event(event));},{path,event});
  await expect(toolbar(page)).toHaveCount(0);
  expect(await page.evaluate(()=>window.__mock.messages.length)).toBe(1);
  await page.evaluate(()=>{history.pushState({},'','/aLiCe/REPO/pull/12?x=1#comment');dispatchEvent(new Event('popstate'));});
  await expect.poll(()=>page.evaluate(()=>window.__mock.storage['repositoryCatalog:alice/repo'])).toEqual({owner:'aLiCe',repo:'REPO'});
  await expect(toolbar(page)).toHaveCount(1);await expect(page.locator('#new_comment_field')).toHaveValue('Keep draft');
  await page.evaluate(()=>{history.pushState({},'','/Alice/repo/tree/main');dispatchEvent(new Event('turbo:render'));});
  await expect(toolbar(page)).toHaveCount(0);await page.waitForTimeout(500);
  expect(await page.evaluate(()=>window.__mock.messages.length)).toBe(2);
  expect(await page.evaluate(()=>window.__mock.storage.config)).toEqual(config());
});
for (const destination of ['another repository','the same repository after leaving']) {
  test(`a stale repository write failure cannot invalidate ${destination}`,async({page})=>{
    await openConversation(page,{beforeContent:async page=>page.evaluate(()=>{
      const send=browser.runtime.sendMessage;let first=true;
      browser.runtime.sendMessage=message=>{
        if(!first)return send(message);first=false;window.__mock.messages.push(message);
        return new Promise((resolve,reject)=>{window.__mock.rejectFirstVisit=()=>reject(new Error('Old write failed'));});
      };
    })});
    await expect.poll(()=>page.evaluate(()=>window.__mock.messages.length)).toBe(1);
    if(destination.startsWith('the same')) {
      await page.evaluate(()=>{history.pushState({},'','/Alice');dispatchEvent(new Event('popstate'));});
      await expect(toolbar(page)).toHaveCount(0);
    }
    const path=destination.startsWith('the same')?'/Alice/repo/pull/12':'/Bob/repo/issues/9';
    const key=destination.startsWith('the same')?'repositoryCatalog:alice/repo':'repositoryCatalog:bob/repo';
    await page.evaluate(path=>{history.pushState({},'',path);dispatchEvent(new Event('popstate'));},path);
    await expect.poll(()=>page.evaluate(key=>Boolean(window.__mock.storage[key]),key)).toBe(true);
    await page.evaluate(()=>window.__mock.rejectFirstVisit());
    await page.evaluate(()=>dispatchEvent(new Event('turbo:render')));await page.waitForTimeout(500);
    expect(await page.evaluate(()=>window.__mock.messages.length)).toBe(2);
    expect(await page.evaluate(()=>window.__mock.storage.config)).toEqual(config());
  });
}
test('a persisted page return remembers a later visit after the catalog was cleared',async({page})=>{
  await openConversation(page);
  await expect.poll(()=>page.evaluate(()=>window.__mock.messages.length)).toBe(1);
  await page.locator('#new_comment_field').fill('Keep draft');
  await page.evaluate(()=>browser.storage.local.remove('repositoryCatalog:alice/repo'));
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  await page.waitForTimeout(500);
  expect(await page.evaluate(()=>window.__mock.messages.length)).toBe(1);
  expect(await page.evaluate(()=>window.__mock.storage['repositoryCatalog:alice/repo'])).toBeUndefined();
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await expect.poll(()=>page.evaluate(()=>window.__mock.storage['repositoryCatalog:alice/repo'])).toEqual({owner:'Alice',repo:'repo'});
  await expect(toolbar(page)).toHaveCount(1);await expect(page.locator('#new_comment_field')).toHaveValue('Keep draft');
  expect(await page.evaluate(()=>window.__mock.messages.length)).toBe(2);
});
test('private visits stay unrecorded through nonrepository navigation and return',async({page})=>{
  await openConversation(page,{beforeContent:async page=>page.evaluate(()=>{browser.extension.inIncognitoContext=true;})});
  await expect(toolbar(page)).toHaveCount(1);
  await page.evaluate(()=>{history.pushState({},'','/Alice');dispatchEvent(new Event('popstate'));});await expect(toolbar(page)).toHaveCount(0);
  await page.evaluate(()=>{history.pushState({},'','/Alice/repo/pull/12');dispatchEvent(new Event('popstate'));});await expect(toolbar(page)).toHaveCount(1);
  await page.waitForTimeout(500);
  expect(await page.evaluate(()=>window.__mock.messages)).toEqual([]);
  expect(await page.evaluate(()=>Object.keys(window.__mock.storage))).toEqual(['config']);
});
test('mount above Write/Preview, insert exactly, update editor state, and never submit',async({page})=>{
  await openConversation(page);
  await expect(toolbar(page)).toHaveCount(1);
  expect(await toolbar(page).evaluate(host=>host.nextElementSibling.classList.contains('js-previewable-comment-form'))).toBe(true);
  await page.getByRole('button',{name:'▶️ CI now',exact:true}).click();
  await expect(page.locator('#new_comment_field')).toHaveValue('/ci-now');
  expect(await page.evaluate(()=>({inputs:window.inputs,submissions:window.submissions,state:window.editorState}))).toEqual({inputs:1,submissions:0,state:'/ci-now'});
  await expect(page.locator('#new_comment_field')).toBeFocused();
  expect(await page.locator('#new_comment_field').evaluate(node=>node.selectionStart)).toBe(7);
});
test('append, one-step undo, selection restoration, and manual edit invalidation',async({page})=>{
  await openConversation(page);
  const editor=page.locator('#new_comment_field');await editor.fill('Before 🧪');
  await editor.evaluate(node=>node.setSelectionRange(1,4,'backward'));
  await page.getByRole('button',{name:'🤖 Zażółć\nReview',exact:true}).click();
  await expect(editor).toHaveValue('Before 🧪\n@codex review\n🧪');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(editor).toHaveValue('Before 🧪');
  expect(await editor.evaluate(node=>[node.selectionStart,node.selectionEnd,node.selectionDirection])).toEqual([1,4,'backward']);
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'▶️ CI now',exact:true}).click();await editor.fill('Manual');
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
});
test('multiple insertions undo only the last; submission invalidates undo',async({page})=>{
  await openConversation(page);await page.getByRole('button',{name:'▶️ CI now',exact:true}).click();
  await page.getByRole('button',{name:'🤖 Zażółć\nReview',exact:true}).click();await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(page.locator('#new_comment_field')).toHaveValue('/ci-now');
  await page.getByRole('button',{name:'▶️ CI now',exact:true}).click();await page.getByRole('button',{name:'Comment',exact:true}).click();
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();expect(await page.evaluate(()=>window.submissions)).toBe(1);
});
test('Write/Preview fixture preserves inserted text and the same toolbar',async({page})=>{
  await openConversation(page);await page.getByRole('button',{name:'▶️ CI now',exact:true}).click();
  await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(page.locator('.preview-pane')).toHaveText('/ci-now');
  await page.getByRole('button',{name:'Write',exact:true}).click();await expect(page.locator('#new_comment_field')).toHaveValue('/ci-now');await expect(toolbar(page)).toHaveCount(1);
});
test('settings refresh preserves text and does not duplicate input listeners',async({page})=>{
  await openConversation(page);await page.locator('#new_comment_field').fill('Keep me');
  const next=config();next.layouts.ci[0].label='Updated';await page.evaluate(next=>window.__mock.external(next),next);
  await expect(page.getByRole('button',{name:'Updated',exact:true})).toBeVisible();await expect(toolbar(page)).toHaveCount(1);
  await expect(page.locator('#new_comment_field')).toHaveValue('Keep me');
  await page.evaluate(()=>window.inputs=0);await page.getByRole('button',{name:'Updated',exact:true}).click();expect(await page.evaluate(()=>window.inputs)).toBe(1);
  await page.evaluate(()=>window.__mock.external({version:999}));await expect(toolbar(page)).toHaveCount(0);await expect(page.locator('#new_comment_field')).toHaveValue('/ci-now');
});
test('empty assignments unmount without changing text; unknown and read-only editors stay untouched',async({page})=>{
  await openConversation(page);await page.locator('#new_comment_field').fill('Keep me');
  const next=config();next.repositories.Alice.repo=[];await page.evaluate(next=>window.__mock.external(next),next);await expect(toolbar(page)).toHaveCount(0);await expect(page.locator('#new_comment_field')).toHaveValue('Keep me');
  await page.evaluate(next=>window.__mock.external(next),config());await expect(toolbar(page)).toHaveCount(1);
  await page.locator('#new_comment_field').evaluate(node=>node.readOnly=true);await expect(toolbar(page)).toHaveCount(0);
  await page.locator('#new_comment_field').evaluate(node=>{node.readOnly=false;node.closest('form').id='unknown';node.id='unknown_editor';node.closest('form').className='';});await expect(toolbar(page)).toHaveCount(0);
});
test('route changes invalidate actions immediately, before periodic reconciliation',async({page})=>{
  await openConversation(page);await expect(toolbar(page)).toHaveCount(1);
  await toolbar(page).evaluate(host=>host.shadowRoot.querySelector('.action').addEventListener('click',()=>{
    history.pushState({},'','/Bob/repo/issues/3');
  },{capture:true,once:true}));
  await page.getByRole('button',{name:'▶️ CI now',exact:true}).click();
  await expect(page.locator('#new_comment_field')).toHaveValue('');expect(await page.evaluate(()=>window.submissions)).toBe(0);
});
test('SPA repository navigation and form replacement drop old undo and mount once',async({page})=>{
  await openConversation(page);await page.getByRole('button',{name:'▶️ CI now',exact:true}).click();
  await page.evaluate(html=>{history.pushState({},'','/Bob/repo/issues/3');document.querySelector('form').outerHTML=html;},form({action:'/Bob/repo/issue_comments'}));
  await expect(toolbar(page)).toHaveCount(1);await expect(toolbar(page).locator('.action')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
  await page.evaluate(html=>document.querySelector('form').outerHTML=html,form({action:'/Bob/repo/issue_comments'}));
  await expect(toolbar(page)).toHaveCount(1);await page.getByRole('button',{name:'🤖 Zażółć\nReview',exact:true}).click();
  await expect(page.locator('#new_comment_field')).toHaveValue('@codex review\n🧪');
  await page.evaluate(()=>history.pushState({},'','/Bob/repo/pull/3/files'));await expect(toolbar(page)).toHaveCount(0);
});
test('issue pages match owner/repo ignoring case, query and fragment',async({page})=>{
  await openConversation(page,{url:'https://github.com/aLiCe/REPO/issues/9?x=1#comment'});await expect(toolbar(page)).toHaveCount(1);await expect(toolbar(page).locator('.action')).toHaveCount(2);
});
test('navigation from an unrelated GitHub page activates existing content script',async({page})=>{
  await openConversation(page,{url:'https://github.com/Alice/repo'});await expect(toolbar(page)).toHaveCount(0);
  await page.evaluate(()=>history.pushState({},'','/Alice/repo/issues/8'));await expect(toolbar(page)).toHaveCount(1);
});
test('a stale form from another repository is never used during navigation',async({page})=>{
  await openConversation(page);await expect(toolbar(page)).toHaveCount(1);
  await page.evaluate(()=>history.pushState({},'','/Bob/repo/issues/3'));await expect(toolbar(page)).toHaveCount(0);
  await page.evaluate(()=>document.querySelector('form').action='/Bob/repo/issue_comments');
  await page.evaluate(()=>document.querySelector('form').append(document.createElement('span')));
  await expect(toolbar(page)).toHaveCount(1);
});
test('exclude existing-comment and code-review editors; ambiguous or unknown forms fail closed',async({page})=>{
  const edit=form({id:'edit_comment',editorID:'edit_field',className:'js-comment-edit-form',action:'/Alice/repo/comments/1'});
  const review=`<div class="review-thread">${form({id:'review_form',editorID:'review_field'})}</div>`;
  await openConversation(page,{body:edit+review+form()});await expect(toolbar(page)).toHaveCount(1);
  expect(await toolbar(page).evaluate(node=>node.closest('form').id)).toBe('new_comment');
  await page.evaluate(html=>document.body.insertAdjacentHTML('beforeend',html),form({id:'another_new_comment',editorID:'another_field'}));await expect(toolbar(page)).toHaveCount(0);
  await page.evaluate(()=>document.querySelector('#another_new_comment').remove());await expect(toolbar(page)).toHaveCount(1);
  await page.evaluate(()=>document.querySelector('#new_comment').remove());await expect(toolbar(page)).toHaveCount(0);
});
for(const count of [1,3,4,8])test(`grid geometry and safe labels with ${count} buttons`,async({page})=>{
  const initial=config();initial.layouts.ci=Array.from({length:count},(_,i)=>({label:i===0?'<img src=x onerror=alert(1)> 🧪 '+('Zażółć'.repeat(30)):`Button ${i}`,value:'',mode:'append'}));initial.repositories.Alice.repo=['ci'];
  await page.setViewportSize({width:320,height:800});await openConversation(page,{initial});await expect(toolbar(page).locator('.action')).toHaveCount(count);
  const metrics=await toolbar(page).evaluate(host=>{
    const root=host.shadowRoot;const grid=root.querySelector('.grid');const buttons=[...root.querySelectorAll('.action')];
    return {columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,gap:getComputedStyle(grid).gap,heights:buttons.map(b=>b.getBoundingClientRect().height),labelHeight:root.querySelector('.label').getBoundingClientRect().height,lineHeight:getComputedStyle(root.querySelector('.label')).lineHeight,clamp:getComputedStyle(root.querySelector('.label')).webkitLineClamp,title:buttons[0].title,name:buttons[0].getAttribute('aria-label'),images:root.querySelectorAll('img').length,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  expect(metrics.columns).toBe(3);expect(metrics.gap).toBe('8px');expect(metrics.heights).toEqual(Array(count).fill(56));expect(metrics.labelHeight).toBeLessThanOrEqual(40);expect(metrics.lineHeight).toBe('20px');expect(metrics.clamp).toBe('2');expect(metrics.images).toBe(0);expect(metrics.title).toBe(metrics.name);expect(metrics.overflow).toBe(false);
});
test('light/dark theme and keyboard activation have a visible focus ring',async({page})=>{
  await openConversation(page,{locale:'pl'});await expect(toolbar(page)).toHaveAttribute('data-theme','light');
  await page.evaluate(()=>document.documentElement.dataset.colorMode='dark');await expect(toolbar(page)).toHaveAttribute('data-theme','dark');
  await page.getByRole('button',{name:'Write',exact:true}).focus();
  await page.keyboard.press('Shift+Tab');await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button',{name:'▶️ CI now',exact:true})).toBeFocused();
  const outline=await page.getByRole('button',{name:'▶️ CI now',exact:true}).evaluate(node=>getComputedStyle(node).outlineWidth);expect(outline).toBe('2px');
  await page.keyboard.press('Enter');await expect(page.locator('#new_comment_field')).toHaveValue('/ci-now');await expect(page.getByRole('button',{name:'Cofnij',exact:true})).toBeEnabled();
  await page.screenshot({path:'artifacts/toolbar-dark.png'});
});
