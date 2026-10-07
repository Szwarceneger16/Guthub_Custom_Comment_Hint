import { readFileSync } from 'node:fs';
import path from 'node:path';

export const config = () => ({version:1,layouts:{ci:[{label:'▶️ CI now',value:'/ci-now',mode:'replace'}],review:[{label:'🤖 Zażółć\nReview',value:'@codex review\n🧪',mode:'append'}]},repositories:{Alice:{repo:['ci','review']},Bob:{repo:['review']}}});

export function form({ id='new_comment', editorID='new_comment_field', action='/Alice/repo/issue_comments', className='js-new-comment-form' }={}) {
  return `<form id="${id}" class="${className}" action="${action}" method="post"><div class="js-previewable-comment-form"><div role="tablist"><button type="button" class="write">Write</button><button type="button" class="preview-tab">Preview</button></div><textarea id="${editorID}" name="comment[body]" aria-label="Comment"></textarea><div class="preview-pane" hidden></div></div><button type="submit">Comment</button></form>`;
}

export async function mockAPI(page, initial=config(), locale='en') {
  const messages=JSON.parse(readFileSync(`src/_locales/${locale}/messages.json`,'utf8'));
  await page.addInitScript(({initial,messages,locale})=>{
    const listeners=new Set();
    const storage={}; if(initial!==undefined) storage.config=initial;
    const installed=[];const clicked=[];const messageListeners=[];
    const mock={storage,writes:0,failWrites:false,failReads:false,optionsOpened:0,permissionGranted:true,permissionRequests:[],historyItems:[],historyQueries:[],failHistory:false,messages:[],
      external(value){const oldValue=structuredClone(storage.config);storage.config=structuredClone(value);for(const listener of listeners)listener({config:{oldValue,newValue:value}},'local');},
      installed(){for(const listener of installed)listener({reason:'install'});},
      clicked(){for(const listener of clicked)listener();}};
    window.__mock=mock;
    window.browser={
      i18n:{getUILanguage:()=>locale,getMessage:(key,values=[])=>{const items=Array.isArray(values)?values:[values];return (messages[key]?.message||'').replace(/\$(\d+)/g,(_,index)=>items[Number(index)-1]??'');}},
      storage:{local:{get:async(keys)=>{if(mock.failReads)throw new Error('read');if(keys===null||keys===undefined)return structuredClone(storage);return structuredClone(Object.fromEntries((Array.isArray(keys)?keys:[keys]).filter(key=>Object.hasOwn(storage,key)).map(key=>[key,storage[key]])));},set:async(value)=>{if(mock.failWrites)throw new Error('quota');mock.writes++;for(const [key,newValue]of Object.entries(value)){const oldValue=structuredClone(storage[key]);storage[key]=structuredClone(newValue);for(const listener of listeners)listener({[key]:{oldValue,newValue}},'local');}},remove:async(keys)=>{if(mock.failWrites)throw new Error('quota');for(const key of Array.isArray(keys)?keys:[keys]){const oldValue=storage[key];delete storage[key];for(const listener of listeners)listener({[key]:{oldValue}},'local');}}},onChanged:{addListener:listener=>listeners.add(listener),removeListener:listener=>listeners.delete(listener)}},
      runtime:{onInstalled:{addListener:listener=>installed.push(listener)},onMessage:{addListener:listener=>messageListeners.push(listener)},sendMessage:async(message)=>{mock.messages.push(message);for(const listener of messageListeners){const reply=listener(message,{tab:{incognito:false},frameId:0,url:location.href});if(reply!==undefined)return reply;}},openOptionsPage:async()=>{mock.optionsOpened++;}},
      permissions:{request:async(value)=>{mock.permissionRequests.push(value);return mock.permissionGranted;}},
      history:{search:async(query)=>{mock.historyQueries.push(query);if(mock.failHistory)throw new Error('history');return structuredClone(mock.historyItems.filter(item=>item.url.includes(query.text)||(item.title||'').includes(query.text)).filter(item=>(item.lastVisitTime??Date.now())>=query.startTime).slice(0,query.maxResults));}},
      extension:{inIncognitoContext:false},
      action:{onClicked:{addListener:listener=>clicked.push(listener)}}
    };
  },{initial,messages,locale});
}

export async function openConversation(page, { initial=config(), url='https://github.com/Alice/repo/pull/12', body=form(), locale='en' }={}) {
  await mockAPI(page,initial,locale);
  await page.route('**/*', route=>route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html data-color-mode="light"><head><meta charset="utf-8"></head><body>${body}<script>
    window.submissions=0;window.inputs=0;
    document.addEventListener('submit',event=>{event.preventDefault();window.submissions++;});
    document.addEventListener('input',event=>{if(event.target.matches('textarea')){window.inputs++;window.editorState=event.target.value;}});
    document.addEventListener('click',event=>{const form=event.target.closest('form');if(!form)return;const textarea=form.querySelector('textarea');const preview=form.querySelector('.preview-pane');if(event.target.matches('.preview-tab')){preview.textContent=window.editorState||textarea.value;preview.hidden=false;textarea.hidden=true;}if(event.target.matches('.write')){textarea.hidden=false;preview.hidden=true;}});
    </script></body></html>`}));
  await page.goto(url);
  await page.addScriptTag({path:'dist/extension/background.js'});
  await page.addScriptTag({path:'dist/extension/content.js'});
}

export async function openOptions(page, initial=config(), locale='en') {
  await mockAPI(page,initial,locale);
  await page.route('**/*',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    const filename=path.basename(pathname);
    if(!['index.html','options.js','options.css'].includes(filename)) return route.abort();
    await route.fulfill({status:200,contentType:filename.endsWith('.js')?'application/javascript':filename.endsWith('.css')?'text/css':'text/html',body:readFileSync(`dist/extension/options/${filename}`)});
  });
  await page.goto('https://fixtures.invalid/options/index.html');
  await page.locator('#save:not([disabled])').waitFor();
}
