/* ═══════════════════════════════════════════════════════
   OPENCLAW PANEL — SKILLS
   ═══════════════════════════════════════════════════════ */

async function loadSkills() {
  const grid = document.getElementById('skills-grid');
  grid.innerHTML = '<div class="placeholder pulse">Loading…</div>';
  try {
    const data   = await apiFetch('/api/skills');
    const skills = data.skills || [];
    if (!skills.length) {
      grid.innerHTML = '<div class="placeholder">No skills installed</div>'; return;
    }
    grid.innerHTML = skills.map(s => `
      <div class="skill-card fade-in">
        <div class="skill-card-name">${s.name}</div>
        ${s.version ? `<div class="skill-card-ver">v${s.version}</div>` : ''}
        <div class="skill-card-desc">${s.description || '—'}</div>
        <button class="skill-card-del" onclick="removeSkill('${s.name}')">✕ remove</button>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = `<div class="placeholder" style="color:var(--red)">${e.message}</div>`;
  }
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
