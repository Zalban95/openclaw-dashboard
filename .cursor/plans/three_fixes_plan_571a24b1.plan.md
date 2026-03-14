---
name: Three fixes plan
overview: Fix the huggingface-cli install command, remove the terminal session frame and reduce height, add all-containers list to the Controls tab, and rename OPENCLAW → DOCA in the UI.
todos:
  - id: hf-install-fix
    content: Fix huggingface-cli installCmd to use python3 -m pip instead of pip3
    status: completed
  - id: terminal-frame
    content: Remove border frame from terminal sessions and reduce container height to 220px
    status: completed
  - id: controls-rename
    content: Rename OPENCLAW to DOCA in index.html title and header logo
    status: completed
  - id: controls-containers
    content: Add all-containers list with per-container controls to the Controls tab
    status: completed
isProject: false
---

# Three Fixes

## 1. huggingface-cli install fix

**File:** `[server.js](server.js)`

Change the `installCmd` for `huggingface-cli` in `SYSTEM_TOOLS`:

```
// before
installCmd: 'pip3 install huggingface-hub',

// after
installCmd: 'python3 -m pip install --user huggingface-hub || python3 -m pip install --break-system-packages huggingface-hub',
```

`pip3` is not reliably in PATH; `python3 -m pip` works wherever Python 3 is installed. The fallback handles Debian/Ubuntu 23+ which block global pip installs.

---

## 2. Terminal tab — frameless + smaller height

**File:** `[public/css/terminal.css](public/css/terminal.css)`

- Remove the `border` and `border-radius` from `.term-session-wrap` (the outer box frame disappears, header + terminal render flush)
- Reduce `.term-session-container` height: `280px → 220px` (prevents the xterm vertical scrollbar)
- Keep `.term-session-header` and its "Terminal N" label untouched

---

## 3. Controls tab — add all-containers list + rename OPENCLAW → DOCA

### 3a. Rename

**File:** `[public/index.html](public/index.html)`

- Line 6: `<title>OpenClaw Panel</title>` → `<title>DOCA Panel</title>`
- Line 30: `<div class="logo-name">OPENCLAW</div>` → `<div class="logo-name">DOCA</div>`
- Line 31: `<div class="logo-ver">PANEL v2.1</div>` → keep as-is or change to `DOCA PANEL v2.1` depending on preference

### 3b. All-containers in Controls tab

**File:** `[public/index.html](public/index.html)` — add a second card below "Service Control":

```html
<div class="card">
  <div class="card-title">Containers
    <button class="btn btn-xs" onclick="controlsRefreshContainers()">↺</button>
  </div>
  <div id="controls-containers-list">
    <div class="placeholder pulse">Loading…</div>
  </div>
</div>
```

**File:** `[public/js/controls.js](public/js/controls.js)` — add `controlsInit()` called on tab activation, `controlsRefreshContainers()` fetching `GET /api/docker/containers`, and `controlsContainerAction(id, act)` posting to `POST /api/docker/containers/:id/action`. Each container row shows: name, image, status badge, and Start/Stop/Restart buttons (disabled according to current state).

The `/api/docker/containers` and `/api/docker/containers/:id/action` endpoints already exist in `server.js` — no backend changes needed.