import { Draft } from './draft.js';
import { clone, validateConfig, decodeConfig, renameLayout, deleteLayout, layoutAssignments, resolveButtons, ConfigError } from '../lib/config.js';
import { initializeConfig, saveConfig, loadConfig } from '../lib/storage.js';
import { createGrid } from '../ui/grid.js';
import { CATALOG_PREFIX, loadCatalog, mergeRepositories, repositoriesFromConfig, repositoryKey, importHistory, clearCatalog } from '../lib/repositories.js';

const api = browser;
const t = (key, values) => api.i18n.getMessage(key, values) || key;
const $ = (id) => document.getElementById(id);
const own = (object, key) => Object.hasOwn(object, key);
const setKey = (object, key, value) => Object.defineProperty(object, key, { value, writable:true, configurable:true, enumerable:true });
let model;
let selectedLayout;
let saving = false;
let operation = 0;
let disposed = false;
let storageRevision = 0;
let catalog = [];
let catalogRevision = 0;
let discoveryBusy = false;
let discoveryStatus = '';

function updateRepositorySuggestions() {
  const suggestions = $('known-repositories');
  if (!suggestions) return;
  const repositories = mergeRepositories(repositoriesFromConfig(model.draft), catalog);
  suggestions.replaceChildren(...repositories.map(({owner,repo}) => {
    const option = element('option'); option.value = `${owner}/${repo}`; return option;
  }));
  $('repository-count').textContent = t('repositoryCount', String(repositories.length));
  $('repository-status').textContent = discoveryStatus;
  $('import-history').disabled = discoveryBusy || Boolean(api.extension?.inIncognitoContext);
  $('clear-repositories').disabled = discoveryBusy;
}

async function refreshCatalog() {
  const revision = ++catalogRevision;
  try {
    const next = await loadCatalog(api);
    if (disposed || revision !== catalogRevision) return;
    catalog = next; updateRepositorySuggestions();
  } catch {
    if (disposed || revision !== catalogRevision) return;
    discoveryStatus = t('catalogLoadFailed'); updateRepositorySuggestions();
  }
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(key, action, disabled = false) {
  const node = element('button', t(key));
  node.type = 'button'; node.disabled = disabled;
  node.addEventListener('click', action);
  return node;
}
function field(key, value = '', multiline = false) {
  const label = element('label', t(key));
  const input = element(multiline ? 'textarea' : 'input');
  input.value = value;
  label.append(input);
  return { label, input };
}
function showError(error) {
  const list = $('errors'); list.replaceChildren(); list.hidden = false;
  if (error instanceof ConfigError) {
    for (const issue of error.errors) list.append(element('li', `${issue.path}: ${t(`error_${issue.code}`)}`));
  } else if (error instanceof SyntaxError) list.append(element('li', `${t('error_json')}: ${error.message}`));
  else list.append(element('li', t('operationFailed')));
}
function clearError() { $('errors').hidden = true; $('errors').replaceChildren(); }
function status(message = '') { $('status').textContent = message; }
function refreshStatus() {
  $('dirty').textContent = model.dirty ? t('unsaved') : t('savedState');
  $('save').disabled = saving;
}
function changed() { operation++; model.changed(); clearError(); status(); refreshStatus(); }
function guarded(action) {
  try { action(); clearError(); } catch (error) { showError(error); }
}
function preview(container, buttons) {
  container.replaceChildren(element('h3', t('preview')));
  if (!buttons.length) container.append(element('p', t('noButtons')));
  else container.append(createGrid(document, buttons).host);
}
function move(items, index, offset) {
  const destination = index + offset;
  [items[index], items[destination]] = [items[destination], items[index]];
}

function renderLayouts(panel) {
  const ids = Object.keys(model.draft.layouts);
  if (!ids.includes(selectedLayout)) selectedLayout = ids[0];
  const select = element('select');
  select.setAttribute('aria-label', t('layout'));
  for (const id of ids) { const option = element('option', id); option.value = id; select.append(option); }
  select.value = selectedLayout || '';
  select.addEventListener('change', () => { selectedLayout = select.value; render(); });
  const name = field('layoutName');
  const row = element('div', undefined, 'row');
  row.append(select, name.label, button('addLayout', () => guarded(() => {
    const id = name.input.value;
    if (!id.trim() || own(model.draft.layouts, id)) throw new ConfigError([{path:'$.layouts',code:'name'}]);
    setKey(model.draft.layouts, id, []); selectedLayout = id; changed(); render();
  })));
  panel.append(row);
  if (selectedLayout === undefined) { panel.append(element('p', t('noLayouts'))); return; }
  const id = selectedLayout;
  const rename = field('layoutName', id);
  const manage = element('div', undefined, 'row');
  manage.append(rename.label, button('rename', () => guarded(() => {
    model.draft = renameLayout(model.draft, id, rename.input.value); selectedLayout = rename.input.value; changed(); render();
  })), button('deleteLayout', () => guarded(() => {
    const assigned = layoutAssignments(model.draft, id);
    if (assigned.length && !window.confirm(t('confirmDelete', [id, assigned.join(', ')]))) return;
    model.draft = deleteLayout(model.draft, id); changed(); render();
  })));
  panel.append(manage);
  const buttons = model.draft.layouts[id];
  const previewNode = element('div', undefined, 'preview');
  buttons.forEach((definition, index) => {
    const card = element('div', undefined, 'button-card');
    card.append(element('h3', t('buttonNumber', String(index + 1))));
    const label = field('buttonLabel', definition.label, true);
    const value = field('buttonValue', definition.value, true);
    const fields = element('div', undefined, 'editor-fields'); fields.append(label.label, value.label);
    for (const [input, key] of [[label.input, 'label'], [value.input, 'value']]) {
      input.addEventListener('input', () => { definition[key] = input.value; changed(); preview(previewNode, buttons); });
    }
    const modeLabel = element('label', t('mode'));
    const mode = element('select');
    for (const key of ['append', 'replace']) { const option = element('option', t(key)); option.value = key; mode.append(option); }
    mode.value = definition.mode;
    mode.addEventListener('change', () => { definition.mode = mode.value; changed(); });
    modeLabel.append(mode);
    const actions = element('div', undefined, 'row');
    actions.append(modeLabel,
      button('up', () => { move(buttons,index,-1); changed(); render(); }, index === 0),
      button('down', () => { move(buttons,index,1); changed(); render(); }, index === buttons.length - 1),
      button('removeButton', () => { buttons.splice(index,1); changed(); render(); }));
    card.append(fields, actions); panel.append(card);
  });
  panel.append(button('addButton', () => { buttons.push({ label:t('newButton'), value:'', mode:'append' }); changed(); render(); }));
  preview(previewNode, buttons); panel.append(previewNode);
}

function renderAssignments(panel) {
  const owner = field('owner'); const repo = field('repository');
  const discovery = element('div', undefined, 'repository-discovery');
  discovery.append(element('h2',t('repositorySuggestions')), element('p',t('repositorySources')), element('p',t('historyAccess')));
  const known = field('knownRepository'); known.input.id = 'known-repository'; known.input.setAttribute('list','known-repositories'); known.label.className = 'grow';
  const suggestions = element('datalist'); suggestions.id = 'known-repositories';
  const choose = element('div',undefined,'row');
  choose.append(known.label, suggestions, button('useRepository', () => {
    const selected = mergeRepositories(repositoriesFromConfig(model.draft), catalog).find(value => repositoryKey(value) === known.input.value.trim().toLowerCase());
    if (!selected) { discoveryStatus = t('chooseKnownRepository'); updateRepositorySuggestions(); return; }
    owner.input.value = selected.owner; repo.input.value = selected.repo;
    repo.input.focus();
  }));
  const importButton = button('importHistory', async () => {
    if (discoveryBusy) return;
    discoveryBusy = true; discoveryStatus = t('historyImporting'); updateRepositorySuggestions();
    try {
      const result = await importHistory(api);
      if (disposed) return;
      discoveryStatus = t(result.granted ? 'historyImported' : 'historyDenied', String(result.count));
      await refreshCatalog();
    } catch { discoveryStatus = t('historyFailed'); }
    finally { discoveryBusy = false; if (!disposed) updateRepositorySuggestions(); }
  });
  importButton.id = 'import-history';
  const clearButton = button('clearRepositories', async () => {
    if (discoveryBusy) return;
    discoveryBusy = true; updateRepositorySuggestions();
    try { await clearCatalog(api); discoveryStatus = t('catalogCleared'); await refreshCatalog(); }
    catch { discoveryStatus = t('catalogClearFailed'); }
    finally { discoveryBusy = false; if (!disposed) updateRepositorySuggestions(); }
  });
  clearButton.id = 'clear-repositories';
  const discoveryActions = element('div',undefined,'row'); discoveryActions.append(importButton,clearButton);
  const count = element('p'); count.id = 'repository-count';
  const message = element('p'); message.id = 'repository-status'; message.setAttribute('role','status');
  discovery.append(choose,count,discoveryActions,message); panel.append(discovery);
  const row = element('div', undefined, 'row');
  row.append(owner.label, repo.label, button('addRepository', () => guarded(() => {
    const next = clone(model.draft);
    const ownerKey = Object.keys(next.repositories).find((name) => name.toLowerCase() === owner.input.value.toLowerCase()) ?? owner.input.value;
    if (!own(next.repositories, ownerKey)) setKey(next.repositories, ownerKey, {});
    if (Object.keys(next.repositories[ownerKey]).some((name) => name.toLowerCase() === repo.input.value.toLowerCase())) throw new ConfigError([{path:'$.repositories',code:'collision'}]);
    setKey(next.repositories[ownerKey], repo.input.value, []);
    const errors = validateConfig(next); if (errors.length) throw new ConfigError(errors);
    model.draft = next; changed(); render();
  })));
  panel.append(row);
  for (const [ownerKey, repos] of Object.entries(model.draft.repositories)) {
    for (const [repoKey, ids] of Object.entries(repos)) {
      const card = element('div', undefined, 'assignment-card'); card.append(element('h2', `${ownerKey}/${repoKey}`));
      const previewNode = element('div', undefined, 'preview');
      const list = element('ol');
      ids.forEach((id,index) => {
        const item = element('li');
        const actions = element('div', undefined, 'row'); actions.append(element('span', id),
          button('up', () => { move(ids,index,-1); changed(); render(); }, index === 0),
          button('down', () => { move(ids,index,1); changed(); render(); }, index === ids.length - 1),
          button('unassign', () => { ids.splice(index,1); changed(); render(); }));
        item.append(actions); list.append(item);
      });
      const select = element('select'); select.setAttribute('aria-label',t('layout'));
      const available = Object.keys(model.draft.layouts).filter((id) => !ids.includes(id));
      for (const id of available) { const option = element('option',id); option.value=id; select.append(option); }
      const actions = element('div',undefined,'row'); actions.append(select,
        button('assign', () => { ids.push(select.value); changed(); render(); }, !available.length),
        button('removeRepository', () => { delete repos[repoKey]; if (!Object.keys(repos).length) delete model.draft.repositories[ownerKey]; changed(); render(); }));
      card.append(list,actions); preview(previewNode, resolveButtons(model.draft,ownerKey,repoKey)); card.append(previewNode); panel.append(card);
    }
  }
}

function renderJSON(panel) {
  const label = field('jsonDocument',model.raw,true); label.input.id='json-editor'; label.input.className='json-editor'; label.input.spellcheck=false;
  label.input.addEventListener('input', () => { operation++; model.raw=label.input.value; clearError(); refreshStatus(); });
  const file = element('input'); file.type='file'; file.accept='.json,application/json'; file.hidden=true; file.setAttribute('aria-label',t('import'));
  file.addEventListener('change', async () => {
    if (!file.files[0]) return;
    const ticket = ++operation;
    try {
      const imported = decodeConfig(await file.files[0].arrayBuffer());
      if (disposed || ticket !== operation) return;
      model.imported(imported); clearError(); status(t('imported')); render();
    } catch (error) {
      if (disposed || ticket !== operation) return;
      if (error instanceof TypeError) status(t('error_encoding'));
      else showError(error);
    } finally { file.value=''; }
  });
  const actions = element('div',undefined,'row'); actions.append(
    button('validate', () => guarded(() => { model.applyJSON(); render(); status(t('valid')); })),
    button('discardJSON', () => { if (model.discardJSON()) { clearError(); render(); } }, !model.lastValid),
    button('import', () => file.click()), file,
    button('export', () => guarded(() => {
      const text=model.export(); const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));
      const anchor=element('a'); anchor.href=url; anchor.download='github-custom-comment-hint.json'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url),1000);
    })));
  panel.append(label.label,actions);
}

function render() {
  const panel=$('panel'); panel.replaceChildren();
  for (const tab of document.querySelectorAll('[data-view]')) {
    const selected=tab.dataset.view===model.view; tab.setAttribute('aria-selected',String(selected)); tab.tabIndex=selected ? 0 : -1;
  }
  panel.setAttribute('aria-labelledby',`tab-${model.view}`);
  if (model.view==='json') renderJSON(panel);
  else if (model.view==='layouts') renderLayouts(panel);
  else renderAssignments(panel);
  updateRepositorySuggestions();
  refreshStatus();
}

for (const node of document.querySelectorAll('[data-i18n]')) node.textContent=t(node.dataset.i18n);
document.documentElement.lang=api.i18n.getUILanguage().startsWith('pl') ? 'pl' : 'en';
document.title=t('settingsTitle'); $('tabs').setAttribute('aria-label',t('settingsTitle'));
for (const tab of document.querySelectorAll('[data-view]')) {
  tab.addEventListener('click', () => { if (model && !saving) guarded(() => { operation++; model.switchView(tab.dataset.view); render(); }); });
}
$('tabs').addEventListener('keydown', (event) => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  const tabs=[...document.querySelectorAll('[data-view]')]; const index=tabs.indexOf(document.activeElement);
  if (index<0) return;
  event.preventDefault(); const next=event.key==='Home' ? 0 : event.key==='End' ? 2 : (index+(event.key==='ArrowRight' ? 1 : 2))%3;
  tabs[next].click(); if (model.view===tabs[next].dataset.view) tabs[next].focus();
});
$('save').addEventListener('click', async () => {
  if (!model || saving) return;
  let snapshot;
  try { snapshot=clone(model.view==='json' ? model.applyJSON() : model.draft); const errors=validateConfig(snapshot); if (errors.length) throw new ConfigError(errors); }
  catch (error) { showError(error); return; }
  saving=true; operation++; refreshStatus(); clearError();
  let written=false;
  try {
    await saveConfig(api,snapshot);
    written=true;
    const revision=storageRevision;
    const stored=await loadConfig(api);
    if (disposed) return;
    // A notification arriving during the read is newer than the read's snapshot.
    const current=revision===storageRevision ? stored : model.external.value;
    model.saved=clone(current);
    model.external=null;
    status(t(JSON.stringify(current)===JSON.stringify(snapshot) ? 'saved' : 'externalPending'));
  } catch { status(t(written ? 'saveUnverified' : 'saveFailed')); }
  finally { saving=false; refreshStatus(); }
});
$('discard').addEventListener('click', async () => {
  if (!model || saving) return;
  const ticket=++operation;
  try {
    const current=await loadConfig(api);
    if (disposed || ticket!==operation) return;
    model.reset(current); clearError(); status(); render();
  } catch { status(t('loadFailed')); }
});
api.storage.onChanged.addListener((changes,area) => {
  if (area!=='local') return;
  if (Object.keys(changes).some(key => key.startsWith(CATALOG_PREFIX))) refreshCatalog();
  if (!own(changes,'config')) return;
  storageRevision++;
  if (!model) return;
  if (saving) { model.external={value:clone(changes.config.newValue)}; return; }
  if (model.receiveExternal(changes.config.newValue)) { clearError(); render(); status(t('externalLoaded')); }
  else status(t('externalPending'));
});
window.addEventListener('beforeunload', (event) => { if (model?.dirty) { event.preventDefault(); event.returnValue=''; } });
window.addEventListener('pagehide', () => { disposed=true; operation++; });

async function start() {
  $('save').disabled=true; $('discard').disabled=true;
  try {
    const revision=storageRevision;
    let saved=await initializeConfig(api);
    if (revision!==storageRevision) saved=await loadConfig(api);
    if (disposed) return;
    model=new Draft(saved); render(); $('discard').disabled=false;
    refreshCatalog();
    if (validateConfig(saved).length) { showError(new ConfigError(validateConfig(saved))); status(t('invalidStored')); }
  } catch { status(t('loadFailed')); }
}
start();
