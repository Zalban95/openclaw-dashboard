/**
 * OPENCLAW PANEL — server.js
 * Modules: status, action, logs, config (multi-file), keys, skills, setup, snapshots, files
 */
'use strict';

const express = require('express');
const { exec, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Paths ──────────────────────────────────────────────────────────────────
const COMPOSE_DIR     = process.env.COMPOSE_DIR     || '/home/al/openclaw';
const CONFIG_PATH     = process.env.CONFIG_PATH     || '/home/al/.openclaw/openclaw.json';
const SKILLS_DIR      = process.env.SKILLS_DIR      || '/home/al/.openclaw/workspace/skills';
const WORKSPACE_DIR   = process.env.WORKSPACE_DIR   || '/home/al/.openclaw/workspace';
const SETUP_DIR       = process.env.SETUP_DIR       || '/home/al';
const SNAPSHOT_SCRIPT = process.env.SNAPSHOT_SCRIPT || '/home/al/snapshot-agent.sh';
const RESTORE_SCRIPT  = process.env.RESTORE_SCRIPT  || '/home/al/restore-agent.sh';
const SNAPSHOT_DIR    = process.env.SNAPSHOT_DIR    || '/media/al/NewVolume/openclaw-snapshots';
const PORT            = process.env.PORT            || 4242;

// ─── Multi-file config registry ──────────────────────────────────────────────
const CONFIG_REGISTRY = {
  openclaw:          CONFIG_PATH,
  soul:              '/home/al/.openclaw/SOUL.md',
  compose:           '/home/al/openclaw/docker-compose.yml',
  aider:             '/home/al/.aider.conf.yml',
  env:               '/home/al/openclaw/.env',
  'modelfile-qwen':  '/home/al/.ollama/Modelfile.qwen-coder-gpu',
  'modelfile-qwen3': '/home/al/.ollama/Modelfile.qwen3',
  setup:             '/home/al/setup-openclaw.sh',
  snapshot:          '/home/al/snapshot-agent.sh',
  restore:           '/home/al/restore-agent.sh',
};

// ─── File manager allowed roots ───────────────────────────────────────────────
const FM_ALLOWED_ROOTS = [
  '/home/al',
  '/media/al',
  '/tmp',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function run(cmd, cwd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: cwd || COMPOSE_DIR, timeout: 60000 }, (err, stdout, stderr) => {
      if (err) reject({ error: err.message, stderr, stdout });
      else resolve({ stdout, stderr });
    });
  });
}

function sseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

/** Return true if path is within an allowed root */
function fmSafe(p) {
  const abs = path.resolve(p);
  return FM_ALLOWED_ROOTS.some(root => abs === root || abs.startsWith(root + '/'));
}

// ─── STATUS ──────────────────────────────────────────────────────────────────
app.get('/api/status', async (req, res) => {
  const [composeResult, gpuResult, ollamaResult] = await Promise.allSettled([
    run('docker compose ps --format json'),
    run('nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits'),
    run('curl -s http://localhost:11434/api/tags'),
  ]);

  // Containers
  let containers = [];
  if (composeResult.status === 'fulfilled') {
    containers = composeResult.value.stdout.trim().split('\n')
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  }

  // GPU
  let gpu = null;
  if (gpuResult.status === 'fulfilled') {
    gpu = gpuResult.value.stdout.trim().split('\n').map(l => {
      const p = l.split(', ').map(s => s.trim());
      return { name: p[0], temp: p[1], util: p[2], memUsed: p[3], memTotal: p[4] };
    });
  }

  // CPU + RAM via os module (always available, no extra binary)
  const cpus   = os.cpus();
  const loadAvg = os.loadavg();
  // Simple busy% from CPU info
  let totalIdle = 0, totalTick = 0;
  cpus.forEach(cpu => {
    for (const type in cpu.times) totalTick += cpu.times[type];
    totalIdle += cpu.times.idle;
  });
  const cpuPct = Math.round((1 - totalIdle / totalTick) * 100);
  const ramTotal = Math.round(os.totalmem() / 1e6);  // MB
  const ramUsed  = Math.round((os.totalmem() - os.freemem()) / 1e6);

  const system = {
    cpuPct,
    load1:  Math.round(loadAvg[0] * 100) / 100,
    load5:  Math.round(loadAvg[1] * 100) / 100,
    ramUsed,
    ramTotal,
  };

  // Ollama models
  let models = [];
  if (ollamaResult.status === 'fulfilled') {
    try {
      const data = JSON.parse(ollamaResult.value.stdout);
      models = (data.models || []).map(m => ({ name: m.name, size: m.size }));
    } catch {}
  }

  res.json({ containers, gpu, system, models, time: new Date().toISOString() });
});

// ─── ACTIONS ─────────────────────────────────────────────────────────────────
app.post('/api/action', async (req, res) => {
  const { action } = req.body;
  const cmds = {
    start:   'docker compose up -d',
    stop:    'docker compose down',
    restart: 'docker compose down && docker compose up -d',
  };
  if (!cmds[action]) return res.status(400).json({ error: 'Unknown action' });
  try {
    const result = await run(cmds[action]);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.error || e.message, stderr: e.stderr });
  }
});

// ─── LOGS SSE ────────────────────────────────────────────────────────────────
app.get('/api/logs', (req, res) => {
  sseHeaders(res);
  const tail  = req.query.tail || '100';
  const child = spawn('docker', ['compose', 'logs', '--follow', '--tail', tail], { cwd: COMPOSE_DIR });
  const emit  = line => line && res.write(`data: ${JSON.stringify(line)}\n\n`);
  child.stdout.on('data', d => d.toString().split('\n').forEach(emit));
  child.stderr.on('data', d => d.toString().split('\n').forEach(l => emit(l && '[stderr] ' + l)));
  req.on('close', () => child.kill());
});

// ─── MULTI-FILE CONFIG ────────────────────────────────────────────────────────

// GET /api/configs/:id  — read any registered config file
app.get('/api/configs/:id', (req, res) => {
  const filePath = CONFIG_REGISTRY[req.params.id];
  if (!filePath) return res.status(404).json({ error: 'Unknown config id' });
  try {
    const content = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, 'utf8')
      : '';
    res.json({ content, path: filePath });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/configs/:id  — write a registered config file
app.post('/api/configs/:id', (req, res) => {
  const filePath = CONFIG_REGISTRY[req.params.id];
  if (!filePath) return res.status(404).json({ error: 'Unknown config id' });
  const { content } = req.body;
  if (content === undefined) return res.status(400).json({ error: 'No content' });
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(filePath)) fs.copyFileSync(filePath, filePath + '.bak');
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ ok: true, backup: filePath + '.bak' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Legacy: GET /api/config  (keeps old panel working during transition)
app.get('/api/config', (req, res) => {
  try { res.json({ config: fs.readFileSync(CONFIG_PATH, 'utf8') }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/config', (req, res) => {
  const { config } = req.body;
  if (!config) return res.status(400).json({ error: 'No config provided' });
  try {
    JSON.parse(config);
    fs.copyFileSync(CONFIG_PATH, CONFIG_PATH + '.bak');
    fs.writeFileSync(CONFIG_PATH, config, 'utf8');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API KEYS ─────────────────────────────────────────────────────────────────
app.get('/api/keys', (req, res) => {
  try {
    const cfg       = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const providers = cfg?.models?.providers || {};
    const result    = {};
    for (const [name, p] of Object.entries(providers)) {
      const key = p.apiKey || '';
      result[name] = {
        baseUrl:      p.baseUrl || '',
        apiKeyMasked: key && key !== 'ollama'
          ? key.slice(0, 4) + '••••••••' + key.slice(-4)
          : key,
        hasKey: !!key && key !== 'ollama',
        models: (p.models || []).map(m => m.id || m.name || m),
      };
    }
    res.json({ providers: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/keys', (req, res) => {
  const { provider, apiKey, baseUrl } = req.body;
  if (!provider) return res.status(400).json({ error: 'provider required' });
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (!cfg.models) cfg.models = {};
    if (!cfg.models.providers) cfg.models.providers = {};
    if (!cfg.models.providers[provider])
      cfg.models.providers[provider] = { api: 'openai-responses', models: [] };
    if (apiKey)  cfg.models.providers[provider].apiKey  = apiKey;
    if (baseUrl) cfg.models.providers[provider].baseUrl = baseUrl;
    fs.copyFileSync(CONFIG_PATH, CONFIG_PATH + '.bak');
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/keys/add-provider', (req, res) => {
  const { name, baseUrl, apiKey, api, models: pm } = req.body;
  if (!name || !baseUrl) return res.status(400).json({ error: 'name and baseUrl required' });
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (!cfg.models) cfg.models = {};
    if (!cfg.models.providers) cfg.models.providers = {};
    cfg.models.providers[name] = { baseUrl, apiKey: apiKey || '', api: api || 'openai-responses', models: pm || [] };
    fs.copyFileSync(CONFIG_PATH, CONFIG_PATH + '.bak');
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/keys/:name', (req, res) => {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (cfg?.models?.providers?.[req.params.name])
      delete cfg.models.providers[req.params.name];
    fs.copyFileSync(CONFIG_PATH, CONFIG_PATH + '.bak');
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── SKILLS ───────────────────────────────────────────────────────────────────
app.get('/api/skills', (req, res) => {
  try {
    if (!fs.existsSync(SKILLS_DIR)) return res.json({ skills: [] });
    const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    const skills  = entries.filter(e => e.isDirectory()).map(e => {
      const sp = path.join(SKILLS_DIR, e.name);
      let description = '', version = '';
      for (const fname of ['package.json', 'skill.json', 'manifest.json']) {
        const fp = path.join(sp, fname);
        if (fs.existsSync(fp)) {
          try { const d = JSON.parse(fs.readFileSync(fp, 'utf8')); description = d.description || ''; version = d.version || ''; }
          catch {}
          break;
        }
      }
      if (!description) {
        for (const fname of ['README.md', 'readme.md']) {
          const fp = path.join(sp, fname);
          if (fs.existsSync(fp)) {
            const lines = fs.readFileSync(fp, 'utf8').split('\n');
            description = lines.find(l => l.trim() && !l.startsWith('#'))?.slice(0, 120) || '';
            break;
          }
        }
      }
      return { name: e.name, version, description };
    });
    res.json({ skills });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/skills/install', (req, res) => {
  const { skill, force } = req.body;
  if (!skill || !/^[\w-]+$/.test(skill)) return res.status(400).json({ error: 'Invalid skill name' });
  sseHeaders(res);
  const cmd   = `npx clawhub install ${skill}${force ? ' --force' : ''}`;
  const child = spawn('bash', ['-c', cmd], { cwd: WORKSPACE_DIR });
  child.stdout.on('data', d => res.write(`data: ${JSON.stringify(d.toString())}\n\n`));
  child.stderr.on('data', d => res.write(`data: ${JSON.stringify(d.toString())}\n\n`));
  child.on('close', code => { res.write(`data: ${JSON.stringify(`[exit ${code}]`)}\n\n`); res.end(); });
  req.on('close', () => child.kill());
});

app.delete('/api/skills/:name', (req, res) => {
  const name = req.params.name;
  if (!/^[\w-]+$/.test(name)) return res.status(400).json({ error: 'Invalid name' });
  const sp = path.join(SKILLS_DIR, name);
  if (!fs.existsSync(sp)) return res.status(404).json({ error: 'Not found' });
  try { fs.rmSync(sp, { recursive: true, force: true }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── SETUP SCRIPTS ────────────────────────────────────────────────────────────
const ALLOWED_SCRIPTS = ['setup-openclaw.sh', 'setup-phase2.sh', 'snapshot-agent.sh', 'restore-agent.sh'];

app.get('/api/setup/scripts', (req, res) => {
  const scripts = ALLOWED_SCRIPTS.map(name => {
    const fullPath = path.join(SETUP_DIR, name);
    const exists   = fs.existsSync(fullPath);
    let size = 0, modified = null;
    if (exists) { const s = fs.statSync(fullPath); size = s.size; modified = s.mtime.toISOString(); }
    return { name, exists, size, modified };
  });
  res.json({ scripts });
});

app.get('/api/setup/scripts/:name', (req, res) => {
  if (!ALLOWED_SCRIPTS.includes(req.params.name)) return res.status(403).json({ error: 'Not allowed' });
  const fp = path.join(SETUP_DIR, req.params.name);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Not found' });
  res.json({ content: fs.readFileSync(fp, 'utf8') });
});

app.post('/api/setup/scripts/:name', (req, res) => {
  if (!ALLOWED_SCRIPTS.includes(req.params.name)) return res.status(403).json({ error: 'Not allowed' });
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'No content' });
  const fp = path.join(SETUP_DIR, req.params.name);
  try {
    if (fs.existsSync(fp)) fs.copyFileSync(fp, fp + '.bak');
    fs.writeFileSync(fp, content, 'utf8');
    fs.chmodSync(fp, 0o755);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── SNAPSHOTS ────────────────────────────────────────────────────────────────
app.get('/api/snapshots', (req, res) => {
  try {
    if (!fs.existsSync(SNAPSHOT_DIR)) return res.json({ snapshots: [] });
    const entries = fs.readdirSync(SNAPSHOT_DIR, { withFileTypes: true });
    const snapshots = entries.filter(e => e.isDirectory()).map(e => {
      const s = fs.statSync(path.join(SNAPSHOT_DIR, e.name));
      return { name: e.name, created: s.mtime.toISOString() };
    }).sort((a, b) => b.created.localeCompare(a.created));
    res.json({ snapshots });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/snapshots/create', (req, res) => {
  const { label } = req.body;
  sseHeaders(res);
  const child = spawn('bash', [SNAPSHOT_SCRIPT, ...(label ? [label] : [])]);
  child.stdout.on('data', d => res.write(`data: ${JSON.stringify(d.toString())}\n\n`));
  child.stderr.on('data', d => res.write(`data: ${JSON.stringify(d.toString())}\n\n`));
  child.on('close', code => { res.write(`data: ${JSON.stringify(`[exit ${code}]`)}\n\n`); res.end(); });
  req.on('close', () => child.kill());
});

app.post('/api/snapshots/restore', (req, res) => {
  const { name } = req.body;
  if (!name || !/^[\w.\-]+$/.test(name)) return res.status(400).json({ error: 'Invalid snapshot name' });
  sseHeaders(res);
  const child = spawn('bash', [RESTORE_SCRIPT, name]);
  child.stdout.on('data', d => res.write(`data: ${JSON.stringify(d.toString())}\n\n`));
  child.stderr.on('data', d => res.write(`data: ${JSON.stringify(d.toString())}\n\n`));
  child.on('close', code => { res.write(`data: ${JSON.stringify(`[exit ${code}]`)}\n\n`); res.end(); });
  req.on('close', () => child.kill());
});

// ─── FILE MANAGER ─────────────────────────────────────────────────────────────

// GET /api/files/list?path=...
app.get('/api/files/list', (req, res) => {
  const dirPath = req.query.path;
  if (!dirPath || !fmSafe(dirPath)) return res.status(403).json({ error: 'Path not allowed' });
  try {
    if (!fs.existsSync(dirPath)) return res.status(404).json({ error: 'Not found' });
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return res.status(400).json({ error: 'Not a directory' });

    const names   = fs.readdirSync(dirPath);
    const entries = names.map(name => {
      try {
        const full = path.join(dirPath, name);
        const s    = fs.statSync(full);
        return {
          name,
          isDir: s.isDirectory(),
          size:  s.isDirectory() ? null : s.size,
          mtime: s.mtime.toISOString(),
          mode:  s.mode.toString(8),
        };
      } catch { return { name, isDir: false, size: null, mtime: null, mode: null }; }
    });
    res.json({ entries, path: dirPath });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/files/read?path=...
app.get('/api/files/read', (req, res) => {
  const filePath = req.query.path;
  if (!filePath || !fmSafe(filePath)) return res.status(403).json({ error: 'Path not allowed' });
  try {
    const s = fs.statSync(filePath);
    if (s.isDirectory()) return res.status(400).json({ error: 'Is a directory' });
    if (s.size > 2 * 1024 * 1024) return res.status(413).json({ error: 'File too large (>2MB)' });
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ content, size: s.size, mtime: s.mtime.toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/files/write  { path, content }
app.post('/api/files/write', (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || !fmSafe(filePath)) return res.status(403).json({ error: 'Path not allowed' });
  if (content === undefined) return res.status(400).json({ error: 'No content' });
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/files/rename  { from, to }
app.post('/api/files/rename', (req, res) => {
  const { from, to } = req.body;
  if (!from || !to || !fmSafe(from) || !fmSafe(to)) return res.status(403).json({ error: 'Path not allowed' });
  try { fs.renameSync(from, to); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/files/delete  { paths: [] }
app.post('/api/files/delete', (req, res) => {
  const { paths } = req.body;
  if (!Array.isArray(paths) || !paths.every(p => fmSafe(p))) return res.status(403).json({ error: 'Path not allowed' });
  const errors = [];
  paths.forEach(p => {
    try { fs.rmSync(p, { recursive: true, force: true }); }
    catch (e) { errors.push(`${p}: ${e.message}`); }
  });
  if (errors.length) return res.status(207).json({ ok: false, errors });
  res.json({ ok: true });
});

// POST /api/files/mkdir  { path }
app.post('/api/files/mkdir', (req, res) => {
  const { path: dirPath } = req.body;
  if (!dirPath || !fmSafe(dirPath)) return res.status(403).json({ error: 'Path not allowed' });
  try { fs.mkdirSync(dirPath, { recursive: true }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/files/paste  { op: 'copy'|'cut', paths: [], dest }
app.post('/api/files/paste', (req, res) => {
  const { op, paths, dest } = req.body;
  if (!dest || !fmSafe(dest) || !Array.isArray(paths)) return res.status(403).json({ error: 'Invalid request' });
  if (!paths.every(p => fmSafe(p))) return res.status(403).json({ error: 'Source path not allowed' });

  const errors = [];
  paths.forEach(src => {
    try {
      const base = path.basename(src);
      let target = path.join(dest, base);
      // Avoid overwrite: append _copy suffix
      if (fs.existsSync(target) && src !== target) {
        const ext  = path.extname(base);
        const name = path.basename(base, ext);
        target = path.join(dest, `${name}_copy${ext}`);
      }
      if (op === 'cut') {
        fs.renameSync(src, target);
      } else {
        // Recursive copy
        function cpRecurse(s, d) {
          const st = fs.statSync(s);
          if (st.isDirectory()) {
            fs.mkdirSync(d, { recursive: true });
            fs.readdirSync(s).forEach(f => cpRecurse(path.join(s, f), path.join(d, f)));
          } else {
            fs.copyFileSync(s, d);
          }
        }
        cpRecurse(src, target);
      }
    } catch (e) { errors.push(`${src}: ${e.message}`); }
  });

  if (errors.length) return res.status(207).json({ ok: false, errors });
  res.json({ ok: true });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`OpenClaw Panel v2 → http://0.0.0.0:${PORT}`);
});
