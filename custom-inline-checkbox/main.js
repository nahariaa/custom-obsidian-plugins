const { Plugin, MarkdownView, TFile, Notice } = require('obsidian');

/* ---------- helpers ---------- */

const TAG_RE_SRC = '(^|[^\\w#/&])#(check|done)(?![\\w/-])';

// Is this element a rendered #check / #done tag (Reading View or CodeMirror)?
function isTagEl(el) {
  if (!el || !el.classList) return false;
  if (el.matches('a.tag')) {
    const h = (el.getAttribute('href') || '').toLowerCase();
    return h === '#check' || h === '#done';
  }
  if (el.classList.contains('cm-hashtag') && !el.classList.contains('cm-hashtag-begin')) {
    const t = (el.textContent || '').toLowerCase();
    return t === 'check' || t === 'done';
  }
  return false;
}

// check <-> done, keeping the capitalisation style (check / Check / CHECK)
function flipKind(kind) {
  const next = kind.toLowerCase() === 'check' ? 'done' : 'check';
  if (kind === kind.toUpperCase()) return next.toUpperCase();
  if (kind[0] === kind[0].toUpperCase()) return next[0].toUpperCase() + next.slice(1);
  return next;
}

function allTagEls(root) {
  return Array.from(root.querySelectorAll('a.tag, .cm-hashtag')).filter(isTagEl);
}

// List every #check/#done token (document order) within lines [start..end].
// Tokens inside `inline code` are ignored, matching what Obsidian renders as tags.
function scanTags(getLine, start, end) {
  const out = [];
  for (let i = start; i <= end; i++) {
    const text = getLine(i);
    if (text === undefined || text === null) break;
    const masked = text.replace(/`[^`]*`/g, (m) => ' '.repeat(m.length));
    const re = new RegExp(TAG_RE_SRC, 'gi');
    let m;
    while ((m = re.exec(masked)) !== null) {
      out.push({ line: i, ch: m.index + m[1].length, kind: m[2] });
    }
  }
  return out;
}

function locateNth(getLine, start, end, n) {
  return scanTags(getLine, start, end)[n] || null;
}

const BLOCK_TAGS = new Set([
  'P', 'LI', 'TD', 'TH', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'BLOCKQUOTE', 'UL', 'OL', 'PRE', 'TABLE', 'TR', 'THEAD', 'TBODY'
]);

// Reading View: wrap everything that sits on the same line as a #done tag
// in <span class="cic-done-line"> so it can be coloured green.
function markDoneLines(el) {
  const doneTags = Array.from(el.querySelectorAll('a.tag[href="#done" i]'));
  for (const tag of doneTags) {
    if (tag.closest('td, th')) continue;          // table rows are coloured via CSS (:has)
    if (tag.closest('.cic-done-line')) continue;  // already wrapped

    let node = tag;
    while (node.parentElement && !BLOCK_TAGS.has(node.parentElement.tagName)) {
      node = node.parentElement;
    }
    const isBreak = (n) =>
      n.nodeType === 1 && (n.tagName === 'BR' || BLOCK_TAGS.has(n.tagName));

    let first = node, last = node;
    while (first.previousSibling && !isBreak(first.previousSibling)) first = first.previousSibling;
    while (last.nextSibling && !isBreak(last.nextSibling)) last = last.nextSibling;

    const wrap = document.createElement('span');
    wrap.className = 'cic-done-line';
    first.parentNode.insertBefore(wrap, first);
    let cur = first;
    while (cur) {
      const next = cur.nextSibling;
      wrap.appendChild(cur);
      if (cur === last) break;
      cur = next;
    }
  }
}

/* ---------- plugin ---------- */

module.exports = class CustomInlineCheckbox extends Plugin {
  async onload() {
    // 1) Reading View: remember which source lines each rendered block came from
    this.registerMarkdownPostProcessor((el, ctx) => {
      const tags = allTagEls(el);
      if (!tags.length) return;

      const info = ctx.getSectionInfo(el);
      if (info && !el.dataset.cicStart) {
        el.dataset.cicStart = String(info.lineStart);
        el.dataset.cicEnd = String(info.lineEnd);
        el.dataset.cicPath = ctx.sourcePath;
      }
      markDoneLines(el);
    });

    // 2) Live Preview / Source: colour the whole line that contains #done
    try {
      const { ViewPlugin, Decoration } = require('@codemirror/view');
      const { RangeSetBuilder } = require('@codemirror/state');
      const DONE_RE = new RegExp('(^|[^\\w#/&])#done(?![\\w/-])', 'i');
      const lineDeco = Decoration.line({ class: 'cic-done-line-cm' });

      const donePlugin = ViewPlugin.fromClass(
        class {
          constructor(view) { this.decorations = this.build(view); }
          update(u) {
            if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view);
          }
          build(view) {
            const b = new RangeSetBuilder();
            let lastFrom = -1;
            for (const { from, to } of view.visibleRanges) {
              let pos = from;
              while (pos <= to) {
                const line = view.state.doc.lineAt(pos);
                if (line.from > lastFrom && DONE_RE.test(line.text)) {
                  b.add(line.from, line.from, lineDeco);
                  lastFrom = line.from;
                }
                pos = line.to + 1;
              }
            }
            return b.finish();
          }
        },
        { decorations: (v) => v.decorations }
      );
      this.registerEditorExtension(donePlugin);
    } catch (e) {
      console.warn('[custom-inline-checkbox] could not register line colouring', e);
    }

    // 3) Event handling.
    // Live Preview tables re-render a cell as soon as it is pressed, which can swallow a
    // normal "click". So with a mouse we toggle on pointerdown (before anything re-renders),
    // and for touch/pen we toggle on click.
    this._handledByPointer = false;

    this.registerDomEvent(document, 'pointerdown', (evt) => {
      const tag = this.getTagEl(evt.target);
      if (!tag) return;
      evt.preventDefault();
      evt.stopPropagation();
      if (evt.pointerType === 'mouse' && evt.button === 0) {
        this._handledByPointer = true;
        this.toggle(tag);
      }
    }, true);

    this.registerDomEvent(document, 'mousedown', (evt) => {
      if (this.getTagEl(evt.target)) {
        evt.preventDefault();
        evt.stopPropagation();
      }
    }, true);

    this.registerDomEvent(document, 'click', (evt) => {
      const tag = this.getTagEl(evt.target);
      if (!tag && !this._handledByPointer) return;
      evt.preventDefault();
      evt.stopPropagation();
      if (this._handledByPointer) { this._handledByPointer = false; return; }
      if (tag) this.toggle(tag);
    }, true);
  }

  async toggle(tag) {
    try {
      // Anything rendered inside a CodeMirror editor (Live Preview / Source) — including
      // tables, whose cells are drawn as normal HTML links — is edited through the editor.
      if (tag.closest('.cm-editor')) await this.toggleInEditor(tag);
      else await this.toggleInReadingView(tag);
    } catch (e) {
      console.error('[custom-inline-checkbox] toggle failed', e);
      new Notice('Checkbox: toggle failed (see console)');
    }
  }

  getTagEl(target) {
    if (!(target instanceof Element)) return null;
    const el = target.closest('a.tag, .cm-hashtag');
    return el && isTagEl(el) ? el : null;
  }

  /* ----- Reading View (tables + normal text) ----- */
  async toggleInReadingView(tag) {
    const root = tag.closest('[data-cic-start]');

    let file, start, end, n;
    if (root) {
      file = this.app.vault.getAbstractFileByPath(root.dataset.cicPath);
      start = parseInt(root.dataset.cicStart, 10);
      end = parseInt(root.dataset.cicEnd, 10);
      n = allTagEls(root).indexOf(tag);
    } else {
      // Fallback: count tags across the whole rendered note
      const view = this.findViewContaining(tag);
      if (!view || !view.file) return;
      file = view.file;
      const scope = view.containerEl.querySelector('.markdown-preview-view') || view.containerEl;
      n = allTagEls(scope).indexOf(tag);
      start = 0;
      end = Number.MAX_SAFE_INTEGER;
    }
    if (!(file instanceof TFile) || n < 0) return;

    await this.app.vault.process(file, (data) => {
      const lines = data.split('\n');
      const hit = locateNth((i) => lines[i], start, Math.min(end, lines.length - 1), n);
      if (!hit) return data;
      const l = lines[hit.line];
      const s = hit.ch + 1;
      lines[hit.line] = l.slice(0, s) + flipKind(hit.kind) + l.slice(s + hit.kind.length);
      return lines.join('\n');
    });
  }

  /* ----- Live Preview / Source mode (tables + normal text) ----- */
  async toggleInEditor(tag) {
    const table = tag.closest('table');
    const cmDom = (table || tag).closest('.cm-editor');

    let view = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView && leaf.view.editor && leaf.view.editor.cm &&
          leaf.view.editor.cm.dom === cmDom) view = leaf.view;
    });
    if (!view) view = this.findViewContaining(tag);
    if (!view || !view.editor) return;

    const editor = view.editor;
    const cm = editor.cm;
    const getLine = (i) => editor.getLine(i);
    let hit = null;

    if (table) {
      hit = this.locateInTable(editor, cm, table, tag);
    } else {
      const lineEl = tag.closest('.cm-line');
      if (lineEl && cm) {
        const ln = cm.state.doc.lineAt(cm.posAtDOM(lineEl)).number - 1;
        hit = locateNth(getLine, ln, ln, allTagEls(lineEl).indexOf(tag));
      }
    }

    if (!hit) {
      new Notice('Checkbox: could not locate this item in the note.');
      return;
    }

    editor.replaceRange(
      flipKind(hit.kind),
      { line: hit.line, ch: hit.ch + 1 },
      { line: hit.line, ch: hit.ch + 1 + hit.kind.length }
    );
    try { await view.save(); } catch (e) { /* autosave will catch it */ }
  }

  // Work out which markdown table a rendered <table> belongs to, then find the exact tag.
  locateInTable(editor, cm, table, tag) {
    const tags = allTagEls(table);
    const n = tags.indexOf(tag);
    if (n < 0) return null;

    const getLine = (i) => editor.getLine(i);
    const isRow = (i) => {
      const t = getLine(i);
      return t !== undefined && t.trim().startsWith('|');
    };

    // Several ways to find where the table widget sits in the document
    const positions = [];
    if (cm) {
      const wrapper = table.closest('.cm-embed-block, .cm-table-widget') || table;
      for (const el of [wrapper, table]) {
        try { positions.push(cm.posAtDOM(el)); } catch (e) { /* try next */ }
      }
      try {
        const r = table.getBoundingClientRect();
        const p = cm.posAtCoords({ x: r.left + 2, y: r.top + 2 });
        if (p !== null && p !== undefined) positions.push(p);
      } catch (e) { /* ignore */ }
    }

    const tried = new Set();
    for (const pos of positions) {
      const base = cm.state.doc.lineAt(pos).number - 1;
      for (const cand of [base, base + 1, base - 1]) {
        if (cand < 0 || cand > editor.lastLine() || !isRow(cand)) continue;
        let s = cand;
        while (s > 0 && isRow(s - 1)) s--;
        if (tried.has(s)) continue;
        tried.add(s);
        let e = cand;
        while (e < editor.lastLine() && isRow(e + 1)) e++;

        const found = scanTags(getLine, s, e);
        if (found.length === tags.length) return found[n];
      }
    }
    return null;
  }

  findViewContaining(el) {
    let found = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView && leaf.view.containerEl.contains(el)) found = leaf.view;
    });
    return found;
  }
};