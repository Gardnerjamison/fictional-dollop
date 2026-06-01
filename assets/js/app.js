/* ===== App: routing + views ===== */
(function () {
  'use strict';
  const S = window.Store;
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const TABS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'collection', label: 'Collection', coll: 'minis' },
    { id: 'painting', label: 'Painting' },
    { id: 'army', label: 'Army Builder', coll: 'armyLists' },
    { id: 'battles', label: 'Battle Log', coll: 'battles' },
    { id: 'reference', label: 'Reference', coll: 'datasheets' },
    { id: 'settings', label: 'Settings' },
  ];

  let route = (location.hash.replace('#', '') || 'dashboard');
  const filters = { search: '', faction: '', status: '', sort: 'added' };

  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- Nav ----------
  function renderNav() {
    const nav = $('#nav');
    nav.innerHTML = TABS.map(t => {
      const count = t.coll ? S.list(t.coll).length : 0;
      const badge = t.coll && count ? `<span class="badge">${count}</span>` : '';
      return `<button data-route="${t.id}" class="${route === t.id ? 'active' : ''}">${t.label}${badge}</button>`;
    }).join('');
    nav.querySelectorAll('button').forEach(b => b.onclick = () => { location.hash = b.dataset.route; });
  }

  function go(r) { route = r; renderNav(); render(); window.scrollTo(0, 0); }

  // ---------- Render dispatch ----------
  function render() {
    const v = { dashboard, collection, painting, army, battles, reference, settings }[route] || dashboard;
    $('#view').innerHTML = v();
    if (afterRender[route]) afterRender[route]();
  }
  const afterRender = {};

  // ================= DASHBOARD =================
  function dashboard() {
    const { counts, totalModels } = S.paintStats();
    const minis = S.list('minis');
    const pts = S.totalPoints();
    const value = S.collectionValue();
    const pct = s => totalModels ? ((counts[s] / totalModels) * 100).toFixed(1) : 0;
    const painted = counts.done + counts.based;
    const battles = S.list('battles');
    const wins = battles.filter(b => b.result === 'win').length;

    const recent = [...minis].sort((a, b) => b.updated - a.updated).slice(0, 6);

    return `
      <div class="section-head"><h2>Dashboard</h2><span class="sub">${minis.length} units · ${totalModels} models</span></div>
      <div class="stat-grid">
        <div class="stat-card"><div class="num">${minis.length}</div><div class="lbl">Units</div></div>
        <div class="stat-card blue"><div class="num">${totalModels}</div><div class="lbl">Models</div></div>
        <div class="stat-card done"><div class="num">${painted}</div><div class="lbl">Painted</div></div>
        <div class="stat-card gold"><div class="num">${pts.toLocaleString()}</div><div class="lbl">Total Points</div></div>
        <div class="stat-card"><div class="num">${value ? '$' + value.toLocaleString() : '—'}</div><div class="lbl">Collection Value</div></div>
        <div class="stat-card accent"><div class="num">${battles.length}</div><div class="lbl">Games (${wins}W)</div></div>
      </div>
      ${totalModels ? `
      <div class="progress-section">
        <div class="progress-label"><span>Painting Progress</span><span>${painted} / ${totalModels} finished (${pct('done') * 1 + pct('based') * 1 ? (((counts.done + counts.based) / totalModels) * 100).toFixed(0) : 0}%)</span></div>
        <div class="progress-bar">
          <div class="pb-based" style="width:${pct('based')}%"></div>
          <div class="pb-done" style="width:${pct('done')}%"></div>
          <div class="pb-wip" style="width:${pct('wip')}%"></div>
          <div class="pb-primed" style="width:${pct('primed')}%"></div>
          <div class="pb-assembled" style="width:${pct('assembled')}%"></div>
          <div class="pb-unpainted" style="width:${pct('unpainted')}%"></div>
        </div>
      </div>` : ''}
      <div class="section-head"><h3 style="color:var(--gold)">Recently updated</h3></div>
      <div class="grid">
        ${recent.length ? recent.map(miniCard).join('') : '<div class="empty"><div class="big">🎲</div><p>No minis yet. Head to Collection to add some, or import a roster in Settings.</p></div>'}
      </div>`;
  }
  afterRender.dashboard = () => bindMiniCards();

  // ================= COLLECTION =================
  function collection() {
    let minis = S.list('minis').slice();
    const f = filters;
    if (f.faction) minis = minis.filter(m => m.faction === f.faction);
    if (f.status) minis = minis.filter(m => m.status === f.status);
    if (f.search) {
      const q = f.search.toLowerCase();
      minis = minis.filter(m => m.name.toLowerCase().includes(q) || (m.faction || '').toLowerCase().includes(q) || (m.tags || []).some(t => t.toLowerCase().includes(q)));
    }
    minis.sort((a, b) => {
      if (f.sort === 'name') return a.name.localeCompare(b.name);
      if (f.sort === 'faction') return (a.faction || '').localeCompare(b.faction || '') || a.name.localeCompare(b.name);
      if (f.sort === 'status') return S.STATUS_ORDER[a.status] - S.STATUS_ORDER[b.status];
      if (f.sort === 'points') return (b.points || 0) - (a.points || 0);
      return b.added - a.added;
    });
    const fOpts = S.factionNames().map(n => `<option value="${esc(n)}" ${f.faction === n ? 'selected' : ''}>${esc(n)}</option>`).join('');
    const sOpts = S.STATUSES.map(s => `<option value="${s.id}" ${f.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('');

    return `
      <div class="section-head">
        <h2>Collection</h2>
        <button class="btn-primary" id="addMini">+ Add Unit</button>
      </div>
      <div class="filters">
        <input type="search" id="fSearch" placeholder="Search name, faction, tag…" value="${esc(f.search)}" />
        <select id="fFaction"><option value="">All Factions</option>${fOpts}</select>
        <select id="fStatus"><option value="">All Statuses</option>${sOpts}</select>
        <select id="fSort">
          <option value="added"${f.sort==='added'?' selected':''}>Recently added</option>
          <option value="name"${f.sort==='name'?' selected':''}>Name</option>
          <option value="faction"${f.sort==='faction'?' selected':''}>Faction</option>
          <option value="status"${f.sort==='status'?' selected':''}>Status</option>
          <option value="points"${f.sort==='points'?' selected':''}>Points</option>
        </select>
      </div>
      <div class="grid">
        ${minis.length ? minis.map(miniCard).join('') : `<div class="empty"><div class="big">⚔️</div><p>${S.list('minis').length ? 'No units match your filters.' : 'No units yet — add your first or import a roster from Settings.'}</p></div>`}
      </div>`;
  }
  afterRender.collection = () => {
    $('#addMini').onclick = () => openMiniModal();
    $('#fSearch').oninput = e => { filters.search = e.target.value; render(); $('#fSearch').focus(); const el = $('#fSearch'); el.setSelectionRange(el.value.length, el.value.length); };
    $('#fFaction').onchange = e => { filters.faction = e.target.value; render(); };
    $('#fStatus').onchange = e => { filters.status = e.target.value; render(); };
    $('#fSort').onchange = e => { filters.sort = e.target.value; render(); };
    bindMiniCards();
  };

  function miniCard(m) {
    const ds = m.datasheetId ? S.get('datasheets', m.datasheetId) : null;
    return `
      <div class="card" data-id="${m.id}">
        ${m.photos && m.photos[0] ? `<img class="card-thumb" src="${esc(m.photos[0])}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
        <div class="card-top">
          <div class="card-name">${esc(m.name)}</div>
          <span class="chip">×${m.modelCount || 1}</span>
        </div>
        ${m.faction ? `<div class="card-faction">${esc(m.faction)}${m.unitType ? ' · ' + esc(m.unitType) : ''}</div>` : ''}
        <div class="card-meta">
          <span class="status-badge status-${m.status}">${S.STATUS_LABEL[m.status] || m.status}</span>
          ${m.points != null ? `<span class="chip">${m.points * (m.modelCount || 1)} pts</span>` : ''}
          ${ds ? `<span class="chip">📋 ${esc(ds.name)}</span>` : ''}
        </div>
        ${(m.tags && m.tags.length) ? `<div class="tag-list">${m.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        ${m.notes ? `<div class="card-notes">${esc(m.notes)}</div>` : ''}
        <div class="card-actions">
          <button class="btn-secondary btn-sm act-edit">Edit</button>
          <button class="btn-ghost btn-sm act-cycle" title="Advance paint status">▸ Status</button>
          <button class="btn-danger btn-sm act-del">Delete</button>
        </div>
      </div>`;
  }

  function bindMiniCards() {
    document.querySelectorAll('.card[data-id]').forEach(card => {
      const id = card.dataset.id;
      const edit = card.querySelector('.act-edit');
      const del = card.querySelector('.act-del');
      const cycle = card.querySelector('.act-cycle');
      if (edit) edit.onclick = () => openMiniModal(id);
      if (del) del.onclick = () => { const m = S.get('minis', id); if (confirm(`Delete "${m.name}"?`)) { S.remove('minis', id); toast('Deleted'); render(); renderNav(); } };
      if (cycle) cycle.onclick = () => {
        const m = S.get('minis', id);
        const order = S.STATUSES.map(s => s.id);
        const next = order[(order.indexOf(m.status) + 1) % order.length];
        S.upsert('minis', { id, status: next, statusHistory: (m.statusHistory || []).concat([{ status: next, at: Date.now() }]) });
        toast('→ ' + S.STATUS_LABEL[next]); render();
      };
    });
  }

  // ================= PAINTING =================
  function painting() {
    const { counts, totalModels } = S.paintStats();
    const recipes = S.list('recipes');
    const queue = S.list('minis').filter(m => m.status === 'wip' || m.status === 'primed');
    const pct = s => totalModels ? ((counts[s] / totalModels) * 100).toFixed(1) : 0;
    return `
      <div class="section-head"><h2>Painting</h2><button class="btn-primary" id="addRecipe">+ Paint Recipe</button></div>
      <div class="stat-grid">
        ${S.STATUSES.map(s => `<div class="stat-card"><div class="num">${counts[s.id] || 0}</div><div class="lbl">${s.label}</div></div>`).join('')}
      </div>
      <div class="progress-section">
        <div class="progress-label"><span>Overall</span><span>${((counts.done + counts.based) / (totalModels || 1) * 100).toFixed(0)}% finished</span></div>
        <div class="progress-bar">
          <div class="pb-based" style="width:${pct('based')}%"></div><div class="pb-done" style="width:${pct('done')}%"></div>
          <div class="pb-wip" style="width:${pct('wip')}%"></div><div class="pb-primed" style="width:${pct('primed')}%"></div>
          <div class="pb-assembled" style="width:${pct('assembled')}%"></div><div class="pb-unpainted" style="width:${pct('unpainted')}%"></div>
        </div>
      </div>
      <div class="section-head"><h3 style="color:var(--gold)">On the workbench (${queue.length})</h3></div>
      <div class="grid">${queue.length ? queue.map(miniCard).join('') : '<div class="empty"><p class="muted">Nothing primed or in progress. Cycle a unit\'s status in Collection to add it here.</p></div>'}</div>
      <div class="section-head" style="margin-top:28px"><h3 style="color:var(--gold)">Paint Recipes (${recipes.length})</h3></div>
      <div class="grid">
        ${recipes.length ? recipes.map(r => `
          <div class="card">
            <div class="card-name">${esc(r.name)}</div>
            ${r.coversFactions && r.coversFactions.length ? `<div class="card-faction">${esc(r.coversFactions.join(', '))}</div>` : ''}
            ${(r.steps || []).length ? `<ol style="margin-left:16px;font-size:0.84rem;color:var(--muted);display:flex;flex-direction:column;gap:3px">${r.steps.map(s => `<li><b style="color:var(--text)">${esc(s.stage || '')}</b>${s.paint ? ' — ' + esc(s.paint) : ''}${s.technique ? ' <i>(' + esc(s.technique) + ')</i>' : ''}</li>`).join('')}</ol>` : '<div class="muted" style="font-size:0.84rem">No steps yet.</div>'}
            <div class="card-actions"><button class="btn-secondary btn-sm" data-rid="${r.id}">Edit</button><button class="btn-danger btn-sm" data-rdel="${r.id}">Delete</button></div>
          </div>`).join('') : '<div class="empty"><p class="muted">No recipes yet. Add your go-to schemes so you never forget a triad again.</p></div>'}
      </div>`;
  }
  afterRender.painting = () => {
    $('#addRecipe').onclick = () => openRecipeModal();
    bindMiniCards();
    document.querySelectorAll('[data-rid]').forEach(b => b.onclick = () => openRecipeModal(b.dataset.rid));
    document.querySelectorAll('[data-rdel]').forEach(b => b.onclick = () => { if (confirm('Delete recipe?')) { S.remove('recipes', b.dataset.rdel); render(); renderNav(); } });
  };

  // ================= ARMY BUILDER =================
  function army() {
    const lists = S.list('armyLists');
    return `
      <div class="section-head"><h2>Army Builder</h2><button class="btn-primary" id="addList">+ New List</button></div>
      <div class="grid">
        ${lists.length ? lists.map(L => {
          const total = (L.units || []).reduce((s, u) => {
            const m = S.get('minis', u.miniId); const ds = u.datasheetId ? S.get('datasheets', u.datasheetId) : null;
            const pp = (m && m.points) || (ds && ds.points) || 0; return s + pp * (u.count || 1);
          }, 0);
          const over = L.pointsLimit && total > L.pointsLimit;
          return `<div class="card">
            <div class="card-top"><div class="card-name">${esc(L.name)}</div><span class="chip" style="${over ? 'color:var(--accent2);border-color:var(--accent2)' : ''}">${total}${L.pointsLimit ? '/' + L.pointsLimit : ''} pts</span></div>
            ${L.faction ? `<div class="card-faction">${esc(L.faction)}${L.detachment ? ' · ' + esc(L.detachment) : ''}</div>` : ''}
            <div class="muted" style="font-size:0.84rem">${(L.units || []).length} entries</div>
            ${L.notes ? `<div class="card-notes">${esc(L.notes)}</div>` : ''}
            <div class="card-actions"><button class="btn-secondary btn-sm" data-lid="${L.id}">Edit</button><button class="btn-danger btn-sm" data-ldel="${L.id}">Delete</button></div>
          </div>`;
        }).join('') : '<div class="empty"><div class="big">📜</div><p>No army lists yet. Build one from your collection and it\'ll total points and flag when you go over.</p></div>'}
      </div>`;
  }
  afterRender.army = () => {
    $('#addList').onclick = () => openListModal();
    document.querySelectorAll('[data-lid]').forEach(b => b.onclick = () => openListModal(b.dataset.lid));
    document.querySelectorAll('[data-ldel]').forEach(b => b.onclick = () => { if (confirm('Delete list?')) { S.remove('armyLists', b.dataset.ldel); render(); renderNav(); } });
  };

  // ================= BATTLE LOG =================
  function battles() {
    const list = S.list('battles').slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const w = list.filter(b => b.result === 'win').length, l = list.filter(b => b.result === 'loss').length, d = list.filter(b => b.result === 'draw').length;
    return `
      <div class="section-head"><h2>Battle Log</h2><button class="btn-primary" id="addBattle">+ Log Game</button></div>
      <div class="stat-grid">
        <div class="stat-card done"><div class="num">${w}</div><div class="lbl">Wins</div></div>
        <div class="stat-card accent"><div class="num">${l}</div><div class="lbl">Losses</div></div>
        <div class="stat-card"><div class="num">${d}</div><div class="lbl">Draws</div></div>
        <div class="stat-card gold"><div class="num">${list.length ? Math.round(w / list.length * 100) : 0}%</div><div class="lbl">Win Rate</div></div>
      </div>
      ${list.length ? `<table><thead><tr><th>Date</th><th>Mission</th><th>Opponent</th><th>Result</th><th>Score</th><th></th></tr></thead>
        <tbody>${list.map(b => `<tr>
          <td>${esc(b.date || '')}</td><td>${esc(b.mission || '')}</td>
          <td>${esc(b.opponent || '')}${b.opponentFaction ? ` <span class="muted">(${esc(b.opponentFaction)})</span>` : ''}</td>
          <td><span class="status-badge status-${b.result === 'win' ? 'done' : b.result === 'loss' ? 'wip' : 'primed'}">${esc((b.result || '').toUpperCase())}</span></td>
          <td>${esc(b.score || '')}</td>
          <td><button class="btn-secondary btn-sm" data-bid="${b.id}">Edit</button> <button class="btn-danger btn-sm" data-bdel="${b.id}">✕</button></td>
        </tr>`).join('')}</tbody></table>` : '<div class="empty"><div class="big">🛡️</div><p>No games logged yet. Record results to track your win rate and which lists perform.</p></div>'}`;
  }
  afterRender.battles = () => {
    $('#addBattle').onclick = () => openBattleModal();
    document.querySelectorAll('[data-bid]').forEach(b => b.onclick = () => openBattleModal(b.dataset.bid));
    document.querySelectorAll('[data-bdel]').forEach(b => b.onclick = () => { if (confirm('Delete game?')) { S.remove('battles', b.dataset.bdel); render(); renderNav(); } });
  };

  // ================= REFERENCE (datasheets) =================
  const refFilters = { search: '', faction: '' };

  function statBlock(st) {
    if (!st) return '';
    const keys = ['M', 'T', 'Sv', 'W', 'Ld', 'OC'];
    const hasAny = keys.some(k => st[k]);
    if (!hasAny) return '';
    return `<div class="stat-block">${keys.map(k => `<div class="sb-cell"><div class="sb-val">${esc(st[k] || '—')}</div><div class="sb-key">${k}</div></div>`).join('')}</div>`;
  }

  function weaponTable(weapons) {
    if (!weapons || !weapons.length) return '';
    return `<div class="weapons-section">
      <table class="weapons-table">
        <thead><tr><th>Weapon</th><th>Range</th><th>A</th><th>BS/WS</th><th>S</th><th>AP</th><th>D</th><th class="wep-abil">Abilities</th></tr></thead>
        <tbody>${weapons.map(w => `<tr class="${w.type === 'Melee' ? 'wep-melee' : 'wep-ranged'}">
          <td><span class="wep-name">${esc(w.name)}</span>${w.type ? `<span class="wep-type">${esc(w.type)}</span>` : ''}</td>
          <td>${esc(w.range || '—')}</td><td>${esc(w.attacks || '—')}</td><td>${esc(w.skill || '—')}</td>
          <td>${esc(w.strength || '—')}</td><td>${esc(w.ap || '—')}</td><td>${esc(w.damage || '—')}</td>
          <td class="wep-abil">${esc(w.abilities || '')}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
  }

  function reference() {
    let ds = S.list('datasheets').slice().sort((a, b) => (a.faction || '').localeCompare(b.faction || '') || a.name.localeCompare(b.name));
    const rf = refFilters;
    const factions = [...new Set(ds.map(d => d.faction).filter(Boolean))].sort();
    if (rf.faction) ds = ds.filter(d => d.faction === rf.faction);
    if (rf.search) { const q = rf.search.toLowerCase(); ds = ds.filter(d => d.name.toLowerCase().includes(q) || (d.faction || '').toLowerCase().includes(q) || (d.keywords || []).some(k => k.toLowerCase().includes(q))); }

    const fOpts = factions.map(f => `<option value="${esc(f)}" ${rf.faction === f ? 'selected' : ''}>${esc(f)}</option>`).join('');
    return `
      <div class="section-head"><h2>Reference · Datasheets</h2><button class="btn-primary" id="addDs">+ Datasheet</button></div>
      <div class="filters">
        <input type="search" id="rfSearch" placeholder="Search name, faction, keyword…" value="${esc(rf.search)}" />
        <select id="rfFaction"><option value="">All Factions</option>${fOpts}</select>
      </div>
      ${ds.length ? ds.map(d => `<div class="ds-card">
        <div class="ds-card-head">
          <div>
            <div class="card-name">${esc(d.name)}</div>
            ${d.faction ? `<div class="card-faction">${esc(d.faction)}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            ${d.points != null ? `<span class="chip pts-chip">${d.points} pts</span>` : ''}
            ${d.tiers && d.tiers.length > 1 ? `<div class="card-meta" style="justify-content:flex-end">${d.tiers.map(t => `<span class="chip">${t.models}m → ${t.points}</span>`).join('')}</div>` : ''}
            ${d.source === 'mfm' ? '<span class="muted" style="font-size:0.7rem">MFM v4.3</span>' : ''}
          </div>
        </div>
        ${statBlock(d.stats)}
        ${weaponTable(d.weapons)}
        ${d.keywords && d.keywords.length ? `<div class="tag-list" style="margin-top:6px">${d.keywords.map(k => `<span class="tag">${esc(k)}</span>`).join('')}</div>` : ''}
        ${d.abilities ? `<div class="card-notes" style="margin-top:6px">${esc(d.abilities)}</div>` : ''}
        <div class="card-actions"><button class="btn-secondary btn-sm" data-did="${d.id}">Edit</button><button class="btn-danger btn-sm" data-ddel="${d.id}">Delete</button></div>
      </div>`).join('') : '<div class="empty"><div class="big">📋</div><p>No datasheets yet. Add unit stats/points or import them in Settings.</p></div>'}`;
  }
  afterRender.reference = () => {
    $('#addDs').onclick = () => openDatasheetModal();
    $('#rfSearch').oninput = e => { refFilters.search = e.target.value; render(); const el = $('#rfSearch'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); };
    $('#rfFaction').onchange = e => { refFilters.faction = e.target.value; render(); };
    document.querySelectorAll('[data-did]').forEach(b => b.onclick = () => openDatasheetModal(b.dataset.did));
    document.querySelectorAll('[data-ddel]').forEach(b => b.onclick = () => { if (confirm('Delete datasheet?')) { S.remove('datasheets', b.dataset.ddel); render(); renderNav(); } });
  };

  // ================= SETTINGS =================
  function settings() {
    const c = S.Sync.cfg;
    return `
      <div class="section-head"><h2>Settings</h2></div>
      <div class="card" style="margin-bottom:16px">
        <h3>Backup</h3>
        <p class="muted" style="font-size:0.82rem;margin-bottom:10px">Download everything as a file, or restore from one. Your data lives in this browser.</p>
        <div class="form-row"><button class="btn-secondary" id="expBtn">⬇ Export JSON</button>
          <button class="btn-secondary" id="impBtn">⬆ Import JSON</button>
          <input type="file" id="impFile" accept="application/json,.json" class="hidden">
        </div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <h3>Official points · Munitorum Field Manual v4.3</h3>
        <p class="muted" style="font-size:0.82rem;margin-bottom:10px">Load datasheets with current points <b>plus full stat lines (M/T/Sv/W/Ld/OC) and weapon profiles</b> for the armies you play. Pick factions (or load all ${S.officialFactions().length}). Already loaded an army before this update? Just re-run it to pull in the stats &amp; weapons.</p>
        <select id="mfmFactions" multiple size="6" style="height:auto">
          ${S.officialFactions().map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}
        </select>
        <div class="form-row" style="margin-top:10px">
          <button class="btn-gold" id="mfmLoad">Load selected</button>
          <button class="btn-secondary" id="mfmAll">Load all factions</button>
        </div>
        <div id="mfmStatus" class="muted" style="font-size:0.82rem;margin-top:10px"></div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <h3>Import roster (CSV / text)</h3>
        <p class="muted" style="font-size:0.82rem;margin-bottom:10px">Paste a spreadsheet/CSV (headers like name, faction, qty, status, points, notes) or just a list of unit names — one per line.</p>
        <textarea id="rosterText" placeholder="name,faction,qty,status,points&#10;Intercessors,Space Marines,5,unpainted,80"></textarea>
        <div class="form-row" style="margin-top:10px"><button class="btn-gold" id="rosterBtn">Import units</button></div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <h3>🤖 AI model recognition</h3>
        <p class="muted" style="font-size:0.82rem;margin-bottom:10px">Snap or upload a photo of a mini and Claude will identify the unit and faction for you. Your key is stored only in this browser and sent only to Anthropic.</p>
        <div class="field"><label>Anthropic API key</label><input type="password" id="aiKey" value="${esc(localStorage.getItem('wh_ai_key') || '')}" placeholder="sk-ant-…" autocomplete="off"></div>
        <div class="form-row"><button class="btn-secondary" id="aiSave">Save key</button></div>
        <div id="aiStatus" class="muted" style="font-size:0.82rem;margin-top:8px"></div>
      </div>
        <p class="muted" style="font-size:0.82rem;margin-bottom:10px">Share one collection across devices. Same sync key everywhere. One-time SQL setup below.</p>
        <div class="field"><label>Supabase URL</label><input type="text" id="sbUrl" value="${esc(c.url)}" placeholder="https://xxxx.supabase.co"></div>
        <div class="field"><label>Anon key</label><input type="text" id="sbKey" value="${esc(c.key)}" placeholder="eyJ…"></div>
        <div class="field"><label>Sync key (shared phrase)</label><input type="text" id="sbSyncKey" value="${esc(c.syncKey)}" placeholder="my-grimdark-army"></div>
        <label style="display:flex;align-items:center;gap:7px;text-transform:none;margin:6px 0 12px"><input type="checkbox" id="sbAuto" ${c.auto ? 'checked' : ''} style="width:auto"> Auto-sync on every change</label>
        <div class="form-row"><button class="btn-secondary" id="sbSave">Save</button><button class="btn-primary" id="sbSync">⇅ Sync now</button></div>
        <div id="sbStatus" class="muted" style="font-size:0.82rem;margin-top:10px"></div>
        <details style="margin-top:12px;font-size:0.8rem"><summary style="cursor:pointer">One-time database setup (SQL)</summary>
          <pre style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:10px;margin-top:8px;overflow-x:auto;font-size:0.74rem">create table if not exists collections (
  id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table collections enable row level security;
create policy "anon access" on collections
  for all to anon using (true) with check (true);</pre></details>
      </div>`;
  }
  afterRender.settings = () => {
    $('#expBtn').onclick = () => {
      const blob = new Blob([S.exportAll()], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `warhammer-data-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
    };
    $('#impBtn').onclick = () => $('#impFile').click();
    $('#impFile').onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const r = new FileReader();
      r.onload = () => { try { const mode = confirm('OK = replace everything. Cancel = merge into current data.') ? 'replace' : 'merge'; S.importAll(r.result, mode); toast('Imported'); renderNav(); render(); } catch (err) { alert('Bad file: ' + err.message); } };
      r.readAsText(file); e.target.value = '';
    };
    const loadMfm = (factions) => {
      const r = S.importOfficialPoints(factions);
      $('#mfmStatus').textContent = `Loaded ${r.added} new + refreshed ${r.updated} datasheet(s).`;
      $('#mfmStatus').style.color = 'var(--done)'; renderNav();
    };
    $('#mfmLoad').onclick = () => {
      const sel = [...$('#mfmFactions').selectedOptions].map(o => o.value);
      if (!sel.length) { $('#mfmStatus').textContent = 'Pick at least one faction (or use Load all).'; $('#mfmStatus').style.color = 'var(--accent2)'; return; }
      loadMfm(sel);
    };
    $('#mfmAll').onclick = () => { if (confirm(`Load all ${S.officialFactions().length} factions (${(window.POINTS_DATA||[]).length} datasheets)?`)) loadMfm(null); };
    $('#rosterBtn').onclick = () => {
      const txt = $('#rosterText').value; if (!txt.trim()) return;
      try { const n = S.importRosterText(txt); toast(`Added ${n} unit(s)`); $('#rosterText').value = ''; renderNav(); } catch (err) { alert('Could not parse: ' + err.message); }
    };
    const status = (m, ok) => { const el = $('#sbStatus'); el.textContent = m; el.style.color = ok === false ? 'var(--accent2)' : ok ? 'var(--done)' : 'var(--muted)'; };
    $('#sbSave').onclick = () => {
      S.Sync.saveCfg({ url: $('#sbUrl').value.trim().replace(/\/+$/, ''), key: $('#sbKey').value.trim(), syncKey: $('#sbSyncKey').value.trim(), auto: $('#sbAuto').checked });
      status(S.Sync.configured() ? 'Saved.' : 'Fill all three fields to enable sync.', S.Sync.configured());
    };
    const aiSt = (m, ok) => { const el = $('#aiStatus'); el.textContent = m; el.style.color = ok === false ? 'var(--accent2)' : ok ? 'var(--done)' : 'var(--muted)'; };
    $('#aiSave').onclick = () => {
      const k = $('#aiKey').value.trim();
      if (!k) { localStorage.removeItem('wh_ai_key'); aiSt('Key cleared.', null); return; }
      if (!k.startsWith('sk-ant-')) { aiSt('Key should start with sk-ant-…', false); return; }
      localStorage.setItem('wh_ai_key', k); aiSt('Key saved.', true);
    };
    $('#sbSync').onclick = async () => {
      S.Sync.saveCfg({ url: $('#sbUrl').value.trim().replace(/\/+$/, ''), key: $('#sbKey').value.trim(), syncKey: $('#sbSyncKey').value.trim(), auto: $('#sbAuto').checked });
      if (!S.Sync.configured()) { status('Fill all three fields first.', false); return; }
      status('Syncing…');
      try { const r = await S.Sync.syncNow(); status(r.dir === 'pulled' ? 'Pulled latest from cloud.' : 'Pushed to cloud.', true); renderNav(); render(); } catch (e) { status('Error: ' + e.message, false); }
    };
  };

  // ================= MODALS =================
  function modal(html, wide) {
    const o = document.createElement('div'); o.className = 'modal-overlay open';
    o.innerHTML = `<div class="modal${wide ? ' wide' : ''}">${html}</div>`;
    o.onclick = e => { if (e.target === o) close(); };
    document.body.appendChild(o);
    function close() { o.remove(); }
    o._close = close;
    return o;
  }

  function openMiniModal(id) {
    const m = id ? S.get('minis', id) : {};
    const dsOpts = S.list('datasheets').map(d => `<option value="${d.id}" ${m.datasheetId === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
    const recOpts = S.list('recipes').map(r => `<option value="${r.id}" ${m.recipeId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
    const statusOpts = S.STATUSES.map(s => `<option value="${s.id}" ${m.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('');
    const o = modal(`
      <h2>${id ? 'Edit Unit' : 'Add Unit'}</h2>
      ${!id && localStorage.getItem('wh_ai_key') ? `
      <div id="aiRecogBox" style="margin-bottom:14px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px">
        <div style="font-size:0.78rem;color:var(--gold);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:7px">AI Model Recognition</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn-gold btn-sm" id="aiCamera">📷 Take photo</button>
          <button class="btn-secondary btn-sm" id="aiUpload">🖼 Upload image</button>
          <input type="file" id="aiFile" accept="image/*" capture="environment" class="hidden">
          <span id="aiRecogStatus" class="muted" style="font-size:0.8rem"></span>
        </div>
        <div id="aiPreviewWrap" style="margin-top:8px;display:none"><img id="aiPreview" style="max-height:120px;border-radius:6px;border:1px solid var(--border)"></div>
      </div>` : ''}
      <div class="form-row">
        <div class="field" style="flex:2">
          <label>Unit name *</label>
          <input type="text" id="mName" value="${esc(m.name || '')}" autocomplete="off" placeholder="Start typing a unit name…">
        </div>
        <div class="field"><label>Models</label><input type="number" id="mQty" min="1" value="${m.modelCount || 1}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Faction</label><input type="text" id="mFaction" list="facList" value="${esc(m.faction || '')}"><datalist id="facList">${S.factionNames().map(n => `<option value="${esc(n)}">`).join('')}</datalist></div>
        <div class="field"><label>Sub-faction</label><input type="text" id="mSub" value="${esc(m.subfaction || '')}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Paint status</label><select id="mStatus">${statusOpts}</select></div>
        <div class="field"><label>Points (per model)</label><input type="number" id="mPoints" min="0" value="${m.points ?? ''}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Datasheet</label><select id="mDs"><option value="">— none —</option>${dsOpts}</select></div>
        <div class="field"><label>Paint recipe</label><select id="mRec"><option value="">— none —</option>${recOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Purchase date</label><input type="date" id="mDate" value="${esc(m.purchaseDate)}"></div>
        <div class="field"><label>Price paid</label><input type="number" id="mPrice" min="0" step="0.01" value="${m.price ?? ''}"></div>
      </div>
      <div class="field"><label>Photo URLs (comma-separated)</label><input type="text" id="mPhotos" value="${esc((m.photos || []).join(', '))}"></div>
      <div class="field"><label>Tags (comma-separated)</label><input type="text" id="mTags" value="${esc((m.tags || []).join(', '))}"></div>
      <div class="field"><label>Assembly notes</label><textarea id="mAssembly">${esc(m.assembly)}</textarea></div>
      <div class="field"><label>Basing</label><input type="text" id="mBasing" value="${esc(m.basing)}"></div>
      <div class="field"><label>Notes</label><textarea id="mNotes">${esc(m.notes)}</textarea></div>
      <div class="modal-actions"><button class="btn-secondary" id="mCancel">Cancel</button><button class="btn-primary" id="mSave">Save</button></div>
    `);
    o.querySelector('#mCancel').onclick = o._close;

    // ---- Unit name autocomplete (dropdown rendered on body so the modal can't clip it) ----
    const allUnits = window.POINTS_DATA || [];
    const nameInput = o.querySelector('#mName');
    const drop = document.createElement('div');
    drop.className = 'ac-drop';
    o.appendChild(drop); // inside overlay → removed with the modal; position:fixed escapes clipping
    let acIdx = -1, curHits = [];

    function closeDrop() { drop.classList.remove('open'); drop.innerHTML = ''; acIdx = -1; }
    function position() {
      const r = nameInput.getBoundingClientRect();
      drop.style.left = r.left + 'px';
      drop.style.top = (r.bottom) + 'px';
      drop.style.width = r.width + 'px';
    }
    function fillFromUnit(u) {
      nameInput.value = u.name;
      o.querySelector('#mFaction').value = u.faction || '';
      const pts = u.tiers && u.tiers[0] ? u.tiers[0].points : null;
      if (pts != null) o.querySelector('#mPoints').value = pts;
      const ds = S.list('datasheets').find(d => d.name === u.name && d.faction === u.faction);
      if (ds) o.querySelector('#mDs').value = ds.id;
      closeDrop();
    }
    function highlight() { drop.querySelectorAll('.ac-item').forEach((el, i) => el.classList.toggle('ac-active', i === acIdx)); }
    function showDrop(q) {
      if (!q) return closeDrop();
      const ql = q.toLowerCase();
      curHits = allUnits.filter(u => u.name.toLowerCase().includes(ql)).slice(0, 12);
      if (!curHits.length) return closeDrop();
      drop.innerHTML = curHits.map((u, i) => `<div class="ac-item" data-i="${i}"><span class="ac-name">${esc(u.name)}</span><span class="ac-fac">${esc(u.faction)}</span></div>`).join('');
      position(); drop.classList.add('open'); acIdx = -1;
      drop.querySelectorAll('.ac-item').forEach((el, i) => { el.onmousedown = e => { e.preventDefault(); fillFromUnit(curHits[i]); }; });
    }

    nameInput.addEventListener('input', () => showDrop(nameInput.value.trim()));
    nameInput.addEventListener('focus', () => { if (nameInput.value.trim()) showDrop(nameInput.value.trim()); });
    nameInput.addEventListener('keydown', e => {
      if (!curHits.length || !drop.classList.contains('open')) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); acIdx = Math.min(acIdx + 1, curHits.length - 1); highlight(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); acIdx = Math.max(acIdx - 1, 0); highlight(); }
      else if (e.key === 'Enter' && acIdx >= 0) { e.preventDefault(); fillFromUnit(curHits[acIdx]); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDrop(); }
    });
    nameInput.addEventListener('blur', () => setTimeout(closeDrop, 150));
    const repos = () => { if (drop.classList.contains('open')) position(); };
    o.querySelector('.modal').addEventListener('scroll', repos, true);

    nameInput.focus();

    // ---- AI recognition ----
    const aiCam = o.querySelector('#aiCamera');
    const aiUpBtn = o.querySelector('#aiUpload');
    const aiFile = o.querySelector('#aiFile');
    if (aiCam && aiUpBtn && aiFile) {
      const aiStat = o.querySelector('#aiRecogStatus');
      const aiPrev = o.querySelector('#aiPreview');
      const aiPrevWrap = o.querySelector('#aiPreviewWrap');

      async function recognise(file) {
        const key = localStorage.getItem('wh_ai_key');
        if (!key) return;
        aiStat.textContent = 'Recognising…'; aiStat.style.color = 'var(--muted)';
        // Show preview
        const previewUrl = URL.createObjectURL(file);
        aiPrev.src = previewUrl; aiPrevWrap.style.display = '';
        // Convert to base64
        const b64 = await new Promise((res, rej) => {
          const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file);
        });
        const mediaType = file.type || 'image/jpeg';
        try {
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 120,
              messages: [{
                role: 'user',
                content: [
                  { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
                  { type: 'text', text: 'This is a Warhammer 40,000 miniature. Identify the unit name and faction. Reply with exactly two lines:\nUnit: <unit name>\nFaction: <faction name>\nIf you cannot identify it, reply: Unit: Unknown\nFaction: Unknown' }
                ]
              }]
            })
          });
          if (!resp.ok) { const t = await resp.text(); throw new Error(resp.status + ': ' + t.slice(0, 120)); }
          const data = await resp.json();
          const text = data.content[0].text.trim();
          const unitM = text.match(/Unit:\s*(.+)/i);
          const facM = text.match(/Faction:\s*(.+)/i);
          const unitName = unitM ? unitM[1].trim() : '';
          const faction = facM ? facM[1].trim() : '';
          if (!unitName || unitName.toLowerCase() === 'unknown') {
            aiStat.textContent = 'Could not identify — try a clearer photo.'; aiStat.style.color = 'var(--accent2)'; return;
          }
          aiStat.textContent = `Identified: ${unitName} (${faction})`; aiStat.style.color = 'var(--done)';
          // Try to match against known units for autocomplete fill
          const ql = unitName.toLowerCase();
          const hit = allUnits.find(u => u.name.toLowerCase() === ql)
            || allUnits.find(u => u.name.toLowerCase().includes(ql))
            || allUnits.find(u => ql.includes(u.name.toLowerCase()));
          if (hit) { fillFromUnit(hit); }
          else { nameInput.value = unitName; o.querySelector('#mFaction').value = faction; }
        } catch (err) {
          aiStat.textContent = 'Error: ' + err.message; aiStat.style.color = 'var(--accent2)';
          console.error(err);
        }
      }

      aiCam.onclick = () => { aiFile.removeAttribute('capture'); aiFile.setAttribute('capture', 'environment'); aiFile.click(); };
      aiUpBtn.onclick = () => { aiFile.removeAttribute('capture'); aiFile.click(); };
      aiFile.onchange = e => { const f = e.target.files[0]; if (f) recognise(f); e.target.value = ''; };
    }

    o.querySelector('#mSave').onclick = () => {
      const name = o.querySelector('#mName').value.trim(); if (!name) { o.querySelector('#mName').focus(); return; }
      const csv = v => v.split(',').map(s => s.trim()).filter(Boolean);
      S.upsert('minis', {
        id, name,
        modelCount: Math.max(1, parseInt(o.querySelector('#mQty').value) || 1),
        faction: o.querySelector('#mFaction').value.trim(), subfaction: o.querySelector('#mSub').value.trim(),
        status: o.querySelector('#mStatus').value,
        points: o.querySelector('#mPoints').value !== '' ? parseInt(o.querySelector('#mPoints').value) : null,
        datasheetId: o.querySelector('#mDs').value || null, recipeId: o.querySelector('#mRec').value || null,
        purchaseDate: o.querySelector('#mDate').value, price: o.querySelector('#mPrice').value !== '' ? parseFloat(o.querySelector('#mPrice').value) : null,
        photos: csv(o.querySelector('#mPhotos').value), tags: csv(o.querySelector('#mTags').value),
        assembly: o.querySelector('#mAssembly').value.trim(), basing: o.querySelector('#mBasing').value.trim(),
        notes: o.querySelector('#mNotes').value.trim(),
      });
      o._close(); toast('Saved'); renderNav(); render();
    };
  }

  function openRecipeModal(id) {
    const r = id ? S.get('recipes', id) : { steps: [] };
    const stepRows = (steps) => steps.map((s, i) => `
      <div class="form-row" data-step="${i}">
        <div class="field"><input type="text" class="s-stage" placeholder="Stage (e.g. Base)" value="${esc(s.stage)}"></div>
        <div class="field"><input type="text" class="s-paint" placeholder="Paint" value="${esc(s.paint)}"></div>
        <div class="field"><input type="text" class="s-tech" placeholder="Technique" value="${esc(s.technique)}"></div>
        <button class="btn-danger btn-sm s-rm" style="align-self:center">✕</button>
      </div>`).join('');
    const o = modal(`
      <h2>${id ? 'Edit Recipe' : 'Paint Recipe'}</h2>
      <div class="field"><label>Name *</label><input type="text" id="rName" value="${esc(r.name)}"></div>
      <div class="field"><label>Applies to factions (comma-separated)</label><input type="text" id="rFac" value="${esc((r.coversFactions || []).join(', '))}"></div>
      <h3>Steps</h3>
      <div id="steps">${stepRows(r.steps || [])}</div>
      <button class="btn-ghost btn-sm" id="addStep" style="margin-top:6px">+ Add step</button>
      <div class="modal-actions"><button class="btn-secondary" id="rCancel">Cancel</button><button class="btn-primary" id="rSave">Save</button></div>
    `, true);
    const addStepRow = () => { const div = document.createElement('div'); div.innerHTML = stepRows([{ stage: '', paint: '', technique: '' }]); const row = div.firstElementChild; o.querySelector('#steps').appendChild(row); bindRm(); };
    const bindRm = () => o.querySelectorAll('.s-rm').forEach(b => b.onclick = () => b.closest('[data-step], .form-row').remove());
    o.querySelector('#addStep').onclick = addStepRow; bindRm();
    o.querySelector('#rCancel').onclick = o._close;
    o.querySelector('#rSave').onclick = () => {
      const name = o.querySelector('#rName').value.trim(); if (!name) return;
      const steps = [...o.querySelector('#steps').children].map(row => ({
        stage: row.querySelector('.s-stage').value.trim(), paint: row.querySelector('.s-paint').value.trim(), technique: row.querySelector('.s-tech').value.trim(),
      })).filter(s => s.stage || s.paint);
      S.upsert('recipes', { id, name, coversFactions: o.querySelector('#rFac').value.split(',').map(s => s.trim()).filter(Boolean), steps });
      o._close(); toast('Saved'); renderNav(); render();
    };
  }

  function openDatasheetModal(id) {
    const d = id ? S.get('datasheets', id) : { stats: {}, weapons: [] };
    const st = d.stats || {};

    const wepRow = (w = {}) => `
      <div class="wep-row form-row" style="gap:4px;align-items:center;flex-wrap:nowrap">
        <input type="text" class="w-name" placeholder="Weapon name" value="${esc(w.name || '')}" style="flex:2;min-width:100px">
        <select class="w-type" style="flex:0 0 80px">
          <option value="Ranged" ${w.type !== 'Melee' ? 'selected' : ''}>Ranged</option>
          <option value="Melee" ${w.type === 'Melee' ? 'selected' : ''}>Melee</option>
        </select>
        <input type="text" class="w-range" placeholder="Range" value="${esc(w.range || '')}" style="flex:0 0 54px">
        <input type="text" class="w-atk"  placeholder="A"     value="${esc(w.attacks || '')}" style="flex:0 0 44px">
        <input type="text" class="w-skill" placeholder="BS"   value="${esc(w.skill || '')}" style="flex:0 0 44px">
        <input type="text" class="w-str"  placeholder="S"     value="${esc(w.strength || '')}" style="flex:0 0 44px">
        <input type="text" class="w-ap"   placeholder="AP"    value="${esc(w.ap || '')}" style="flex:0 0 44px">
        <input type="text" class="w-dmg"  placeholder="D"     value="${esc(w.damage || '')}" style="flex:0 0 44px">
        <input type="text" class="w-abil" placeholder="Abilities" value="${esc(w.abilities || '')}" style="flex:1;min-width:80px">
        <button class="btn-danger btn-sm w-rm" style="flex:none">✕</button>
      </div>`;

    const o = modal(`
      <h2>${id ? 'Edit Datasheet' : 'New Datasheet'}</h2>
      <div class="form-row">
        <div class="field" style="flex:2"><label>Name *</label><input type="text" id="dName" value="${esc(d.name || '')}"></div>
        <div class="field"><label>Points</label><input type="number" id="dPoints" value="${d.points ?? ''}"></div>
      </div>
      <div class="field"><label>Faction</label><input type="text" id="dFaction" value="${esc(d.faction || '')}"></div>
      <h3>Stat line</h3>
      <div class="form-row" style="flex-wrap:nowrap;gap:6px">
        ${['M', 'T', 'Sv', 'W', 'Ld', 'OC'].map(k => `<div class="field" style="min-width:50px;flex:1"><label>${k}</label><input type="text" id="st_${k}" value="${esc(st[k] || '')}"></div>`).join('')}
      </div>
      <h3 style="margin-bottom:6px">Weapons</h3>
      <div style="overflow-x:auto">
        <div style="font-size:0.7rem;color:var(--muted);display:flex;gap:4px;padding:0 0 2px;min-width:600px">
          <span style="flex:2;min-width:100px">Name</span><span style="flex:0 0 80px">Type</span><span style="flex:0 0 54px">Range</span>
          <span style="flex:0 0 44px">A</span><span style="flex:0 0 44px">BS/WS</span><span style="flex:0 0 44px">S</span>
          <span style="flex:0 0 44px">AP</span><span style="flex:0 0 44px">D</span><span style="flex:1;min-width:80px">Abilities</span><span style="flex:none;width:36px"></span>
        </div>
        <div id="wepRows" style="display:flex;flex-direction:column;gap:4px;min-width:600px">${(d.weapons || []).map(wepRow).join('')}</div>
      </div>
      <button class="btn-ghost btn-sm" id="addWep" style="margin-top:6px">+ Add weapon</button>
      <div class="field" style="margin-top:10px"><label>Keywords (comma-separated)</label><input type="text" id="dKw" value="${esc((d.keywords || []).join(', '))}"></div>
      <div class="field"><label>Abilities / special rules</label><textarea id="dAbil">${esc(d.abilities || '')}</textarea></div>
      <div class="modal-actions"><button class="btn-secondary" id="dCancel">Cancel</button><button class="btn-primary" id="dSave">Save</button></div>
    `, true);

    const bindWepRm = () => o.querySelectorAll('.w-rm').forEach(b => b.onclick = () => b.closest('.wep-row').remove());
    o.querySelector('#addWep').onclick = () => {
      const div = document.createElement('div'); div.innerHTML = wepRow();
      o.querySelector('#wepRows').appendChild(div.firstElementChild); bindWepRm();
    };
    bindWepRm();
    o.querySelector('#dCancel').onclick = o._close;
    o.querySelector('#dSave').onclick = () => {
      const name = o.querySelector('#dName').value.trim(); if (!name) return;
      const stats = {}; ['M', 'T', 'Sv', 'W', 'Ld', 'OC'].forEach(k => { const v = o.querySelector('#st_' + k).value.trim(); if (v) stats[k] = v; });
      const weapons = [...o.querySelector('#wepRows').children].map(row => ({
        name: row.querySelector('.w-name').value.trim(),
        type: row.querySelector('.w-type').value,
        range: row.querySelector('.w-range').value.trim(),
        attacks: row.querySelector('.w-atk').value.trim(),
        skill: row.querySelector('.w-skill').value.trim(),
        strength: row.querySelector('.w-str').value.trim(),
        ap: row.querySelector('.w-ap').value.trim(),
        damage: row.querySelector('.w-dmg').value.trim(),
        abilities: row.querySelector('.w-abil').value.trim(),
      })).filter(w => w.name);
      S.upsert('datasheets', {
        id, name, faction: o.querySelector('#dFaction').value.trim(),
        points: o.querySelector('#dPoints').value !== '' ? parseInt(o.querySelector('#dPoints').value) : null,
        stats, weapons, keywords: o.querySelector('#dKw').value.split(',').map(s => s.trim()).filter(Boolean),
        abilities: o.querySelector('#dAbil').value.trim(),
      });
      o._close(); toast('Saved'); renderNav(); render();
    };
  }

  function openListModal(id) {
    const L = id ? S.get('armyLists', id) : { units: [] };
    const minis = S.list('minis');
    const unitRow = (u) => `<div class="form-row" data-unit>
      <div class="field" style="flex:2"><select class="u-mini">${minis.map(x => `<option value="${x.id}" ${x.id === u.miniId ? 'selected' : ''}>${esc(x.name)}${x.points ? ' (' + x.points + ')' : ''}</option>`).join('')}</select></div>
      <div class="field" style="max-width:90px"><input type="number" class="u-count" min="1" value="${u.count || 1}"></div>
      <button class="btn-danger btn-sm u-rm" style="align-self:center">✕</button>
    </div>`;

    const o = modal(`
      <h2>${id ? 'Edit Army List' : 'New Army List'}</h2>
      <div class="form-row">
        <div class="field" style="flex:2"><label>List name *</label><input type="text" id="lName" value="${esc(L.name || '')}"></div>
        <div class="field"><label>Points limit</label><input type="number" id="lLimit" value="${L.pointsLimit ?? ''}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Faction</label><input type="text" id="lFaction" list="lFacList" value="${esc(L.faction || '')}">
          <datalist id="lFacList">${S.factionNames().map(n => `<option value="${esc(n)}">`).join('')}</datalist></div>
        <div class="field"><label>Detachment</label><input type="text" id="lDet" value="${esc(L.detachment || '')}"></div>
      </div>
      <h3>Units</h3>
      ${minis.length ? `<div id="units">${(L.units || []).map(unitRow).join('')}</div>
      <button class="btn-ghost btn-sm" id="addUnit" style="margin-top:6px">+ Add unit</button>` : '<p class="muted" style="font-size:0.84rem">Add some units to your Collection first.</p>'}
      <div id="suggestBox" style="margin-top:14px"></div>
      <div class="field" style="margin-top:8px"><label>Notes</label><textarea id="lNotes">${esc(L.notes || '')}</textarea></div>
      <div class="modal-actions"><button class="btn-secondary" id="lCancel">Cancel</button><button class="btn-primary" id="lSave">Save</button></div>
    `, true);

    const bindRm = () => o.querySelectorAll('.u-rm').forEach(b => b.onclick = () => { b.closest('[data-unit]').remove(); refreshSuggest(); });

    function addUnitRow(miniId) {
      if (!o.querySelector('#units')) return;
      const div = document.createElement('div');
      div.innerHTML = unitRow({ miniId: miniId || minis[0].id, count: 1 });
      o.querySelector('#units').appendChild(div.firstElementChild);
      bindRm(); refreshSuggest();
    }

    function refreshSuggest() {
      const box = o.querySelector('#suggestBox');
      if (!minis.length || !box) return;
      const faction = o.querySelector('#lFaction').value.trim();
      // IDs already in the list
      const inList = new Set([...(o.querySelector('#units') ? o.querySelector('#units').querySelectorAll('.u-mini') : [])].map(s => s.value));
      // Candidates: collection units matching faction (or all if no faction set), not already in list
      const candidates = minis.filter(m => !inList.has(m.id) && (!faction || m.faction === faction));
      if (!candidates.length) { box.innerHTML = ''; return; }
      box.innerHTML = `
        <div style="font-size:0.78rem;color:var(--gold);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:7px">
          Suggested from your collection${faction ? ' · ' + esc(faction) : ''}
        </div>
        <div class="suggest-chips">${candidates.slice(0, 16).map(m => `
          <button class="suggest-chip" data-mid="${m.id}">
            <span class="sc-name">${esc(m.name)}</span>
            ${m.points ? `<span class="sc-pts">${m.points * (m.modelCount || 1)} pts</span>` : ''}
            <span class="sc-status status-${m.status}">${S.STATUS_LABEL[m.status] || ''}</span>
          </button>`).join('')}
          ${candidates.length > 16 ? `<span class="muted" style="font-size:0.78rem;align-self:center">+${candidates.length - 16} more</span>` : ''}
        </div>`;
      box.querySelectorAll('.suggest-chip').forEach(b => {
        b.onclick = () => { addUnitRow(b.dataset.mid); };
      });
    }

    if (minis.length) {
      o.querySelector('#addUnit').onclick = () => addUnitRow();
      bindRm();
      o.querySelector('#lFaction').addEventListener('input', refreshSuggest);
      refreshSuggest();
    }
    o.querySelector('#lCancel').onclick = o._close;
    o.querySelector('#lSave').onclick = () => {
      const name = o.querySelector('#lName').value.trim(); if (!name) return;
      const units = minis.length && o.querySelector('#units')
        ? [...o.querySelector('#units').children].map(row => ({ miniId: row.querySelector('.u-mini').value, count: parseInt(row.querySelector('.u-count').value) || 1 }))
        : (L.units || []);
      S.upsert('armyLists', {
        id, name, pointsLimit: o.querySelector('#lLimit').value !== '' ? parseInt(o.querySelector('#lLimit').value) : null,
        faction: o.querySelector('#lFaction').value.trim(), detachment: o.querySelector('#lDet').value.trim(),
        units, notes: o.querySelector('#lNotes').value.trim(),
      });
      o._close(); toast('Saved'); renderNav(); render();
    };
  }

  function openBattleModal(id) {
    const b = id ? S.get('battles', id) : { date: new Date().toISOString().slice(0, 10) };
    const listOpts = S.list('armyLists').map(L => `<option value="${L.id}" ${b.myListId === L.id ? 'selected' : ''}>${esc(L.name)}</option>`).join('');
    const o = modal(`
      <h2>${id ? 'Edit Game' : 'Log Game'}</h2>
      <div class="form-row">
        <div class="field"><label>Date</label><input type="date" id="bDate" value="${esc(b.date)}"></div>
        <div class="field"><label>Result</label><select id="bResult">
          <option value="win" ${b.result === 'win' ? 'selected' : ''}>Win</option>
          <option value="loss" ${b.result === 'loss' ? 'selected' : ''}>Loss</option>
          <option value="draw" ${b.result === 'draw' ? 'selected' : ''}>Draw</option>
        </select></div>
        <div class="field"><label>Score</label><input type="text" id="bScore" value="${esc(b.score)}" placeholder="85–60"></div>
      </div>
      <div class="field"><label>Mission</label><input type="text" id="bMission" value="${esc(b.mission)}"></div>
      <div class="form-row">
        <div class="field"><label>Opponent</label><input type="text" id="bOpp" value="${esc(b.opponent)}"></div>
        <div class="field"><label>Opponent faction</label><input type="text" id="bOppFac" value="${esc(b.opponentFaction)}"></div>
      </div>
      <div class="field"><label>My list</label><select id="bList"><option value="">— none —</option>${listOpts}</select></div>
      <div class="field"><label>Notes / what worked</label><textarea id="bNotes">${esc(b.notes)}</textarea></div>
      <div class="modal-actions"><button class="btn-secondary" id="bCancel">Cancel</button><button class="btn-primary" id="bSave">Save</button></div>
    `);
    o.querySelector('#bCancel').onclick = o._close;
    o.querySelector('#bSave').onclick = () => {
      S.upsert('battles', {
        id, date: o.querySelector('#bDate').value, result: o.querySelector('#bResult').value, score: o.querySelector('#bScore').value.trim(),
        mission: o.querySelector('#bMission').value.trim(), opponent: o.querySelector('#bOpp').value.trim(),
        opponentFaction: o.querySelector('#bOppFac').value.trim(), myListId: o.querySelector('#bList').value || null, notes: o.querySelector('#bNotes').value.trim(),
      });
      o._close(); toast('Saved'); renderNav(); render();
    };
  }

  // ---------- Boot ----------
  window.onStoreChange = () => { /* re-render current view on external (sync) updates */ renderNav(); render(); };
  window.addEventListener('hashchange', () => go(location.hash.replace('#', '') || 'dashboard'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(o => o._close ? o._close() : o.remove()); });

  renderNav();
  render();
  S.Sync.init();
})();
