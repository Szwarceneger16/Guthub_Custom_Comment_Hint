import { insertText, UndoState } from '../lib/text.js';
import { conversationFromURL } from '../lib/config.js';
import { createGrid } from '../ui/grid.js';

export function findMainEditor(document, conversation) {
  const candidates = [];
  for (const form of document.querySelectorAll('form')) {
    if (form.closest('.js-comment-edit-form, .js-inline-comments-container, .review-thread, .js-pull-request-review, [data-testid="comment-edit-form"]')) continue;
    const editors = form.querySelectorAll('textarea#new_comment_field, textarea[name="comment[body]"]');
    if (editors.length !== 1) continue;
    const editor = editors[0];
    if (editor.disabled || editor.readOnly) continue;
    let action;
    try { action = new URL(form.getAttribute('action') || '', document.location.href); } catch { continue; }
    const expectedAction = `/${conversation.owner}/${conversation.repo}/issue_comments`.toLowerCase();
    const alternateAction = `/${conversation.owner}/${conversation.repo}/issues/${conversation.number}/comments`.toLowerCase();
    const conversationAction = `/${conversation.owner}/${conversation.repo}/${conversation.kind}/${conversation.number}/comment`.toLowerCase();
    if (action.origin !== 'https://github.com' || ![expectedAction, alternateAction, conversationAction].includes(action.pathname.toLowerCase())) continue;
    const trustedForm = form.matches('form#new_comment, form#new_comment_form, form.js-new-comment-form');
    if (!trustedForm && !(editor.id === 'new_comment_field' && action.origin === 'https://github.com' && action.pathname.toLowerCase() === expectedAction)) continue;
    if (form.querySelector('input[name="_method"][value="patch"], input[name="_method"][value="put"]')) continue;
    const section = editor.closest('.js-previewable-comment-form, [data-testid="markdown-editor"]');
    if (!section || !form.contains(section)) continue;
    candidates.push({ editor, form, section });
  }
  return candidates.length === 1 ? candidates[0] : null;
}

export function attachToolbar(document, target, buttons, undoLabel, conversationKey) {
  const { editor, form, section } = target;
  const state = new UndoState();
  let writing = false;
  let insertedValue;
  const current = () => {
    const conversation = conversationFromURL(document.location.href);
    return editor.isConnected && !editor.disabled && !editor.readOnly && conversation?.key === conversationKey
      && findMainEditor(document, conversation)?.editor === editor;
  };
  function write(value, start = value.length, end = start, direction = 'none') {
    const setter = Object.getOwnPropertyDescriptor(document.defaultView.HTMLTextAreaElement.prototype, 'value').set;
    writing = true;
    try {
      setter.call(editor, value);
      editor.focus();
      editor.setSelectionRange(start, end, direction);
      editor.dispatchEvent(new document.defaultView.InputEvent('input', { bubbles: true, inputType: 'insertText', data: null }));
    } finally { writing = false; }
  }
  const grid = createGrid(document, buttons, {
    undoLabel,
    onInsert: (definition) => {
      if (!current()) return;
      state.capture(editor);
      insertedValue = insertText(editor.value, definition);
      write(insertedValue);
      grid.setUndoAvailable(true);
    },
    onUndo: () => {
      if (!current() || editor.value !== insertedValue) { state.clear(); grid.setUndoAvailable(false); return; }
      const previous = state.take();
      if (previous) write(previous.value, previous.start, previous.end, previous.direction);
      grid.setUndoAvailable(false);
    },
  });
  const invalidate = () => { if (!writing) { state.clear(); grid.setUndoAvailable(false); } };
  editor.addEventListener('input', invalidate);
  editor.addEventListener('change', invalidate);
  form.addEventListener('submit', invalidate);
  form.addEventListener('reset', invalidate);
  section.before(grid.host);
  return {
    ...target, host: grid.host,
    destroy() {
      state.clear();
      editor.removeEventListener('input', invalidate);
      editor.removeEventListener('change', invalidate);
      form.removeEventListener('submit', invalidate);
      form.removeEventListener('reset', invalidate);
      grid.host.remove();
    },
  };
}
