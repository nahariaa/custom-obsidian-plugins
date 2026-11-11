# Custom Inline Checkbox (Obsidian plugin)

Turns the tags `#check` and `#done` into clickable checkboxes **anywhere** in a note: in normal text, lists, headings, and **inside Markdown tables**. Clicking a box flips the tag in the file itself, so the state is plain text and diffs cleanly in Git.

| You write | You see | Meaning |
|-----------|---------|---------|
| `#check`  | empty box | not done |
| `#done`   | green box with a tick | done |

When an item is `#done`, the **whole line** (or the **whole table row**) turns green.

## Features

- Works in Reading View, Live Preview and Source mode.
- Works inside Markdown tables, including several tables per note and several boxes per row.
- State lives in the note as plain text (`#check` / `#done`), so it persists to disk and is Git-friendly.
- Case-insensitive: `#check`, `#Check` and `#CHECK` all render as boxes. Toggling keeps your capitalisation (`#Check` becomes `#Done`).
- Green colour scheme (box and completed text), configurable with two CSS variables.
- Clicking a box does not open Obsidian's tag search pane.
- Desktop and mobile (`isDesktopOnly: false`).

## Installation

There is no build step; the plugin is plain JavaScript.

1. Create this folder inside your vault:
   ```
   <your-vault>/.obsidian/plugins/custom-inline-checkbox/
   ```
2. Copy these three files into it:
   ```
   manifest.json
   main.js
   styles.css
   ```
3. In Obsidian go to **Settings → Community plugins**, turn off *Restricted mode* if needed, click the reload icon, and enable **Custom Inline Checkbox**.
4. After updating the files later, toggle the plugin off and on (or restart Obsidian) and reopen your notes.

Requires Obsidian **1.5.0** or newer.

## Usage

Type the tag anywhere:

```markdown
- #check Buy milk
- #done Send invoice

| Task          | Status  |
|---------------|---------|
| Write report  | #check  |
| Review draft  | #done   |
```

Click the box to toggle it. Rule of thumb for colouring: a line (or table row) containing `#done` is green; one with only `#check` keeps the normal colour.

## Customising the colours

Edit the variables at the top of `styles.css`:

```css
body        { --cic-green: #2ea44f; --cic-green-text: #2ea44f; }
.theme-dark { --cic-green: #3fb950; --cic-green-text: #4ade80; }
```

- `--cic-green`: the checkbox itself.
- `--cic-green-text`: the text of completed items.

## How it works

For anyone (human or AI agent) who needs to modify it.

| File | Role |
|------|------|
| `manifest.json` | Plugin metadata (`id: custom-inline-checkbox`). |
| `styles.css` | Hides the literal tag text and draws it as a box; colours completed lines and table rows. Case-insensitive via `[href="#done" i]` and `[class~="cm-tag-done" i]` selectors. Row colouring uses `:has()`. |
| `main.js` | Click handling and file edits, described below. |

**Rendering.** In Live Preview and Source mode, tags are CodeMirror spans (`.cm-hashtag`, split into a hidden `-begin` `#` span and a visible `-end` span). In Reading View, and for table cells in Live Preview, they are `a.tag` links. The CSS handles both.

**Finding the right tag to edit.** The plugin never trusts DOM row/column positions. It counts which `#check`/`#done` token (in document order) was clicked within a known block of lines, then edits that exact token:

- *Reading View:* a Markdown post-processor stores the block's source line range (`ctx.getSectionInfo`) on the rendered element as `data-cic-*` attributes. If that is unavailable, it falls back to counting across the whole note.
- *Live Preview / Source, normal text:* the line comes from `cm.posAtDOM(.cm-line)`.
- *Live Preview / Source, tables:* the table's position in the note is found via `cm.posAtDOM`/`posAtCoords`, expanded to the full run of `|` lines, and validated by checking that the tag count matches the rendered table.

**Writing the change.** Editor modes use `editor.replaceRange` (so undo works) followed by `view.save()`. Reading View uses `vault.process`.

**Input events.** Table cells re-render on press, which can swallow a normal click. With a mouse the toggle therefore happens on `pointerdown`; touch and pen use `click`. `mousedown` is suppressed so the cursor does not move.

**Green lines in Live Preview.** A CodeMirror `ViewPlugin` adds the class `cic-done-line-cm` to every line containing `#done`. In Reading View, nodes on the same line as a `#done` tag are wrapped in `span.cic-done-line`.

Tokens inside `` `inline code` `` are ignored when locating tags. The tag regex is `(^|[^\w#/&])#(check|done)(?![\w/-])`, so `#checklist` and `#done/sub` are not matched.

## Known limitations

- A line containing `#done` inside a fenced code block also turns green in Live Preview.
- Notes embedded in other notes (`![[note]]`) may not toggle correctly.
- The plugin uses `editor.cm` (the CodeMirror instance), which Obsidian does not document as public API. A future Obsidian update could break it.
- Row colouring in tables relies on the CSS `:has()` selector (all current Obsidian versions on desktop and mobile support it).
- In Reading View, the fallback path (used only when line info is unavailable) can miscount in very long notes that render lazily.

## Troubleshooting

- **Boxes do not appear:** confirm the plugin is enabled and that `styles.css` is in the plugin folder. Reload the plugin after copying new files.
- **Notice "Checkbox: could not locate this item in the note":** the plugin could not match a rendered table or line to the file. Open the developer console (`Ctrl+Shift+I`, Console tab) and check for red errors; include them in a bug report.
- **Nothing changes in Git:** Obsidian saves shortly after an edit. The plugin also calls `view.save()` immediately. Check that your repo does not ignore the file you edited.
- **Committing the plugin itself:** many setups `.gitignore` `.obsidian/`. If you want this plugin in Git, keep `.obsidian/plugins/custom-inline-checkbox/` tracked, or keep a separate repo containing only the three files above.

## Repository layout

```
.
├── manifest.json
├── main.js
├── styles.css
└── README.md
```

## License

Personal project. Add a license of your choice (for example MIT) before sharing publicly.