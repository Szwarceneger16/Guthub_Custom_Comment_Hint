export const CATALOG_PREFIX = 'repositoryCatalog:';
const reservedOwners = new Set(['about', 'account', 'apps', 'business', 'codespaces', 'collections', 'contact', 'copilot', 'customer-stories', 'dashboard', 'enterprise', 'enterprises', 'events', 'explore', 'features', 'issues', 'join', 'login', 'logout', 'marketplace', 'new', 'notifications', 'organizations', 'orgs', 'pricing', 'pulls', 'resources', 'search', 'security', 'sessions', 'settings', 'signup', 'site', 'solutions', 'sponsors', 'stars', 'topics', 'trending', 'users']);

function validRepository(value) {
  return value && typeof value.owner === 'string' && typeof value.repo === 'string'
    && /^[a-z0-9][a-z0-9-]*$/iu.test(value.owner) && /^[a-z0-9_.-]+$/iu.test(value.repo)
    && !['.', '..'].includes(value.repo) && !reservedOwners.has(value.owner.toLowerCase());
}
export function repositoryKey({ owner, repo }) { return `${owner.toLowerCase()}/${repo.toLowerCase()}`; }

export function repositoryFromURL(input) {
  try {
    const url = new URL(input);
    if (url.origin !== 'https://github.com' || url.username || url.password) return null;
    const [, owner, repo] = url.pathname.split('/');
    const result = { owner, repo };
    return validRepository(result) ? result : null;
  } catch { return null; }
}

export function mergeRepositories(...lists) {
  const unique = new Map();
  for (const value of lists.flat()) {
    if (validRepository(value) && !unique.has(repositoryKey(value))) unique.set(repositoryKey(value), { owner:value.owner, repo:value.repo });
  }
  return [...unique.values()].sort((a,b) => repositoryKey(a).localeCompare(repositoryKey(b), 'en'));
}

export function repositoriesFromConfig(config) {
  return Object.entries(config?.repositories || {}).flatMap(([owner, repos]) =>
    Object.keys(repos || {}).map(repo => ({ owner, repo })));
}

export function catalogFromStorage(stored) {
  return mergeRepositories(Object.entries(stored).filter(([key, value]) =>
    key.startsWith(CATALOG_PREFIX) && validRepository(value) && key === CATALOG_PREFIX + repositoryKey(value)).map(([,value]) => value));
}

export async function loadCatalog(api) { return catalogFromStorage(await api.storage.local.get(null)); }

export async function rememberRepositories(api, repositories) {
  const entries = mergeRepositories(repositories);
  // Independent keys avoid lost updates when different tabs discover repositories.
  for (let offset = 0; offset < entries.length; offset += 256) {
    await api.storage.local.set(Object.fromEntries(entries.slice(offset, offset + 256).map(value => [CATALOG_PREFIX + repositoryKey(value), value])));
  }
  return entries.length;
}

export async function clearCatalog(api) {
  const stored = await api.storage.local.get(null);
  const keys = Object.keys(stored).filter(key => key.startsWith(CATALOG_PREFIX));
  if (keys.length) await api.storage.local.remove(keys);
}

export async function importHistory(api) {
  // Called directly by a settings button: Firefox requires a user gesture.
  if (!await api.permissions.request({ permissions:['history'] })) return { granted:false, count:0 };
  // Override both the 24-hour default and the 100-result default. No recent-only cap.
  const items = await api.history.search({ text:'https://github.com/', startTime:0, maxResults:2147483647 });
  const repositories = mergeRepositories(items.map(item => repositoryFromURL(item.url)));
  return { granted:true, count:await rememberRepositories(api, repositories) };
}

export function registerRepositoryDiscovery(api) {
  api.runtime.onMessage.addListener((message, sender) => {
    if (message?.type !== 'rememberRepository' || !sender.tab || sender.tab.incognito || sender.frameId !== 0) return undefined;
    let source;
    try { source = new URL(sender.url); } catch { return undefined; }
    if (source.origin !== 'https://github.com') return undefined;
    const repository = repositoryFromURL(message.url);
    if (!repository) return undefined;
    return rememberRepositories(api, [repository]).then(() => true);
  });
}
