/* ===== Data store: model, persistence, migration, sync ===== */
(function (global) {
  'use strict';

  const KEY = 'wh_data_v2';
  const MTIME = 'wh_data_v2_mtime';
  const SYNC = 'wh_sync_cfg_v1';

  // ---- Reference enums ----
  const STATUSES = [
    { id: 'unpainted', label: 'Unpainted' },
    { id: 'assembled', label: 'Assembled' },
    { id: 'primed', label: 'Primed' },
    { id: 'wip', label: 'WIP' },
    { id: 'done', label: 'Done' },
    { id: 'based', label: 'Based / Finished' },
  ];
  const STATUS_ORDER = STATUSES.reduce((a, s, i) => (a[s.id] = i, a), {});
  const STATUS_LABEL = STATUSES.reduce((a, s) => (a[s.id] = s.label, a), {});

  function uid(prefix) {
    return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function blankData() {
    return {
      version: 2,
      minis: [],       // collection entries
      datasheets: [],  // game stats / points reference
      recipes: [],     // paint recipes
      armyLists: [],   // army list builder
      battles: [],     // battle log
      factions: [],    // faction meta: color scheme, lore
      settings: {},
    };
  }

  let data = load();

  function load() {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        const d = JSON.parse(raw);
        return Object.assign(blankData(), d);
      } catch (_) { /* fall through */ }
    }
    // Migrate from the original v1 single-list tracker, if present.
    const v1 = localStorage.getItem('wh_minis_v1');
    const d = blankData();
    if (v1) {
      try {
        const old = JSON.parse(v1);
        d.minis = old.map(m => ({
          id: m.id || uid('m_'),
          name: m.name || 'Unnamed',
          faction: m.faction || '',
          subfaction: '',
          unitType: '',
          kit: '',
          modelCount: m.qty || 1,
          status: m.status || 'unpainted',
          points: m.points ?? null,
          datasheetId: null,
          recipeId: null,
          photos: [],
          tags: [],
          purchaseDate: '',
          price: null,
          assembly: '',
          basing: '',
          notes: m.notes || '',
          statusHistory: [],
          added: m.added || Date.now(),
          updated: Date.now(),
        }));
      } catch (_) { /* ignore */ }
    }
    return d;
  }

  function persist(skipSync) {
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.setItem(MTIME, String(Date.now()));
    if (!skipSync) Sync.maybeAuto();
    if (typeof global.onStoreChange === 'function') global.onStoreChange();
  }

  // ---- Generic collection CRUD ----
  function list(coll) { return data[coll] || []; }
  function get(coll, id) { return (data[coll] || []).find(x => x.id === id); }
  function upsert(coll, obj) {
    if (!data[coll]) data[coll] = [];
    if (obj.id) {
      const i = data[coll].findIndex(x => x.id === obj.id);
      if (i >= 0) { data[coll][i] = Object.assign({}, data[coll][i], obj, { updated: Date.now() }); persist(); return data[coll][i]; }
    }
    obj.id = obj.id || uid(coll[0] + '_');
    obj.added = obj.added || Date.now();
    obj.updated = Date.now();
    data[coll].push(obj);
    persist();
    return obj;
  }
  function remove(coll, id) {
    if (!data[coll]) return;
    data[coll] = data[coll].filter(x => x.id !== id);
    persist();
  }

  // ---- Derived helpers ----
  function factionNames() {
    const set = new Set();
    data.minis.forEach(m => m.faction && set.add(m.faction));
    data.factions.forEach(f => f.name && set.add(f.name));
    return [...set].sort();
  }

  function paintStats() {
    const counts = {}; STATUSES.forEach(s => counts[s.id] = 0);
    let totalModels = 0;
    data.minis.forEach(m => { counts[m.status] = (counts[m.status] || 0) + (m.modelCount || 1); totalModels += (m.modelCount || 1); });
    return { counts, totalModels };
  }

  function totalPoints() {
    return data.minis.reduce((s, m) => s + (m.points != null ? m.points * (m.modelCount || 1) : 0), 0);
  }

  function collectionValue() {
    return data.minis.reduce((s, m) => s + (m.price != null ? m.price : 0), 0);
  }

  // ---- Import / export ----
  function exportAll() { return JSON.stringify(data, null, 2); }

  function importAll(json, mode) {
    const incoming = typeof json === 'string' ? JSON.parse(json) : json;
    if (mode === 'merge') {
      ['minis', 'datasheets', 'recipes', 'armyLists', 'battles', 'factions'].forEach(coll => {
        if (Array.isArray(incoming[coll])) {
          const existing = new Set((data[coll] || []).map(x => x.id));
          incoming[coll].forEach(x => { if (!existing.has(x.id)) data[coll].push(x); });
        }
      });
    } else {
      data = Object.assign(blankData(), incoming);
    }
    persist();
  }

  // Parse a CSV/TSV roster into mini records. Flexible header mapping.
  function importRosterText(text) {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return 0;
    const delim = lines[0].includes('\t') ? '\t' : ',';
    const headers = splitRow(lines[0], delim).map(h => h.trim().toLowerCase());
    const map = {
      name: ['name', 'unit', 'unit name', 'model'],
      faction: ['faction', 'army'],
      unitType: ['type', 'unit type', 'role'],
      kit: ['kit', 'box', 'set'],
      modelCount: ['qty', 'quantity', 'count', 'models', 'number'],
      status: ['status', 'paint', 'paint status'],
      points: ['points', 'pts', 'cost'],
      notes: ['notes', 'note', 'comment'],
    };
    const idx = {};
    Object.keys(map).forEach(field => {
      idx[field] = headers.findIndex(h => map[field].includes(h));
    });
    // If no recognizable header row, treat every line as a name.
    const hasHeader = Object.values(idx).some(i => i >= 0);
    let added = 0;
    const rows = hasHeader ? lines.slice(1) : lines;
    rows.forEach(line => {
      const cells = splitRow(line, delim);
      const val = f => idx[f] >= 0 ? (cells[idx[f]] || '').trim() : '';
      const name = hasHeader ? val('name') : line.trim();
      if (!name) return;
      const statusRaw = val('status').toLowerCase();
      const status = STATUS_ORDER[statusRaw] != null ? statusRaw : 'unpainted';
      upsert('minis', {
        name,
        faction: val('faction'),
        unitType: val('unitType'),
        kit: val('kit'),
        modelCount: parseInt(val('modelCount')) || 1,
        status,
        points: val('points') ? parseInt(val('points')) : null,
        notes: val('notes'),
        subfaction: '', datasheetId: null, recipeId: null,
        photos: [], tags: [], purchaseDate: '', price: null,
        assembly: '', basing: '', statusHistory: [],
      });
      added++;
    });
    return added;
  }

  function splitRow(line, delim) {
    // Simple CSV split that respects double quotes.
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === delim && !q) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }

  // ---- Cloud sync (Supabase REST, single JSON blob, last-write-wins) ----
  const Sync = {
    cfg: JSON.parse(localStorage.getItem(SYNC) || 'null') || { url: '', key: '', syncKey: '', auto: false },
    timer: null,
    configured() { return !!(this.cfg.url && this.cfg.key && this.cfg.syncKey); },
    saveCfg(cfg) { this.cfg = cfg; localStorage.setItem(SYNC, JSON.stringify(cfg)); },
    mtime() { return parseInt(localStorage.getItem(MTIME) || '0'); },
    headers() { return { apikey: this.cfg.key, Authorization: 'Bearer ' + this.cfg.key, 'Content-Type': 'application/json' }; },
    maybeAuto() { if (this.configured() && this.cfg.auto) { clearTimeout(this.timer); this.timer = setTimeout(() => this.push().catch(() => {}), 1500); } },
    async push() {
      if (!this.configured()) return;
      const body = [{ id: this.cfg.syncKey, data, updated_at: new Date(this.mtime() || Date.now()).toISOString() }];
      const res = await fetch(`${this.cfg.url}/rest/v1/collections?on_conflict=id`, {
        method: 'POST', headers: Object.assign({}, this.headers(), { Prefer: 'resolution=merge-duplicates' }), body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('push ' + res.status + ': ' + (await res.text()));
    },
    async pull() {
      if (!this.configured()) return null;
      const res = await fetch(`${this.cfg.url}/rest/v1/collections?id=eq.${encodeURIComponent(this.cfg.syncKey)}&select=data,updated_at`, { headers: this.headers() });
      if (!res.ok) throw new Error('pull ' + res.status + ': ' + (await res.text()));
      const rows = await res.json();
      return rows.length ? rows[0] : null;
    },
    async syncNow() {
      const remote = await this.pull();
      const rt = remote ? new Date(remote.updated_at).getTime() : 0;
      if (remote && remote.data && rt > this.mtime()) {
        data = Object.assign(blankData(), remote.data);
        localStorage.setItem(KEY, JSON.stringify(data));
        localStorage.setItem(MTIME, String(rt));
        if (typeof global.onStoreChange === 'function') global.onStoreChange();
        return { dir: 'pulled' };
      }
      await this.push();
      return { dir: 'pushed' };
    },
    async init() {
      if (!this.configured()) return;
      try {
        const remote = await this.pull();
        if (!remote || !remote.data) return;
        const rt = new Date(remote.updated_at).getTime();
        if (rt > this.mtime() && JSON.stringify(remote.data) !== JSON.stringify(data)) {
          data = Object.assign(blankData(), remote.data);
          localStorage.setItem(KEY, JSON.stringify(data));
          localStorage.setItem(MTIME, String(rt));
          if (typeof global.onStoreChange === 'function') global.onStoreChange();
        }
      } catch (_) { /* offline */ }
    },
  };

  global.Store = {
    STATUSES, STATUS_ORDER, STATUS_LABEL, uid,
    raw: () => data,
    list, get, upsert, remove,
    factionNames, paintStats, totalPoints, collectionValue,
    exportAll, importAll, importRosterText,
    Sync,
  };
})(window);
