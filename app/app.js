// Leonida Ledger — GTA VI trophy guide & tracker.
// Static and offline: the only file it fetches is its own data/trophies.json.
// Progress lives in localStorage; export/import move it as JSON.
const STORAGE_KEY = 'gta6-trophy-checklist';
const DEMO_IDS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 15, 16, 19, 21];
const CATEGORY_LABELS = { story: 'Story', missable: 'Missable', collectibles: 'Collectibles', activities: 'Activities', online: 'Online' };

const doc = await (await fetch('data/trophies.json')).json();
const trophies = doc.trophies;
const byId = new Map(trophies.map((t) => [t.id, t]));

const params = new URLSearchParams(location.search);
const demoMode = params.has('demo');
let earned = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]').filter((id) => byId.has(id)));
if (demoMode) earned = new Set(DEMO_IDS);

let view = ['checklist', 'roadmap', 'missable', 'guide'].includes(params.get('view')) ? params.get('view') : 'checklist';
let category = params.get('filter') ?? 'all';
let gradeFilter = params.get('grade') ?? 'all';
let query = params.get('q') ?? '';
let spoilerOn = params.get('spoiler') !== 'off';
let selectedId = Number(params.get('trophy') ?? 28);
if (!byId.has(selectedId)) selectedId = 28;

const $ = (id) => document.getElementById(id);
const listEl = $('trophyList'), detailEl = $('detailPanel'), roadmapEl = $('roadmapView'),
  missableEl = $('missableView'), listCol = $('listCol'), detailCol = $('detailCol'),
  layoutEl = document.querySelector('.layout');

function isSpoilerHidden(t) {
  return spoilerOn && t.hidden && t.category === 'story' && !earned.has(t.id);
}

function displayName(t) {
  return isSpoilerHidden(t) ? 'Hidden story trophy' : t.name;
}

function saveEarned() {
  if (demoMode) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...earned].sort((a, b) => a - b)));
}

function syncUrl() {
  const p = new URLSearchParams();
  p.set('view', view);
  if (category !== 'all') p.set('filter', category);
  if (gradeFilter !== 'all') p.set('grade', gradeFilter);
  if (query) p.set('q', query);
  if (!spoilerOn) p.set('spoiler', 'off');
  if (view === 'guide' || view === 'checklist') p.set('trophy', String(selectedId));
  if (demoMode) p.set('demo', '13');
  history.replaceState(null, '', `${location.pathname}?${p}`);
}

function gradeCountsText() {
  const totals = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  const got = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const t of trophies) { totals[t.grade]++; if (earned.has(t.id)) got[t.grade]++; }
  return `Platinum ${got.platinum}/${totals.platinum} · Gold ${got.gold}/${totals.gold} · Silver ${got.silver}/${totals.silver} · Bronze ${got.bronze}/${totals.bronze}`;
}

function renderHeader() {
  const totalSources = trophies.reduce((n, t) => n + t.sources.length, 0);
  const twoPlus = trophies.filter((t) => t.sources.length >= 2).length;
  const sites = [...new Set(trophies.flatMap((t) => t.sources.map((s) => s.site)))];
  $('earnedCount').textContent = String(earned.size);
  $('progressFill').style.width = `${Math.round((earned.size / trophies.length) * 100)}%`;
  $('progressPct').textContent = `${Math.round((earned.size / trophies.length) * 100)}% to platinum`;
  $('gradeCounts').textContent = gradeCountsText();
  $('citationLine').textContent = `${totalSources} claims cited across ${trophies.length} trophies · ${twoPlus}/${trophies.length} trophies cite 2+ named sources · Sources checked: ${sites.join(', ')} · 1 potentially missable trophy · 0 online trophies`;
  $('sourceLine').textContent = `Sources checked for this guide (20 Nov 2026): PowerPyx trophy guide & roadmap, Push Square trophy guide & roadmap, Exophase official trophy list, PSNProfiles PSN progress targets. ${totalSources} cited claims in total.`;
  $('demoNote').hidden = !demoMode;
}

function filteredTrophies() {
  const q = query.trim().toLowerCase();
  return trophies.filter((t) => {
    if (category === 'online') return false;
    if (category !== 'all' && t.category !== category) return false;
    if (gradeFilter !== 'all' && t.grade !== gradeFilter) return false;
    if (q && !(t.name + ' ' + t.description + ' ' + t.guide).toLowerCase().includes(q)) return false;
    return true;
  });
}

function tagSpans(t) {
  const tags = [`<span class="tag">${CATEGORY_LABELS[t.category]}</span>`, `<span class="tag">Stage ${t.stage}</span>`];
  if (t.missable) tags.push('<span class="tag miss">Missable — do it in Chapter 1</span>');
  if (t.guide.includes('community details pending')) tags.push('<span class="tag pending">Method unconfirmed</span>');
  if (t.hidden) tags.push('<span class="tag">Hidden on PSN</span>');
  return tags.join('');
}

function renderList() {
  const rows = filteredTrophies();
  $('listMeta').textContent = `Showing ${rows.length} of ${trophies.length} trophies · ${earned.size} earned · tick a box to save it in this browser`;
  $('onlineNote').hidden = category !== 'online';
  listEl.replaceChildren();
  for (const t of rows) {
    const li = document.createElement('li');
    if (earned.has(t.id)) li.classList.add('earned');
    if (t.id === selectedId) li.classList.add('selected');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = earned.has(t.id);
    box.setAttribute('aria-label', `Earned: ${displayName(t)}`);
    box.addEventListener('change', () => {
      if (box.checked) earned.add(t.id); else earned.delete(t.id);
      saveEarned(); renderAll();
    });
    box.addEventListener('click', (e) => e.stopPropagation());
    const body = document.createElement('div');
    const hidden = isSpoilerHidden(t);
    body.innerHTML = `<div class="trophy-name">${displayName(t)}${hidden ? ' <span class="hidden-tag">(story spoiler hidden)</span>' : ''}</div>` +
      `<div class="trophy-desc">${hidden ? 'Hidden until earned — turn spoilers off to reveal.' : t.description}</div>` +
      `<div class="trophy-tags">${tagSpans(t)}</div>`;
    const badge = document.createElement('span');
    badge.className = `badge ${hidden ? '' : t.grade}`;
    badge.textContent = hidden ? 'Hidden' : t.grade;
    li.append(box, body, badge);
    li.addEventListener('click', () => { selectedId = t.id; if (view === 'roadmap' || view === 'missable') view = 'checklist'; renderAll(); });
    listEl.append(li);
  }
}

function renderDetail() {
  const t = byId.get(selectedId);
  const hidden = isSpoilerHidden(t);
  const pending = t.guide.includes('community details pending');
  detailEl.innerHTML =
    `<p class="detail-meta">${CATEGORY_LABELS[t.category]} · Stage ${t.stage} of 5 · ${t.grade}${t.hidden ? ' · Hidden on PSN' : ''}</p>` +
    `<h2>${displayName(t)}</h2>` +
    `<p class="official">${hidden ? 'Official description hidden until earned.' : t.description}</p>` +
    (t.missable ? '<div class="warn-box"><b>Potentially missable.</b> One meditation in Chapter 1 at Jason\u2019s house can be lost — see the guide below and keep a save at the start of Chapter 1.</div>' : '') +
    (pending ? '<div class="pending-box"><b>Method not yet confirmed.</b> Guide from the official description only — community details pending. No guess is printed here.</div>' : '') +
    `<p class="guide-text">${hidden ? 'Turn spoilers off to read this guide.' : t.guide}</p>` +
    `<h3>Sources</h3><ul class="sources">` +
    t.sources.map((s) => `<li><b>${s.site}</b> — ${s.note}</li>`).join('') +
    `</ul><p class="detail-meta">Every fact above is cited to a named source checked during the build. Nothing here is copied from those guides.</p>`;
}

function renderRoadmap() {
  roadmapEl.replaceChildren();
  for (const stage of doc.roadmap) {
    const members = trophies.filter((t) => t.stage === stage.stage);
    const got = members.filter((t) => earned.has(t.id)).length;
    const pct = Math.round((got / members.length) * 100);
    const card = document.createElement('div');
    card.className = 'stage-card';
    card.innerHTML = `<h3>${stage.title}</h3><p>${stage.note}</p>` +
      `<div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>` +
      `<p>${got} of ${members.length} trophies in this stage · ${pct}%</p>` +
      `<p class="stage-names">${members.map((t) => displayName(t)).join(' · ')}</p>`;
    roadmapEl.append(card);
  }
}

function renderMissable() {
  const t = byId.get(28);
  missableEl.replaceChildren();
  const hero = document.createElement('div');
  hero.className = 'missable-hero';
  hero.innerHTML = `<h3>Only 1 potentially missable trophy</h3>` +
    `<p>PowerPyx lists a single potentially missable trophy in GTA VI: <b>Positive Mental Attitude</b>. Every other trophy can be earned after the story in free-roam — PowerPyx notes all trophy-related quest givers return, the Kingpin Bowling robbery respawns, and nothing on the 100% checklist is missable. The one warning is the Chapter 1 meditation at Jason\u2019s house, and even that is still unconfirmed as a requirement.</p>` +
    `<p><b>Protect yourself:</b> keep a separate save at the start of each chapter (15 manual slots; no mission replay) and never play with cheats on your platinum save — cheats disable trophies and saving.</p>`;
  missableEl.append(hero);
  const card = document.createElement('div');
  card.className = 'stage-card';
  card.innerHTML = `<h3>${t.name} — ${t.grade}</h3><p class="official">${t.description}</p><p>${t.guide}</p>` +
    `<ul class="sources">${t.sources.map((s) => `<li><b>${s.site}</b> — ${s.note}</li>`).join('')}</ul>`;
  missableEl.append(card);
  const rest = document.createElement('p');
  rest.className = 'stage-names';
  rest.textContent = 'All 54 other trophies: not missable. Story trophies unlock by playing the chapters; side-quest finales stay available after the story; collectibles, activities and robberies can all be finished in free-roam.';
  missableEl.append(rest);
}

function renderAll() {
  renderHeader();
  document.querySelectorAll('.views button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('#categoryTabs button').forEach((b) => b.classList.toggle('active', b.dataset.cat === category));
  $('gradeFilter').value = gradeFilter;
  $('searchBox').value = query;
  $('spoilerToggle').checked = spoilerOn;
  const wide = view === 'roadmap' || view === 'missable' || view === 'guide';
  layoutEl.style.gridTemplateColumns = wide ? '1fr' : '';
  listEl.hidden = view !== 'checklist';
  $('listMeta').hidden = view !== 'checklist';
  roadmapEl.hidden = view !== 'roadmap';
  missableEl.hidden = view !== 'missable';
  detailCol.style.display = view === 'roadmap' || view === 'missable' ? 'none' : '';
  if (view === 'guide') listCol.style.display = 'none'; else listCol.style.display = '';
  if (view === 'checklist') renderList();
  if (view === 'roadmap') renderRoadmap();
  if (view === 'missable') renderMissable();
  renderDetail();
  syncUrl();
}

document.querySelectorAll('.views button').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; renderAll(); }));
document.querySelectorAll('#categoryTabs button').forEach((b) => b.addEventListener('click', () => {
  category = b.dataset.cat;
  if (category === 'missable') { selectedId = 28; }
  if (view === 'roadmap' || view === 'missable' || view === 'guide') view = 'checklist';
  renderAll();
}));
$('gradeFilter').addEventListener('change', (e) => { gradeFilter = e.target.value; renderAll(); });
$('searchBox').addEventListener('input', (e) => { query = e.target.value; if (view !== 'checklist') view = 'checklist'; renderList(); syncUrl(); });
$('spoilerToggle').addEventListener('change', (e) => { spoilerOn = e.target.checked; renderAll(); });
$('exportBtn').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ game: 'Grand Theft Auto VI', earned: [...earned].sort((x, y) => x - y) }, null, 2)], { type: 'application/json' }));
  a.download = 'gta6-trophy-progress.json';
  a.click();
});
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const ids = Array.isArray(data) ? data : data.earned;
    const next = new Set((ids ?? []).filter((id) => byId.has(id)));
    earned = next; saveEarned(); renderAll();
  } catch { alert('That file is not valid trophy progress JSON.'); }
  e.target.value = '';
});

renderAll();
