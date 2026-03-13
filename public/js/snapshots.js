/* ═══════════════════════════════════════════════════════
   OPENCLAW PANEL — SNAPSHOTS
   ═══════════════════════════════════════════════════════ */

async function loadSnapshots() {
  const list = document.getElementById('snap-list');
  try {
    const data  = await apiFetch('/api/snapshots');
    const snaps = data.snapshots || [];
    if (!snaps.length) {
      list.innerHTML = '<div class="placeholder">No snapshots yet</div>'; return;
    }
    list.innerHTML = snaps.map(s => `
      <div class="snap-item fade-in">
        <div>
          <div class="snap-name">${s.name}</div>
          <div class="snap-date">${fmtDate(s.created)}</div>
        </div>
        <div class="snap-actions">
          <button class="btn btn-sm btn-amber" onclick="restoreSnapshot('${s.name}')">↺ Restore</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = `<div class="placeholder" style="color:var(--red)">${e.message}</div>`;
  }
}

function createSnapshot() {
  const label = document.getElementById('snap-label').value.trim();
  const out   = document.getElementById('snap-out');
  out.textContent     = 'Creating snapshot…\n';
  out.style.display   = 'block';

  fetch('/api/snapshots/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label })
  })
    .then(res => streamToEl(res, out, () => loadSnapshots()))
    .catch(e  => { out.textContent += `\nError: ${e.message}`; });
}

function restoreSnapshot(name) {
  if (!confirm(`Restore snapshot: ${name}?\nThis will overwrite current config.`)) return;
  const out = document.getElementById('snap-out');
  out.textContent   = `Restoring ${name}…\n`;
  out.style.display = 'block';

  fetch('/api/snapshots/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
    .then(res => streamToEl(res, out, null))
    .catch(e  => { out.textContent += `\nError: ${e.message}`; });
}
