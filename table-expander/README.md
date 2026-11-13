/* Expand / shrink button, top-right corner of every table */
.cic-te-wrap {
    position: relative;
}

.cic-te-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 5;
    width: 24px;
    height: 24px;
    min-width: 0;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    box-shadow: none;
    color: var(--text-muted);
    opacity: 0.45;
    cursor: pointer;
    transition: opacity 0.12s ease;
}
.cic-te-wrap:hover .cic-te-btn { opacity: 0.8; }
.cic-te-btn:hover {
    opacity: 1 !important;
    color: var(--text-normal);
    background: var(--background-modifier-hover);
}
.cic-te-btn svg { width: 14px; height: 14px; }

/* Expanded: full pane width, text wraps so nothing needs sideways scrolling */
.cic-te-expanded {
    max-width: none !important;
    box-sizing: border-box;
    overflow-x: auto;
}
.cic-te-expanded table {
    width: 100%;
}
.cic-te-expanded td,
.cic-te-expanded th {
    white-space: normal !important;
    overflow-wrap: break-word;
}