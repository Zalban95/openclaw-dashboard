/* ═══════════════════════════════════════════════════════
   OPENCLAW PANEL — SKILLS (enhanced)
   ═══════════════════════════════════════════════════════ */

let allSkills = [];

async function loadSkills() {
  const grid = document.getElementById('skills-grid');
  grid.innerHTML = '<div class="placeholder pulse">Loading…</div>';
  try {
    const data = await apiFetch('/api/skills');
    allSkills  = data.skills || [];
    renderSkills(allSkills);
  } catch (e) {
    grid.innerHTML = `<div class="placeholder" style="color:var(--red)">${e.message}</div>`;
  }
}

function renderSkills(skills) {
  const grid = document.getElementById('skills-grid');
  if (!skills.length) {
    grid.innerHTML = '<div class="placeholder">No skills installed</div>';
    return;
  }
  grid.innerHTML = skills.map(s => `
    <div class="skill-card fade-in ${s.enabled ? '' : 'disabled'}">
      <div class="skill-card-header">
        <div class="skill-card-name">${s.name}</div>
        <label class="skill-toggle" title="${s.enabled ? 'Disable' : 'Enable'}">
          <input type="checkbox" ${s.enabled ? 'checked' : ''}
                 onchange="toggleSkill('${s.name}', this.checked)">
          <span class="skill-toggle-track"></span>
        </label>
      </div>
      ${s.version ? `<div class="skill-card-ver">v${s.version}</div>` : ''}
      <div class="skill-card-desc">${s.description || '—'}</div>
      <div class="skill-card-footer">
        <button class="skill-card-action" onclick="showSkillDetail('${s.name}')">Details</button>
        <button class="skill-card-del" onclick="removeSkill('${s.name}')">✕ remove</button>
      </div>
    </div>
  `).join('');
}

function filterSkills() {
  const q = (document.getElementById('skill-filter').value || '').toLowerCase().trim();
  if (!q) { renderSkills(allSkills); return; }
  renderSkills(allSkills.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.description || '').toLowerCase().includes(q)
  ));
}

async function toggleSkill(name, enable) {
  try {
    await apiFetch(`/api/skills/${name}/toggle`, { method: 'POST' });
    loadSkills();
  } catch (e) { alert(`Toggle error: ${e.message}`); loadSkills(); }
}

async function showSkillDetail(name) {
  const overlay = document.getElementById('skill-detail-overlay');
  const title   = document.getElementById('skill-detail-title');
  const body    = document.getElementById('skill-detail-body');

  title.textContent = name;
  body.innerHTML = '<div class="placeholder pulse">Loading…</div>';
  overlay.style.display = 'flex';

  try {
    const data = await apiFetch(`/api/skills/${name}`);
    let html = '';

    html += `<div class="skill-detail-meta">`;
    html += `<span class="badge ${data.enabled ? 'badge-green' : 'badge-red'}">${data.enabled ? 'ENABLED' : 'DISABLED'}</span>`;
    if (data.version) html += ` <span class="badge badge-blue">v${data.version}</span>`;
    html += `</div>`;

    if (data.description) {
      html += `<p style="color:var(--text);font-size:12px;margin:10px 0">${data.description}</p>`;
    }

    if (data.readme) {
      html += `<div class="skill-detail-section">README</div>`;
      html += `<pre class="skill-detail-readme">${escapeHtml(data.readme)}</pre>`;
    }

    if (data.files && data.files.length) {
      html += `<div class="skill-detail-section">Files (${data.files.length})</div>`;
      html += `<div class="skill-detail-files">`;
      data.files.forEach(f => {
        const icon = f.isDir ? '📁' : '📄';
        const size = f.isDir ? '' : fmtBytes(f.size);
        html += `<div class="skill-detail-file"><span>${icon} ${f.name}</span><span class="text-muted">${size}</span></div>`;
      });
      html += `</div>`;
    }

    html += `<div style="margin-top:12px;font-size:10px;color:var(--muted)">Path: ${data.path}</div>`;
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = `<div class="placeholder" style="color:var(--red)">${e.message}</div>`;
  }
}

function closeSkillDetail(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('skill-detail-overlay').style.display = 'none';
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function installSkill(force) {
  const name = document.getElementById('skill-input').value.trim();
  if (!name) return;
  const out = document.getElementById('install-out');
  out.textContent = '';
  out.style.display = 'block';

  fetch('/api/skills/install', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skill: name, force })
  }).then(res => {
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    function read() {
      reader.read().then(({ done, value }) => {
        if (done) { loadSkills(); return; }
        decoder.decode(value).split('\n').forEach(line => {
          if (line.startsWith('data: ')) {
            try { out.textContent += JSON.parse(line.slice(6)); } catch {}
          }
        });
        out.scrollTop = out.scrollHeight;
        read();
      });
    }
    read();
  }).catch(e => { out.textContent += `\nError: ${e.message}`; });
}

async function removeSkill(name) {
  if (!confirm(`Remove skill: ${name}?`)) return;
  try {
    await apiFetch(`/api/skills/${name}`, { method: 'DELETE' });
    loadSkills();
  } catch (e) { alert(`Error: ${e.message}`); }
}
