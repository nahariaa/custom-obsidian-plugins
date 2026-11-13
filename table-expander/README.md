# Table Expander (Obsidian plugin)

Adds a small expand/shrink button to the top-right corner of every table (Reading View and Live Preview).

- Default: tables look exactly like normal Obsidian tables, so it works with *Readable line length* turned on.
- Click the button: the table stretches across the full visible width of the pane and its text wraps.
- Click again: it returns to its original size.
- A table stays expanded while you edit it or tick checkboxes in it. This is remembered by note path and header row until Obsidian restarts.

## Install

Copy `manifest.json`, `main.js` and `styles.css` into:

```
<your-vault>/.obsidian/plugins/table-expander/
```

Then enable **Table Expander** under Settings -> Community plugins. Requires Obsidian 1.5.0 or newer.

## Notes

- Two tables in one note with identical header rows expand together.
- Expanded state is not saved across restarts.
- If you added a `wrap-tables.css` snippet earlier, turn it off under Settings -> Appearance -> CSS snippets so it doesn't conflict.