const own = (object, key) => Object.hasOwn(object, key);
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const clone = (value) => structuredClone(value);

export function validateConfig(value) {
  const errors = [];
  const error = (path, code) => errors.push({ path, code });
  if (!record(value)) return [{ path: '$', code: 'object' }];
  if (value.version !== 1) error('$.version', 'version');
  if (!record(value.layouts)) error('$.layouts', 'object');
  if (!record(value.repositories)) error('$.repositories', 'object');
  if (record(value.layouts)) {
    for (const [id, buttons] of Object.entries(value.layouts)) {
      const path = `$.layouts[${JSON.stringify(id)}]`;
      if (!id.trim()) error(path, 'name');
      if (!Array.isArray(buttons)) { error(path, 'array'); continue; }
      buttons.forEach((button, index) => {
        const at = `${path}[${index}]`;
        if (!record(button)) { error(at, 'object'); return; }
        for (const field of ['label', 'value']) {
          if (typeof button[field] !== 'string') error(`${at}.${field}`, 'string');
        }
        if (!['append', 'replace'].includes(button.mode)) error(`${at}.mode`, 'mode');
      });
    }
  }
  if (record(value.repositories)) {
    const owners = new Set();
    for (const [owner, repositories] of Object.entries(value.repositories)) {
      const path = `$.repositories[${JSON.stringify(owner)}]`;
      if (!validSegment(owner)) error(path, 'segment');
      const normalized = owner.toLowerCase();
      if (owners.has(normalized)) error(path, 'collision');
      owners.add(normalized);
      if (!record(repositories)) { error(path, 'object'); continue; }
      const names = new Set();
      for (const [repo, ids] of Object.entries(repositories)) {
        const at = `${path}[${JSON.stringify(repo)}]`;
        if (!validSegment(repo)) error(at, 'segment');
        if (names.has(repo.toLowerCase())) error(at, 'collision');
        names.add(repo.toLowerCase());
        if (!Array.isArray(ids)) { error(at, 'array'); continue; }
        const assigned = new Set();
        ids.forEach((id, index) => {
          if (typeof id !== 'string') error(`${at}[${index}]`, 'string');
          else if (!record(value.layouts) || !own(value.layouts, id)) error(`${at}[${index}]`, 'reference');
          if (assigned.has(id)) error(`${at}[${index}]`, 'duplicate');
          assigned.add(id);
        });
      }
    }
  }
  return errors;
}

function validSegment(name) {
  return name.length > 0 && name.trim() === name && !/[\s/\\?#%]/u.test(name) && !['.', '..'].includes(name);
}

export class ConfigError extends Error {
  constructor(errors) { super('Invalid configuration'); this.name = 'ConfigError'; this.errors = errors; }
}

export function assertConfig(value) {
  const errors = validateConfig(value);
  if (errors.length) throw new ConfigError(errors);
  return value;
}

export function parseConfig(text) { return assertConfig(JSON.parse(text.replace(/^\uFEFF/u, ''))); }
export function decodeConfig(bytes) {
  return parseConfig(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
export function exportConfig(value) { return `${JSON.stringify(assertConfig(value), null, 2)}\n`; }

export function resolveButtons(config, owner, repo) {
  if (validateConfig(config).length) return [];
  const ownerKey = Object.keys(config.repositories).find((key) => key.toLowerCase() === owner.toLowerCase());
  if (ownerKey === undefined) return [];
  const repos = config.repositories[ownerKey];
  const repoKey = Object.keys(repos).find((key) => key.toLowerCase() === repo.toLowerCase());
  return repoKey === undefined ? [] : repos[repoKey].flatMap((id) => config.layouts[id]);
}

export function layoutAssignments(config, id) {
  return Object.entries(config.repositories).flatMap(([owner, repos]) =>
    Object.entries(repos).filter(([, ids]) => ids.includes(id)).map(([repo]) => `${owner}/${repo}`));
}

export function renameLayout(config, from, to) {
  assertConfig(config);
  if (!own(config.layouts, from) || !to.trim() || (from !== to && own(config.layouts, to))) {
    throw new ConfigError([{ path: '$.layouts', code: 'name' }]);
  }
  const next = clone(config);
  next.layouts = Object.fromEntries(Object.entries(next.layouts).map(([key, buttons]) => [key === from ? to : key, buttons]));
  for (const repos of Object.values(next.repositories)) {
    for (const key of Object.keys(repos)) repos[key] = repos[key].map((id) => id === from ? to : id);
  }
  return next;
}

export function deleteLayout(config, id) {
  assertConfig(config);
  const next = clone(config);
  delete next.layouts[id];
  for (const repos of Object.values(next.repositories)) {
    for (const key of Object.keys(repos)) repos[key] = repos[key].filter((assigned) => assigned !== id);
  }
  return next;
}

export function conversationFromURL(input) {
  try {
    const url = new URL(input);
    if (url.origin !== 'https://github.com') return null;
    const match = /^\/([^/]+)\/([^/]+)\/(pull|issues)\/([1-9]\d*)\/?$/u.exec(url.pathname);
    if (!match) return null;
    const [, owner, repo, kind, number] = match;
    if (!validSegment(owner) || !validSegment(repo)) return null;
    return { owner, repo, kind, number, key: `${owner.toLowerCase()}/${repo.toLowerCase()}/${kind}/${number}` };
  } catch { return null; }
}
