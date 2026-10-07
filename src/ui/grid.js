const styles = `
:host { display:block; margin:0 0 12px; font:14px/20px system-ui,sans-serif;
  --hint-bg:#f6f8fa; --hint-fg:#1f2328; --hint-border:#d0d7de; --hint-hover:#eaeef2; }
:host([data-theme="dark"]) { --hint-bg:#21262d; --hint-fg:#f0f6fc; --hint-border:#3d444d; --hint-hover:#30363d; }
* { box-sizing:border-box; }
.grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
button { appearance:none; font:inherit; color:var(--fgColor-default,var(--hint-fg));
  background:var(--button-default-bgColor-rest,var(--hint-bg)); border:1px solid var(--borderColor-default,var(--hint-border));
  border-radius:6px; cursor:pointer; min-width:0; padding:6px 10px; }
.action { height:56px; width:100%; }
button:hover { background:var(--button-default-bgColor-hover,var(--hint-hover)); }
button:focus-visible { outline:2px solid var(--focus-outlineColor,#0969da); outline-offset:2px; }
button:disabled { cursor:default; opacity:.55; }
.label { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2;
  overflow:hidden; overflow-wrap:anywhere; white-space:pre-wrap; line-height:20px; max-height:40px; }
.undo { display:block; margin-top:8px; }
`;

export function themeFor(document) {
  const mode = document.documentElement.dataset.colorMode;
  if (mode === 'light' || mode === 'dark') return mode;
  return document.defaultView.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function createGrid(document, buttons, { onInsert, onUndo, undoLabel = 'Undo', theme = themeFor(document) } = {}) {
  const host = document.createElement('div');
  host.dataset.commentHint = '';
  host.dataset.theme = theme;
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = styles;
  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const definition of buttons) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action';
    button.title = definition.label;
    button.setAttribute('aria-label', definition.label);
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = definition.label;
    button.append(label);
    if (onInsert) button.addEventListener('click', () => onInsert(definition));
    else button.disabled = true;
    grid.append(button);
  }
  root.append(style, grid);
  let undo;
  if (onUndo) {
    undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'undo';
    undo.textContent = undoLabel;
    undo.disabled = true;
    undo.addEventListener('click', onUndo);
    root.append(undo);
  }
  return { host, setUndoAvailable: (available) => { if (undo) undo.disabled = !available; } };
}
