/* ═══════════════════════════════════════════════════════
   OPENCLAW PANEL — SIDEBAR STATUS POLLING
   ═══════════════════════════════════════════════════════ */

async function pollStatus() {
  try {
    const data = await apiFetch('/api/status');
    document.getElementById('dot').className = 'dot on';

    renderContainers(data.containers || []);
    renderGPU(data.gpu || []);
    renderSystem(data.system || null);
    renderModels(data.models || []);

  } catch {
    document.getElementById('dot').className = 'dot';
  }
}

function renderContainers(containers) {
  const el = document.getElementById('s-containers');
  if (!containers.length) {
    el.innerHTML = '<div class="placeholder">None running</div>'; return;
  }
  el.innerHTML = containers.map(c => {
    const st  = (c.State || c.Status || '').toLowerCase();
    const up  = st.includes('running') || st.includes('up');
    const label = (c.Service || c.Name || '').replace('openclaw-openclaw-','').replace(/-1$/, '');
    return `<div class="c-item ${up ? 'running' : 'exited'}">
      <span class="c-name">${label}</span>
      <span class="c-state">${st.split(' ')[0]}</span>
    </div>`;
  }).join('');
}

function renderGPU(gpus) {
  const el = document.getElementById('s-gpu');
  if (!gpus.length) {
    el.innerHTML = '<div class="placeholder">No GPU data</div>'; return;
  }
  el.innerHTML = gpus.map((g, i) => {
    const usedMB  = parseInt(g.memUsed)  || 0;
    const totalMB = parseInt(g.memTotal) || 1;
    const pct = Math.round((usedMB / totalMB) * 100);
    const barColor = pct > 90 ? 'red' : pct > 70 ? 'amber' : 'green';
    return `<div class="gpu-card">
      <div class="gpu-name">GPU ${i} — ${g.name}</div>
      <div class="gpu-grid">
        <div class="gm"><span class="gm-l">Temp</span><span class="gm-v">${g.temp}°C</span></div>
        <div class="gm"><span class="gm-l">Util</span><span class="gm-v">${g.util}%</span></div>
        <div class="gm"><span class="gm-l">VRAM</span><span class="gm-v">${g.memUsed}/${g.memTotal} MB</span></div>
        <div class="gm"><span class="gm-l">Used</span><span class="gm-v">${pct}%</span></div>
        <div class="res-bar"><div class="res-bar-fill ${barColor}" style="width:${pct}%"></div></div>
      </div>
    </div>`;
  }).join('');
}

function renderSystem(sys) {
  const el = document.getElementById('s-system');
  if (!sys) {
    el.innerHTML = '<div class="placeholder">No system data</div>'; return;
  }
  const cpuPct  = Math.round(sys.cpuPct || 0);
  const ramPct  = Math.round((sys.ramUsed / sys.ramTotal) * 100) || 0;
  const cpuColor = cpuPct > 90 ? 'red' : cpuPct > 70 ? 'amber' : 'green';
  const ramColor = ramPct > 90 ? 'red' : ramPct > 70 ? 'amber' : 'blue';

  el.innerHTML = `<div class="sys-card">
    <div class="sys-grid">
      <div class="sys-metric">
        <span class="sys-label">CPU</span>
        <span class="sys-value cpu">${cpuPct}%</span>
      </div>
      <div class="sys-metric">
        <span class="sys-label">Load</span>
        <span class="sys-value cpu">${(sys.load1 || 0).toFixed(2)}</span>
      </div>
      <div class="res-bar"><div class="res-bar-fill ${cpuColor}" style="width:${cpuPct}%"></div></div>

      <div class="sys-metric">
        <span class="sys-label">RAM</span>
        <span class="sys-value ram">${fmtBytes(sys.ramUsed * 1e6)}</span>
      </div>
      <div class="sys-metric">
        <span class="sys-label">Total</span>
        <span class="sys-value ram">${fmtBytes(sys.ramTotal * 1e6)}</span>
      </div>
      <div class="res-bar"><div class="res-bar-fill ${ramColor}" style="width:${ramPct}%"></div></div>
    </div>
  </div>`;
}

function renderModels(models) {
  const el = document.getElementById('s-models');
  if (!models.length) {
    el.innerHTML = '<div class="placeholder">No models loaded</div>'; return;
  }
  el.innerHTML = models.map(m => {
    const name = m.name.replace(/:latest$/, '');
    const size = m.size ? fmtBytes(m.size) : '?';
    return `<div class="model-item">
      <span class="model-name">${name}</span>
      <span class="model-sz">${size}</span>
    </div>`;
  }).join('');
}

// Clock
function startClock() {
  const el = document.getElementById('clock');
  function tick() { el.textContent = new Date().toLocaleTimeString('en-GB', { hour12: false }); }
  tick();
  setInterval(tick, 1000);
}

// Init
setInterval(pollStatus, 5000);
pollStatus();
startClock();
