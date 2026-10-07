import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATALOG_PREFIX, repositoryFromURL, mergeRepositories, loadCatalog, rememberRepositories, clearCatalog, importHistory, registerRepositoryDiscovery } from '../../src/lib/repositories.js';

function apiFixture() {
  const stored = { config:{version:1}, unrelated:'keep' };
  return { stored, api:{ storage:{ local:{
    get:async () => structuredClone(stored),
    set:async value => Object.assign(stored,structuredClone(value)),
    remove:async keys => keys.forEach(key => delete stored[key]),
  } } } };
}

test('enterprise-account routes are excluded from visits, history and existing catalogs', async () => {
  for (const route of ['enterprises', 'ENTERPRISES']) {
    for (const path of ['', '/settings', '/people']) {
      assert.equal(repositoryFromURL(`https://github.com/${route}/demo-enterprise${path}?x=1#anchor`), null);
    }
  }
  const {stored, api} = apiFixture();
  stored[CATALOG_PREFIX+'enterprises/demo-enterprise'] = {owner:'enterprises',repo:'demo-enterprise'};
  assert.deepEqual(await loadCatalog(api), []);
  assert.equal(await rememberRepositories(api, [{owner:'ENTERPRISES',repo:'demo-enterprise'}]), 0);
  api.permissions = {request:async () => true};
  api.history = {search:async () => [{url:'https://github.com/enterprises/demo-enterprise/settings'}, {url:'https://github.com/Alice/project'}]};
  assert.deepEqual(await importHistory(api), {granted:true,count:1});
  assert.deepEqual(await loadCatalog(api), [{owner:'Alice',repo:'project'}]);
});

test('account stars routes never become repositories through discovery, history or an old catalog', async () => {
  const urls = ['stars', 'STARS'].flatMap(route => ['', '/lists/review-tools'].map(path =>
    `https://github.com/${route}/octocat${path}?tab=stars#list`));
  for (const url of urls) assert.equal(repositoryFromURL(url), null);
  const {stored, api} = apiFixture();
  stored[CATALOG_PREFIX+'stars/octocat'] = {owner:'stars',repo:'octocat'};
  assert.deepEqual(await loadCatalog(api), []);
  assert.equal(await rememberRepositories(api, [{owner:'STARS',repo:'octocat'}]), 0);
  let receive;
  api.runtime = {onMessage:{addListener:listener => { receive=listener; }}};
  registerRepositoryDiscovery(api);
  for (const url of urls) assert.equal(receive({type:'rememberRepository',url}, {frameId:0,url,tab:{incognito:false}}), undefined);
  api.permissions = {request:async () => true};
  api.history = {search:async () => [...urls.map(url => ({url})), {url:'https://github.com/Octocat/stars'}]};
  assert.deepEqual(await importHistory(api), {granted:true,count:1});
  assert.deepEqual(await loadCatalog(api), [{owner:'Octocat',repo:'stars'}]);
  assert.deepEqual(stored.config, {version:1});
});

test('repository discovery handles all repository pages and rejects other hosts and global routes', () => {
  for (const path of ['','/tree/main','/blob/main/README.md','/pull/102/files','/issues/2','/settings','/actions']) {
    assert.deepEqual(repositoryFromURL(`https://github.com/Alice/project${path}?x=1#anchor`),{owner:'Alice',repo:'project'});
  }
  assert.deepEqual(repositoryFromURL('https://github.com/github/docs'),{owner:'github',repo:'docs'});
  for (const url of ['https://github.com','https://github.com/Alice?tab=repositories','https://github.com/settings/profile','https://github.com/orgs/Alice/projects','https://github.com/topics/javascript','https://github.com/search?q=repo','https://example.com/Alice/project','http://github.com/Alice/project','https://github.com.evil.invalid/Alice/project','https://github.com/Alice/a%2Fb','https://' + ['user','secret'].join(':') + '@github.com/Alice/project']) {
    assert.equal(repositoryFromURL(url),null,url);
  }
});
test('repository catalog deduplicates case but distinguishes owners; concurrent writes preserve config', async () => {
  const {stored,api}=apiFixture();
  await Promise.all([
    rememberRepositories(api,[{owner:'Alice',repo:'Project'}]),
    rememberRepositories(api,[{owner:'Bob',repo:'project'}]),
  ]);
  await rememberRepositories(api,[{owner:'ALICE',repo:'PROJECT'}]);
  assert.equal((await loadCatalog(api)).length,2);
  assert.deepEqual(stored.config,{version:1}); assert.equal(stored.unrelated,'keep');
  assert.deepEqual(mergeRepositories([{owner:'Alice',repo:'project'},null,{owner:'ALICE',repo:'PROJECT'},{owner:'Bob',repo:'project'}]),[{owner:'Alice',repo:'project'},{owner:'Bob',repo:'project'}]);
  assert.deepEqual(Object.keys(stored).sort(),['config','repositoryCatalog:alice/project','repositoryCatalog:bob/project','unrelated']);
});
test('malformed catalog entries are ignored; clearing catalog preserves assignments and other keys',async () => {
  const {stored,api}=apiFixture();
  stored[CATALOG_PREFIX+'mismatch/key']={owner:'Alice',repo:'project'};
  stored[CATALOG_PREFIX+'invalid']=null;
  await rememberRepositories(api,[{owner:'Alice',repo:'project'}]);
  assert.deepEqual(await loadCatalog(api),[{owner:'Alice',repo:'project'}]);
  await clearCatalog(api); assert.deepEqual(stored,{config:{version:1},unrelated:'keep'});
});
test('history import explicitly requests permission and all-time results beyond the default 100', async () => {
  const {stored,api}=apiFixture(); const calls=[];
  api.permissions={request:async options => { calls.push(options); return true; }};
  api.history={search:async query => {
    assert.deepEqual(query,{text:'https://github.com/',startTime:0,maxResults:2147483647});
    return [...Array.from({length:301},(_,i)=>({url:`https://github.com/Alice/repo${i}/tree/main`,title:'Not stored',lastVisitTime:1})),
      {url:'https://github.com/ALICE/REPO0/pull/1'}, {url:'https://evil.invalid/Alice/repo',title:'https://github.com/'}, {url:'https://github.com/settings/profile'}];
  }};
  assert.deepEqual(await importHistory(api),{granted:true,count:301});
  assert.deepEqual(calls,[{permissions:['history']}]);
  assert.equal((await loadCatalog(api)).length,301);
  assert.deepEqual(stored.config,{version:1});
  assert.ok(Object.values(stored).filter(value=>value?.owner).every(value=>Object.keys(value).sort().join(',')==='owner,repo'));
});
test('denied or failed history imports leave configuration untouched',async () => {
  const {stored,api}=apiFixture();
  api.permissions={request:async () => false};
  api.history={search:async () => { throw new Error('must not read without permission'); }};
  assert.deepEqual(await importHistory(api),{granted:false,count:0});
  api.permissions.request=async () => true;
  await assert.rejects(importHistory(api));
  assert.deepEqual(stored,{config:{version:1},unrelated:'keep'});
});
test('background records only messages from the nonprivate top-level GitHub content script',async () => {
  const {stored,api}=apiFixture();let receive;
  api.runtime={onMessage:{addListener:listener=>{receive=listener;}}};
  registerRepositoryDiscovery(api);
  const sender={frameId:0,url:'https://github.com/Alice/project',tab:{incognito:false}};
  const message={type:'rememberRepository',url:'https://github.com/Bob/project/pull/1'};
  for (const invalid of [{...sender,frameId:1},{...sender,tab:{incognito:true}},{...sender,tab:undefined},{...sender,url:'https://evil.invalid/Alice/project'}]) {
    assert.equal(receive(message,invalid),undefined);
  }
  assert.equal(receive({type:'other'},sender),undefined);
  assert.equal(receive({...message,url:'https://example.com/Bob/project'},sender),undefined);
  assert.equal(await receive(message,sender),true);
  assert.deepEqual(await loadCatalog(api),[{owner:'Bob',repo:'project'}]);
  assert.deepEqual(stored.config,{version:1});
});
test('Firefox MV3 manifest omits persistent and keeps history optional', () => {
  const manifest=JSON.parse(readFileSync('src/manifest.json','utf8'));
  assert.equal(manifest.manifest_version,3);
  assert.deepEqual(manifest.background,{scripts:['background.js']});
  assert.deepEqual(manifest.permissions,['storage']);
  assert.deepEqual(manifest.optional_permissions,['history']);
  assert.deepEqual(manifest.host_permissions,['https://github.com/*']);
});
