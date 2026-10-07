import { clone, parseConfig, exportConfig, validateConfig } from '../lib/config.js';

export class Draft {
  constructor(saved) { this.reset(saved); }
  reset(saved) {
    this.saved = clone(saved);
    this.draft = clone(saved);
    this.raw = JSON.stringify(saved, null, 2);
    this.lastValid = validateConfig(saved).length ? null : clone(saved);
    this.view = this.lastValid ? 'layouts' : 'json';
    this.external = null;
  }
  get dirty() {
    return JSON.stringify(this.draft) !== JSON.stringify(this.saved) || this.raw !== JSON.stringify(this.draft, null, 2)
      || (this.external !== null && JSON.stringify(this.draft) !== JSON.stringify(this.external.value));
  }
  changed() {
    this.raw = JSON.stringify(this.draft, null, 2);
    if (!validateConfig(this.draft).length) this.lastValid = clone(this.draft);
  }
  applyJSON() {
    const parsed = parseConfig(this.raw);
    this.draft = parsed;
    this.lastValid = clone(parsed);
    this.raw = JSON.stringify(parsed, null, 2);
    return parsed;
  }
  switchView(view) {
    if (this.view === 'json' && view !== 'json') this.applyJSON();
    this.view = view;
  }
  discardJSON() {
    if (!this.lastValid) return false;
    this.draft = clone(this.lastValid);
    this.raw = JSON.stringify(this.draft, null, 2);
    return true;
  }
  imported(config) { this.draft = clone(config); this.changed(); }
  export() { return exportConfig(this.view === 'json' ? parseConfig(this.raw) : this.draft); }
  receiveExternal(config) {
    if (this.dirty) { this.external = { value: clone(config) }; return false; }
    const view = this.view;
    this.reset(config);
    if (this.lastValid) this.view = view;
    return true;
  }
}
