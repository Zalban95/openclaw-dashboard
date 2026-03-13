/* ═══════════════════════════════════════════════════════
   OPENCLAW PANEL — CONFIG  (multi-file editor)
   ═══════════════════════════════════════════════════════ */

/* ── File registry ───────────────────────────────────────
   Groups: favorites · core · providers · system
   Each entry: { id, label, path, type: 'json'|'text'|'sh'|'env', description }
──────────────────────────────────────────────────────── */
const CONFIG_FILES = [
  /* ── Favorites ──────────────────────────────────── */
  {
    group: 'favorites', id: 'openclaw',
    label: 'openclaw.json',
    path: '/home/al/.openclaw/openclaw.json',
    type: 'json',
    description: 'Main OpenClaw config — models, providers, tools'
  },
  {
    group: 'favorites', id: 'soul',
    label: 'SOUL.md',
    path: '/home/al/.openclaw/SOUL.md',
    type: 'text',
    description: "Bob's rules and personality definition"
  },
  {
    group: 'favorites', id: 'compose',
    label: 'docker-compose.yml',
    path: '/home/al/openclaw/docker-compose.yml',
    type: 'text',
    description: 'Docker Compose stack definition'
  },

  /* ── Config files ────────────────────────────────── */
  {
    group: 'config', id: 'aider',
    label: '.aider.conf.yml',
    path: '/home/al/.aider.conf.yml',
    type: 'text',
    description: 'Aider defaults — model, API key, flags'
  },
  {
    group: 'config', id: 'env',
    label: '.env',
    path: '/home/al/openclaw/.env',
    type: 'env',
    description: 'Docker env overrides for the stack'
  },
  {
    group: 'config', id: 'modelfile-qwen',
    label: 'Modelfile.qwen-coder',
    path: '/home/al/.ollama/Modelfile.qwen-coder-gpu',
    type: 'text',
    description: 'Ollama Modelfile for qwen-coder-gpu'
  },
  {
    group: 'config', id: 'modelfile-qwen3',
    label: 'Modelfile.qwen3',
    path: '/home/al/.ollama/Modelfile.qwen3',
    type: 'text',
    description: 'Ollama Modelfile for qwen3:30b'
  },

  /* ── Custom / Scripts ────────────────────────────── */
  {
    group: 'custom', id: 'setup',
    label: 'setup-openclaw.sh',
    path: '/home/al/setup-openclaw.sh',
    type: 'sh',
    description: 'Initial setup script'
  },
  {
    group: 'custom', id: 'snapshot',
    label: 'snapshot-agent.sh',
    path: '/home/al/snapshot-agent.sh',
    type: 'sh',
    description: 'Agent snapshot script'
  },
  {
    group: 'custom', id: 'restore',
    label: 'restore-agent.sh',
    path: '/home/al/restore-agent.sh',
    type: 'sh',
    description: 'Agent restore script'
  }
];

const GROUP_LABELS = {
  favorites: '★ Favorites',
  config:    '⚙ Config',
  custom:    '⚡ Scripts'
};

let cfgActive = null; // id of currently open file

/* ── Init: build file list sidebar ──────────────────── */
function initConfig() {
  if (document.getElementById('config-file-list').children.length > 0) {
    // Already built — just reload current file
    if (cfgActive) cfgLoadFile(cfgActive);
    return;
  }
  buildConfigSidebar();
  cfgOpenFile('openclaw'); // default
}

function buildConfigSidebar() {
  const container = document.getElementById('config-file-list');
  const groups    = ['favorites', 'config', 'custom'];

  groups.forEach(grp => {
    const files = CONFIG_FILES.filter(f => f.group === grp);
    if (!files.length) return;

    const section = document.createElement('div');
    section.className = 'config-file-group';

    const label = document.createElement('div');
    label.className   = 'config-file-group-label';
    label.textContent = GROUP_LABELS[grp];
    section.appendChild(label);

    files.forEach(f => {
      const btn = document.createElement('button');
      btn.className        = 'config-file-item';
      btn.id               = `cfgbtn-${f.id}`;
      btn.title            = f.description + '\n' + f.path;
      btn.innerHTML        = `<div class="config-file-name">${f.label}</div>
                               <div class="config-file-path">${f.path}</div>`;
      btn.onclick = () => cfgOpenFile(f.id);
      section.appendChild(btn);
    });

    container.appendChild(section);
  });
}

/* ── Open a file ─────────────────────────────────────── */
async function cfgOpenFile(id) {
  const entry = CONFIG_FILES.find(f => f.id === id);
  if (!entry) return;

  // Update sidebar highlight
  document.querySelectorAll('.config-file-item').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`cfgbtn-${id}`);
  if (btn) btn.classList.add('active');

  cfgActive = id;

  // Update editor header
  document.getElementById('config-editor-filename').textContent = `${entry.label}  —  ${entry.path}`;

  // Load content
  const editor = document.getElementById('config-editor');
  const status = document.getElementById('json-status');
  editor.value = '';
  setStatus(status, 'Loading…', 'info');

  try {
    const data = await apiFetch(`/api/configs/${encodeURIComponent(entry.id)}`);
    editor.value = entry.type === 'json'
      ? (() => { try { return JSON.stringify(JSON.parse(data.content), null, 2); } catch { return data.content; } })()
      : data.content;
    cfgValidate();
  } catch (e) {
    editor.value = `// Error loading file: ${e.message}`;
    setStatus(status, `✗ ${e.message}`, 'err');
  }
}

function cfgLoadFile(id) { cfgOpenFile(id); }

/* ── Validate (JSON only) ────────────────────────────── */
function cfgValidate() {
  const entry  = CONFIG_FILES.find(f => f.id === cfgActive);
  const editor = document.getElementById('config-editor');
  const status = document.getElementById('json-status');

  if (!entry || entry.type !== 'json') {
    editor.classList.remove('err');
    setStatus(status, entry ? `${entry.type} file` : '', '');
    return;
  }
  try {
    JSON.parse(editor.value);
    editor.classList.remove('err');
    setStatus(status, '✓ valid JSON', 'ok');
  } catch (e) {
    editor.classList.add('err');
    setStatus(status, `✗ ${e.message}`, 'err');
  }
}

/* ── Save ────────────────────────────────────────────── */
async function saveConfig() {
  const entry  = CONFIG_FILES.find(f => f.id === cfgActive);
  const editor = document.getElementById('config-editor');
  const status = document.getElementById('json-status');

  if (!entry) return;

  // Validate JSON before saving
  if (entry.type === 'json') {
    try { JSON.parse(editor.value); }
    catch { alert('Fix JSON errors before saving'); return; }
  }

  const needsRestart = entry.id === 'openclaw';
  const msg = needsRestart
    ? `Save ${entry.label} and restart OpenClaw?`
    : `Save ${entry.label}?`;
  if (!confirm(msg)) return;

  try {
    await apiFetch(`/api/configs/${encodeURIComponent(entry.id)}`, {
      method: 'POST',
      body: { content: editor.value }
    });
    setStatus(status, '✓ Saved', 'ok');
    if (needsRestart) await action('restart');
    setTimeout(() => cfgValidate(), 4000);
  } catch (e) {
    setStatus(status, `✗ ${e.message}`, 'err');
  }
}

function reloadConfig() {
  if (cfgActive) cfgOpenFile(cfgActive);
}
