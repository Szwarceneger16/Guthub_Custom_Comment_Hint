export function insertText(current, { value, mode }) {
  if (typeof current !== 'string' || typeof value !== 'string') throw new TypeError('Text must be a string');
  if (mode === 'replace') return value;
  if (mode !== 'append') throw new TypeError('Unknown insertion mode');
  return `${current}${current && !current.endsWith('\n') ? '\n' : ''}${value}`;
}

export class UndoState {
  snapshot = null;
  capture(editor) {
    this.snapshot = { value: editor.value, start: editor.selectionStart, end: editor.selectionEnd, direction: editor.selectionDirection };
  }
  clear() { this.snapshot = null; }
  take() { const result = this.snapshot; this.clear(); return result; }
}
