/* ═══════════════════════════════════════════════════════
   OPENCLAW PANEL — NAVIGATION
   ═══════════════════════════════════════════════════════ */

const NAV_TABS = ['controls','logs','keys','skills','snapshots','setup','config','files','claude','terminal'];

function nav(name) {
  currentTab = name;

  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === name);
  });

  document.querySelectorAll('.tab-page').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${name}`);
  });

  if (name === 'logs'      && !logSource) startLogs();
  if (name === 'keys')     loadKeys();
  if (name === 'skills')   loadSkills();
  if (name === 'snapshots') loadSnapshots();
  if (name === 'setup')    loadScripts();
  if (name === 'config')   initConfig();
  if (name === 'files')    fmInit();
  if (name === 'claude')   claudeInit();
  if (name === 'terminal') termInit();

  closeSidebar();
}

/* ── Mobile sidebar ──────────────────────────────────── */
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.querySelector('.sidebar').classList.toggle('open', sidebarOpen);
  document.getElementById('sidebar-backdrop').classList.toggle('visible', sidebarOpen);
}

function closeSidebar() {
  sidebarOpen = false;
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('visible');
}
