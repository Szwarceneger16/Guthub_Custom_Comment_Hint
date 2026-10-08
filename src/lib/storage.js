import { assertConfig } from './config.js';
import defaults from './default-config.json' with { type: 'json' };

export async function initializeConfig(api, canInitialize=()=>true) {
  const stored = await api.storage.local.get('config');
  if (!Object.hasOwn(stored, 'config') && canInitialize()) {
    await api.storage.local.set({ config: defaults });
    return defaults;
  }
  return stored.config;
}
export async function loadConfig(api) { return (await api.storage.local.get('config')).config; }
export async function saveConfig(api, config) { await api.storage.local.set({ config: assertConfig(config) }); }
