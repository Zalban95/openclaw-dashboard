/* ═══════════════════════════════════════════════════════
   OPENCLAW PANEL — NAVIGATION
   ═══════════════════════════════════════════════════════ */

const NAV_TABS = ['controls','logs','keys','skills','snapshots','setup','config','files'];

function nav(name) {
  currentTab = name;

  // Update tab buttons
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === name);
  });

  // Update tab pages
  document.querySelectorAll('.tab-page').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${name}`);
  });

  // Lazy-load tab content
  if (name === 'logs'      && !logSource) startLogs();
  if (name === 'keys')     loadKeys();
  if (name === 'skills')   loadSkills();
  if (name === 'snapshots') loadSnapshots();
  if (name === 'setup')    loadScripts();
  if (name === 'config')   initConfig();
  if (name === 'files')    fmInit();

  // Close mobile sidebar when navigating
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
