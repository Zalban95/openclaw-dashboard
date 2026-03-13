/* ═══════════════════════════════════════════════════════
   OPENCLAW PANEL — CONTROLS  (start / stop / restart)
   ═══════════════════════════════════════════════════════ */

async function action(act) {
  const st = document.getElementById('action-status');
  setStatus(st, `Running: ${act}…`, 'info');
  const btns = document.querySelectorAll('.btn');
  btns.forEach(b => b.disabled = true);
  try {
    await apiFetch('/api/action', { method: 'POST', body: { action: act } });
    setStatus(st, `✓ ${act} completed`, 'ok');
  } catch (e) {
    setStatus(st, `✗ ${e.message}`, 'err');
  } finally {
    btns.forEach(b => b.disabled = false);
    setTimeout(() => { st.textContent = ''; st.className = 'status-line'; }, 8000);
    setTimeout(pollStatus, 2000);
  }
}
