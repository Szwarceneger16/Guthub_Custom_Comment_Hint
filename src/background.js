import { initializeConfig } from './lib/storage.js';
import { registerRepositoryDiscovery } from './lib/repositories.js';

registerRepositoryDiscovery(browser);

browser.runtime.onInstalled.addListener(() => {
  initializeConfig(browser).catch(() => console.error('Configuration initialization failed. Open settings to retry.'));
});
browser.action.onClicked.addListener(() => {
  browser.runtime.openOptionsPage().catch(() => console.error('Could not open extension settings.'));
});
