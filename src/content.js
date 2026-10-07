import { conversationFromURL, resolveButtons, validateConfig } from './lib/config.js';
import { loadConfig } from './lib/storage.js';
import { findMainEditor, attachToolbar } from './github/editor.js';
import { themeFor } from './ui/grid.js';
import { repositoryFromURL, repositoryKey } from './lib/repositories.js';

let config;
let binding;
let signature;
let pending = false;
let stopped = false;
let configRevision = 0;
let rememberedRepository;
const editorConversations = new WeakMap();
const media = matchMedia('(prefers-color-scheme: dark)');

function reconcile() {
  pending = false;
  if (stopped) return;
  const repository = repositoryFromURL(location.href);
  if (repository && repositoryKey(repository) !== rememberedRepository && !browser.extension?.inIncognitoContext) {
    rememberedRepository = repositoryKey(repository);
    browser.runtime.sendMessage({ type:'rememberRepository', url:location.href }).catch(() => {
      // Retry after navigation; toolbar behavior is independent of the catalog.
      rememberedRepository = undefined;
    });
  }
  const conversation = conversationFromURL(location.href);
  const buttons = conversation && config && !validateConfig(config).length ? resolveButtons(config, conversation.owner, conversation.repo) : [];
  let target = conversation ? findMainEditor(document, conversation) : null;
  if (target) {
    const previous = editorConversations.get(target.editor);
    // A generic action cannot establish ownership after this editor outlives a conversation.
    const stale = previous && (previous.stale || previous.key !== conversation.key);
    editorConversations.set(target.editor, { key: conversation.key, stale: Boolean(stale && !target.conversationSpecific) });
    if (stale && !target.conversationSpecific) target = null;
  }
  if (!buttons.length) target = null;
  const nextSignature = JSON.stringify([conversation?.key, buttons.map(({label, value, mode}) => [label, value, mode])]);
  if (binding && (!target || target.editor !== binding.editor || target.section !== binding.section || !binding.host.isConnected || nextSignature !== signature)) {
    binding.destroy();
    binding = null;
  }
  if (target && !binding) {
    binding = attachToolbar(document, target, buttons, browser.i18n.getMessage('undo'), conversation.key);
    signature = nextSignature;
  }
  if (binding) binding.host.dataset.theme = themeFor(document);
}

function schedule() {
  if (!pending && !stopped) { pending = true; queueMicrotask(reconcile); }
}

const observer = new MutationObserver(schedule);
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-color-mode', 'data-dark-theme', 'data-light-theme', 'action', 'disabled', 'readonly'] });
for (const event of ['popstate', 'pageshow', 'turbo:load', 'turbo:render']) window.addEventListener(event, schedule);
media.addEventListener('change', schedule);
// History changes in the page's isolated world do not always produce DOM events.
let lastURL = location.href;
const timer = setInterval(() => { if (lastURL !== location.href) { lastURL = location.href; schedule(); } }, 400);

const onStorageChanged = (changes, area) => {
  if (area === 'local' && Object.hasOwn(changes, 'config')) {
    configRevision++;
    config = changes.config.newValue;
    schedule();
  }
};
browser.storage.onChanged.addListener(onStorageChanged);
const initialRevision = configRevision;
loadConfig(browser).then((value) => { if (configRevision === initialRevision) config = value; schedule(); }).catch(() => { if (configRevision === initialRevision) config = undefined; schedule(); });

window.addEventListener('pagehide', (event) => {
  if (event.persisted) { binding?.destroy(); binding = null; return; }
  stopped = true;
  clearInterval(timer);
  observer.disconnect();
  browser.storage.onChanged.removeListener(onStorageChanged);
  media.removeEventListener('change', schedule);
  for (const name of ['popstate', 'pageshow', 'turbo:load', 'turbo:render']) window.removeEventListener(name, schedule);
  binding?.destroy();
}, { once: false });
