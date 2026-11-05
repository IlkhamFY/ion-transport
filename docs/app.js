const $ = s => document.querySelector(s);
const app = $('#app');
const MIS = '—';
const PAL = ['#1f5c52', '#8d5e32', '#2c5282', '#8a4038', '#4f6b32', '#5c4d73', '#a07a2a', '#3d6f78', '#6e4a3a', '#3f5e4a', '#7a4e62', '#4a5568'];

const esc = s => s == null ? '' : String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const n = v => Number(v).toLocaleString('en-US');
const num = x => {
  if (x == null || String(x).trim() === '') return NaN;
  const v = +x;
  return Number.isFinite(v) ? v : NaN;
};
const finite = x => Number.isFinite(num(x));
function fmt(v, d = 3) {
  if (!Number.isFinite(+v)) return MIS;
  const x = +v;
  const a = Math.abs(x);
  if (a !== 0 && (a < 0.001 || a >= 10000)) return x.toExponential(2);
  return (+x.toFixed(d)).toString();
}
function fixed(v, d) {
  return Number.isFinite(+v) ? (+v).toFixed(d) : null;
}
function signed(v, d = 3) {
  if (!Number.isFinite(+v)) return MIS;
  const x = +v;
  return (x > 0 ? '+' : '') + x.toFixed(d);
}
function yearOf(y) {
  const v = +y;
  return Number.isFinite(v) ? String(Math.round(v)) : '';
}
function pretty(s) { return String(s || '').replace(/_/g, ' '); }
function parseCSV(t) {
  const out = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); out.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); out.push(row); }
  const h = out.shift();
  if (!h) return [];
  return out.filter(r => r.some(x => x !== '')).map(r => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}
function parseCI(s) {
  if (!s) return null;
  const t = String(s).replace(/np\.float64/g, '');
  const nums = [...t.matchAll(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g)].map(m => +m[0]).filter(Number.isFinite);
  if (nums.length < 2) return null;
  return [nums[0], nums[1]];
}
async function tryFetch(u) {
  try { const r = await fetch(u, {cache: 'no-store'}); return r.ok ? r : null; }
  catch (e) { return null; }
}
async function readJSON(u) {
  const r = await fetch(u);
  if (!r.ok) throw new Error(u);
  return JSON.parse((await r.text()).replace(/\bNaN\b/g, 'null'));
}

let statsC, rowsC, reproC, tgtC;
function stats() { return statsC || (statsC = readJSON('data/stats.json')); }
async function rows() {
  if (rowsC) return rowsC;
  const j = await readJSON('data/rows.json');
  rowsC = j.rows.map(r => Object.fromEntries(j.cols.map((c, i) => [c, r[i]])));
  return rowsC;
}
async function repro() {
  if (reproC !== undefined) return reproC;
  try { reproC = await readJSON('data/repro/stats.json'); }
  catch (e) { reproC = null; }
  return reproC;
}
async function targets() {
  if (tgtC) return tgtC;
  tgtC = {byId: {}, byFormula: {}};
  const r = await tryFetch('data/nmr_targets.csv');
  if (!r) return tgtC;
  for (const row of parseCSV(await r.text())) {
    tgtC.byId[row.mp_id] = row;
    if (row.formula && !tgtC.byFormula[row.formula]) tgtC.byFormula[row.formula] = row;
  }
  return tgtC;
}

function ticks(range, k) {
  const span = range[1] - range[0];
  if (!(span > 0)) return {vals: [range[0]], step: 1};
  const rough = span / k;
  const p = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map(a => a * p).find(a => a >= rough - 1e-12);
  const vals = [];
  for (let v = Math.ceil((range[0] - 1e-9) / step) * step; v <= range[1] + 1e-9; v += step) {
    vals.push(+v.toFixed(6));
  }
  return {vals, step};
}
function tlabel(v, step) {
  const d = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return (+(+v).toFixed(d)).toString();
}
function scatter({w = 640, h = 360, pts, xr, yr, lines = [], band = null, diag = false, label = ''}) {
  pts = pts.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!pts.length && !lines.length) return '<p class="muted">Nothing to plot.</p>';
  const m = {l: w < 420 ? 40 : 46, r: 12, t: 12, b: 26};
  const W = w - m.l - m.r, H = h - m.t - m.b;
  const ext = (a, p) => {
    let lo = Math.min(...a), hi = Math.max(...a);
    if (!Number.isFinite(lo)) return [0, 1];
    if (lo === hi) { lo -= 1; hi += 1; }
    const d = (hi - lo) * p;
    return [lo - d, hi + d];
  };
  const xs = pts.map(p => p.x).concat(lines.flatMap(L => L.p.map(p => p.x)));
  const ys = pts.map(p => p.y).concat(lines.flatMap(L => L.p.map(p => p.y)));
  xr = xr || ext(xs, 0.06);
  yr = yr || ext(ys, 0.08);
  const X = v => m.l + (v - xr[0]) / (xr[1] - xr[0]) * W;
  const Y = v => m.t + H - (v - yr[0]) / (yr[1] - yr[0]) * H;
  const tx = ticks(xr, w < 420 ? 4 : 5), ty = ticks(yr, h < 320 ? 4 : 5);
  let g = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">`;
  tx.vals.forEach(v => g += `<line x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${m.t + H}" stroke="#e6e1d8"/><text x="${X(v)}" y="${h - 8}" text-anchor="middle">${tlabel(v, tx.step)}</text>`);
  ty.vals.forEach(v => g += `<line x1="${m.l}" x2="${m.l + W}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e6e1d8"/><text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${tlabel(v, ty.step)}</text>`);
  if (band && Number.isFinite(+band)) {
    const a = xr[0], b = xr[1], f = +band;
    g += `<polygon points="${X(a)},${Y(a - f)} ${X(b)},${Y(b - f)} ${X(b)},${Y(b + f)} ${X(a)},${Y(a + f)}" fill="#8d5e32" opacity="0.13"/>`;
  }
  if (diag) g += `<line x1="${X(xr[0])}" y1="${Y(xr[0])}" x2="${X(xr[1])}" y2="${Y(xr[1])}" stroke="#1a1916" stroke-width="0.8" stroke-dasharray="3 3"/>`;
  lines.forEach(L => {
    if (L.p.length < 2) return;
    g += `<polyline fill="none" stroke="${L.c}" stroke-width="${L.w || 1.4}" opacity="${L.o ?? 0.85}" points="${L.p.map(p => X(p.x) + ',' + Y(p.y)).join(' ')}"/>`;
  });
  pts.forEach(p => {
    const x = X(p.x), y = Y(p.y), c = p.c || '#1f5c52', id = esc(p.id || ''), t = esc(p.t || '');
    const attrs = `class="pt" data-id="${id}"`;
    if (p.s === 'sq') {
      const z = p.big ? 5 : 3.4;
      g += `<rect ${attrs} x="${x - z}" y="${y - z}" width="${z * 2}" height="${z * 2}" fill="${p.open ? 'none' : c}" stroke="${c}" stroke-width="1.2"><title>${t}</title></rect>`;
    } else if (p.s === 'tri') {
      const z = p.big ? 6 : 4.4;
      const pts2 = `${x},${y - z} ${x - z},${y + z * 0.75} ${x + z},${y + z * 0.75}`;
      g += `<polygon class="pt" data-id="${id}" points="${pts2}" fill="${p.open ? 'none' : c}" stroke="${c}" stroke-width="1.2"><title>${t}</title></polygon>`;
    } else {
      g += `<circle class="pt" data-id="${id}" cx="${x}" cy="${y}" r="${p.big ? 5.2 : (p.r || 3.3)}" fill="${c}" opacity="${p.o ?? 0.92}"><title>${t}</title></circle>`;
    }
  });
  g += '</svg>';
  return g;
}
function axisChart(svg, yl, xl) {
  return `<div class="chart-y">${yl}</div>${svg}<div class="chart-x">${xl}</div>`;
}
function chartWidth(el, fallback) {
  const w = el && el.clientWidth;
  return Math.max(280, w || fallback || Math.min(760, window.innerWidth - 32));
}

/* ---------- overview ---------- */
const EA_LABEL = {
  arrhenius: 'Arrhenius', unknown: 'unlabelled', nmr_slr: 'NMR relaxation',
  nmr_t1rho: 'NMR T1rho', two_region: 'two-region', vtf_pseudo: 'VTF pseudo-activation',
};
function ceilingPair(block, digits, unit) {
  const raw = unit === 'decades' ? block.median_sd_decades : block.median_sd_eV;
  const v = fixed(raw, digits);
  const ci = block.ci95 || [];
  const lo = fixed(ci[0], digits), hi = fixed(ci[1], digits);
  const title = unit === 'decades' ? 'Conductivity, median material SD' : 'Activation energy, median material SD';
  return `<div>
    <div class="k">${title}</div>
    <div class="big" title="${esc(raw)}">${v} <span>${unit}</span></div>
    <div class="k">${lo && hi ? `95% CI ${lo}–${hi}` : '95% CI unavailable'} · ${n(block.n_materials)} materials · ${n(block.n_papers)} papers</div>
  </div>`;
}
async function home() {
  const s = await stats();
  const rp = await repro();
  const bp = s.by_property || {};
  const sigN = (bp.sigma_total || 0) + (bp.sigma_bulk || 0) + (bp.sigma_gb || 0);
  const difN = (bp.D_NMR || 0) + (bp.D_other || 0) + (bp.D_tracer || 0);
  const eaBits = Object.entries(s.by_ea_type || {}).filter(([, v]) => v)
    .map(([k, v]) => `${n(v)} ${EA_LABEL[k] || k}`).join(', ');
  app.innerHTML = `<h1>Measured Li and Na transport, each value kept with its paper.</h1>
    <p>Conductivity, diffusivity and activation energy for lithium and sodium conductors. These counts are the open CC BY lithium and sodium rows. The facts file is separate and is not added in.</p>
    <div class="stats">
      ${[['records', 'Li/Na rows'], ['papers', 'papers'], ['formulas', 'formulas'], ['tierA', 'tier A rows']].map(([k, lab]) => `<div class="stat"><b>${n(s[k])}</b><span>${lab}</span></div>`).join('')}
    </div>
    <p class="note">${n(s.measured_rows)} of the ${n(s.records)} rows are the measured view: the paper is not citation-only. All ${n(s.tierA)} tier A rows sit in that view. Cited values stay in the table and are marked on the row.</p>
    <p class="note">The open file, all ions, is ${n(s.open_rows)} CC BY rows from ${n(s.open_papers)} papers. The facts-only file is ${n(s.facts_rows)} rows from ${n(s.facts_papers)} other articles, released CC BY 4.0, with the source article licence kept on the row. It is not part of the ${n(s.records)}.</p>
    ${rp ? `<div class="ceiling" aria-label="Experimental spread">${ceilingPair(rp.sigma, 2, 'decades')}${ceilingPair(rp.ea_eis, 3, 'eV')}</div>
      <p class="note"><a href="#/reproducibility">How far experiments on the same material disagree</a>. These are measured spreads, not model errors.</p>` : ''}
    <h2>Conductivity against temperature</h2>
    <figure><div id="hero"></div><figcaption id="herocap"></figcaption></figure>
    <div class="split">
      <div>
        <h2>What is in the rows</h2>
        <p>Lithium rows: ${n(s.Li)}. Sodium rows: ${n(s.Na)}. Publication years ${s.years[0]}–${s.years[1]}.</p>
        <p>${n(bp.Ea || 0)} activation energies (${eaBits}). ${n(sigN)} conductivities and ${n(difN)} diffusivities.</p>
        <p>${n(s.linked)} rows carry a structure id. Family and ion labels are heuristic, read from the paper text. Tier A is the stricter cut; the tier is on every row.</p>
      </div>
      <div><h2>Rows by family</h2><div id="fams"></div></div>
    </div>`;
  const all = await rows();
  const hero = heroSeries(all);
  const host = $('#hero');
  const w = chartWidth(host);
  const h = w < 520 ? 280 : 390;
  const li = '#1f5c52', na = '#8d5e32';
  host.innerHTML = axisChart(scatter({
    w, h, label: 'Conductivity against inverse temperature',
    pts: hero.flat().map(r => ({x: 1000 / r.T_K, y: Math.log10(r.value), r: w < 520 ? 1.5 : 1.8, c: r.ion === 'Na' ? na : li, t: `${r.formula || r.material_name}, ${fmt(r.T_K, 0)} K, ${r.doi}`})),
    lines: hero.map(a => ({c: a[0].ion === 'Na' ? 'rgba(141,94,50,.55)' : 'rgba(31,92,82,.45)', w: 1.15, o: 1, p: a.map(r => ({x: 1000 / r.T_K, y: Math.log10(r.value)}))})),
    xl: '', yl: '',
  }), 'log₁₀ σ (S/cm)', '1000/T (1/K)');
  const npt = hero.reduce((t, a) => t + a.length, 0);
  $('#herocap').textContent = `${n(hero.length)} conductivity series with at least three temperatures, falling as the sample cools (${n(npt)} points). Lithium in green, sodium in ochre. A point’s label is its source.`;
  const fc = {};
  all.forEach(r => { const f = r.material_class || 'unknown'; fc[f] = (fc[f] || 0) + 1; });
  const top = Object.entries(fc).sort((a, b) => b[1] - a[1]);
  const show = top.slice(0, 8);
  const mx = show[0][1];
  $('#fams').innerHTML = `<div class="counts">${show.map(([f, c]) => `<div class="ct"><span>${esc(pretty(f))}</span><span>${n(c)}</span><div class="track"><div class="fill" style="width:${(100 * c / mx).toFixed(1)}%"></div></div></div>`).join('')}</div>
    <p class="note">Top eight of ${n(top.length)} families. ${n(top.slice(8).reduce((t, x) => t + x[1], 0))} rows sit in the rest.</p>`;
}
function heroSeries(all) {
  const sg = all.filter(r => String(r.property).startsWith('sigma') && r.T_K > 150 && r.T_K < 1500 && r.value > 1e-14 && r.value < 1);
  const gs = {};
  sg.forEach(r => {
    const k = [r.doi, r.formula, r.material_name, r.property].join('|');
    (gs[k] = gs[k] || []).push(r);
  });
  return Object.values(gs).filter(a => a.length >= 3 && new Set(a.map(r => r.T_K)).size === a.length)
    .map(a => a.slice().sort((p, q) => q.T_K - p.T_K))
    .filter(a => a.every((r, i) => !i || r.value <= a[i - 1].value * 1.05));
}

/* ---------- explorer ---------- */
const EX = {q: '', ion: 'all', fam: 'all', tier: false, measured: false, formula: '', off: new Set()};
function readExplore(q) {
  EX.q = q.get('q') || '';
  EX.ion = q.get('ion') || 'all';
  EX.fam = q.get('family') || 'all';
  EX.tier = q.get('tier') === 'A';
  EX.measured = q.get('measured') === '1';
  EX.formula = q.get('formula') || '';
  EX.off = new Set();
}
function writeExploreHash() {
  const p = {};
  if (EX.q) p.q = EX.q;
  if (EX.ion !== 'all') p.ion = EX.ion;
  if (EX.fam !== 'all') p.family = EX.fam;
  if (EX.tier) p.tier = 'A';
  if (EX.measured) p.measured = '1';
  if (EX.formula) p.formula = EX.formula;
  setHash('explore', p);
}
function keyOf(r) { return r.formula || r.material_name || ''; }
async function explore() {
  const all = await rows();
  const fams = Object.entries(all.reduce((a, r) => {
    const f = r.material_class || 'unknown'; a[f] = (a[f] || 0) + 1; return a;
  }, {})).sort((a, b) => b[1] - a[1]);
  app.innerHTML = `<h1>Arrhenius explorer</h1>
    <p>Log conductivity against inverse temperature. Each line is one paper and sample. Check a source to lay it on the same axes.</p>
    <div class="filters">
      <input type="search" id="q" aria-label="Search formula, name or DOI" placeholder="Search formula, name or DOI" value="${esc(EX.q)}" autocomplete="off">
      <div class="seg" role="group" aria-label="Ion">
        ${[['all', 'Li and Na'], ['Li', 'Li'], ['Na', 'Na']].map(([v, l]) => `<button type="button" data-ion="${v}" aria-pressed="${EX.ion === v}">${l}</button>`).join('')}
      </div>
      <label class="field">Family
        <select id="fam" aria-label="Family"><option value="all">All families</option>${fams.map(([f, c]) => `<option value="${esc(f)}" ${EX.fam === f ? 'selected' : ''}>${esc(pretty(f))} (${n(c)})</option>`).join('')}</select>
      </label>
      <label class="check"><input type="checkbox" id="tier" ${EX.tier ? 'checked' : ''}> Tier A only</label>
      <label class="check"><input type="checkbox" id="meas" ${EX.measured ? 'checked' : ''}> Measured view</label>
    </div>
    <div class="explore"><div id="list"></div><div id="plot"></div></div>`;
  let qtimer;
  $('#q').oninput = e => {
    EX.q = e.target.value;
    drawExplore(all);
    clearTimeout(qtimer);
    qtimer = setTimeout(writeExploreHash, 350);
  };
  app.querySelectorAll('[data-ion]').forEach(b => b.onclick = () => {
    EX.ion = b.dataset.ion;
    app.querySelectorAll('[data-ion]').forEach(x => x.setAttribute('aria-pressed', x.dataset.ion === EX.ion));
    reconcileFormula(all); drawExplore(all); writeExploreHash();
  });
  $('#fam').onchange = e => { EX.fam = e.target.value; reconcileFormula(all); drawExplore(all); writeExploreHash(); };
  $('#tier').onchange = e => { EX.tier = e.target.checked; reconcileFormula(all); drawExplore(all); writeExploreHash(); };
  $('#meas').onchange = e => { EX.measured = e.target.checked; reconcileFormula(all); drawExplore(all); writeExploreHash(); };
  drawExplore(all);
}
function passRow(r) {
  if (EX.ion !== 'all' && r.ion !== EX.ion) return false;
  if (EX.fam !== 'all' && (r.material_class || 'unknown') !== EX.fam) return false;
  if (EX.tier && r.tier !== 'A') return false;
  if (EX.measured && !r.measured_only) return false;
  return true;
}
function matchQuery(r, q) {
  if (!q) return true;
  return [r.formula, r.material_name, r.doi].some(v => v && String(v).toLowerCase().includes(q));
}
function reconcileFormula(all) {
  if (!EX.formula) return;
  if (!all.some(r => keyOf(r) === EX.formula && passRow(r))) EX.formula = '';
}
function drawExplore(all) {
  const q = EX.q.trim().toLowerCase();
  const keys = new Map();
  for (const r of all) {
    if (!passRow(r) || !matchQuery(r, q)) continue;
    const k = keyOf(r);
    if (!k) continue;
    if (!keys.has(k)) keys.set(k, {key: k, formula: r.formula || '', name: r.material_name || '', family: r.material_class || 'unknown', ion: r.ion, papers: new Set(), pts: 0});
    const g = keys.get(k);
    if (String(r.property).startsWith('sigma') && r.T_K > 0 && r.value > 0) {
      g.pts++;
      if (r.doi) g.papers.add(r.doi);
    }
  }
  let list = [...keys.values()].filter(g => g.pts > 0);
  const open = !q && EX.fam === 'all' && EX.ion === 'all' && !EX.tier && !EX.measured;
  list.sort((a, b) => b.pts - a.pts || b.papers.size - a.papers.size || a.key.localeCompare(b.key));
  const total = list.length;
  if (open) list = list.slice(0, 8);
  else list = list.slice(0, 40);
  if (EX.formula && !list.some(g => g.key === EX.formula)) {
    const g = keys.get(EX.formula);
    if (g) list.unshift(g);
  }
  const noun = total === 1 ? 'formula' : 'formulas';
  const note = open
    ? 'Formulas with the most conductivity points. Search or pick a family for the rest.'
    : (total > list.length ? `Showing ${n(list.length)} of ${n(total)}. Refine the search.` : `${n(total)} ${noun} with conductivity.`);
  $('#list').innerHTML = `<p class="note" style="margin-top:0">${note}</p><div class="formula-list">${list.map(g => `<button type="button" class="formula ${g.key === EX.formula ? 'on' : ''}" data-k="${esc(g.key)}"><span class="fn">${esc(g.formula || g.name)}</span><span class="meta">${esc(pretty(g.family))} · ${g.papers.size} ${g.papers.size === 1 ? 'paper' : 'papers'} · ${n(g.pts)} ${g.pts === 1 ? 'point' : 'points'}</span></button>`).join('') || '<p class="muted">No conductivity matches.</p>'}</div>`;
  $('#list').querySelectorAll('button.formula').forEach(b => b.onclick = () => {
    EX.formula = b.dataset.k;
    EX.off = new Set();
    drawExplore(all);
    writeExploreHash();
  });
  drawPlot(all);
}
function drawPlot(all) {
  const host = $('#plot');
  if (!EX.formula) { host.innerHTML = '<p class="muted">Choose a formula. The plot overlays every paper that reported it.</p>'; return; }
  const mine = all.filter(r => keyOf(r) === EX.formula && passRow(r));
  const sig = mine.filter(r => String(r.property).startsWith('sigma') && r.T_K > 0 && r.value > 0);
  const eas = mine.filter(r => r.property === 'Ea' && finite(r.value));
  const groups = new Map();
  sig.forEach(r => {
    const gk = [r.doi || '', r.property || '', r.material_name || ''].join('|');
    if (!groups.has(gk)) groups.set(gk, []);
    groups.get(gk).push(r);
  });
  let series = [...groups.entries()].map(([gk, pts]) => {
    const r0 = pts[0];
    return {gk, doi: r0.doi || '', year: yearOf(r0.year), name: r0.material_name || '', property: r0.property, pts};
  }).sort((a, b) => (a.year || '').localeCompare(b.year || '') || a.doi.localeCompare(b.doi) || a.gk.localeCompare(b.gk));
  series.forEach((s, i) => { s.color = PAL[i % PAL.length]; s.on = !EX.off.has(s.gk); });
  const shown = series.filter(s => s.on);
  const title = mine.find(r => r.formula)?.formula || EX.formula;
  const eaBlock = eas.length ? `<h3>Reported activation energy</h3><ul class="sources">${eas.slice().sort((a, b) => num(a.value) - num(b.value)).map(r => `<li><span><span>${fmt(r.value)} eV</span> <span class="muted">${esc(r.ea_type || 'unlabelled')} · tier ${esc(r.tier || '')}</span><br><a href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener">${esc(r.doi || 'source')}</a></span></li>`).join('')}</ul>` : '';
  if (!series.length) {
    host.innerHTML = `<h2 style="margin-top:0">${esc(title)}</h2><p>No temperature-resolved conductivity for this formula under the current filters.</p>${eaBlock}`;
    return;
  }
  const propLabel = p => p === 'sigma_total' ? '' : p === 'sigma_bulk' ? 'bulk' : p === 'sigma_gb' ? 'grain boundary' : (p || '');
  host.innerHTML = `<h2 style="margin-top:0">${esc(title)}</h2>
    <div class="plot-grid"><div id="cv"></div>
    <div>
      ${EX.off.size ? '<p style="margin:0 0 6px"><button type="button" class="quiet" id="showall">Show all sources</button></p>' : ''}
      <ul class="sources">${series.map(s => {
        const extra = (s.name && s.name !== title) ? esc(s.name) : '';
        const pl = propLabel(s.property);
        return `<li><label><input type="checkbox" data-k="${esc(s.gk)}" ${s.on ? 'checked' : ''} aria-label="Toggle ${esc(s.doi)}"></label><span class="swatch" style="background:${s.color}"></span><span><a href="https://doi.org/${esc(s.doi)}" target="_blank" rel="noopener">${esc(s.doi || 'source missing')}</a><span class="meta muted" style="display:block">${[s.year, `${s.pts.length} points`, pl, extra].filter(Boolean).join(' · ')}</span></span></li>`;
      }).join('')}</ul>
      ${eaBlock}
    </div></div>
    <div class="table-wrap" id="ptable"></div>`;
  const cv = $('#cv');
  const w = chartWidth(cv);
  const h = w < 520 ? 300 : 420;
  const pts = [], lines = [];
  shown.forEach(s => {
    const p = s.pts.map(r => ({x: 1000 / r.T_K, y: Math.log10(r.value), c: s.color, r: 3.2, t: `${fmt(r.T_K, 1)} K, ${fmt(r.value)} S/cm, ${r.doi}`}))
      .filter(d => Number.isFinite(d.x) && Number.isFinite(d.y));
    pts.push(...p);
    lines.push({c: s.color, p: p.slice().sort((a, b) => a.x - b.x)});
  });
  cv.innerHTML = axisChart(scatter({w, h, pts, lines, label: `log conductivity of ${title} against inverse temperature`}), 'log₁₀ σ (S/cm)', '1000/T (1/K)');
  const flat = shown.flatMap(s => s.pts.map(r => ({...r, color: s.color}))).sort((a, b) => a.T_K - b.T_K);
  $('#ptable').innerHTML = `<table><thead><tr><th class="num">T (K)</th><th class="num">1000/T</th><th class="num">σ (S/cm)</th><th class="num">log₁₀ σ</th><th>Method</th><th>Tier</th><th>Source</th></tr></thead><tbody>${flat.map(r => `<tr><td class="num">${fmt(r.T_K, 1)}</td><td class="num">${fmt(1000 / r.T_K, 3)}</td><td class="num">${fmt(r.value)}</td><td class="num">${fmt(Math.log10(r.value), 2)}</td><td>${esc(r.method || '')}</td><td>${esc(r.tier || '')}</td><td>${r.doi ? `<a href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener">${esc(yearOf(r.year) || 'doi')}</a>` : ''}</td></tr>`).join('')}</tbody></table>`;
  host.querySelectorAll('input[data-k]').forEach(box => box.onchange = () => {
    if (box.checked) EX.off.delete(box.dataset.k); else EX.off.add(box.dataset.k);
    drawPlot(all);
  });
  const show = $('#showall');
  if (show) show.onclick = () => { EX.off = new Set(); drawPlot(all); };
}

/* ---------- leaderboard ---------- */
const LB = {target: 'all', model: null, family: 'all', span: 'all', sort: 'MAE', dir: 1, mat: null, msort: 'abs', mdir: -1, scrollMat: false};
function looksFake(L, PM, M) {
  if (M && M._demo) return true;
  const models = [...(L || []), ...(PM || [])].map(r => r.model || '').filter(Boolean);
  return models.length > 0 && models.every(m => /^demo-/i.test(m));
}
async function readSet(dir) {
  const [lb, pm, mt] = await Promise.all(['leaderboard.csv', 'per_material.csv', 'metrics.json'].map(f => tryFetch(dir + f)));
  if (!lb && !pm && !mt) return {present: false};
  let L = [], PM = [], M = {};
  try { if (lb) L = parseCSV(await lb.text()); } catch (e) { L = []; }
  try { if (pm) PM = parseCSV(await pm.text()); } catch (e) { PM = []; }
  try { if (mt) M = JSON.parse((await mt.text()).replace(/\bNaN\b/g, 'null')); } catch (e) { M = {}; }
  const cols = PM[0] ? Object.keys(PM[0]) : [];
  const ok = !!(lb && pm && L.length && PM.length && cols.includes('model') && cols.includes('Ea_exp') && cols.includes('Ea_model'));
  return {present: !!(lb || pm || mt), ok, fake: looksFake(L, PM, M), L, PM, M};
}
async function loadBoard() {
  const real = await readSet('data/leaderboard/');
  if (real.present && real.fake) return {mode: 'pending'};
  if (real.present && !real.ok) return {mode: 'bad'};
  if (real.ok && !real.fake) return {mode: 'live', banner: false, ...real};
  return {mode: 'pending'};
}
function isNmr(r) { return /nmr/i.test(r.ea_type || ''); }
function passTarget(r) {
  if (LB.target === 'nmr') return isNmr(r);
  if (LB.target === 'eis') return !isNmr(r);
  return true;
}
function spanOf(r, tgt) {
  const t = tgt.byId[r.mp_id] || tgt.byFormula[r.formula];
  if (!t) return '';
  if (t.nmr_long_range === 'yes') return 'long';
  if (t.nmr_long_range === 'local_or_unclear') return 'local';
  return '';
}
function spanLabel(s) { return s === 'long' ? 'Long-range' : s === 'local' ? 'Local' : MIS; }
function scoredLabel(r) {
  if (isNmr(r)) return 'NMR';
  if ((r.ea_type || '') === 'arrhenius') return 'Conductivity';
  return r.ea_type || MIS;
}
function ranksOf(a) {
  const n = a.length, order = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), r = Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[order[k][1]] = avg;
    i = j + 1;
  }
  return r;
}
function spearman(xs, ys) {
  if (xs.length < 3) return NaN;
  const rx = ranksOf(xs), ry = ranksOf(ys);
  const mx = rx.reduce((s, v) => s + v, 0) / rx.length, my = ry.reduce((s, v) => s + v, 0) / ry.length;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = rx[i] - mx, b = ry[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  if (dx === 0 || dy === 0) return NaN;
  return num / Math.sqrt(dx * dy);
}
function metricsOf(rows) {
  const universe = new Set(rows.filter(r => finite(r.Ea_exp)).map(r => r.mp_id || r.formula));
  const models = [...new Set(rows.map(r => r.model))];
  return models.map(m => {
    const scored = rows.filter(r => r.model === m && finite(r.Ea_exp) && finite(r.Ea_model));
    const covered = new Set(scored.map(r => r.mp_id || r.formula));
    const err = scored.map(r => num(r.Ea_model) - num(r.Ea_exp));
    const mae = err.length ? err.reduce((s, e) => s + Math.abs(e), 0) / err.length : NaN;
    const rmse = err.length ? Math.sqrt(err.reduce((s, e) => s + e * e, 0) / err.length) : NaN;
    const bias = err.length ? err.reduce((s, e) => s + e, 0) / err.length : NaN;
    return {
      model: m, MAE: mae, RMSE: rmse, Spearman: spearman(scored.map(r => num(r.Ea_exp)), scored.map(r => num(r.Ea_model))),
      bias, coverage: universe.size ? covered.size / universe.size : NaN,
      covered: covered.size, universe: universe.size, n: scored.length,
    };
  });
}
function cmpMetric(a, b, k, dir) {
  const x = a[k], y = b[k];
  const xn = !Number.isFinite(x), yn = !Number.isFinite(y);
  if (xn && yn) return 0;
  if (xn) return 1;
  if (yn) return -1;
  return (x > y ? 1 : x < y ? -1 : 0) * dir;
}
function mixColor(t) {
  const a = [245, 244, 241], b = [31, 92, 82];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function shapeOf(r, tgt) {
  if (!isNmr(r)) return 'circ';
  const s = spanOf(r, tgt);
  if (s === 'long') return 'sq';
  return 'tri';
}
async function leaderboard() {
  LB.pack = await loadBoard();
  if (LB.pack.mode !== 'live') { await paintPending(LB.pack.mode); return; }
  LB.tgt = await targets();
  paintBoard();
}
async function paintPending(mode) {
  const s = await stats().catch(() => ({}));
  const title = mode === 'bad' ? 'Leaderboard files could not be read' : 'No model scores yet';
  const body = mode === 'bad'
    ? 'A live board needs leaderboard.csv and per_material.csv with model, Ea_exp and Ea_model, plus metrics.json. Those files are not in this release.'
    : 'The potential runs are still going. This page will rank models when the runs are in. No score is shown in their place.';
  const gold = s.gold_materials ? `<p class="muted">The reference list has ${n(s.gold_materials)} materials with a measured activation energy. The numbers are on the downloads page. They are not predictions.</p>` : '';
  app.innerHTML = `<h1>Leaderboard</h1><p>Predicted activation energy against the measured value.</p><div class="pending"><p class="pending-title">${title}.</p><p class="muted">${body}</p>${gold}</div>`;
}
function paintBoard() {
  const tgt = LB.tgt;
  const rows = LB.pack.PM.filter(passTarget);
  let ranked = metricsOf(rows);
  const firstDir = {MAE: 1, RMSE: 1, Spearman: -1, bias: 1, coverage: -1, n: -1};
  const byMae = ranked.slice().sort((a, b) => cmpMetric(a, b, 'MAE', 1) || a.model.localeCompare(b.model));
  ranked.sort((a, b) => cmpMetric(a, b, LB.sort, LB.dir) || a.model.localeCompare(b.model));
  const famsAvail = new Set(rows.map(r => r.family || 'unknown'));
  if (LB.family !== 'all' && !famsAvail.has(LB.family)) LB.family = 'all';
  if (!LB.model || (LB.model !== '*' && !ranked.some(r => r.model === LB.model))) {
    LB.model = byMae[0] ? byMae[0].model : null;
  }
  const floor = num(LB.pack.M.error_floor_eV);
  const modelIndex = new Map(byMae.map((r, i) => [r.model, i]));
  const colorOf = m => PAL[(modelIndex.get(m) ?? 0) % PAL.length];
  app.innerHTML = `<h1>Leaderboard</h1>
    <p>Predicted activation energy against the measured value. Rank follows the column you sort; the page opens on MAE, lowest first.</p>
    <div class="seg" role="group" aria-label="Target" id="tgt">
      ${[['all', 'All targets'], ['eis', 'Conductivity'], ['nmr', 'NMR']].map(([v, l]) => `<button type="button" data-t="${v}" aria-pressed="${LB.target === v}">${l}</button>`).join('')}
    </div>
    <div class="table-wrap sticky"><table><thead><tr>
      <th class="num">#</th><th>Model</th>
      ${[['MAE', 'MAE (eV)', 'Mean absolute error'], ['RMSE', 'RMSE (eV)', 'Root mean square error'], ['Spearman', 'Spearman', 'Rank correlation of prediction and experiment'], ['bias', 'Bias (eV)', 'Mean of prediction minus experiment'], ['coverage', 'Coverage', 'Materials with a prediction, over materials in this table'], ['n', 'Rows', 'Scored rows']].map(([k, lab, tip]) => `<th class="${k === 'model' ? '' : 'num'}"><button type="button" class="textbtn" data-s="${k}" title="${tip}">${lab}${LB.sort === k ? (LB.dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>`).join('')}
    </tr></thead><tbody>${ranked.map((r, i) => `<tr class="click ${r.model === LB.model ? 'sel' : ''}" data-model="${esc(r.model)}" tabindex="0"><td class="num muted">${i + 1}</td><td>${esc(r.model)}</td><td class="num">${fmt(r.MAE)}</td><td class="num">${fmt(r.RMSE)}</td><td class="num">${Number.isFinite(r.Spearman) ? r.Spearman.toFixed(2) : MIS}</td><td class="num">${signed(r.bias)}</td><td class="num" title="${r.universe ? Math.round(100 * r.covered / r.universe) + '%' : ''}">${r.universe ? `${r.covered}/${r.universe}` : MIS}</td><td class="num">${r.n ? n(r.n) : MIS}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">MAE, RMSE and bias are in eV. Spearman needs at least three scored rows. Coverage counts a material once, even when it has both a conductivity target and an NMR target.</p>
    <h2>Model against experiment</h2>
    <div class="filters"><label class="field">Model <select id="mdl" aria-label="Model"><option value="*" ${LB.model === '*' ? 'selected' : ''}>All models</option>${ranked.map(r => `<option ${r.model === LB.model ? 'selected' : ''}>${esc(r.model)}</option>`).join('')}</select></label></div>
    <div id="parity"></div>
    <h2>Error by family</h2>
    <p class="note">Mean absolute error in eV. A blank cell has no scored row. Select a cell to open that model and family below.</p>
    <div id="heat"></div>
    <h2>Per material</h2>
    <div class="filters" id="mfilt"></div>
    <div class="table-wrap sticky" id="mats"></div>`;
  $('#tgt').querySelectorAll('button').forEach(b => b.onclick = () => { LB.target = b.dataset.t; LB.mat = null; paintBoard(); });
  app.querySelectorAll('button[data-s]').forEach(b => b.onclick = () => {
    const k = b.dataset.s;
    if (LB.sort === k) LB.dir = -LB.dir;
    else { LB.sort = k; LB.dir = firstDir[k]; }
    paintBoard();
  });
  app.querySelectorAll('tr[data-model]').forEach(tr => {
    const pick = () => { LB.model = tr.dataset.model; LB.mat = null; paintBoard(); };
    tr.onclick = e => { if (e.target.closest('a')) return; pick(); };
    tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
  });
  $('#mdl').onchange = e => { LB.model = e.target.value; LB.mat = null; paintBoard(); };
  drawParity(rows, byMae, colorOf, floor);
  drawHeat(rows, byMae, colorOf);
  drawMats(rows, byMae, tgt);
  if (LB.scrollMat) {
    const sel = document.querySelector('#mats tr.sel');
    if (sel) sel.scrollIntoView({block: 'nearest'});
    LB.scrollMat = false;
  }
}
function drawParity(rows, ranked, colorOf, floor) {
  const one = LB.model && LB.model !== '*';
  const use = rows.filter(r => finite(r.Ea_exp) && finite(r.Ea_model) && (!one || r.model === LB.model));
  const host = $('#parity');
  if (!use.length) { host.innerHTML = '<p class="muted">No scored rows for this filter.</p>'; return; }
  const vals = use.flatMap(r => [num(r.Ea_exp), num(r.Ea_model)]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(0.04, (hi - lo) * 0.06);
  lo -= pad; hi += pad;
  if (Number.isFinite(floor)) { lo -= floor; hi += floor; }
  const box = document.createElement('div');
  host.innerHTML = '';
  host.appendChild(box);
  const w = chartWidth(box);
  const h = Math.max(300, Math.min(520, w));
  const pts = use.map(r => {
    const id = [r.model, r.mp_id || r.formula, r.ea_type].join('|');
    const s = shapeOf(r, LB.tgt);
    const open = isNmr(r) && !spanOf(r, LB.tgt);
    const selected = id === LB.mat;
    let c = colorOf(r.model);
    if (one) c = s === 'sq' ? '#1a1916' : s === 'tri' ? '#8d5e32' : '#1f5c52';
    return {
      x: num(r.Ea_exp), y: num(r.Ea_model), s: s === 'circ' ? 'circ' : s, open, c, id, big: selected,
      t: `${r.formula}: exp ${r.Ea_exp}, model ${r.Ea_model}, ${scoredLabel(r)} ${spanLabel(spanOf(r, LB.tgt))}`,
    };
  });
  box.innerHTML = axisChart(scatter({
    w, h, pts, xr: [lo, hi], yr: [lo, hi], diag: true,
    band: Number.isFinite(floor) ? floor : null,
    label: 'Predicted activation energy against experiment',
  }), 'Ea model (eV)', 'Ea experiment (eV)');
  const leg = one
    ? `<ul class="legend"><li><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="#1f5c52"/></svg> Conductivity</li><li><svg width="12" height="12" aria-hidden="true"><rect x="2" y="2" width="8" height="8" fill="#1a1916"/></svg> Long-range NMR</li><li><svg width="12" height="12" aria-hidden="true"><polygon points="6,1 11,11 1,11" fill="#8d5e32"/></svg> Local NMR</li></ul>`
    : `<ul class="legend">${ranked.map(r => `<li><span class="swatch" style="background:${colorOf(r.model)};margin-top:0"></span>${esc(r.model)}</li>`).join('')}<li>Circle conductivity, square long-range NMR, triangle local NMR.</li></ul>`;
  const bandNote = Number.isFinite(floor)
    ? `Shaded band: ±${fmt(floor)} eV, the experimental floor stored in metrics.json.`
    : 'metrics.json has no error_floor_eV, so no noise band is drawn.';
  host.insertAdjacentHTML('beforeend', `${leg}<p class="note">${bandNote} A hollow triangle is an NMR row whose long-range mark is not in the target table. The mark is joined on mp id.</p>`);
  box.querySelectorAll('.pt').forEach(el => el.addEventListener('click', () => {
    LB.mat = el.dataset.id;
    LB.scrollMat = true;
    const model = LB.mat.split('|')[0];
    if (model) LB.model = model;
    paintBoard();
  }));
}
function drawHeat(rows, ranked, colorOf) {
  const scored = rows.filter(r => finite(r.Ea_exp) && finite(r.Ea_model));
  const host = $('#heat');
  if (!scored.length) { host.innerHTML = '<p class="muted">No scored rows for this filter.</p>'; return; }
  const models = ranked.map(r => r.model);
  const fams = [...new Set(scored.map(r => r.family || 'unknown'))].sort((a, b) => a.localeCompare(b));
  const cell = {};
  scored.forEach(r => {
    const k = r.model + '|' + (r.family || 'unknown');
    (cell[k] = cell[k] || []).push(Math.abs(num(r.Ea_model) - num(r.Ea_exp)));
  });
  const means = Object.values(cell).map(a => a.reduce((s, x) => s + x, 0) / a.length);
  const mx = Math.max(...means, 0.001);
  let html = `<div class="table-wrap sticky"><table class="heat"><thead><tr><th>Family</th>${models.map(m => `<th class="${m === LB.model ? 'on' : ''}">${esc(m)}</th>`).join('')}</tr></thead><tbody>`;
  fams.forEach(f => {
    html += `<tr><td>${esc(f)}</td>`;
    models.forEach(m => {
      const a = cell[m + '|' + f];
      const on = LB.model === m && LB.family === f;
      if (!a) { html += '<td class="muted">—</td>'; return; }
      const v = a.reduce((s, x) => s + x, 0) / a.length;
      const t = 0.08 + 0.40 * (v / mx);
      html += `<td class="cell ${on ? 'on' : ''}" data-m="${esc(m)}" data-f="${esc(f)}" style="background:${mixColor(t)}" title="n=${a.length}">${fmt(v, 2)}</td>`;
    });
    html += '</tr>';
  });
  html += `</table></div><div class="scale"><span>0</span><i style="background:linear-gradient(90deg,#f5f4f1,${mixColor(0.48)})"></i><span>${fmt(mx, 2)} eV</span></div>`;
  host.innerHTML = html;
  host.querySelectorAll('td.cell').forEach(td => td.addEventListener('click', () => {
    LB.model = td.dataset.m;
    LB.family = td.dataset.f;
    LB.mat = null;
    paintBoard();
  }));
}
function drawMats(rows, ranked, tgt) {
  const one = LB.model && LB.model !== '*';
  const fams = [...new Set(rows.map(r => r.family || 'unknown'))].sort((a, b) => a.localeCompare(b));
  $('#mfilt').innerHTML = `<label class="field">Family <select id="mf" aria-label="Family"><option value="all">All families</option>${fams.map(f => `<option ${LB.family === f ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
    <div class="seg" role="group" aria-label="NMR span">${[['all', 'Any NMR mark'], ['long', 'Long-range'], ['local', 'Local'], ['none', 'No NMR mark']].map(([v, l]) => `<button type="button" data-span="${v}" aria-pressed="${LB.span === v}">${l}</button>`).join('')}</div>`;
  let list = rows.filter(r => finite(r.Ea_exp) && finite(r.Ea_model) && (!one || r.model === LB.model));
  if (LB.family !== 'all') list = list.filter(r => (r.family || 'unknown') === LB.family);
  if (LB.span === 'long') list = list.filter(r => spanOf(r, tgt) === 'long');
  else if (LB.span === 'local') list = list.filter(r => spanOf(r, tgt) === 'local');
  else if (LB.span === 'none') list = list.filter(r => !spanOf(r, tgt));
  const val = r => {
    const err = num(r.Ea_model) - num(r.Ea_exp);
    if (LB.msort === 'abs') return Math.abs(err);
    if (LB.msort === 'exp') return num(r.Ea_exp);
    if (LB.msort === 'pred') return num(r.Ea_model);
    if (LB.msort === 'err') return err;
    if (LB.msort === 'formula') return r.formula || '';
    return r.family || '';
  };
  list.sort((a, b) => {
    const x = val(a), y = val(b);
    if (typeof x === 'string') return x.localeCompare(y) * LB.mdir;
    return (x > y ? 1 : x < y ? -1 : 0) * LB.mdir;
  });
  const arrow = k => LB.msort === k ? (LB.mdir > 0 ? ' ↑' : ' ↓') : '';
  const headHtml = `<th class="num">#</th>` + [
    ['formula', 'Formula'], ['family', 'Family'],
  ].map(([k, lab]) => `<th><button type="button" class="textbtn" data-ms="${k}">${lab}${arrow(k)}</button></th>`).join('')
    + (one ? '' : '<th>Model</th>')
    + `<th>Scored</th><th title="From the target table, joined on mp id">NMR</th>`
    + [['exp', 'Ea exp'], ['pred', 'Ea model'], ['err', 'Error']].map(([k, lab]) => `<th class="num"><button type="button" class="textbtn" data-ms="${k}">${lab}${arrow(k === 'err' ? 'abs' : k)}</button></th>`).join('');
  const body = list.map((r, i) => {
    const id = [r.model, r.mp_id || r.formula, r.ea_type].join('|');
    const err = num(r.Ea_model) - num(r.Ea_exp);
    const href = r.formula ? `#/explore?formula=${encodeURIComponent(r.formula)}` : '';
    return `<tr class="${id === LB.mat ? 'sel' : ''}" id="row-${i}"><td class="num muted">${i + 1}</td><td>${href ? `<a href="${href}">${esc(r.formula)}</a>` : esc(r.material_name || '')}</td><td>${esc(r.family || '')}</td>${one ? '' : `<td>${esc(r.model)}</td>`}<td title="${esc(r.ea_type || '')}">${esc(scoredLabel(r))}</td><td>${spanLabel(spanOf(r, tgt))}</td><td class="num">${fmt(r.Ea_exp)}</td><td class="num">${fmt(r.Ea_model)}</td><td class="num">${signed(err)}</td></tr>`;
  }).join('');
  const missed = one ? new Set(rows.filter(r => r.model === LB.model && finite(r.Ea_exp) && !finite(r.Ea_model)).map(r => r.mp_id || r.formula)).size : 0;
  $('#mats').innerHTML = list.length
    ? `<table><thead><tr>${headHtml}</tr></thead><tbody>${body}</tbody></table>`
    : '<p class="muted">No materials for this filter.</p>';
  if (missed) $('#mats').insertAdjacentHTML('beforeend', `<p class="note">${n(missed)} materials in this model have no prediction on the current target.</p>`);
  else if (list.length) $('#mats').insertAdjacentHTML('beforeend', `<p class="note">${n(list.length)} scored rows. Error is prediction minus experiment, in eV. NMR marks long-range against local.</p>`);
  $('#mf').onchange = e => { LB.family = e.target.value; paintBoard(); };
  $('#mfilt').querySelectorAll('[data-span]').forEach(b => b.onclick = () => { LB.span = b.dataset.span; paintBoard(); });
  $('#mats').querySelectorAll('button[data-ms]').forEach(b => b.onclick = () => {
    const k = b.dataset.ms === 'err' ? 'abs' : b.dataset.ms;
    if (LB.msort === k) LB.mdir = -LB.mdir;
    else {
      LB.msort = k;
      LB.mdir = (k === 'abs') ? -1 : 1;
    }
    paintBoard();
  });
}

/* ---------- reproducibility ---------- */
function famNum(row, key) {
  const v = num(row[key]);
  return Number.isFinite(v) ? v : NaN;
}
function bars(items, digits, ref) {
  const vals = items.flatMap(it => [it.value, it.lo, it.hi, ref].filter(v => Number.isFinite(v)));
  const max = Math.max(...vals, 0) * 1.08 || 1;
  const pct = v => Math.max(0, Math.min(100, 100 * v / max));
  return items.map(it => {
    const ci = Number.isFinite(it.lo) && Number.isFinite(it.hi)
      ? `<div class="ci" style="left:${pct(it.lo)}%;width:${Math.max(0, pct(it.hi) - pct(it.lo))}%"><i></i><i class="b"></i></div>` : '';
    const refEl = Number.isFinite(ref) ? `<div class="ref" style="left:${pct(ref)}%"></div>` : '';
    const ciText = Number.isFinite(it.lo) && Number.isFinite(it.hi) ? ` · 95% CI ${it.lo.toFixed(digits)}–${it.hi.toFixed(digits)}` : '';
    return `<div class="hb"><div class="nm">${esc(it.label)}<small>${it.note}${ciText}</small></div><div class="vl" title="${esc(it.raw)}">${it.value.toFixed(digits)}</div><div class="track"><div class="fill" style="width:${pct(it.value)}%"></div>${ci}${refEl}</div></div>`;
  }).join('');
}
function spreadRows(items, digits, unit) {
  const vals = items.map(it => it.value);
  const max = Math.max(...vals, 0) * 1.08 || 1;
  return items.map(it => `<div class="hb"><div class="nm">${esc(it.label)}<small>${esc(it.note)}</small></div><div class="vl">${it.value.toFixed(digits)} ${unit}</div><div class="track"><div class="fill" style="width:${Math.max(0, Math.min(100, 100 * it.value / max)).toFixed(1)}%"></div></div></div>`).join('');
}
async function reproducibility() {
  const rp = await repro();
  if (!rp || !rp.sigma || !rp.ea_eis) {
    app.innerHTML = `<h1>Reproducibility</h1><div class="pending"><p class="pending-title">Summary unavailable.</p><p class="muted">The measured-view spread file could not be read.</p></div>`;
    return;
  }
  const s = rp.sigma, e = rp.ea_eis;
  const sigmaItems = (s.materials || []).map(r => ({
    label: r.material, value: r.sd_decades,
    note: `${r.family} · ${r.ion} · ${n(r.n_papers)} papers`,
  })).sort((a, b) => b.value - a.value);
  const eaItems = (e.materials || []).map(r => ({
    label: r.formula || r.material, value: r.sd_eV,
    note: `${r.family} · ${n(r.n_papers)} papers`,
  })).sort((a, b) => b.value - a.value);
  app.innerHTML = `<h1>Reproducibility</h1>
    <p>How far independent experiments on the same material sit from each other, on the measured lithium and sodium view (${n(rp.records)} rows, ${n(rp.papers)} papers). The figure is a ceiling on the agreement a model can be asked to reach. It is not a model error.</p>
    <div class="ceiling">${ceilingPair(s, 2, 'decades')}${ceilingPair(e, 3, 'eV')}</div>
    <p>Conductivity is the room-temperature value on a log₁₀ scale, so the unit is a decade. The headline number is the median of the per-material standard deviations. The pooled conductivity standard deviation is ${fixed(s.pooled_sd_decades, 2)} decades and is set by the widest materials. Activation energy here is EIS Arrhenius only. Its pooled standard deviation is ${fixed(e.pooled_sd_eV, 3)} eV. NMR reproducibility is not given a floor: no NMR class in this view has one material in two papers.</p>
    <h2>Conductivity, by material</h2>
    ${spreadRows(sigmaItems, 2, 'decades')}
    <h2>Activation energy, EIS, by material</h2>
    ${spreadRows(eaItems, 3, 'eV')}
    <p class="note" style="margin-top:18px">Read from <a href="data/repro/stats.json">stats.json</a>.</p>`;
}

/* ---------- downloads ---------- */
const ROLE = {
  lina: 'Lithium and sodium rows from the open CC BY file. This is the table the explorer draws.',
  open: 'The whole open CC BY file, every ion. The same rows as the lithium and sodium file, plus the other ions.',
  facts: 'Numeric facts from articles that are not CC BY. Released CC BY 4.0. Not added to the open file, and not Tier A.',
  gold: 'Measured activation energies for the reference materials. No model prediction.',
  schema: 'What each column on the explorer means.',
  stats: 'Counts for this release. The facts count is separate from the open count.',
  rows: 'The lithium and sodium rows, in the shape this site reads.',
  repro: 'Experimental spread on the measured view.',
};
function bytes(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
async function downloads() {
  const [s, schema, files] = await Promise.all([
    stats(),
    readJSON('data/schema.json').catch(() => null),
    readJSON('data/files.json').catch(() => ({files: []})),
  ]);
  const list = (files.files || []).map(f => `<div class="file"><a href="${esc(f.href)}" download>${esc(f.name)}</a><span class="hash">${[bytes(f.bytes), f.sha256 ? 'sha256 ' + f.sha256 : ''].filter(Boolean).join(' · ')}</span><p>${ROLE[f.role] || ''}${f.rows ? ` ${n(f.rows)} rows.` : ''}</p></div>`).join('');
  app.innerHTML = `<h1>Downloads</h1>
    <p>Open CC BY file: ${n(s.open_rows)} rows, ${n(s.open_papers)} papers. Lithium and sodium rows: ${n(s.records)}, ${n(s.papers)} papers, ${n(s.formulas)} formulas, ${n(s.tierA)} tier A. Facts-only file: ${n(s.facts_rows)} rows. The facts rows are not included in the open count.</p>
    <h2 style="margin-top:8px">Files</h2>
    ${list || '<p class="muted">File list unavailable.</p>'}
    <h2>Licence</h2>
    <p>The open file is CC BY. The facts file is released CC BY 4.0 and keeps the source article licence on each row. Cite the DOI on the row you use.</p>
    <h2>Tiers</h2>
    <p>Tier A is the stricter subset: a table value, a named material, a unit taken from the header, measured in that paper, and not marked approximate. Tier B passed the other checks and missed at least one of those. On the facts file, <span class="k">would_be_tier_a</span> records the same mechanical gate and does not place the row in Tier A.</p>
    <h2>Reading the table</h2>
    <pre>import pandas as pd
df = pd.read_csv("ion_transport_LiNa_open.csv")
df = pd.read_parquet("ion_transport_LiNa_open.parquet")</pre>
    ${schema ? `<h2>Fields</h2><dl class="fields">${Object.entries(schema).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}`;
}

/* ---------- router ---------- */
const routes = {'': home, explore, leaderboard, reproducibility, downloads, data: downloads};
const TITLES = {'': 'Overview', explore: 'Explorer', leaderboard: 'Leaderboard', reproducibility: 'Reproducibility', downloads: 'Downloads', data: 'Downloads'};
let mute = false, lastPath = null, rendering = false, again = null;
function parseRoute() {
  let raw = location.hash.replace(/^#/, '');
  if (raw.startsWith('/')) raw = raw.slice(1);
  const i = raw.indexOf('?');
  const path = (i < 0 ? raw : raw.slice(0, i)).replace(/\/$/, '');
  const q = new URLSearchParams(i < 0 ? '' : raw.slice(i + 1));
  return {path, q};
}
function setHash(path, params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') sp.set(k, String(v)); });
  const qs = sp.toString();
  const next = '#/' + path + (qs ? '?' + qs : '');
  if (location.hash === next) return;
  mute = true;
  location.hash = next;
}
function navOn(path) {
  document.querySelectorAll('nav a').forEach(a => {
    const href = a.getAttribute('href');
    const p = href === '#/' ? '' : href.replace('#/', '');
    if (p === path || (p === 'downloads' && path === 'data')) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}
async function run(fn) {
  app.dataset.ready = '0';
  try { await fn(); }
  catch (e) {
    console.error(e);
    app.innerHTML = '<h1>This page could not be drawn.</h1><p class="muted">The files it reads did not load.</p>';
  }
  app.dataset.ready = '1';
}
async function go(scroll = true, reason = 'nav') {
  if (rendering) { again = {scroll, reason}; return; }
  rendering = true;
  const r = parseRoute();
  const entered = r.path !== lastPath;
  lastPath = r.path;
  if (r.path === 'explore' && (entered || reason === 'nav')) readExplore(r.q);
  navOn(r.path);
  document.title = (TITLES[r.path] || 'Overview') + ' · Ion transport';
  await run(routes[r.path] || home);
  if (scroll) window.scrollTo(0, 0);
  rendering = false;
  if (again) { const a = again; again = null; go(a.scroll, a.reason); }
}
addEventListener('hashchange', () => { if (mute) { mute = false; return; } go(true, 'nav'); });
let lastW = innerWidth, rst;
addEventListener('resize', () => {
  clearTimeout(rst);
  rst = setTimeout(() => {
    if (Math.abs(innerWidth - lastW) < 40) return;
    lastW = innerWidth;
    go(false, 'resize');
  }, 180);
});
go(false, 'nav');
