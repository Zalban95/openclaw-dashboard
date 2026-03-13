/* ═══════════════════════════════════════════════════════
   OPENCLAW PANEL — CLAUDE CODE MANAGEMENT
   ═══════════════════════════════════════════════════════ */

let claudeRunning  = false;
let claudeHistory  = [];

function claudeInit() {
  claudeCheckStatus();
}

async function claudeCheckStatus() {
  const badge   = document.getElementById('claude-status-badge');
  const version = document.getElementById('claude-version');
  const stopBtn = document.getElementById('claude-stop-btn');

  badge.textContent = 'Checking…';
  badge.className   = 'badge badge-blue';

  try {
    const data = await apiFetch('/api/claude/status');
    if (data.available) {
      badge.textContent = 'Available';
      badge.className   = 'badge badge-green';
      version.textContent = data.version || '';
    } else {
      badge.textContent = 'Not found';
      badge.className   = 'badge badge-red';
      version.textContent = 'claude CLI not in PATH';
    }
    claudeRunning = data.running;
    stopBtn.style.display = data.running ? 'inline-flex' : 'none';
  } catch (e) {
    badge.textContent = 'Error';
    badge.className   = 'badge badge-red';
    version.textContent = e.message;
  }
}

function claudeRun() {
  const input  = document.getElementById('claude-input');
  const output = document.getElementById('claude-output');
  const prompt = input.value.trim();
  if (!prompt) return;

  claudeHistory.push({ prompt, time: new Date().toISOString() });
  renderClaudeHistory();

  input.value = '';
  output.innerHTML = '';

  const promptEl = document.createElement('div');
  promptEl.className = 'claude-prompt-echo';
  promptEl.textContent = `❯ ${prompt}`;
  output.appendChild(promptEl);

  const responseEl = document.createElement('div');
  responseEl.className = 'claude-response';
  output.appendChild(responseEl);

  claudeRunning = true;
  document.getElementById('claude-stop-btn').style.display = 'inline-flex';

  fetch('/api/claude/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  }).then(res => {
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    function read() {
      reader.read().then(({ done, value }) => {
        if (done) {
          claudeRunning = false;
          document.getElementById('claude-stop-btn').style.display = 'none';
          const doneEl = document.createElement('div');
          doneEl.className = 'claude-done';
          doneEl.textContent = '— done —';
          output.appendChild(doneEl);
          return;
        }
        const text = decoder.decode(value);
        text.split('\n').forEach(line => {
          if (!line.startsWith('data: ')) return;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'stdout') {
              responseEl.textContent += evt.text;
            } else if (evt.type === 'stderr') {
              const err = document.createElement('span');
              err.className = 'claude-stderr';
              err.textContent = evt.text;
              responseEl.appendChild(err);
            } else if (evt.type === 'done') {
              claudeHistory[claudeHistory.length - 1].exitCode = evt.code;
            }
          } catch {}
        });
        output.scrollTop = output.scrollHeight;
        read();
      });
    }
    read();
  }).catch(e => {
    responseEl.textContent = `Error: ${e.message}`;
    claudeRunning = false;
    document.getElementById('claude-stop-btn').style.display = 'none';
  });
}

async function claudeStop() {
  try {
    await apiFetch('/api/claude/stop', { method: 'POST' });
    claudeRunning = false;
    document.getElementById('claude-stop-btn').style.display = 'none';
  } catch (e) { alert(`Stop error: ${e.message}`); }
}

function renderClaudeHistory() {
  const el = document.getElementById('claude-history');
  if (!claudeHistory.length) {
    el.innerHTML = '<div class="placeholder">No commands run yet</div>';
    return;
  }
  el.innerHTML = claudeHistory.slice().reverse().map(h => `
    <div class="claude-hist-item fade-in">
      <span class="claude-hist-prompt">${escapeHtmlClaude(h.prompt)}</span>
      <span class="claude-hist-time">${new Date(h.time).toLocaleTimeString('en-GB', { hour12: false })}</span>
      ${h.exitCode !== undefined ? `<span class="badge ${h.exitCode === 0 ? 'badge-green' : 'badge-red'}">${h.exitCode}</span>` : ''}
    </div>
  `).join('');
}

function escapeHtmlClaude(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
