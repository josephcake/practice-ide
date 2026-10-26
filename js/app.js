/* ============================================================
   APP
   ============================================================ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const store = {
  get(k, d) {
    try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }
    catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch { return false; /* quota */ }
  },
  remove(k) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
};

const KEYS = {
  done: 'gs.done',
  notes: 'gs.notes',
  draft: (id) => 'gs.draft.' + id,
  last: 'gs.last',
  lastCoding: 'gs.last.coding',
  lastDesign: 'gs.last.design',
  page: 'gs.page',
  queue: 'gs.queue',
  run: (id) => 'gs.run.' + id,
  runs: 'gs.runs',
  ai: (id) => 'gs.ai.' + id,
  review: (id) => 'gs.review.' + id,
  solve: (id) => 'gs.solve.' + id
};

// a sensible default work order: warm-ups -> async -> core -> design
// the queue now opens with the verified Goldman set, in interview order
const DEFAULT_QUEUE_GS = [...new Set([
  'gs-fraction-decimal', 'gs-high-five', 'gs-forest-root', 'gs-first-unique',
  'gs-most-frequent-ip', 'gs-optimal-path', 'gs-car-add', 'gs-merge-intervals',
  'gs-min-window-sub', 'gs-josephus', 'gs-rounding', 'gs-robot-grid',
  'gs-lru-ttl', 'gs-parking-garage', 'gs-magic-potion',
  // scraped 2024-2026 set, appended to the end of the queue
  ...(typeof GS_SCRAPED !== 'undefined' ? GS_SCRAPED.map((q) => q.id) : []),
  ...(typeof GS_SCRAPED_DESIGN !== 'undefined' ? GS_SCRAPED_DESIGN.map((q) => q.id) : []),
  'concurrency-pool', 'order-book',
  ...(typeof DESIGN_QUESTIONS !== 'undefined' ? DESIGN_QUESTIONS.map((q) => q.id) : [])
])];

const DEFAULT_QUEUE = [
  'two-sum', 'valid-parens', 'best-time-stock', 'tree-bst', 'climb-stairs',
  'group-anagrams', 'lru-cache', 'concurrency-pool', 'debounce-throttle',
  'promise-combinators', 'js-traps', 'coin-change',
  'order-book', 'ledger', 'rate-limiter'
];

const state = {
  active: null,
  view: 'questions',   // questions | plan
  tab: 'prompt',       // prompt | notes
  showSolution: false,
  aiOpen: false,
  done: new Set(store.get(KEYS.done, [])),
  notes: store.get(KEYS.notes, {}),
  search: '',
  designSearch: '',
  page: 'coding',
  level: 'all',
  sen: 'all',
  cat: 'all',
  lastResults: null,
  logs: [],
  running: false,
  viewingSavedRun: false,
  runStartedAt: null,
  runCode: null,
  savedRun: null,
  ai: null,
  aiLoading: false,
  aiLoadingMode: null,
  aiLastMode: 'next',
  aiError: null,
  hintSelection: '',
  explainTerm: '',
  aiExplaining: false,
  aiExplainError: null,
  solve: null,
  solveLoading: false,
  solveError: null,
  review: null,
  reviewLoading: false,
  reviewError: null,
  queue: (() => {
    const saved = store.get(KEYS.queue, null);
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : DEFAULT_QUEUE_GS.slice();
  })()
};

/* ------------------------------------------------------------
   Queue seeding
   The scraped set is appended to the SAVED queue exactly once.
   A returning user already has a localStorage queue, so a fresh
   DEFAULT_QUEUE_GS alone would never show the new questions.
   Ids are remembered after seeding, so removing one is permanent.
   ------------------------------------------------------------ */
const QUEUE_SEED_KEY = 'gs.queue.seeded';
function seedScrapedQueue() {
  const scraped = [
    ...(typeof GS_SCRAPED !== 'undefined' ? GS_SCRAPED : []),
    ...(typeof GS_SCRAPED_DESIGN !== 'undefined' ? GS_SCRAPED_DESIGN : [])
  ].map((q) => q.id);
  if (!scraped.length) return;
  const seeded = store.get(QUEUE_SEED_KEY, []);
  const fresh = scraped.filter((id) => !seeded.includes(id) && !state.queue.includes(id));
  if (fresh.length) {
    state.queue.push(...fresh);
    store.set(KEYS.queue, state.queue);
  }
  store.set(QUEUE_SEED_KEY, [...new Set([...seeded, ...scraped])]);
}
seedScrapedQueue();

const DESIGN_SEED_KEY = 'gs.queue.design';
function seedDesignQueue() {
  const ids = (typeof DESIGN_QUESTIONS !== 'undefined' ? DESIGN_QUESTIONS : []).map((q) => q.id);
  if (!ids.length) return;
  const seeded = store.get(DESIGN_SEED_KEY, []);
  const fresh = ids.filter((id) => !seeded.includes(id) && !state.queue.includes(id));
  if (fresh.length) {
    state.queue.push(...fresh);
    store.set(KEYS.queue, state.queue);
  }
  store.set(DESIGN_SEED_KEY, [...new Set([...seeded, ...ids])]);
}

const SEN_LABEL = { junior: 'Junior', mid: 'Mid', senior: 'Senior', manager: 'Manager', 'N/A': 'Level N/A' };
const SEN_ABBR = { junior: 'JR', mid: 'MID', senior: 'SR', manager: 'MGR', 'N/A': 'N/A' };
const senClass = (s) => (s === 'N/A' ? 'sen-na' : 'sen-' + String(s).toLowerCase());

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GS = (typeof GS_QUESTIONS !== 'undefined') ? GS_QUESTIONS.slice() : [];
if (typeof GS_SCRAPED !== 'undefined') GS.push(...GS_SCRAPED);
// design / behavioral entries join the existing design library in place
if (typeof GS_SCRAPED_DESIGN !== 'undefined' && typeof DESIGN_QUESTIONS !== 'undefined') {
  DESIGN_QUESTIONS.push(...GS_SCRAPED_DESIGN);
}
const ROUNDS = (typeof GS_ROUNDS !== 'undefined') ? GS_ROUNDS : [];
const ALL_CODING = [...GS, ...QUESTIONS];
const allItems = () => [...ALL_CODING, ...DESIGN_QUESTIONS];
const byId = (id) => allItems().find((q) => q.id === id);
const designQuestions = () => (typeof DESIGN_QUESTIONS !== 'undefined' ? DESIGN_QUESTIONS : []);

/* ------------------------------------------------------------
   Highlighting
   A small JS tokenizer. Used for the reference solutions and for
   the coloured layer behind the editor textarea.
   ------------------------------------------------------------ */
const KEYWORD_RE = /^(?:function|class|const|let|var|return|if|else|for|while|do|of|in|new|await|async|try|catch|finally|throw|typeof|instanceof|null|undefined|true|false|this|break|continue|switch|case|default|delete|export|import|extends|super|void|yield|static|get|set)$/;

function highlight(code) {
  let out = '';
  let i = 0;
  const emit = (cls, text) => {
    out += cls ? `<span class="${cls}">${esc(text)}</span>` : esc(text);
  };
  while (i < code.length) {
    const rest = code.slice(i);
    let m;
    if ((m = /^\/\/[^\n]*/.exec(rest))) { emit('tok-com', m[0]); i += m[0].length; continue; }
    if ((m = /^\/\*[\s\S]*?\*\//.exec(rest))) { emit('tok-com', m[0]); i += m[0].length; continue; }
    if ((m = /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/.exec(rest))) {
      emit('tok-str', m[0]); i += m[0].length; continue;
    }
    if ((m = /^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(rest))) {
      emit('tok-num', m[0]); i += m[0].length; continue;
    }
    if ((m = /^[A-Za-z_$][\w$]*/.exec(rest))) {
      const word = m[0];
      const call = /^\s*\(/.test(code.slice(i + word.length));
      emit(KEYWORD_RE.test(word) ? 'tok-kw' : call ? 'tok-fn' : 'tok-id', word);
      i += word.length; continue;
    }
    if ((m = /^\s+/.exec(rest))) { emit(null, m[0]); i += m[0].length; continue; }
    if ((m = /^[{}()[\];,.]/.exec(rest))) { emit('tok-punc', m[0]); i += 1; continue; }
    if ((m = /^[+\-*/%=<>!&|^~?:]+/.exec(rest))) { emit('tok-op', m[0]); i += m[0].length; continue; }
    emit(null, code[i]); i += 1;
  }
  return out;
}

/* ------------------------------------------------------------
   Toast
   ------------------------------------------------------------ */
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 1800);
}

/* ------------------------------------------------------------
   Sidebar
   ------------------------------------------------------------ */
const CAT_LABEL = {
  all: 'All',
  arrays: 'Arrays',
  strings: 'Strings',
  linkedlist: 'Lists',
  trees: 'Trees',
  dp: 'DP',
  async: 'Async',
  js: 'JS'
};

/* ------------------------------------------------------------
   Queue (the left-hand practising order)
   ------------------------------------------------------------ */
function codingQueue() {
  return state.queue.filter((id) => {
    const item = byId(id);
    return item && ALL_CODING.includes(item);
  });
}

function renderQueue() {
  const queue = codingQueue();
  const rows = queue.map((id, i) => {
    const item = byId(id);
    if (!item) return '';
    const done = state.done.has(id);
    const on = state.active && state.active.id === id;
    const isDesign = DESIGN_QUESTIONS.includes(item);
    const hasMap = typeof DESIGN_GRAPHS !== 'undefined' && !!DESIGN_GRAPHS[id];
    const k = item.seniority ? (SEN_ABBR[item.seniority] || 'N/A') : (isDesign ? (hasMap ? 'MAP' : 'D') : 'L' + item.level);
    const tip = [item.title, item.seniority ? SEN_LABEL[item.seniority] : '',
      item.added ? 'added ' + item.added : '', hasMap ? 'interactive architecture map' : ''].filter(Boolean).join(' · ');
    return `<div class="qrow${on ? ' on now' : ''}" data-id="${id}" title="${esc(tip)}">
      <span class="done-dot ${done ? '' : 'off'}"></span>
      <span class="qn">${i + 1}</span>
      <span class="t">${esc(item.title)}</span>
      <span class="k${item.seniority ? ' k-sen' : (hasMap ? ' k-map' : '')}">${esc(k)}</span>
      <span style="display:flex;gap:4px">
        <button class="mini up" data-act="up" title="Move up (${i === 0 ? 'disabled' : '⌥↑'})">↑</button>
        <button class="mini x" data-act="remove" title="Remove from queue">×</button>
      </span>
    </div>`;
  }).join('');

  $('#queue-list').innerHTML = rows;
  const doneInQueue = queue.filter((id) => state.done.has(id)).length;
  $('#queue-count').textContent = `${doneInQueue}/${queue.length}`;
  $('#btn-queue-next').disabled = nextQueuedId() === null;
}

function nextQueuedId() {
  const queue = codingQueue();
  if (!queue.length) return null;
  const after = state.active ? queue.indexOf(state.active.id) : -1;
  const order = after >= 0 ? queue.slice(after + 1).concat(queue.slice(0, after + 1)) : queue;
  const pending = order.find((id) => !state.done.has(id));
  return pending !== undefined ? pending : null;
}

function queueAdd(id) {
  if (state.queue.includes(id)) return;
  state.queue.push(id);
  persistQueue();
}

function queueRemove(id) {
  state.queue = state.queue.filter((x) => x !== id);
  persistQueue();
}

function queueMove(id, dir) {
  const i = state.queue.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= state.queue.length) return;
  [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
  persistQueue();
}

function persistQueue() {
  store.set(KEYS.queue, state.queue);
  renderQueue();
  renderSidebar(); // refresh the add buttons in the library
}

$('#queue-list').addEventListener('click', (e) => {
  const row = e.target.closest('.qrow');
  if (!row) return;
  const id = row.dataset.id;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'remove') return queueRemove(id);
  if (act === 'up') return queueMove(id, -1);
  open(id);
});

$('#queue-list').addEventListener('dblclick', (e) => {
  const row = e.target.closest('.qrow');
  if (row) queueRemove(row.dataset.id);
});

$('#btn-queue-next').addEventListener('click', () => {
  const id = nextQueuedId();
  if (id) open(id);
});

$('#btn-queue-reset').addEventListener('click', () => {
  if (!confirm('Clear the whole queue? The library below is unchanged.')) return;
  state.queue = [];
  persistQueue();
  toast('Queue cleared');
});

function matches(item, q, isDesign) {
  if (state.level !== 'all' && String(item.level) !== String(state.level)) return false;
  // role-level filter only applies to entries the source actually labeled;
  // unlabeled questions stay visible under "All levels"
  if (state.sen !== 'all' && (!item.seniority || item.seniority !== state.sen)) return false;
  if (state.cat !== 'all') {
    if (isDesign) { if (state.cat !== 'design') return false; }
    else if (state.cat === 'gs') { if (item.cat !== 'gs-core') return false; }
    else if (state.cat === 'design') return false;
    else if (item.cat !== state.cat) return false;
  }
  if (q) {
    const hay = [item.title, item.prompt, item.solution, (item.hints || []).join(' '), item.seniority, item.levelWhy,
      (item.sources || []).map((x) => x.label).join(' ')].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function renderSidebar() {
  const q = state.search.trim().toLowerCase();

  const gsList = GS.filter((item) => matches(item, q, false));
  const libList = QUESTIONS.filter((item) => matches(item, q, false));

  let html = '';
  if (gsList.length) {
    html += '<div class="group-h gs-group">Goldman Sachs <span class="cnt">' + gsList.length + '</span></div>';
    for (const item of gsList) html += itemRow(item);
  }
  if (libList.length) {
    html += '<div class="group-h">General practice</div>';
    for (const item of libList) html += itemRow(item);
  }
  if (!html) html = '<div class="empty" style="padding:16px 8px">No matches.</div>';
  $('#q-list').innerHTML = html;
}

function itemRow(item, design = false) {
  const on = state.active && state.active.id === item.id ? ' on' : '';
  const done = state.done.has(item.id);
  const queued = state.queue.includes(item.id);
  const isGs = item.cat === 'gs-core';
  const hasMap = design && typeof DESIGN_GRAPHS !== 'undefined' && !!DESIGN_GRAPHS[item.id];
  const badge = design ? (hasMap ? 'MAP' : 'D') : (isGs ? 'GS' : 'L' + item.level);
  const cls = design ? (hasMap ? 'map' : 'l' + item.level) : (isGs ? 'gs' : 'l' + item.level);
  const ttl = [item.title, item.seniority ? SEN_LABEL[item.seniority] : '',
    item.added ? 'added ' + item.added : '', item.reportCount || '',
    hasMap ? 'interactive architecture map' : ''].filter(Boolean).join('\n');
  const sen = item.seniority
    ? `<span class="lvl sen ${senClass(item.seniority)}" title="${esc(item.levelWhy || SEN_LABEL[item.seniority])}">${SEN_ABBR[item.seniority] || 'N/A'}</span>`
    : '<span class="lvl-slot"></span>';
  return `<div class="item${on}" data-id="${item.id}">
    <span class="done-dot ${done ? '' : 'off'}"></span>
    <span class="t" title="${esc(ttl)}">${esc(item.title)}</span>
    ${sen}
    <span class="lvl ${cls}">${badge}</span>
    <button class="add-btn${queued ? ' queued' : ''}" data-act="add" title="${queued ? 'Already in queue' : 'Add to queue'}">${queued ? '✓' : '+'}</button>
  </div>`;
}


function designRow(item) {
  const on = state.active && state.active.id === item.id ? ' on' : '';
  const done = state.done.has(item.id);
  const hasMap = typeof DESIGN_GRAPHS !== 'undefined' && !!DESIGN_GRAPHS[item.id];
  const ttl = [item.title, item.cat, hasMap ? 'interactive architecture' : 'open-ended / behavioral'].filter(Boolean).join(' · ');
  return `<div class="item design-item${on}" data-id="${item.id}" title="${esc(ttl)}">
    <span class="done-dot ${done ? '' : 'off'}"></span>
    <span class="t">${esc(item.title)}</span>
    <span class="lvl ${hasMap ? 'map' : ''}">${hasMap ? 'MAP' : 'D'}</span>
  </div>`;
}

function renderDesignSidebar() {
  const list = $('#design-list');
  if (!list) return;
  const all = designQuestions();
  const q = (state.designSearch || '').trim().toLowerCase();
  const filtered = all.filter((item) => {
    if (!q) return true;
    const hay = [item.title, item.prompt, item.cat, item.seniority, (item.topics || []).join(' ')].join(' ').toLowerCase();
    return hay.includes(q);
  });
  const hasMap = (item) => typeof DESIGN_GRAPHS !== 'undefined' && !!DESIGN_GRAPHS[item.id];
  const maps = filtered.filter((item) => hasMap(item));
  const openItems = filtered.filter((item) => !hasMap(item));
  let html = '';
  if (maps.length) {
    html += `<div class="group-h">Architecture maps <span class="cnt">${maps.length}</span></div>`;
    html += maps.map(designRow).join('');
  }
  if (openItems.length) {
    html += `<div class="group-h">Behavioral / open-ended <span class="cnt">${openItems.length}</span></div>`;
    html += openItems.map(designRow).join('');
  }
  if (!html) html = '<div class="empty" style="padding:16px 8px">No design questions match.</div>';
  list.innerHTML = html;
  const count = $('#design-count');
  if (count) count.textContent = String(all.length);
  const next = $('#btn-design-next');
  if (next) next.disabled = !nextDesignId();
}

function nextDesignId() {
  const all = designQuestions();
  if (!all.length) return null;
  const idx = state.active ? all.findIndex((q) => q.id === state.active.id) : -1;
  const order = idx >= 0 ? all.slice(idx + 1).concat(all.slice(0, idx + 1)) : all;
  const next = order.find((q) => !state.done.has(q.id));
  return next ? next.id : null;
}

function updateProgress() {
  const label = $('#prog-label');
  const val = $('#prog-val');
  const bar = $('#prog-bar');
  if (!val || !bar) return;
  if (state.page === 'design') {
    const all = designQuestions();
    const done = all.filter((q) => state.done.has(q.id)).length;
    if (label) label.textContent = 'Design completed';
    val.textContent = `${done}/${all.length}`;
    bar.style.width = all.length ? Math.round((done / all.length) * 100) + '%' : '0%';
    return;
  }
  const done = ALL_CODING.filter((q) => state.done.has(q.id)).length;
  if (label) label.textContent = 'Completed';
  val.textContent = `${done}/${ALL_CODING.length}`;
  bar.style.width = Math.round((done / ALL_CODING.length) * 100) + '%';
}

function setPageChrome(page) {
  state.page = page;
  store.set(KEYS.page, page);
  document.body.classList.toggle('mode-design', page === 'design');
  document.querySelectorAll('#page-nav [data-page]').forEach((btn) => {
    const on = btn.dataset.page === page;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  updateProgress();
  renderSidebar();
  renderQueue();
  renderDesignSidebar();
}

function switchPage(page) {
  const pool = page === 'design' ? designQuestions() : ALL_CODING;
  if (!pool.length) return;
  if (state.page === page && state.active && pool.includes(state.active)) return;
  let next = state.active && pool.includes(state.active) ? state.active : null;
  if (!next) {
    const lastId = store.get(page === 'design' ? KEYS.lastDesign : KEYS.lastCoding, null);
    const last = lastId ? byId(lastId) : null;
    if (last && pool.includes(last)) next = last;
  }
  if (!next) next = pool.find((q) => !state.done.has(q.id)) || pool[0];
  if (next) open(next.id);
}

$('#q-list').addEventListener('click', (e) => {
  const row = e.target.closest('.item');
  if (!row) return;
  const id = row.dataset.id;
  if (e.target.closest('[data-act="add"]')) {
    if (!state.queue.includes(id)) { queueAdd(id); toast('Added to queue'); }
    return;
  }
  open(id);
});

$('#search').addEventListener('input', (e) => { state.search = e.target.value; renderSidebar(); });

$('#level-chips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  state.level = b.dataset.level;
  $$('#level-chips .chip').forEach((c) => c.classList.toggle('on', c === b));
  renderSidebar();
});

$('#sen-chips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  state.sen = b.dataset.sen;
  $$('#sen-chips .chip').forEach((c) => c.classList.toggle('on', c === b));
  renderSidebar();
});

$('#cat-chips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  state.cat = b.dataset.cat;
  $$('#cat-chips .chip').forEach((c) => c.classList.toggle('on', c === b));
  renderSidebar();
});

/* ------------------------------------------------------------
   Editor
   ------------------------------------------------------------ */
const ed = $('#editor');
const gutter = $('#gutter');
const codeLayer = $('#highlight');

function diffSolutionLines(before, after) {
  const a = String(before || '').split(/\r?\n/);
  const b = String(after || '').split(/\r?\n/);
  const n = a.length, m = b.length;
  if (n * m > 220000) {
    const known = new Set(a);
    return b.map((text) => ({ text, added: !known.has(text) }));
  }
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ text: b[j], added: false });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      out.push({ text: b[j], added: true });
      j++;
    }
  }
  while (j < m) {
    out.push({ text: b[j], added: true });
    j++;
  }
  return out;
}

function paintEditor() {
  if (!codeLayer) return;
  const rec = state.solve;
  const applied = !!(rec && typeof rec.baseCode === 'string' && rec.solution === ed.value);
  if (applied) {
    const lines = diffSolutionLines(rec.baseCode, ed.value);
    codeLayer.innerHTML = lines.map((line) =>
      `<span class="diff-line${line.added ? ' diff-add' : ''}">${line.text ? highlight(line.text) : '&nbsp;'}</span>`
    ).join('');
    ed.title = 'Green-tinted lines were added or changed by Solve it.';
  } else {
    codeLayer.innerHTML = highlight(ed.value) + '\n';
    ed.title = '';
  }
  codeLayer.scrollTop = ed.scrollTop;
  codeLayer.scrollLeft = ed.scrollLeft;
}

function loadCode(item) {
  const draft = store.get(KEYS.draft(item.id), null);
  ed.value = draft !== null ? draft : (item.starter || '');
  ed.scrollTop = 0;
  ed.scrollLeft = 0;
  paintEditor();
  syncGutter();
}

ed.addEventListener('input', () => {
  if (!state.active) return;
  store.set(KEYS.draft(state.active.id), ed.value);
  paintEditor();
  syncGutter();
  markRunStale();
  markHintStale();
  setStatus('');
});

ed.addEventListener('scroll', () => {
  gutter.scrollTop = ed.scrollTop;
  if (codeLayer) {
    codeLayer.scrollTop = ed.scrollTop;
    codeLayer.scrollLeft = ed.scrollLeft;
  }
});

function syncGutter() {
  const lines = ed.value.split('\n').length;
  const pad = String(lines).length;
  let html = '';
  for (let i = 1; i <= lines; i++) {
    const bad = state.lastResults && state.lastResults.errorLines && state.lastResults.errorLines.has(i);
    html += `<div class="gl${bad ? ' bad' : ''}">${i}</div>`;
  }
  gutter.innerHTML = html;
  gutter.style.minWidth = (pad + 2) + 'ch';
  gutter.scrollTop = ed.scrollTop;
}

ed.addEventListener('keydown', (e) => {
  const { selectionStart: s, selectionEnd: en, value } = ed;

  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    runTests();
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'h') {
    e.preventDefault();
    toggleAIPane();
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) {
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      if (value.slice(lineStart, lineStart + 2) === '  ') {
        ed.setRangeText('', lineStart, lineStart + 2, 'preserve');
      }
    } else if (s !== en && value.slice(s, en).includes('\n')) {
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const block = value.slice(lineStart, en);
      const changed = e.shiftKey
        ? block.split('\n').map((l) => (l.startsWith('  ') ? l.slice(2) : l)).join('\n')
        : block.split('\n').map((l) => '  ' + l).join('\n');
      ed.setRangeText(changed, lineStart, en, 'preserve');
    } else {
      ed.setRangeText('  ', s, en, 'end');
    }
    ed.dispatchEvent(new Event('input'));
    return;
  }
  if (e.key === 'Enter') {
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const indent = (value.slice(lineStart, s).match(/^[ \t]*/) || [''])[0];
    const before = value.slice(0, s).replace(/[ \t]+$/, '');
    const opens = /[{([]$/.test(before);
    e.preventDefault();
    if (opens) {
      ed.setRangeText('\n' + indent + '  \n' + indent, s, en, 'end');
      ed.selectionStart = ed.selectionEnd = s + 1 + indent.length + 2;
    } else {
      ed.setRangeText('\n' + indent, s, en, 'end');
    }
    ed.dispatchEvent(new Event('input'));
    return;
  }
  if (['}', ')', ']'].includes(e.key) && s === en) {
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const prefix = value.slice(lineStart, s);
    if (prefix.length && /^\s+$/.test(prefix) && !(prefix.length % 2)) {
      e.preventDefault();
      ed.setRangeText(e.key, s - prefix.length, s, 'end');
      ed.dispatchEvent(new Event('input'));
    }
  }
});

function setStatus(text, kind = '') {
  const el = $('#status');
  el.textContent = text;
  el.className = 'status ' + kind;
}

/* ------------------------------------------------------------
   Open a question
   ------------------------------------------------------------ */

function setDesignMode(on) {
  const body = document.body;
  const stage = $('#design-stage');
  const pane = $('.pane.left');
  const arch = $('#arch-modal');
  if (!stage) return;
  if (on) {
    body.classList.add('mode-design');
    stage.setAttribute('aria-hidden', 'false');
    const mount = $('#design-brief-mount');
    if (pane && mount && pane.parentElement !== mount) mount.appendChild(pane);
    const main = $('#design-stage-main');
    if (arch && main && arch.parentElement !== main) main.appendChild(arch);
    return;
  }
  body.classList.remove('mode-design');
  stage.setAttribute('aria-hidden', 'true');
  openBrief(false);
  const workspace = $('.workspace');
  const resizer = $('#resize-panes');
  if (pane && workspace && pane.parentElement !== workspace) workspace.insertBefore(pane, resizer);
  if (arch && arch.parentElement !== document.body) document.body.appendChild(arch);
  if (typeof DesignGraph !== 'undefined') DesignGraph.close();
}

function openBrief(force) {
  const stage = $('#design-stage');
  if (!stage) return;
  const on = typeof force === 'boolean' ? force : !stage.classList.contains('brief-open');
  stage.classList.toggle('brief-open', on);
  const brief = $('#design-brief');
  if (brief) {
    brief.classList.toggle('on', on);
    brief.toggleAttribute('inert', !on);
  }
}

function openDesignStage(item) {
  const empty = $('#design-empty');
  const graph = typeof DESIGN_GRAPHS !== 'undefined' ? DESIGN_GRAPHS[item.id] : null;
  if (graph && typeof DesignGraph !== 'undefined') {
    if (empty) empty.classList.add('hidden');
    openBrief(false);
    DesignGraph.open(item.id, { inline: true });
    return;
  }
  if (typeof DesignGraph !== 'undefined') DesignGraph.close();
  if (empty) {
    empty.classList.remove('hidden');
    const title = $('#design-empty-title');
    if (title) title.textContent = item.title;
  }
  openBrief(false);
}

function bindDesignChrome() {
  const nav = $('#page-nav');
  if (nav) {
    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (btn) switchPage(btn.dataset.page);
    });
  }
  const designSearch = $('#design-search');
  if (designSearch) {
    designSearch.addEventListener('input', (e) => {
      state.designSearch = e.target.value;
      renderDesignSidebar();
    });
  }
  const designList = $('#design-list');
  if (designList) {
    designList.addEventListener('click', (e) => {
      const row = e.target.closest('.design-item');
      if (row) open(row.dataset.id);
    });
  }
  const designNext = $('#btn-design-next');
  if (designNext) {
    designNext.addEventListener('click', () => {
      const id = nextDesignId();
      if (id) open(id);
    });
  }
  const close = $('#design-brief-close');
  if (close) close.addEventListener('click', () => openBrief(false));
  const scrim = $('#design-scrim');
  if (scrim) scrim.addEventListener('click', () => openBrief(false));
  const emptyBrief = $('#design-empty-brief');
  if (emptyBrief) emptyBrief.addEventListener('click', () => openBrief(true));
  const emptyStart = $('#design-empty-start');
  if (emptyStart) emptyStart.addEventListener('click', () => DesignStudy.focusAnswer());
}

/* ------------------------------------------------------------
   Ask AI side chat: what the AI sees about the current task
   ------------------------------------------------------------ */
function chatSuggestions(item, isDesign, focus) {
  if (!isDesign) {
    const failing = state.lastResults && !lastRunPassed(item);
    return [
      failing ? 'Why is my code failing the tests?' : 'Explain the problem with a tiny example',
      'Which pattern or data structure fits this problem, and why?',
      'What is the time and space complexity of my current code?',
      'What follow-up questions would an interviewer ask here?'
    ];
  }
  if (item.noFramework) {
    return ['What is this question really testing?', 'Help me pick the right story for this', 'Critique my answer as a hiring manager', 'What follow-ups should I expect?'];
  }
  if (focus && focus.type === 'node') {
    return [`Why does this design need the ${focus.label}?`, `What happens if the ${focus.label} fails?`, `What are the alternatives to the ${focus.label}?`, 'Explain it like I am new to system design'];
  }
  if (focus && focus.type === 'flow') {
    return [`Walk me through "${focus.label}" step by step`, 'Which hops add the most latency?', 'Why are some of these hops async?'];
  }
  if (focus && focus.type === 'failure') {
    return ['How would I detect this in production?', 'How should the system degrade here?', 'What would the interviewer ask next about this failure?'];
  }
  if (focus && focus.type === 'edge') {
    return [`Why is ${focus.label} designed this way?`, 'What if this call were the other kind (sync vs async)?'];
  }
  return ['What is this question really testing?', 'What clarifying questions should I ask first?', 'Review what I have written so far', 'What will the interviewer push on?'];
}

function chatContextProvider() {
  const item = state.active;
  if (!item) return null;
  const isDesign = !ALL_CODING.includes(item);
  const focus = isDesign && typeof DesignGraph !== 'undefined' && DesignGraph.isInline() ? DesignGraph.getFocus() : null;
  const context = {
    page: isDesign ? 'design' : 'coding',
    question: {
      title: item.title,
      kind: isDesign ? (item.noFramework ? 'behavioral' : 'system design') : 'coding',
      level: item.level,
      seniority: item.seniority || 'N/A',
      prompt: item.prompt,
      topics: item.topics || []
    },
    notes: state.notes[item.id] || ''
  };
  if (isDesign) {
    const study = typeof DesignStudy !== 'undefined' ? DesignStudy.chatContext() : null;
    context.design = {
      map: study ? study.map : '',
      stage: study ? study.stage : '',
      worksheet: study ? study.worksheet : '',
      focus: focus ? focus.text : ''
    };
  } else {
    context.code = ed.value;
    context.language = 'JavaScript';
    const res = state.lastResults;
    if (res) {
      const results = res.results || [];
      const failed = (item.tests || []).map((t, i) => ({ t, r: results[i] })).filter(({ r }) => !r || !r.pass).slice(0, 3)
        .map(({ t, r }) => `- ${t.input || 'case'}: expected ${fmt(t.expected)}, got ${r ? (r.error ? 'error ' + r.error : fmt(r.actual)) : 'not run'}`);
      context.lastRun = `${results.filter((r) => r.pass).length}/${(item.tests || []).length} passing${res.fatal ? ' | ' + res.fatal : ''}\n${failed.join('\n')}`;
    }
  }
  return {
    key: item.id,
    label: item.title,
    focusLabel: focus ? focus.label : '',
    page: context.page,
    context,
    suggestions: chatSuggestions(item, isDesign, focus)
  };
}

function openHelp() {
  $('#plan-title').textContent = 'How this app works';
  $('#plan-body').innerHTML = `
    <div class="help-grid">
      <div class="help-card"><b>1 · Pick a page</b><p><b>Algorithm</b> is a coding IDE with tests. <b>System Design</b> is where you design systems and study architectures.</p></div>
      <div class="help-card"><b>2 · Read what is asked</b><p>Every design question opens with a plain-language task and concrete examples, so you know exactly what to build.</p></div>
      <div class="help-card"><b>3 · Write your design</b><p>Type your answer in <b>Your design</b> on the right, one step at a time: requirements, estimates, boxes and arrows, deep dive, failures. It saves automatically.</p></div>
      <div class="help-card"><b>4 · Get evaluated</b><p>Press <b>Evaluate my design</b>. The AI scores each area, lists gaps, and gives the follow-ups an interviewer would ask.</p></div>
      <div class="help-card"><b>5 · Compare and learn</b><p>Open <b>② Map</b>. Switch to <b>User actions</b> to see every request hop by hop, click any box to learn what it does, why, trade-offs, and who uses it. <b>Learn</b> lists every concept.</p></div>
      <div class="help-card"><b>6 · Ask follow-ups</b><p><b>✦ Ask AI</b> (⌘J) opens a side chat that already knows your question, your work, and what you are looking at.</p></div>
    </div>
    <div class="section-h">Canvas shapes</div>
    <div class="shape-key">${Object.keys(SHAPE_INFO).map((s) => `<span>${DesignGraph.shapeIcon(s)}${esc(SHAPE_INFO[s].label)}</span>`).join('')}</div>
    <div class="section-h">Keyboard</div>
    <table class="num-table">
      <tr><td>⌘J / Ctrl+J</td><td>Open or close Ask AI</td></tr>
      <tr><td>/</td><td>Jump to the Ask AI input</td></tr>
      <tr><td>P</td><td>Switch the map between Components and User actions</td></tr>
      <tr><td>E</td><td>Expand the canvas</td></tr>
      <tr><td>⌘↵</td><td>Run tests (coding page)</td></tr>
      <tr><td>⌘H</td><td>AI hint (coding page)</td></tr>
      <tr><td>j / k</td><td>Next / previous coding question</td></tr>
    </table>`;
  $('#plan-modal').classList.add('on');
}

function open(id) {
  const item = byId(id);
  if (!item) return;
  state.active = item;
  state.showSolution = false;
  state.tab = 'prompt';
  state.lastResults = null;
  state.logs = [];
  state.running = false;
  state.ai = store.get(KEYS.ai(id), null);
  state.aiLoading = false;
  state.aiLoadingMode = null;
  state.aiLastMode = 'next';
  state.aiError = null;
  state.hintSelection = '';
  state.explainTerm = '';
  state.aiExplaining = false;
  state.aiExplainError = null;
  state.review = store.get(KEYS.review(id), null);
  state.reviewLoading = false;
  state.reviewError = null;
  state.solve = store.get(KEYS.solve(id), null);
  state.solveLoading = false;
  state.solveError = null;
  const isDesign = !ALL_CODING.includes(item);
  store.set(KEYS.last, id);
  store.set(isDesign ? KEYS.lastDesign : KEYS.lastCoding, id);
  document.title = item.title + ' - Interview Prep';
  setDesignMode(isDesign);
  setPageChrome(isDesign ? 'design' : 'coding');
  if (isDesign && ed && typeof ed.blur === 'function') ed.blur();

  $('#q-title').textContent = item.title;
  $('#q-sig').textContent = item.signature || '';
  $('#q-sig').style.display = item.signature ? '' : 'none';
  $('#results').classList.add('hidden');
  setStatus('');

  if (ALL_CODING.includes(item)) loadCode(item);
  else {
    const draft = store.get(KEYS.draft(item.id), null);
    ed.value = draft !== null ? draft
      : '// System design working area - no tests here.\n//\n// 1. Requirements / non-goals\n//\n// 2. Envelope (QPS, storage, latency)\n//\n// 3. Boxes and arrows\n//\n// 4. Deep dive + failure modes';
    ed.scrollTop = 0;
    ed.scrollLeft = 0;
    paintEditor();
    syncGutter();
  }

  const isCoding = !isDesign;
  $('#btn-run').style.display = isCoding ? '' : 'none';
  $('#btn-run-2').style.display = isCoding ? '' : 'none';
  $('#btn-done').textContent = state.done.has(id) ? 'Done ✓' : 'Mark done';
  $('#btn-done').classList.toggle('primary', !state.done.has(id));

  renderTabs();
  renderDoc();
  if (isDesign) {
    openDesignStage(item);
    if (typeof DesignStudy !== 'undefined') DesignStudy.open(item);
  } else if (typeof DesignStudy !== 'undefined') {
    DesignStudy.close();
  }
  if (isCoding) restoreRun(item);
  if (state.aiOpen && !isDesign) renderAIHint();
  if (isCoding) ed.focus();
  if (typeof AIChat !== 'undefined') AIChat.refresh();
}

function renderTabs() {
  // on the design page the answer lives in the "Your design" panel, so the brief has no separate Notes tab
  const isDesign = state.active && !ALL_CODING.includes(state.active);
  if (isDesign && state.tab === 'notes') state.tab = 'prompt';
  $('#tabs').innerHTML = [
    `<button class="tab ${state.tab === 'prompt' ? 'on' : ''}" data-tab="prompt">Question</button>`,
    isDesign ? '' : `<button class="tab ${state.tab === 'notes' ? 'on' : ''}" data-tab="notes">Notes</button>`
  ].join('');
}

$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (!b) return;
  state.tab = b.dataset.tab;
  renderTabs();
  renderDoc();
});

/* ------------------------------------------------------------
   Document pane
   ------------------------------------------------------------ */
function renderDoc() {
  const item = state.active;
  const doc = $('#doc');
  if (!item) return;

  if (state.tab === 'notes') {
    const n = state.notes[item.id] || '';
    doc.innerHTML = `
      <div class="section-h">Your notes</div>
      <div class="empty" style="margin-bottom:8px">What did you get wrong? What is the invariant? Write the 30-second verbal summary you would give an interviewer.</div>
      <textarea class="notes" id="notes-box" spellcheck="false" placeholder="e.g. Brute force O(n^2)... key insight: track running min... follow-up: sorted array -> two pointers"></textarea>`;
    const box = $('#notes-box');
    box.value = n;
    box.addEventListener('input', () => {
      state.notes[item.id] = box.value;
      store.set(KEYS.notes, state.notes);
    });
    return;
  }

  // prompt tab
  const isGs = item.cat === 'gs-core';
  let html = `<h2>${esc(item.title)}</h2>
    <div class="meta-row">
      ${isGs ? `<span class="tag tag-gs">GS verified · ${esc(item.confidence)} confidence</span>` : ''}
      ${item.seniority ? `<span class="tag tag-sen ${senClass(item.seniority)}" title="${esc(item.levelWhy || '')}">${esc(SEN_LABEL[item.seniority] || 'Level N/A')}</span>` : ''}
      ${item.added ? `<span class="tag tag-date" title="Date this question was added to this queue">added ${esc(item.added)}</span>` : ''}
      ${item.sourceDate ? `<span class="tag tag-date" title="Date the source was published">source ${esc(item.sourceDate)}</span>` : ''}
      ${item.tag ? `<span class="tag">${esc(item.tag)}</span>` : ''}
      <span class="tag">${item.seniority === 'manager' ? 'Manager round' : RUBRIC[item.level] ? RUBRIC[item.level].label : 'Design'}</span>
      ${item.complexity ? `<span class="tag">${esc(item.complexity)}</span>` : ''}
    </div>
    <div class="body-text">${formatBody(item.prompt)}</div>`;

  const arch = !ALL_CODING.includes(item) && typeof DESIGN_GRAPHS !== 'undefined' ? DESIGN_GRAPHS[item.id] : null;
  if (arch) {
    html += `<div class="arch-cta">
      <div class="arch-cta-copy">
        <span class="arch-cta-kicker">Interactive architecture</span>
        <b>${esc(arch.title)}</b>
        <span>${arch.nodes.length} components · ${arch.layers.length} layers · ${arch.flow.length}-step request trace</span>
      </div>
      <button class="btn primary" id="btn-arch">Open map ↗</button>
    </div>`;
  }

  if (isGs && item.reportCount) {
    html += `<div class="callout gs-evidence"><b>Why this is here:</b> ${esc(item.reportCount)}`;
    if (item.sources && item.sources.length) {
      html += `<div class="srcs">${item.sources.map((src, i) =>
        `<a href="${esc(src.url)}" target="_blank" rel="noopener">[${i + 1}] ${esc(src.label)}</a>`).join('')}</div>`;
    }
    html += `</div>`;
  }

  if (item.topics) {
    html += `<div class="section-h">What good answers cover</div><div class="topic-grid">${
      item.topics.map((t) => `<span class="topic">${esc(t)}</span>`).join('')
    }</div>`;
  }

  if (item.signature) {
    const isDesign = !ALL_CODING.includes(item);
    html += `<div class="section-h">${isDesign ? 'Signature / entry point' : 'Signature'}</div>
      <div class="sigbox">${esc(item.signature)}</div>`;
  }

  if (RUBRIC[item.level] && item.seniority !== 'manager') {
    html += `<div class="callout" style="margin-top:12px"><b>${esc(RUBRIC[item.level].label)}.</b> ${esc(RUBRIC[item.level].note)}</div>`;
  }

  if (!ALL_CODING.includes(item) && !item.noFramework) {
    html += frameworkHTML();
  }

  if (item.solution) {
    html += `<div class="section-h">Reference solution</div>
      <button class="btn tiny ghost" id="btn-ref-sol">${state.showSolution ? 'Hide' : 'Show'} reference solution</button>`;
    if (state.showSolution) {
      html += `<pre class="code" style="margin-top:10px">${highlight(item.solution)}</pre>`;
      if (item.complexity) html += `<div class="cx">${esc(item.complexity)}</div>`;
      html += `<div class="callout" style="margin-top:12px">Close this and <b>retype it from memory</b>. Recognition is not recall, and the interview only measures recall.</div>`;
    }
  }

  doc.innerHTML = html;
  const refBtn = $('#btn-ref-sol');
  if (refBtn) refBtn.onclick = () => { state.showSolution = !state.showSolution; renderDoc(); };
  const archBtn = $('#btn-arch');
  if (archBtn) archBtn.onclick = () => DesignGraph.open(item.id);
}

/* ------------------------------------------------------------
   AI hint (DeepSeek, proxied by server.py - key stays server-side)
   ------------------------------------------------------------ */
function cleanPseudo(text) {
  return String(text || '')
    .replace(/^```[a-zA-Z]*\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .replace(/^\s*(pseudocode|hint|next step)\s*:\s*/i, '')
    .trim();
}

function briefValue(v, limit = 360) {
  try {
    const text = JSON.stringify(v);
    const out = text === undefined ? String(v) : text;
    return out.length > limit ? out.slice(0, limit) + '…' : out;
  } catch {
    return String(v);
  }
}

function buildHintContext(item, mode) {
  const ctx = buildAIContext(item);
  ctx.mode = mode;
  if (mode === 'reevaluate' && state.ai) {
    ctx.previousCode = state.ai.code || '';
    ctx.previousHint = state.ai.hint || '';
    ctx.previousAiHints = [];
  }
  return ctx;
}

function buildAIContext(item) {
  const results = (state.lastResults && state.lastResults.results) || [];
  const tests = item.tests || [];
  const failed = [];
  tests.forEach((t, i) => {
    const r = results[i];
    if (!r || !r.pass) {
      failed.push({
        input: t.input || ('case ' + (i + 1)),
        expected: briefValue(t.expected),
        got: r ? briefValue(r.actual) : 'not run',
        error: r && r.error ? String(r.error) : ''
      });
    }
  });

  const prior = [];
  if (state.ai) {
    prior.push(...(state.ai.history || []), state.ai.hint);
  }

  return {
    question: {
      title: item.title,
      prompt: item.prompt,
      signature: item.signature || '',
      level: item.level,
      seniority: item.seniority || 'N/A',
      tag: item.tag || ''
    },
    code: ed.value,
    language: 'JavaScript',
    lastRun: state.lastResults
      ? {
          passed: results.filter((r) => r.pass).length,
          total: tests.length,
          fatal: state.lastResults.fatal || null,
          failed: failed.slice(0, 4)
        }
      : null,
    console: (state.logs || []).slice(-20).map((l) => l.text).join('\n'),
    previousAiHints: prior.filter(Boolean).slice(-3),
    progress: {
      done: state.done.has(item.id)
    }
  };
}

const AI_VERDICT = {
  on_track: { icon: '✓', label: 'Approach is on track', cls: 'on-track' },
  wrong: { icon: '✕', label: 'Approach is wrong', cls: 'wrong' },
  unclear: { icon: '○', label: 'Not enough code to judge yet', cls: 'unclear' }
};

function renderExplainBlock(ai) {
  const legacy = Array.isArray(ai.explanations) ? ai.explanations[ai.explanations.length - 1] : null;
  const ex = ai.explanation || legacy;
  if (state.aiExplaining) {
    return `<div class="ai-loading"><span class="spinner"></span><span>Explaining “${esc(state.explainTerm || state.hintSelection || 'selection')}”…</span></div>`;
  }
  if (state.aiExplainError) {
    return `<div class="ai-error"><b>Could not explain “${esc(state.explainTerm || 'that')}”.</b><div>${esc(state.aiExplainError)}</div>
      <div style="margin-top:8px"><button class="btn tiny" id="btn-ai-explain-retry">Try again</button></div></div>`;
  }
  if (!ex) return '';
  return `<div class="section-h">Explain</div>
    <div class="ai-explain">
      <span class="ai-explain-term">${esc(ex.term || 'selection')}</span>
      <div class="ai-explain-body">${formatBody(ex.explanation || '')}</div>
      ${ex.example ? `<pre class="ai-explain-example">${esc(ex.example)}</pre>` : ''}
    </div>`;
}

function renderAIHint() {
  const body = $('#ai-body');
  if (!body) return;
  const item = state.active;
  if (!item) { body.innerHTML = ''; return; }
  const ai = state.ai;
  const stale = ai && ai.code !== ed.value;
  const passed = lastRunPassed(item);
  const at = ai && ai.at ? new Date(ai.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const modelLabel = (ai && ai.model) || (state.review && state.review.model) || 'DeepSeek';
  const modeTag = ai ? 'approach + next step' : (passed ? 'solution review' : 'approach + next step');
  const sub = $('#ai-pane-sub');
  if (sub) sub.textContent = modelLabel;

  let html = `<div class="meta-row">
      <span class="tag tag-ai">${esc(modelLabel)}</span>
      <span class="tag">${modeTag}</span>
      ${at ? `<span class="tag">${esc(at)}</span>` : ''}
      ${ai && ai.mode === 'reevaluate' ? '<span class="tag">re-evaluated</span>' : ''}
      ${stale ? '<span class="tag tag-stale" title="The editor changed after this hint was generated">code changed since this hint</span>' : ''}
    </div>
    <div class="body-text ai-intro">Reads this question, your editor code, the last test run and console output. While you work it checks whether your approach can work (slow is fine) and returns pseudocode for only the next step. Once the tests pass, it reviews the solution for comments, naming, pseudocode, edge cases, and a better approach.</div>`;

  if (passed) html += reviewHTML();

  if (state.aiLoading) {
    const loading = state.aiLoadingMode === 'reevaluate'
      ? 'Re-checking your changes against the last hint…'
      : 'Checking your approach and the next step…';
    html += `<div class="ai-loading"><span class="spinner"></span><span>${loading}</span></div>`;
  } else if (state.aiError) {
    html += `<div class="ai-error"><b>Could not get an AI hint.</b><div>${esc(state.aiError)}</div>
      <div style="margin-top:8px"><button class="btn tiny" id="btn-ai-retry">Try again</button></div></div>`;
  } else if (ai) {
    const verdict = ai.verdict && AI_VERDICT[ai.verdict];
    if (verdict) {
      html += `<div class="ai-verdict ${verdict.cls}">
        <span class="ai-verdict-label">${verdict.icon} ${esc(verdict.label)}</span>
        ${ai.issue ? `<div class="ai-verdict-note">${esc(ai.issue)}</div>` : ''}
      </div>`;
    }
    html += `<div class="section-h">Next step</div>
      <pre class="ai-code">${esc(cleanPseudo(ai.hint))}</pre>
      ${ai.why ? `<div class="ai-why">${esc(ai.why)}</div>` : ''}
      <div class="ai-actions">
        <button class="btn" id="btn-ai-next">Ask for next step</button>
        <button class="btn ghost" id="btn-ai-reeval" title="Re-read the current code, compare it with the last hint, and check what changed">Re-evaluate</button>
        <button class="btn ghost" id="btn-ai-explain" ${state.hintSelection ? '' : 'disabled'} title="Highlight part of Next step first">Explain selection</button>
      </div>
      <div class="ai-selection" id="ai-selection" style="${state.hintSelection ? '' : 'display:none'}">${state.hintSelection ? 'Selected: ' + esc(state.hintSelection) : ''}</div>
      <div class="ai-note">Re-evaluate re-reads your changes. Highlight any part of Next step to enable Explain selection.</div>
      ${renderExplainBlock(ai)}`;
  } else {
    html += `<div class="ai-empty">
      <button class="btn ${passed ? 'ghost' : 'primary'}" id="btn-ai-get">${passed ? 'Ask for next step' : 'Get AI hint'}</button>
      ${passed ? '' : `<div class="ai-note">${ALL_CODING.includes(item) ? 'Tip: run the tests first - the hint uses the failing case and console output.' : 'Tip: write your current design or outline in the editor first.'}</div>`}
    </div>`;
  }

  if (!passed) html += reviewHTML();
  if (ALL_CODING.includes(item)) html += solveHTML();
  html += `<div class="callout ai-disclaimer">Generated from this sandbox only. AI hints can be wrong - treat this as a nudge, not an answer.</div>`;
  body.innerHTML = html;

  const get = $('#btn-ai-get');
  if (get) get.onclick = () => requestAIHint('next');
  const next = $('#btn-ai-next');
  if (next) next.onclick = () => requestAIHint('next');
  const retry = $('#btn-ai-retry');
  if (retry) retry.onclick = () => requestAIHint(state.aiLastMode || 'next');
  const reeval = $('#btn-ai-reeval');
  if (reeval) reeval.onclick = () => requestAIHint('reevaluate');
  const explain = $('#btn-ai-explain');
  if (explain) {
    explain.onmousedown = (e) => e.preventDefault();
    explain.onclick = explainSelection;
  }
  const explainRetry = $('#btn-ai-explain-retry');
  if (explainRetry) explainRetry.onclick = explainSelection;
  const solve = $('#btn-solve');
  if (solve) solve.onclick = solveIt;
  const solveRetry = $('#btn-solve-retry');
  if (solveRetry) solveRetry.onclick = solveIt;
  const solveAgain = $('#btn-solve-again');
  if (solveAgain) solveAgain.onclick = solveIt;
  const solveApply = $('#btn-solve-apply');
  if (solveApply) solveApply.onclick = () => applySolution(false);
  const solveRun = $('#btn-solve-run');
  if (solveRun) solveRun.onclick = () => applySolution(true);
  const solveRestore = $('#btn-solve-restore');
  if (solveRestore) solveRestore.onclick = restoreSolution;

  const reviewGet = $('#btn-review-get');
  if (reviewGet) reviewGet.onclick = () => requestAIReview(state.active);
  const reviewRetry = $('#btn-review-retry');
  if (reviewRetry) reviewRetry.onclick = () => requestAIReview(state.active);
  const reviewAgain = $('#btn-review-again');
  if (reviewAgain) reviewAgain.onclick = () => requestAIReview(state.active, { force: true });
  const reviewClear = $('#btn-review-clear');
  if (reviewClear) reviewClear.onclick = () => {
    state.review = null;
    state.reviewError = null;
    store.remove(KEYS.review(item.id));
    renderDoc();
  };
}

async function requestAIHint(mode = 'next') {
  const item = state.active;
  if (!item || state.aiLoading) return;
  const reeval = mode === 'reevaluate' && !!state.ai;
  const requestCode = ed.value;

  state.aiLoading = true;
  state.aiLoadingMode = reeval ? 'reevaluate' : 'next';
  state.aiLastMode = state.aiLoadingMode;
  state.aiError = null;
  state.hintSelection = '';
  state.explainTerm = '';
  state.aiExplainError = null;
  if (!state.aiOpen) setAIPane(true, false);
  else renderAIHint();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75000);
  try {
    const res = await fetch('/api/ai-hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: buildHintContext(item, reeval ? 'reevaluate' : 'next') }),
      signal: controller.signal
    });
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON error page */ }
    if (!res.ok) throw new Error(data.error || ('AI hint failed (' + res.status + ')'));
    if (state.active !== item) return;

    const hint = cleanPseudo(data.next_step);
    if (!hint) throw new Error('The model returned an empty hint. Try again.');

    const prior = [];
    if (state.ai) prior.push(...(state.ai.history || []), state.ai.hint);
    const verdict = ['on_track', 'wrong', 'unclear'].includes(data.verdict) ? data.verdict : '';
    state.ai = {
      hint,
      why: data.why || '',
      verdict,
      issue: data.issue || '',
      at: data.at || new Date().toISOString(),
      code: requestCode,
      model: data.model || '',
      mode: reeval ? 'reevaluate' : 'next',
      explanation: null,
      history: prior.filter(Boolean).slice(-3)
    };
    store.set(KEYS.ai(item.id), state.ai);
  } catch (err) {
    if (err && err.name === 'AbortError') {
      state.aiError = 'The request timed out after 75s. Try again.';
    } else if (err instanceof TypeError) {
      state.aiError = 'Could not reach the AI hint server. Start it with: python3 server.py';
    } else {
      state.aiError = (err && err.message) || 'AI hint failed.';
    }
  } finally {
    clearTimeout(timer);
    state.aiLoading = false;
    state.aiLoadingMode = null;
    if (state.active === item) renderAIHint();
  }
}

function lastRunPassed(item) {
  const target = item || state.active;
  if (!target || !target.tests || !target.tests.length) return false;
  const res = state.lastResults;
  if (!res || res.fatal) return false;
  const results = res.results || [];
  return results.length === target.tests.length && results.every((r) => r.pass);
}

function maybeReviewAfterPass() {
  const item = state.active;
  if (!item || !ALL_CODING.includes(item) || state.reviewLoading) return;
  if (!lastRunPassed(item)) return;
  if (state.review && state.review.code === ed.value) return;
  requestAIReview(item, { open: false });
}

async function requestAIReview(item, opts = {}) {
  const target = item || state.active;
  if (!target || state.reviewLoading) return;
  if (!lastRunPassed(target)) {
    state.reviewError = 'Pass the tests first, then ask for a review.';
    if (state.aiOpen) renderAIHint();
    return;
  }
  const reviewCode = ed.value;
  const passingCode = state.runCode || (state.savedRun && state.savedRun.code) || reviewCode;
  if (reviewCode !== passingCode) {
    state.reviewError = 'The editor changed after the passing run. Run the tests again, then review.';
    if (state.aiOpen) renderAIHint();
    return;
  }
  if (!opts.force && state.review && state.review.code === reviewCode) return;

  if (opts.open !== false && !state.aiOpen) setAIPane(true, false);
  state.reviewLoading = true;
  state.reviewError = null;
  if (state.aiOpen) renderAIHint();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const res = await fetch('/api/ai-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: buildAIContext(target) }),
      signal: controller.signal
    });
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON error page */ }
    if (!res.ok) throw new Error(data.error || ('Review failed (' + res.status + ')'));
    if (state.active !== target) return;
    if (!data.review) throw new Error('The model returned an empty review. Try again.');

    state.review = {
      review: data.review,
      code: reviewCode,
      at: data.at || new Date().toISOString(),
      model: data.model || ''
    };
    store.set(KEYS.review(target.id), state.review);
    if (!state.aiOpen) toast('Solution review ready in AI hint');
  } catch (err) {
    if (err && err.name === 'AbortError') {
      state.reviewError = 'The review timed out after 90s. Try again.';
    } else if (err instanceof TypeError) {
      state.reviewError = 'Could not reach the AI review server.';
    } else {
      state.reviewError = (err && err.message) || 'Review failed.';
    }
  } finally {
    clearTimeout(timer);
    state.reviewLoading = false;
    if (state.active === target && state.aiOpen) renderAIHint();
  }
}

function reviewHTML() {
  const item = state.active;
  const record = state.review;
  const passed = lastRunPassed(item);
  if (!record && !state.reviewLoading && !state.reviewError && !passed) return '';

  let html = `<div class="section-h">Solution review</div>`;
  if (state.reviewLoading) {
    return html + `<div class="ai-loading"><span class="spinner"></span><span>Reviewing your passing solution…</span></div>`;
  }
  if (state.reviewError) {
    return html + `<div class="ai-error"><b>Could not review the solution.</b><div>${esc(state.reviewError)}</div>
      <div style="margin-top:8px"><button class="btn tiny" id="btn-review-retry">Try again</button></div></div>`;
  }
  if (!record) {
    return html + `<div class="review-empty">
      <button class="btn" id="btn-review-get">Review my solution</button>
      <div class="ai-note">Tests pass. Get feedback on comments, naming, pseudocode, edge cases, and a better approach.</div>
    </div>`;
  }

  let r = record.review || {};
  let malformed = false;
  if (typeof r.summary === 'string' && r.summary.trim().startsWith('{') && !(Array.isArray(r.strengths) && r.strengths.length)) {
    try {
      const inner = JSON.parse(r.summary);
      if (inner && typeof inner === 'object' && inner.summary) r = inner;
      else malformed = true;
    } catch { malformed = true; }
  }
  const stale = record.code !== ed.value;
  html += stale ? '<div class="tag tag-stale" style="display:inline-block;margin-bottom:10px">code changed since this review</div>' : '';
  if (malformed) {
    html += `<div class="ai-error"><b>This saved review was malformed.</b><div>The model returned it as a string, so it could not be rendered. Generate it again.</div></div>`;
  } else if (r.summary) {
    html += `<div class="review-summary">${esc(r.summary)}</div>`;
  }
  if (Array.isArray(r.strengths) && r.strengths.length) {
    html += `<div class="review-block"><h4>Strengths</h4><ul>${r.strengths.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>`;
  }
  if (Array.isArray(r.improvements) && r.improvements.length) {
    html += `<div class="review-block"><h4>Improve for the interview</h4><ul>${r.improvements.map((im) =>
      `<li>${im.area ? `<span class="review-area">${esc(im.area)}</span>` : ''}${esc(im.note)}</li>`).join('')}</ul></div>`;
  }
  if (r.better_approach) {
    html += `<div class="review-block"><h4>Better approach</h4><p>${esc(r.better_approach)}</p></div>`;
  }
  if (Array.isArray(r.interview_notes) && r.interview_notes.length) {
    html += `<div class="review-block"><h4>How to explain it</h4><ul>${r.interview_notes.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>`;
  }
  html += `<div class="ai-actions"><button class="btn tiny" id="btn-review-again">Review again</button><button class="btn tiny ghost" id="btn-review-clear">Clear</button></div>`;
  return html;
}


async function explainSelection() {
  const item = state.active;
  const ai = state.ai;
  const term = (state.explainTerm || state.hintSelection || '').trim();
  if (!item || !ai) return;
  if (!term) {
    toast('Highlight part of the next step first');
    return;
  }
  if (state.aiExplaining) return;

  state.explainTerm = term;
  state.aiExplaining = true;
  state.aiExplainError = null;
  renderAIHint();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75000);
  try {
    const res = await fetch('/api/ai-explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: {
        question: {
          title: item.title,
          prompt: item.prompt,
          signature: item.signature || '',
          level: item.level,
          seniority: item.seniority || 'N/A'
        },
        code: ed.value,
        pseudocode: cleanPseudo(ai.hint),
        selection: term,
        issue: ai.issue || '',
        language: 'JavaScript'
      } }),
      signal: controller.signal
    });
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON error page */ }
    if (!res.ok) throw new Error(data.error || ('Explain failed (' + res.status + ')'));
    if (state.active !== item || state.ai !== ai) return;
    if (!data.explanation) throw new Error('The model returned an empty explanation. Try again.');

    ai.explanation = {
      term: data.term || term,
      explanation: data.explanation,
      example: data.example || '',
      at: data.at || new Date().toISOString()
    };
    delete ai.explanations;
    store.set(KEYS.ai(item.id), ai);
    state.hintSelection = '';
    state.explainTerm = '';
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
  } catch (err) {
    if (err && err.name === 'AbortError') {
      state.aiExplainError = 'The explanation timed out. Try again.';
    } else if (err instanceof TypeError) {
      state.aiExplainError = 'Could not reach the AI server.';
    } else {
      state.aiExplainError = (err && err.message) || 'Explain failed.';
    }
  } finally {
    clearTimeout(timer);
    state.aiExplaining = false;
    if (state.active === item) renderAIHint();
  }
}

document.addEventListener('selectionchange', () => {
  if (!state.aiOpen) return;
  const pre = document.querySelector('#ai-body .ai-code');
  const sel = window.getSelection();
  const btn = $('#btn-ai-explain');
  const chip = $('#ai-selection');
  let text = '';
  if (pre && sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    const range = sel.getRangeAt(0);
    if (pre.contains(range.commonAncestorContainer)) {
      text = sel.toString().replace(/\s+/g, ' ').trim();
    }
  }
  if (!text) {
    state.hintSelection = '';
    if (chip) {
      chip.textContent = '';
      chip.style.display = 'none';
    }
    if (btn) btn.disabled = true;
    return;
  }
  state.hintSelection = text.slice(0, 240);
  state.explainTerm = state.hintSelection;
  if (chip) {
    chip.textContent = 'Selected: ' + state.hintSelection;
    chip.style.display = '';
  }
  if (btn) btn.disabled = false;
});


function buildSolveContext(item) {
  const results = (state.lastResults && state.lastResults.results) || [];
  const tests = item.tests || [];
  const failed = [];
  tests.forEach((t, i) => {
    const r = results[i];
    if (!r || !r.pass) {
      failed.push({
        input: t.input || ('case ' + (i + 1)),
        expected: briefValue(t.expected),
        got: r ? briefValue(r.actual) : 'not run',
        error: r && r.error ? String(r.error) : ''
      });
    }
  });
  return {
    question: {
      title: item.title,
      prompt: item.prompt,
      signature: item.signature || '',
      level: item.level,
      seniority: item.seniority || 'N/A'
    },
    code: ed.value,
    language: 'JavaScript',
    lastRun: state.lastResults
      ? {
          passed: results.filter((r) => r.pass).length,
          total: tests.length,
          failed: failed.slice(0, 4)
        }
      : null,
    console: (state.logs || []).slice(-20).map((l) => l.text).join('\n')
  };
}

async function solveIt() {
  const item = state.active;
  if (!item || !ALL_CODING.includes(item) || state.solveLoading) return;
  if (!state.aiOpen) setAIPane(true, false);

  state.solveLoading = true;
  state.solveError = null;
  renderAIHint();
  const baseCode = ed.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch('/api/ai-solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: buildSolveContext(item) }),
      signal: controller.signal
    });
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON error page */ }
    if (!res.ok) throw new Error(data.error || ('Solve failed (' + res.status + ')'));
    if (state.active !== item) return;
    if (!data.solution) throw new Error('The model returned an empty solution. Try again.');

    state.solve = {
      solution: data.solution,
      approach: data.approach || '',
      steps: Array.isArray(data.steps) ? data.steps : [],
      changes: Array.isArray(data.changes) ? data.changes : [],
      at: data.at || new Date().toISOString(),
      model: data.model || '',
      baseCode,
      previousCode: null
    };
    const previous = ed.value;
    if (previous !== state.solve.solution) {
      state.solve.previousCode = previous;
      ed.value = state.solve.solution;
      ed.dispatchEvent(new Event('input'));
    }
    store.set(KEYS.solve(item.id), state.solve);
    toast('Solution applied to editor');
  } catch (err) {
    if (err && err.name === 'AbortError') {
      state.solveError = 'The solve request timed out. Try again.';
    } else if (err instanceof TypeError) {
      state.solveError = 'Could not reach the AI server.';
    } else {
      state.solveError = (err && err.message) || 'Solve failed.';
    }
  } finally {
    clearTimeout(timer);
    state.solveLoading = false;
    if (state.active === item) renderAIHint();
  }
}

function solveHTML() {
  const item = state.active;
  const rec = state.solve;
  let html = `<div class="section-h">${rec ? 'Solution' : 'Solve it'}</div>`;

  if (state.solveLoading) {
    return html + `<div class="ai-loading"><span class="spinner"></span><span>Solving with as much of your current code as possible…</span></div>`;
  }
  if (state.solveError) {
    return html + `<div class="ai-error"><b>Could not solve it.</b><div>${esc(state.solveError)}</div>
      <div style="margin-top:8px"><button class="btn tiny" id="btn-solve-retry">Try again</button></div></div>`;
  }
  if (!rec) {
    return html + `<div class="solve-empty">
      <button class="btn primary" id="btn-solve">Solve it</button>
      <div class="ai-note">Full solution with inline comments, applied directly to the editor. It reuses your current code where possible; your previous code stays restorable.</div>
    </div>`;
  }

  const applied = ed.value === rec.solution;
  const stale = !applied && ed.value !== rec.baseCode;
  const at = rec.at ? new Date(rec.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const steps = Array.isArray(rec.steps) ? rec.steps : [];
  const changes = Array.isArray(rec.changes) ? rec.changes : [];

  html += `<div class="solve-meta">
    <span class="tag">${esc(rec.model || 'DeepSeek')}</span>
    <span class="tag">${applied ? 'applied' : 'not applied'}</span>
    ${at ? `<span class="tag">${esc(at)}</span>` : ''}
    ${stale ? '<span class="tag tag-stale" title="The editor changed after this solution was generated">code changed since this solution</span>' : ''}
  </div>`;

  if (rec.approach) html += `<div class="review-summary">${esc(rec.approach)}</div>`;
  if (changes.length) {
    html += `<div class="solve-changes-wrap"><div class="section-h">What changed</div>
      <ul class="solve-changes">${changes.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>`;
  }
  if (steps.length) {
    html += `<div class="section-h">Step-by-step</div>
      <ol class="solve-steps">${steps.map((s, i) =>
        `<li><b>${esc(s.title || ('Step ' + (i + 1)))}</b><span>${esc(s.detail || '')}</span></li>`).join('')}</ol>`;
  }

  const diff = typeof rec.baseCode === 'string' ? diffSolutionLines(rec.baseCode, rec.solution) : null;
  html += diff
    ? `<pre class="code solve-code">${diff.map((line) =>
        `<span class="diff-line${line.added ? ' diff-add' : ''}">${line.text ? highlight(line.text) : '&nbsp;'}</span>`).join('')}</pre>`
    : `<pre class="code solve-code">${highlight(rec.solution)}</pre>`;
  if (diff && diff.some((line) => line.added)) {
    html += `<div class="solve-legend"><span class="legend-swatch"></span>Colored lines were added or changed by the AI</div>`;
  }
  html += `<div class="solve-actions">
    <button class="btn primary" id="btn-solve-run">Apply &amp; run</button>
    ${applied ? '' : '<button class="btn" id="btn-solve-apply">Apply to editor</button>'}
    <button class="btn ghost" id="btn-solve-again">Solve again</button>
    ${typeof rec.previousCode === 'string' ? '<button class="btn ghost" id="btn-solve-restore">Restore my code</button>' : ''}
  </div>`;
  return html;
}

function renderAIHintPreserveScroll() {
  const body = $('#ai-body');
  const top = body ? body.scrollTop : 0;
  renderAIHint();
  if (body) body.scrollTop = top;
}

function applySolution(run) {
  const item = state.active;
  const rec = state.solve;
  if (!item || !rec || !rec.solution) return;
  if (ed.value !== rec.solution) rec.previousCode = ed.value;
  ed.value = rec.solution;
  ed.dispatchEvent(new Event('input'));
  store.set(KEYS.solve(item.id), rec);
  renderAIHintPreserveScroll();
  if (run) runTests();
  toast(run ? 'Solution applied - running tests' : 'Solution applied');
}

function restoreSolution() {
  const item = state.active;
  const rec = state.solve;
  if (!item || !rec || typeof rec.previousCode !== 'string') return;
  ed.value = rec.previousCode;
  ed.dispatchEvent(new Event('input'));
  rec.previousCode = null;
  store.set(KEYS.solve(item.id), rec);
  renderAIHintPreserveScroll();
  toast('Previous code restored');
}

function formatBody(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<span class="code-inline">$1</span>')
    .replace(/^(\s*)-\s/gm, '$1• ');
}

function frameworkHTML() {
  const steps = [
    ['1. Requirements', 'Functional and non-functional. Scale numbers, latency SLO, consistency needs, and explicit non-goals.'],
    ['2. Envelope', 'QPS reads and writes, storage per day and per year, bytes per record. Do the arithmetic out loud.'],
    ['3. High level', 'Boxes and arrows. Client, gateway, service, store, queue, cache. Name the sharding key.'],
    ['4. Deep dive', 'Pick the one hard part the interviewer cares about - consistency, fan-out, ordering, latency - and go deep.']
  ];
  return `<div class="section-h">The 4-step framework</div>
    <div class="framework">${steps.map(([t, d]) => `<div class="fw-step"><div class="num">${t[0]}</div><div class="txt"><b>${esc(t.slice(3))}</b>${esc(d)}</div></div>`).join('')}</div>
    <div class="callout" style="margin-top:12px">Close with trade-offs and failure modes. Naming what breaks - and what you would do about it - is what separates senior from mid.</div>`;
}



/* ------------------------------------------------------------
   Run tests
   ------------------------------------------------------------ */
function namesFor(item) {
  const src = (item.solution || '') + '\n' + (item.starter || '');
  const found = new Set();
  const re = /(?:function|class)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(src))) found.add(m[1]);
  for (const t of item.tests) {
    const cre = /\bTest\.([A-Za-z_$][\w$]*)/g;
    while ((m = cre.exec(t.custom || ''))) found.add(m[1]);
  }
  // helpers the tests rely on
  ['arrToLL', 'llToArr', 'T'].forEach((h) => found.add(h));
  return [...found];
}

const HARNESS = `
const arrToLL = (a) => a.reduceRight((next, val) => ({ val, next }), null);
const llToArr = (h) => { const out = []; while (h) { out.push(h.val); h = h.next; } return out; };
const T = (val, left = null, right = null) => ({ val, left, right });
`;

async function runTests() {
  const item = state.active;
  if (!item || !ALL_CODING.includes(item)) return;

  const btn = $('#btn-run');
  btn.disabled = true;
  setStatus('running...');
  state.logs = [];
  state.running = true;
  state.viewingSavedRun = false;
  state.runStartedAt = new Date().toISOString();
  state.runCode = ed.value;
  showRunning();
  writeRunSnapshot(item, { results: [], fatal: null }, { running: true, at: state.runStartedAt, code: state.runCode });

  const names = namesFor(item);
  const res = await Runner.run(item, state.runCode, { names, harness: HARNESS }, {
    onLog: (level, text, parts) => {
      if (state.active !== item) return;
      appendLog(level, text, parts);
      scheduleRunPersist();
    },
    onClear: () => {
      if (state.active !== item) return;
      state.logs = [];
      renderConsole();
      scheduleRunPersist();
    }
  });
  btn.disabled = false;
  state.running = false;
  clearTimeout(runPersistTimer);
  if (state.active !== item) return;

  state.lastResults = res;
  const snap = writeRunSnapshot(item, res, { at: state.runStartedAt, code: state.runCode });
  appendRunHistory(snap);
  syncGutter();
  renderResults(res);
}

/* ------------------------------------------------------------
   Console (console.* output streamed from the test worker)
   ------------------------------------------------------------ */
function consoleEmpty() {
  if (state.running) return '<div class="console-empty">Waiting for console output…</div>';
  if (state.viewingSavedRun) return '<div class="console-empty">This saved run had no console output.</div>';
  return '<div class="console-empty">No console output from this run.</div>';
}

function consoleLine(entry) {
  const tag = entry.level === 'log' ? '' : `<span class="console-tag">${esc(entry.level)}</span>`;
  const parts = Array.isArray(entry.parts) && entry.parts.length
    ? entry.parts
    : [{ type: '', text: entry.text }];
  const body = parts.map((p) => {
    const type = p.type ? `<span class="console-type">${esc(p.type)}</span>` : '';
    return `<span class="console-arg">${type}<span class="console-text">${esc(p.text)}</span></span>`;
  }).join('<span class="console-sep">·</span>');
  return `<div class="console-line lvl-${esc(entry.level)}">${tag}${body}</div>`;
}

function consoleHTML() {
  const logs = state.logs || [];
  return `<div class="console-panel">
    <div class="console-h">
      <span class="console-title" title="console.log(...) from your code and test cases appears here">Console</span>
      <span class="console-count" id="console-count">${logs.length}</span>
      <span class="spacer"></span>
      <button class="btn tiny ghost" id="btn-clear-console" title="Clear console output">Clear</button>
    </div>
    <div class="console-out" id="console-out">${logs.length ? logs.map(consoleLine).join('') : consoleEmpty()}</div>
  </div>`;
}

function bindConsole() {
  const clear = $('#btn-clear-console');
  if (clear) clear.onclick = () => {
    state.logs = [];
    renderConsole();
    const item = state.active;
    if (item && state.savedRun && state.savedRun.id === item.id) {
      state.savedRun.logs = [];
      store.set(KEYS.run(item.id), state.savedRun);
    }
  };
}

function renderConsole() {
  const out = $('#console-out');
  if (!out) return;
  out.innerHTML = state.logs.length ? state.logs.map(consoleLine).join('') : consoleEmpty();
  const count = $('#console-count');
  if (count) count.textContent = state.logs.length;
  out.scrollTop = out.scrollHeight;
}

function appendLog(level, text, parts) {
  state.logs.push({ level, text, parts });
  const out = $('#console-out');
  if (!out) return;
  if (state.logs.length === 1) out.innerHTML = '';
  out.insertAdjacentHTML('beforeend', consoleLine({ level, text, parts }));
  out.scrollTop = out.scrollHeight;
  const count = $('#console-count');
  if (count) count.textContent = state.logs.length;
}

/* ------------------------------------------------------------
   Run persistence
   localStorage is the database for now. Every run writes:
     gs.run.<id>  latest snapshot for this question (restored on open)
     gs.runs      bounded history of full snapshots (for a later DB)
   ------------------------------------------------------------ */
const RUN_HISTORY_MAX = 25;
const RUN_LOG_MAX = 300;

function buildRunSnapshot(item, res, opts = {}) {
  const results = (res && res.results) || [];
  const fatal = (res && res.fatal) || null;
  const passed = results.filter((r) => r.pass).length;
  return {
    v: 1,
    id: item.id,
    title: item.title,
    at: opts.at || new Date().toISOString(),
    status: opts.running ? 'running' : fatal ? 'failed' : 'done',
    fatal,
    passed,
    total: results.length,
    code: opts.code !== undefined ? opts.code : ed.value,
    logs: (state.logs || []).slice(0, RUN_LOG_MAX),
    results: results.map((r) => ({ pass: !!r.pass, error: r.error || null, actual: r.actual }))
  };
}

function writeRunSnapshot(item, res, opts = {}) {
  const snap = buildRunSnapshot(item, res, opts);
  if (!store.set(KEYS.run(item.id), snap)) {
    // bulky actual values are the usual culprit - retry with the essentials
    snap.results = snap.results.map((r) => ({ pass: r.pass, error: r.error }));
    store.set(KEYS.run(item.id), snap);
  }
  state.savedRun = snap;
  return snap;
}

function appendRunHistory(snap) {
  const entry = Object.assign({}, snap, {
    code: snap.code.length > 20000 ? snap.code.slice(0, 20000) : snap.code,
    logs: snap.logs.slice(0, 120)
  });
  // pathological return values can blow the quota - keep the verdict only
  try {
    if (JSON.stringify(entry).length > 80000) {
      entry.results = entry.results.map((r) => ({ pass: r.pass, error: r.error }));
    }
  } catch { /* non-serialisable result */ }
  const runs = store.get(KEYS.runs, []);
  runs.push(entry);
  if (runs.length > RUN_HISTORY_MAX) runs.splice(0, runs.length - RUN_HISTORY_MAX);
  let ok = store.set(KEYS.runs, runs);
  while (!ok && runs.length > 5) {
    runs.splice(0, 5);
    ok = store.set(KEYS.runs, runs);
  }
}

let runPersistTimer = null;
function scheduleRunPersist() {
  clearTimeout(runPersistTimer);
  runPersistTimer = setTimeout(() => {
    const item = state.active;
    if (!item || !ALL_CODING.includes(item)) return;
    writeRunSnapshot(item, { results: [], fatal: null }, { running: true, at: state.runStartedAt, code: state.runCode });
  }, 250);
}

function restoreRun(item) {
  const saved = store.get(KEYS.run(item.id), null);
  if (!saved || !Array.isArray(saved.results)) return false;
  state.savedRun = saved;
  state.logs = Array.isArray(saved.logs) ? saved.logs : [];
  state.lastResults = { results: saved.results, fatal: saved.fatal || null };
  renderResults(state.lastResults, { restored: saved });
  return true;
}

function markHintStale() {
  if (!state.aiOpen || !state.ai || state.aiLoading || state.ai.code === ed.value) return;
  const meta = $('#ai-body .meta-row');
  if (!meta || meta.querySelector('.tag-stale')) return;
  const tag = document.createElement('span');
  tag.className = 'tag tag-stale';
  tag.title = 'The editor changed after this hint was generated';
  tag.textContent = 'code changed since this hint';
  meta.appendChild(tag);
}

function markRunStale() {
  const item = state.active;
  if (!item || !state.savedRun || state.savedRun.id !== item.id) return;
  if (ed.value === state.savedRun.code) return;
  const bar = $('.results-h');
  if (!bar || bar.querySelector('.run-stale')) return;
  const chip = document.createElement('span');
  chip.className = 'run-stale';
  chip.title = 'The editor changed after this run';
  chip.textContent = 'code changed';
  const meta = bar.querySelector('.run-meta');
  if (meta) meta.after(chip);
  else {
    const score = bar.querySelector('.score');
    if (score) score.after(chip);
  }
}

function showRunning() {
  const box = $('#results');
  box.classList.remove('hidden');
  box.innerHTML = `<div class="results-h">
    <span class="score">running…</span>
    <span class="spacer"></span>
    <button class="btn tiny ghost" id="btn-hide-results">Hide</button>
  </div>${consoleHTML()}`;
  bindConsole();
  $('#btn-hide-results').onclick = () => box.classList.add('hidden');
}

function renderResults(res, opts = {}) {
  const box = $('#results');
  box.classList.remove('hidden');
  const item = state.active;
  const results = res.results || [];
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const allOk = total > 0 && passed === total && !res.fatal;
  const restored = opts.restored || null;
  state.viewingSavedRun = !!restored;
  const stale = restored && restored.code !== ed.value;
  const interrupted = restored && restored.status === 'running';
  const savedSnap = restored || (state.savedRun && state.savedRun.id === item.id ? state.savedRun : null);
  const savedAt = savedSnap ? new Date(savedSnap.at) : null;
  const savedValid = savedAt && !isNaN(savedAt.getTime());
  const savedTime = savedValid ? savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const scoreLabel = res.fatal ? 'FAILED' : interrupted ? 'run interrupted' : total ? `${passed}/${total} passing` : 'no results';

  let html = `<div class="results-h">
    <span class="score ${allOk ? 'ok' : 'bad'}">${scoreLabel}</span>
    ${savedTime ? `<span class="run-meta" title="saved locally at ${esc(savedAt.toLocaleString())}">saved ${esc(savedTime)}</span>` : ''}
    ${stale ? '<span class="run-stale" title="The editor changed after this run">code changed</span>' : ''}
    <span class="spacer"></span>
    ${allOk ? '<button class="btn tiny ghost" id="btn-review">Review</button>' : ''}
    ${allOk && !restored && !state.done.has(item.id) ? '<button class="btn tiny primary" id="btn-complete">Mark done ✓</button>' : ''}
    <button class="btn tiny ghost" id="btn-hide-results">Hide</button>
  </div>`;
  html += consoleHTML();

  if (res.fatal) {
    html += `<div class="fatal">${esc(res.fatal)}</div>`;
  }

  item.tests.forEach((t, i) => {
    const r = results[i] || { pass: false, error: 'not run' };
    html += `<div class="case ${r.pass ? 'pass' : 'fail'}">
      <div class="mark">${r.pass ? '✓' : '✕'}</div>
      <div>
        <div class="input">${esc(t.input || ('case ' + (i + 1)))}</div>
        ${r.error ? `<div class="row act">threw ${esc(r.error)}</div>` : ''}
        ${!r.pass && !r.error ? `<div class="row exp"><span class="lbl">expected</span>${esc(fmt(t.expected))}</div>
        <div class="row act"><span class="lbl">got</span>${esc(fmt(r.actual))}</div>` : ''}
        ${t.note ? `<div class="note">${esc(t.note)}</div>` : ''}
      </div>
    </div>`;
  });

  box.innerHTML = html;
  bindConsole();

  const done = $('#btn-complete');
  if (done) done.onclick = () => { toggleDone(); renderResults(res); };
  const reviewBtn = $('#btn-review');
  if (reviewBtn) reviewBtn.onclick = () => {
    setAIPane(true, false);
    if (!(state.review && state.review.code === ed.value)) requestAIReview();
  };
  $('#btn-hide-results').onclick = () => box.classList.add('hidden');

  if (restored) {
    setStatus(`${scoreLabel} - saved run`, allOk ? 'ok' : 'bad');
  } else if (allOk) {
    setStatus(`${passed}/${total} passing - nice`, 'ok');
    if (!state.done.has(item.id)) {
      setTimeout(() => { if (state.active && state.active.id === item.id) toggleDone(); }, 600);
    }
  } else {
    setStatus(`${passed}/${total} passing`, 'bad');
  }
  if (!restored) offerNext();
  markRunStale();
}

function offerNext() {
  const bar = $('.results-h');
  if (!bar || !state.active || !state.queue.includes(state.active.id)) return;
  const nextSkill = nextQueuedId();
  if (!nextSkill) return;
  bar.querySelector('#btn-next-queue')?.remove();
  const b = document.createElement('button');
  b.id = 'btn-next-queue';
  b.className = 'btn tiny';
  b.textContent = 'Next in queue ▸';
  b.onclick = () => open(nextSkill);
  bar.insertBefore(b, bar.querySelector('#btn-hide-results'));
}

function fmt(v) {
  if (v === undefined) return 'undefined';
  if (typeof v === 'function') return '[function]';
  try { return JSON.stringify(v); } catch { return String(v); }
}

function toggleDone() {
  const id = state.active.id;
  const marking = !state.done.has(id);
  if (marking) state.done.add(id);
  else state.done.delete(id);
  store.set(KEYS.done, [...state.done]);
  $('#btn-done').textContent = state.done.has(id) ? 'Done ✓' : 'Mark done';
  $('#btn-done').classList.toggle('primary', !state.done.has(id));
  renderSidebar();
  renderQueue();
  updateProgress();
  renderDesignSidebar();
  toast(state.done.has(id) ? 'Marked done' : 'Unmarked');
  if (marking) {
    const inline = $('#btn-complete');
    if (inline) inline.remove();
    setTimeout(maybeReviewAfterPass, 0);
  }
}

/* ------------------------------------------------------------
   Toolbar
   ------------------------------------------------------------ */
$('#btn-run').addEventListener('click', runTests);
$('#btn-done').addEventListener('click', toggleDone);
/** Starts the current problem over: every saved artifact for this question is cleared. */
function resetProblem() {
  const item = state.active;
  if (!item) return;
  const id = item.id;
  const isDesign = !ALL_CODING.includes(item);
  const what = isDesign
    ? 'your written design, the AI evaluation, practice progress, notes, the Ask AI conversation, and the done mark'
    : 'your code (back to the starter), test runs, AI hints, review and solution, notes, the Ask AI conversation, and the done mark';
  if (!confirm(`Reset “${item.title}”?\n\nThis clears ${what} for this question only.`)) return;

  [KEYS.draft(id), KEYS.run(id), KEYS.ai(id), KEYS.review(id), KEYS.solve(id),
    'gs.chat.' + id, 'gs.study.' + id, 'gs.design.eval.' + id, 'gs.quiz.' + id].forEach((k) => store.remove(k));
  store.set(KEYS.runs, store.get(KEYS.runs, []).filter((r) => r && r.id !== id));
  delete state.notes[id];
  store.set(KEYS.notes, state.notes);
  const legacy = store.get('gs.notes', {});
  if (legacy && legacy[id]) { delete legacy[id]; store.set('gs.notes', legacy); }
  if (state.done.has(id)) {
    state.done.delete(id);
    store.set(KEYS.done, [...state.done]);
  }
  if (typeof AIChat !== 'undefined') AIChat.forget(id);
  state.savedRun = null;
  $('#results').classList.add('hidden');
  open(id);
  renderSidebar();
  renderQueue();
  renderDesignSidebar();
  updateProgress();
  toast('Problem reset');
}

$('#btn-reset').addEventListener('click', resetProblem);

const moreMenu = $('#more-menu');
if (moreMenu) {
  const setMore = (on) => {
    moreMenu.classList.toggle('open', on);
    $('#btn-more').setAttribute('aria-expanded', on ? 'true' : 'false');
  };
  $('#btn-more').addEventListener('click', (e) => { e.stopPropagation(); setMore(!moreMenu.classList.contains('open')); });
  $('#more-list').addEventListener('click', () => setMore(false));
  document.addEventListener('click', (e) => { if (!moreMenu.contains(e.target)) setMore(false); });
}

const sidebarBtn = $('#btn-sidebar');
function setSidebarHidden(on) {
  document.body.classList.toggle('sidebar-hidden', on);
  store.set('gs.sidebar.hidden', on);
  if (sidebarBtn) sidebarBtn.classList.toggle('on', on);
  window.dispatchEvent(new Event('resize'));
}
if (sidebarBtn) sidebarBtn.addEventListener('click', () => {
  // the Map view tucks the list away for canvas room; ☰ peeks at it without changing the saved preference
  if (document.body.classList.contains('map-wide')) {
    document.body.classList.toggle('sidebar-peek');
    window.dispatchEvent(new Event('resize'));
    return;
  }
  setSidebarHidden(!document.body.classList.contains('sidebar-hidden'));
});
if (store.get('gs.sidebar.hidden', false)) setSidebarHidden(true);

$('#btn-notes').addEventListener('click', () => { state.tab = 'notes'; renderTabs(); renderDoc(); });
$('#btn-hint').addEventListener('click', toggleAIPane);
const aiClose = $('#btn-ai-close');
if (aiClose) aiClose.addEventListener('click', () => setAIPane(false));

/* ------------------------------------------------------------
   Plan / guide modal
   ------------------------------------------------------------ */
function openPlan() {
  const body = [
    `<div class="section-h">5-day bring-up plan</div>`,
    ...ROUND_PLAN.map((d) => `<div class="plan-day"><h3>${esc(d.day)}</h3><ul>${d.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`),
    `<div class="section-h">What is most likely to actually come up</div>`,
    `<div class="plan-day"><h3>Ranked by probability</h3><ul>
      <li><b>Arrays / hash maps</b> - Two Sum, Group Anagrams, Product Except Self. Near-certain.</li>
      <li><b>JavaScript specifics</b> - concurrency pool, debounce/throttle, Promise.all, LRU. Senior JS rounds live here.</li>
      <li><b>DP</b> - Coin Change and Climbing Stairs, because they touch money.</li>
      <li><b>System design</b> - one standard (URL shortener or cache) plus one domain question (order book / risk / ledger).</li>
      <li><b>Behavioural</b> - be ready with 3 STAR stories: a production incident, a trade-off you argued for, a time you were wrong.</li>
    </ul></div>`,
    `<div class="section-h">If you have only one evening</div>`,
    `<div class="callout">Do <b>Level 1 without hints</b>, then the three async questions, then read the order-book and risk hints out loud. That covers 80% of the surface. Do not try to grind LeetCode breadth - depth on what you already half-know is a better return.</div>`,
    `<div class="section-h">How to talk while you code</div>`,
    `<div class="plan-day"><ul>
      <li>Restate the problem and one example in your own words.</li>
      <li>State brute force + complexity before writing anything.</li>
      <li>Name the optimisation idea in one sentence, then code it.</li>
      <li>Test one edge case by hand before saying "done".</li>
      <li>Finish with complexity and one follow-up you would ask about.</li>
    </ul></div>`
  ].join('');

  $('#plan-body').innerHTML = body;
  $('#plan-title').textContent = 'Bring-up plan';
  $('#plan-modal').classList.add('on');
}

/* ------------------------------------------------------------
   Rounds view: the interview pipeline, as reported
   ------------------------------------------------------------ */
function openRounds() {
  const body = [
    `<div class="callout" style="margin-bottom:12px">Built from candidate reports (2023-2026). Stages vary by office and level: the CoderPad screen and Superday are consistent, the OA is sometimes skipped for experienced hires.</div>`,
    ...ROUNDS.map((r, i) => `
      <div class="plan-day">
        <h3><span class="rnum">${i + 1}</span>${esc(r.stage)}</h3>
        <div class="rrow"><span class="rlbl">Format</span><span>${esc(r.detail)}</span></div>
        <div class="rrow"><span class="rlbl">Prepare</span><span>${esc(r.ask)}</span></div>
      </div>`),
    `<div class="section-h">Reading the reports honestly</div>`,
    `<div class="plan-day"><ul>
      <li><b>Fraction to recurring decimal</b> is the single most repeated problem in the corpus. If you only drill one thing, drill that.</li>
      <li><b>Fraction, High Five, forest root, string compression</b> account for a large share of CoderPad rounds.</li>
      <li><b>Two questions per round</b> is the norm: usually easy + medium, revealed one at a time.</li>
      <li><b>Java-flavoured follow-ups</b> are common even in a JavaScript interview - HashMap internals, load factor, treeify, immutable classes.</li>
      <li><b>Your last project</b> is a design round in itself. Be able to draw it cold.</li>
      <li><b>Behavioural</b>: an incident you caused, a trade-off you argued, being wrong. Have three STAR stories.</li>
    </ul></div>`,
    `<div class="callout" style="margin-top:10px"><b>On the AI part:</b> CoderPad flags paste events and screen-leaves, and one 2026 report describes a candidate removed mid-round for an overlay. Type every solution by hand in practice so the muscle exists when it matters.</div>`
  ].join('');

  $('#plan-body').innerHTML = body;
  $('#plan-title').textContent = 'The Goldman round map';
  $('#plan-modal').classList.add('on');
}

$('#btn-rounds').addEventListener('click', openRounds);
$('#btn-plan').addEventListener('click', openPlan);
$('#plan-close').addEventListener('click', () => $('#plan-modal').classList.remove('on'));
$('#plan-modal').addEventListener('click', (e) => {
  if (e.target.id === 'plan-modal') $('#plan-modal').classList.remove('on');
});


/* ------------------------------------------------------------
   Code graph (Graphify: graphify-out/graph.html + graph.json)
   ------------------------------------------------------------ */
let graphBusy = false;

function graphClock(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function setGraphStatus(st, reload) {
  const meta = $('#graph-meta');
  const empty = $('#graph-empty');
  const frame = $('#graph-frame');
  const open = $('#graph-open');
  const exists = !!(st && st.exists && st.html);

  if (meta) {
    meta.textContent = exists
      ? `${st.nodes} nodes · ${st.edges} edges · ${st.communities} communities · built ${graphClock(st.builtAt)}`
      : 'Not built';
    meta.title = exists ? `graphify-out/graph.json · built ${new Date(st.builtAt).toLocaleString()}` : '';
  }
  if (empty) empty.classList.toggle('hidden', exists);
  if (frame) {
    if (exists) {
      frame.style.display = '';
      if (reload || !frame.getAttribute('src')) {
        frame.src = '/graphify-out/graph.html?v=' + Date.now();
      }
    } else {
      frame.style.display = 'none';
      frame.removeAttribute('src');
    }
  }
  if (open) {
    open.style.display = exists ? '' : 'none';
    open.href = '/graphify-out/graph.html';
  }
  const msg = $('#graph-empty-msg');
  if (msg) {
    msg.textContent = exists ? '' : (st && st.bin ? '' : 'Graphify CLI not found on the server. Install it with: uv tool install graphifyy');
  }
}

async function openGraph() {
  $('#graph-modal').classList.add('on');
  const meta = $('#graph-meta');
  if (meta) meta.textContent = 'Loading…';
  try {
    const res = await fetch('/api/graph/status');
    const st = await res.json();
    setGraphStatus(st, true);
  } catch {
    if (meta) meta.textContent = 'Graph server unavailable';
  }
}

async function rebuildGraph() {
  if (graphBusy) return;
  graphBusy = true;
  const buttons = [$('#graph-rebuild'), $('#graph-build-empty')].filter(Boolean);
  buttons.forEach((b) => { b.disabled = true; });
  const meta = $('#graph-meta');
  const msg = $('#graph-empty-msg');
  if (meta) meta.textContent = 'Building graph…';
  if (msg) msg.textContent = 'Scanning code with Graphify… this takes a few seconds.';
  try {
    const res = await fetch('/api/graph/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('Build failed (' + res.status + ')'));
    setGraphStatus(data.status || {}, true);
    toast('Code graph rebuilt');
  } catch (err) {
    if (meta) meta.textContent = 'Build failed';
    if (msg) msg.textContent = (err && err.message) || 'Build failed';
    toast('Graph rebuild failed');
  } finally {
    graphBusy = false;
    buttons.forEach((b) => { b.disabled = false; });
  }
}

const graphBtn = $('#btn-graph');
if (graphBtn) graphBtn.addEventListener('click', openGraph);
const graphClose = $('#graph-close');
if (graphClose) graphClose.addEventListener('click', () => $('#graph-modal').classList.remove('on'));
const graphRebuild = $('#graph-rebuild');
if (graphRebuild) graphRebuild.addEventListener('click', rebuildGraph);
const graphBuildEmpty = $('#graph-build-empty');
if (graphBuildEmpty) graphBuildEmpty.addEventListener('click', rebuildGraph);
const graphModal = $('#graph-modal');
if (graphModal) graphModal.addEventListener('click', (e) => {
  if (e.target.id === 'graph-modal') $('#graph-modal').classList.remove('on');
});

/* ------------------------------------------------------------
   Layout: resizable sidebar, question/editor panes, queue
   Sizes persist in localStorage and are clamped to the viewport.
   ------------------------------------------------------------ */
const LAYOUT_KEY = 'gs.layout';
const isNarrowAI = () => (typeof window.matchMedia === 'function'
  ? window.matchMedia('(max-width: 1279px)').matches
  : window.innerWidth < 1280);
const savedLayout = store.get(LAYOUT_KEY, {});
const layout = {
  sidebar: Number(savedLayout.sidebar) || 320,
  queue: Number(savedLayout.queue) || 264,
  doc: Number(savedLayout.doc) || null,
  ai: Number(savedLayout.ai) || 360,
  aiOpen: typeof savedLayout.aiOpen === 'boolean' ? savedLayout.aiOpen : !isNarrowAI()
};
state.aiOpen = !!layout.aiOpen;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function applyLayout() {
  const root = document.documentElement;
  const aiReserve = (layout.aiOpen && !isNarrowAI()) ? (340 + 320 + layout.ai + 14) : 480;
  const maxSidebar = Math.max(240, Math.min(560, window.innerWidth - aiReserve));
  layout.sidebar = clamp(layout.sidebar, 240, maxSidebar);
  root.style.setProperty('--sidebar-w', Math.round(layout.sidebar) + 'px');

  const maxQueue = Math.max(96, Math.round(window.innerHeight * 0.55));
  layout.queue = clamp(layout.queue, 96, maxQueue);
  root.style.setProperty('--queue-h', Math.round(layout.queue) + 'px');

  const ws = $('.workspace');
  if (ws) {
    ws.classList.toggle('ai-open', !!layout.aiOpen);
    const wsWidth = ws.getBoundingClientRect().width;
    const aiW = layout.aiOpen ? layout.ai : 0;
    if (layout.doc) {
      const maxDoc = Math.max(280, wsWidth - 320 - 14 - aiW);
      layout.doc = clamp(layout.doc, 280, maxDoc);
      root.style.setProperty('--doc-w', Math.round(layout.doc) + 'px');
    } else {
      root.style.removeProperty('--doc-w');
    }
    const docW = layout.doc || 340;
    const maxAi = Math.max(260, wsWidth - docW - 320 - 14);
    layout.ai = clamp(layout.ai, 260, maxAi);
    root.style.setProperty('--ai-w', Math.round(layout.ai) + 'px');
  }
  state.aiOpen = !!layout.aiOpen;
  document.body.classList.toggle('ai-hint-open', !!layout.aiOpen && !isNarrowAI());
  const hintBtn = $('#btn-hint');
  if (hintBtn) hintBtn.classList.toggle('on', !!layout.aiOpen && !isNarrowAI());
}

function saveLayout() { store.set(LAYOUT_KEY, layout); }

function makeResizer(el, opts) {
  if (!el) return;
  let drag = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    drag = (opts.start && opts.start(e)) || {};
    drag.x = e.clientX;
    drag.y = e.clientY;
    el.classList.add('dragging');
    document.body.classList.add('resizing');
    if (opts.axis === 'y') document.body.classList.add('row');
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    e.preventDefault();
    opts.move(e, drag);
    applyLayout();
  });
  const stop = (e) => {
    if (!drag) return;
    drag = null;
    el.classList.remove('dragging');
    document.body.classList.remove('resizing', 'row');
    try { el.releasePointerCapture(e.pointerId); } catch { /* synthetic events */ }
    saveLayout();
  };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  window.addEventListener('pointerup', stop);
  window.addEventListener('blur', () => { if (drag) stop({ pointerId: -1 }); });
  el.addEventListener('dblclick', () => { if (opts.reset) opts.reset(); applyLayout(); saveLayout(); });
  el.addEventListener('keydown', (e) => {
    if (opts.key && opts.key(e)) { e.preventDefault(); applyLayout(); saveLayout(); }
  });
}

makeResizer($('#resize-sidebar'), {
  axis: 'x',
  move: (e) => { layout.sidebar = e.clientX; },
  reset: () => { layout.sidebar = 320; },
  key: (e) => {
    const step = e.shiftKey ? 32 : 12;
    if (e.key === 'ArrowLeft') { layout.sidebar -= step; return true; }
    if (e.key === 'ArrowRight') { layout.sidebar += step; return true; }
    return false;
  }
});

makeResizer($('#resize-panes'), {
  axis: 'x',
  move: (e) => {
    const ws = $('.workspace');
    if (ws) layout.doc = e.clientX - ws.getBoundingClientRect().left;
  },
  reset: () => { layout.doc = null; },
  key: (e) => {
    const ws = $('.workspace');
    if (!ws) return false;
    const rect = ws.getBoundingClientRect();
    const current = layout.doc || rect.width * 0.47;
    const step = e.shiftKey ? 40 : 16;
    if (e.key === 'ArrowLeft') { layout.doc = current - step; return true; }
    if (e.key === 'ArrowRight') { layout.doc = current + step; return true; }
    return false;
  }
});

makeResizer($('#resize-ai'), {
  axis: 'x',
  move: (e) => {
    const ws = $('.workspace');
    if (ws) layout.ai = ws.getBoundingClientRect().right - e.clientX;
  },
  reset: () => { layout.ai = 360; },
  key: (e) => {
    const step = e.shiftKey ? 32 : 12;
    if (e.key === 'ArrowLeft') { layout.ai += step; return true; }
    if (e.key === 'ArrowRight') { layout.ai -= step; return true; }
    return false;
  }
});

makeResizer($('#resize-queue'), {
  axis: 'y',
  start: () => {
    const row = $('#queue-list');
    return { base: row ? row.getBoundingClientRect().height : layout.queue };
  },
  move: (e, drag) => { layout.queue = drag.base + (drag.y - e.clientY); },
  reset: () => { layout.queue = 264; },
  key: (e) => {
    const step = e.shiftKey ? 32 : 12;
    if (e.key === 'ArrowUp') { layout.queue += step; return true; }
    if (e.key === 'ArrowDown') { layout.queue -= step; return true; }
    return false;
  }
});

function setAIPane(open, auto = true) {
  if (open && isNarrowAI()) {
    toast('Widen the window to use the AI panel');
    return;
  }
  layout.aiOpen = !!open;
  state.aiOpen = !!open;
  applyLayout();
  saveLayout();
  if (open) {
    renderAIHint();
    if (auto && !lastRunPassed(state.active) && !state.ai && !state.aiLoading && !state.aiError) requestAIHint();
  }
}

function toggleAIPane() {
  if (!state.active) return;
  if (isNarrowAI()) {
    toast('Widen the window to use the AI panel');
    return;
  }
  setAIPane(!state.aiOpen);
}

applyLayout();
window.addEventListener('resize', applyLayout);

/* ------------------------------------------------------------
   Keyboard shortcuts
   ------------------------------------------------------------ */
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'j') {
    e.preventDefault();
    AIChat.toggle();
    return;
  }
  if (e.key === 'Escape') {
    const plan = $('#plan-modal');
    const graph = $('#graph-modal');
    if ((plan && plan.classList.contains('on')) || (graph && graph.classList.contains('on'))) {
      if (plan) plan.classList.remove('on');
      if (graph) graph.classList.remove('on');
      return;
    }
    const stage = $('#design-stage');
    if (stage && stage.classList.contains('brief-open')) {
      openBrief(false);
      return;
    }
    const arch = $('#arch-modal');
    if (arch && arch.classList.contains('inspector-open') && typeof DesignGraph !== 'undefined') {
      DesignGraph.toggleInspector(false);
      return;
    }
    return;
  }
  if (document.activeElement === ed) return;
  const typing = e.target && (e.target.closest('input, textarea, select, [contenteditable="true"]'));
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); AIChat.open(); return; }
  if (e.key === '?') { openPlan(); return; }
  if (document.body.classList.contains('mode-design') && typeof DesignGraph !== 'undefined' && DesignGraph.getGraph()
      && DesignGraph.isInline() && DesignStudy.isMapShown()) {
    if (e.key === 'p' || e.key === 'P') { DesignGraph.setLayout(DesignGraph.layout() === 'paths' ? 'layers' : 'paths'); return; }
    if (e.key === 'e' || e.key === 'E') { DesignGraph.setExpanded(); return; }
  }
  const idx = ALL_CODING.findIndex((q) => state.active && q.id === state.active.id);
  if (e.key === 'j' && idx >= 0) open(ALL_CODING[Math.min(idx + 1, ALL_CODING.length - 1)].id);
  if (e.key === 'k' && idx > 0) open(ALL_CODING[idx - 1].id);
});

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */
function boot() {
  bindDesignChrome();
  AIChat.setContextProvider(chatContextProvider);
  AIChat.init();
  DesignGraph.onChange(() => AIChat.refresh());
  const help = $('#btn-help');
  if (help) help.addEventListener('click', openHelp);
  if (!store.get('gs.help.seen', false)) {
    store.set('gs.help.seen', true);
    setTimeout(openHelp, 400);
  }
  state.queue = state.queue.filter((id) => {
    const item = byId(id);
    return item && ALL_CODING.includes(item);
  });
  store.set(KEYS.queue, state.queue);
  renderSidebar();
  renderQueue();
  const last = store.get(KEYS.last, GS[0] ? GS[0].id : QUESTIONS[0].id);
  open(byId(last) ? last : (GS[0] ? GS[0].id : QUESTIONS[0].id));
}

boot();
