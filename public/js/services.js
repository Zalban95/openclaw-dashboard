/* ═══════════════════════════════════════════════════════
   OPENCLAW PANEL — INFERENCE SERVICES
   Manages Docker-based inference backends (Whisper, vLLM,
   Stable Diffusion, ComfyUI) with GPU assignment.
   ═══════════════════════════════════════════════════════ */

let _servicesDefs   = [];  // loaded from GET /api/services
let _servicesStatus = {};  // loaded from GET /api/services/status

async function servicesInit() {
  try {
    const data = await apiFetch('/api/services');
    _servicesDefs = data.services || [];
  } catch { _servicesDefs = []; }
  _renderServicesGrid();
  servicesLoadStatus();
}

async function servicesLoadStatus() {
  try {
    const data = await apiFetch('/api/services/status');
    _servicesStatus = data.running || {};
  } catch { _servicesStatus = {}; }
  _updateServicesBadges();
}

/* ── Rendering ──────────────────────────────────────── */

function _renderServicesGrid() {
  const grid = document.getElementById('services-grid');
  if (!grid) return;

  grid.innerHTML = _servicesDefs.map(svc => {
    const isVllm = svc.id === 'vllm';
    return `
    <div class="services-row" id="svc-row-${svc.id}">
      <div class="services-header">
        <span class="badge badge-grey" id="svc-badge-${svc.id}">○ stopped</span>
        <span class="services-label">${svc.label}</span>
        <span class="services-image">${svc.image}</span>
        <span style="flex:1"></span>
        <a id="svc-url-${svc.id}" class="services-url" style="display:none"
           href="http://localhost:${svc.port}" target="_blank">
          http://localhost:${svc.port}
        </a>
      </div>
      <div style="font-size:10px;color:var(--muted);margin:2px 0 6px">${svc.description}</div>
      <div class="services-controls">
        <label class="services-ctrl-label">GPU</label>
        <select class="input services-select" id="svc-gpu-${svc.id}" style="width:130px">
          <option value="0">GPU 0</option>
          <option value="1">GPU 1</option>
          <option value="all">Both GPUs</option>
          <option value="">No GPU (CPU)</option>
        </select>
        ${isVllm ? `
        <label class="services-ctrl-label">Model ID</label>
        <input class="input services-model-input" id="svc-model-${svc.id}"
               placeholder="e.g. meta-llama/Llama-3.2-1B" style="flex:1;min-width:180px">
        ` : ''}
        <button class="btn btn-sm btn-teal"  id="svc-start-${svc.id}" onclick="serviceStart('${svc.id}')">▶ Start</button>
        <button class="btn btn-sm btn-red"   id="svc-stop-${svc.id}"  onclick="serviceStop('${svc.id}')"  style="display:none">■ Stop</button>
      </div>
      <pre class="install-out" id="svc-out-${svc.id}" style="display:none;max-height:160px;margin-top:6px"></pre>
      <div id="svc-api-note-${svc.id}" style="display:none;font-size:10px;color:var(--green);margin-top:4px">
        ✓ Registered in Tool APIs → <strong>${svc.id}</strong>
      </div>
    </div>`;
  }).join('');

  _updateServicesBadges();
}

function _updateServicesBadges() {
  _servicesDefs.forEach(svc => {
    const info     = _servicesStatus[svc.id];
    const running  = info?.state === 'running';
    const badge    = document.getElementById(`svc-badge-${svc.id}`);
    const urlEl    = document.getElementById(`svc-url-${svc.id}`);
    const startBtn = document.getElementById(`svc-start-${svc.id}`);
    const stopBtn  = document.getElementById(`svc-stop-${svc.id}`);

    if (!badge) return;

    if (running) {
      badge.textContent = '● running';
      badge.className   = 'badge badge-green';
      if (urlEl)    urlEl.style.display    = '';
      if (startBtn) startBtn.style.display = 'none';
      if (stopBtn)  stopBtn.style.display  = '';
    } else {
      badge.textContent = '○ stopped';
      badge.className   = 'badge badge-grey';
      if (urlEl)    urlEl.style.display    = 'none';
      if (startBtn) startBtn.style.display = '';
      if (stopBtn)  stopBtn.style.display  = 'none';
    }
  });
}

/* ── Actions ────────────────────────────────────────── */

async function serviceStart(id) {
  const svc     = _servicesDefs.find(s => s.id === id);
  if (!svc) return;
  const gpu     = document.getElementById(`svc-gpu-${id}`)?.value   || '0';
  const modelId = document.getElementById(`svc-model-${id}`)?.value || '';
  const out     = document.getElementById(`svc-out-${id}`);
  const startBtn = document.getElementById(`svc-start-${id}`);
  const apiNote  = document.getElementById(`svc-api-note-${id}`);

  if (out)     { out.style.display = 'block'; out.textContent = `Starting ${svc.label}…\n`; }
  if (startBtn)  startBtn.disabled = true;
  if (apiNote)   apiNote.style.display = 'none';

  try {
    const res = await fetch('/api/services/start', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, gpu, modelId }),
    });
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    const read = async () => {
      const { done, value } = await reader.read();
      if (done) { servicesLoadStatus(); if (startBtn) startBtn.disabled = false; return; }
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      parts.forEach(part => {
        const line = part.trim().replace(/^data:\s*/, '');
        if (!line) return;
        try {
          const obj = JSON.parse(line);
          if (obj.status && out) { out.textContent += obj.status; out.scrollTop = out.scrollHeight; }
          if (obj.done) {
            if (obj.ok && apiNote) apiNote.style.display = '';
            servicesLoadStatus();
            if (startBtn) startBtn.disabled = false;
          }
        } catch {}
      });
      read();
    };
    read();
  } catch (e) {
    if (out) out.textContent += `\nError: ${e.message}`;
    if (startBtn) startBtn.disabled = false;
    servicesLoadStatus();
  }
}

async function serviceStop(id) {
  const stopBtn = document.getElementById(`svc-stop-${id}`);
  if (stopBtn) stopBtn.disabled = true;
  try {
    await apiFetch('/api/services/stop', { method: 'POST', body: { id } });
  } catch (e) {
    const out = document.getElementById(`svc-out-${id}`);
    if (out) { out.style.display = 'block'; out.textContent += `\nStop error: ${e.message}`; }
  }
  if (stopBtn) stopBtn.disabled = false;
  servicesLoadStatus();
}
