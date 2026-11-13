const { Plugin, setIcon } = require('obsidian');

const SCROLLER_SEL = '.cm-scroller, .markdown-preview-view';
const WRAPPER_SEL = '.cm-table-widget, .el-table, .cm-embed-block';
const GAP = 16; // px of breathing room left/right of an expanded table

module.exports = class TableExpander extends Plugin {
  onload() {
    this.expandedKeys = new Set(); // remembers expanded tables across re-renders
    this.expandedEls = new Set();  // currently expanded wrapper elements
    this.timer = null;

    this.ro = new ResizeObserver(() => this.relayoutAll());

    const schedule = () => {
      if (this.timer) return;
      this.timer = window.setTimeout(() => { this.timer = null; this.scan(); }, 80);
    };

    // Obsidian re-renders tables often (Live Preview especially), so watch the DOM
    this.observer = new MutationObserver(schedule);
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.register(() => this.observer.disconnect());
    this.register(() => this.ro.disconnect());

    this.registerEvent(this.app.workspace.on('layout-change', schedule));
    this.registerEvent(this.app.workspace.on('active-leaf-change', schedule));
    this.registerDomEvent(window, 'resize', () => this.relayoutAll());
    this.app.workspace.onLayoutReady(schedule);
  }

  onunload() {
    document.querySelectorAll('.cic-te-btn').forEach((b) => b.remove());
    document.querySelectorAll('.cic-te-wrap').forEach((w) => {
      w.classList.remove('cic-te-wrap', 'cic-te-expanded');
      w.style.marginLeft = '';
      w.style.width = '';
    });
  }

  scan() {
    document
      .querySelectorAll('.markdown-source-view table, .markdown-preview-view table')
      .forEach((t) => this.decorate(t));
  }

  decorate(table) {
    const wrapper = table.closest(WRAPPER_SEL) || table.parentElement;
    if (!wrapper) return;
    if (wrapper.querySelector(':scope > .cic-te-btn')) return;

    wrapper.classList.add('cic-te-wrap');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cic-te-btn';
    btn.contentEditable = 'false';
    // keep the editor from grabbing focus / moving the cursor
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle(wrapper);
    });
    wrapper.appendChild(btn);

    const expanded = this.expandedKeys.has(this.keyFor(wrapper));
    this.setExpanded(wrapper, expanded);
  }

  toggle(wrapper) {
    const on = !wrapper.classList.contains('cic-te-expanded');
    const key = this.keyFor(wrapper);
    if (on) this.expandedKeys.add(key);
    else this.expandedKeys.delete(key);
    this.setExpanded(wrapper, on);
  }

  setExpanded(wrapper, on) {
    wrapper.classList.toggle('cic-te-expanded', on);

    if (on) {
      this.expandedEls.add(wrapper);
      const sc = wrapper.closest(SCROLLER_SEL);
      if (sc) this.ro.observe(sc);
      this.layout(wrapper);
    } else {
      this.expandedEls.delete(wrapper);
      wrapper.style.marginLeft = '';
      wrapper.style.width = '';
    }

    const btn = wrapper.querySelector(':scope > .cic-te-btn');
    if (btn) {
      btn.empty();
      setIcon(btn, on ? 'minimize-2' : 'maximize-2');
      btn.setAttribute('aria-label', on ? 'Shrink table' : 'Expand table');
    }
    this.remeasure(wrapper);
  }

  // Stretch the table across the visible width of the pane, escaping the narrow text column
  layout(wrapper) {
    const sc = wrapper.closest(SCROLLER_SEL);
    if (!sc) return;
    wrapper.style.marginLeft = '0px';
    wrapper.style.width = '';
    const naturalLeft = wrapper.getBoundingClientRect().left;
    const sr = sc.getBoundingClientRect();
    const targetLeft = sr.left + sc.clientLeft + GAP;
    wrapper.style.marginLeft = (targetLeft - naturalLeft) + 'px';
    wrapper.style.width = Math.max(200, sc.clientWidth - GAP * 2) + 'px';
  }

  relayoutAll() {
    for (const el of Array.from(this.expandedEls)) {
      if (!el.isConnected) this.expandedEls.delete(el);
      else this.layout(el);
    }
  }

  // Identify a table by note path + header text so it stays expanded after a re-render
  keyFor(wrapper) {
    const table = wrapper.querySelector('table');
    const head = table && table.rows[0]
      ? table.rows[0].textContent.replace(/\s+/g, ' ').trim().slice(0, 200)
      : '';
    const view = this.findView(wrapper);
    return (view && view.file ? view.file.path : '') + '::' + head;
  }

  findView(el) {
    let found = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view && leaf.view.containerEl && leaf.view.containerEl.contains(el)) found = leaf.view;
    });
    return found;
  }

  remeasure(wrapper) {
    const v = this.findView(wrapper);
    try { v && v.editor && v.editor.cm && v.editor.cm.requestMeasure(); } catch (e) { /* ignore */ }
  }
};