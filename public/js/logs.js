/* ═══════════════════════════════════════════════════════
   OPENCLAW PANEL — LOGS  (SSE streaming)
   ═══════════════════════════════════════════════════════ */

function startLogs() {
  if (logSource) logSource.close();
  logSource = new EventSource('/api/logs?tail=200');
  logSource.onmessage = e => appendLog(JSON.parse(e.data));
  logSource.onerror = () => {
    appendLog('[panel] stream disconnected — retrying…');
    logSource.close(); logSource = null;
    setTimeout(startLogs, 4000);
  };
  const st = document.getElementById('log-status');
  setStatus(st, 'streaming', 'ok');
}

function appendLog(line) {
  const out = document.getElementById('log-out');
  const el = document.createElement('span');
  el.className = 'll';
  const l = line.toLowerCase();
  if (l.includes('error') || l.includes('err:') || l.includes('[stderr]')) el.classList.add('e');
  else if (l.includes('warn')) el.classList.add('w');
  else if (l.includes('info')) el.classList.add('i');
  el.textContent = line + '\n';
  out.appendChild(el);
  while (out.children.length > 3000) out.removeChild(out.firstChild);
  if (autoScroll) out.scrollTop = out.scrollHeight;
}

function clearLogs() { document.getElementById('log-out').innerHTML = ''; }

function toggleScroll() {
  autoScroll = !autoScroll;
  document.getElementById('scroll-btn').textContent = `Autoscroll ${autoScroll ? 'ON' : 'OFF'}`;
}
