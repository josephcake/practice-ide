/* ============================================================
   STUDY PANEL: Learn (concepts + glossary), Practice (flashcards),
   the estimate calculator, and the numbers cheat sheet.
   Each renderer owns one container element.
   ============================================================ */

const DesignPractice = (() => {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } };
  const ask = (q) => { if (typeof AIChat !== 'undefined') AIChat.ask(q); };
  const icon = (shape) => (typeof DesignGraph !== 'undefined' && DesignGraph.shapeIcon ? DesignGraph.shapeIcon(shape) : '');

  /* ================= LEARN ================= */
  function conceptsFor(item, graph) {
    const comp = new Map();
    if (graph) {
      graph.nodes.forEach((node) => {
        const c = ConceptLib.forNode(node);
        if (!c) return;
        if (!comp.has(c.id)) comp.set(c.id, { c, nodes: [], shape: DesignGraph.shapeOf(node) });
        comp.get(c.id).nodes.push(node);
      });
    }
    const text = [item.prompt, ...(item.hints || []), ...(item.topics || []),
      ...(graph ? [...graph.why, ...graph.tradeoffs, ...graph.nodes.map((n) => n.detail + ' ' + (n.spec || []).join(' '))] : [])].join(' ');
    const linked = ConceptLib.linkTerms(esc(text));
    const ids = new Set([...linked.matchAll(/data-concept="([^"]+)"/g)].map((m) => m[1]));
    const patterns = ConceptLib.all.filter((c) => c.kind === 'pattern' && ids.has(c.id));
    return { components: [...comp.values()], patterns };
  }

  function renderLearn(el, item, graph) {
    const { components, patterns } = conceptsFor(item, graph);
    const card = (c, extra) => `<details class="learn-card">
      <summary>${extra.icon || ''}<b>${esc(c.name)}</b>${extra.meta ? `<span class="learn-meta">${extra.meta}</span>` : ''}</summary>
      <div class="learn-body">
        ${extra.nodes ? `<div class="learn-nodes">${extra.nodes}</div>` : ''}
        <div class="concept-row"><span>What it does</span><p>${esc(c.what)}</p></div>
        <div class="concept-row"><span>Why it is used</span><p>${esc(c.why)}</p></div>
        ${(c.tradeoffs || []).length ? `<div class="concept-row"><span>Trade-offs</span><ul>${c.tradeoffs.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
        ${(c.usedBy || []).length ? `<div class="concept-row"><span>Who uses it</span><div class="used-by">${c.usedBy.map((u) => `<i>${esc(u)}</i>`).join('')}</div></div>` : ''}
        ${c.alt && c.alt !== '—' ? `<div class="concept-row"><span>Alternative</span><p>${esc(c.alt)}</p></div>` : ''}
        <div class="ask-row">
          ${extra.nodes ? `<button class="btn tiny" data-spot="${esc(extra.ids)}" type="button">Show on map</button>` : ''}
          <button class="btn tiny ask-ai-btn" data-ask="${esc(`Teach me ${c.name} using ${item.title} as the example: what it does, why it is needed here, the main trade-off, and a real company that uses it.`)}" type="button">✦ Teach me with this example</button>
        </div>
      </div>
    </details>`;

    el.innerHTML = `
      <div class="study-intro">Each building block: what it does, why it is used, its trade-offs, and who runs it in production.</div>
      ${components.length ? `<div class="study-h">Components on this map <span>${components.length}</span></div>
        ${components.map(({ c, nodes, shape }) => card(c, {
          icon: icon(shape),
          meta: nodes.length === 1 ? esc(nodes[0].label) : `${nodes.length} on map`,
          nodes: nodes.map((n) => `<button class="arch-tag" data-node="${esc(n.id)}" type="button">${esc(n.label)}</button>`).join(''),
          ids: nodes.map((n) => n.id).join(',')
        })).join('')}` : ''}
      ${patterns.length ? `<div class="study-h">Patterns you should be able to explain <span>${patterns.length}</span></div>
        ${patterns.map((c) => card(c, {})).join('')}` : ''}
      ${!components.length && !patterns.length ? '<div class="study-intro">No architecture map for this question. Look up a concept below, or ask the AI.</div>' : ''}
      <div class="study-h">Look up any concept</div>
      <input class="search" id="gloss-search" placeholder="cache, saga, idempotency…">
      <div class="gloss-list" id="gloss-list"></div>`;
    bindGlossary(el);

    el.onclick = (e) => {
      const spot = e.target.closest('[data-spot]');
      if (spot) { DesignStudy.showMap(); DesignGraph.spotlight(spot.dataset.spot.split(',')); return; }
      const node = e.target.closest('[data-node]');
      if (node) { DesignStudy.showMap(); DesignGraph.selectNode(node.dataset.node); return; }
      const a = e.target.closest('[data-ask]');
      if (a) ask(a.dataset.ask);
    };
  }

  /* ================= PRACTICE ================= */
  function deckFor(item, graph) {
    const cards = [];
    if (graph) {
      graph.flow.forEach((f, i) => cards.push({
        id: 'flow' + i, tag: 'User action',
        q: `Walk through “${f.title}”. Which components does the request touch, in what order?`,
        a: `${f.detail}\n\nOrder: ${f.edges.map(([a, b]) => `${label(graph, a)} → ${label(graph, b)}`).join(', ')}`,
        go: { flow: i }
      }));
      graph.nodes.filter((n) => !['Client', 'Consumers', 'Obs'].includes(n.layer)).forEach((n) => cards.push({
        id: 'node-' + n.id, tag: 'Component',
        q: `Why does the design need the ${n.label} (${n.sub})? What would go wrong without it?`,
        a: `${n.detail}\n\n${(n.spec || []).map((s) => '• ' + s).join('\n')}`,
        go: { node: n.id }
      }));
    }
    (item.topics || []).forEach((t, i) => {
      const hint = (item.hints || []).find((h) => h.toLowerCase().includes(t.toLowerCase().split(/[\s/+]/)[0]));
      cards.push({ id: 'topic' + i, tag: 'Topic', q: `Explain “${t}” out loud as it applies to this question.`, a: hint || 'No written answer for this one. Press “Ask AI to check me” and explain it in your own words.' });
    });
    return cards;
  }
  const label = (graph, id) => (graph.nodes.find((n) => n.id === id) || {}).label || id;

  function renderPractice(el, item, graph) {
    const key = 'gs.quiz.' + item.id;
    const marks = load(key, {});
    const deck = deckFor(item, graph);
    const rank = { miss: 0, undefined: 1, shaky: 2, good: 3 };
    let order = deck.slice().sort((a, b) => rank[marks[a.id]] - rank[marks[b.id]]);
    let idx = 0;
    let shown = false;

    const draw = () => {
      const good = deck.filter((c) => marks[c.id] === 'good').length;
      const card = order[idx];
      if (!card) {
        el.innerHTML = '<div class="study-intro">No practice cards for this question yet. Ask the AI to quiz you instead.</div>'
          + `<button class="btn ask-ai-btn" data-quiz type="button">✦ Quiz me</button>`;
        return;
      }
      el.innerHTML = `
        <div class="study-intro">Answer out loud before you reveal. Cards you miss come back first next time.</div>
        <div class="quiz-progress"><div style="width:${deck.length ? Math.round(good / deck.length * 100) : 0}%"></div></div>
        <div class="quiz-stats"><span>${good}/${deck.length} mastered</span><span>card ${idx + 1} of ${order.length}</span></div>
        <div class="quiz-card">
          <span class="quiz-tag">${esc(card.tag)}</span>
          <div class="quiz-q">${esc(card.q)}</div>
          ${shown ? `<div class="quiz-a">${esc(card.a).replace(/\n/g, '<br>')}</div>` : ''}
          <div class="quiz-actions">
            ${shown ? `
              <button class="btn tiny" data-mark="miss" type="button">✕ Missed it</button>
              <button class="btn tiny" data-mark="shaky" type="button">~ Shaky</button>
              <button class="btn tiny primary" data-mark="good" type="button">✓ Got it</button>`
              : '<button class="btn primary" data-show type="button">Reveal answer</button>'}
          </div>
          ${shown && card.go ? '<button class="linklike" data-go type="button">See it on the map →</button>' : ''}
        </div>
        <div class="ask-row">
          <button class="btn tiny ask-ai-btn" data-check type="button">✦ Ask AI to check my answer</button>
          <button class="btn tiny ask-ai-btn" data-quiz type="button">✦ Interview me with follow-ups</button>
          <button class="btn tiny ghost" data-reset type="button">Reset deck</button>
        </div>`;
    };

    el.onclick = (e) => {
      const card = order[idx];
      if (e.target.closest('[data-show]')) { shown = true; draw(); return; }
      const mark = e.target.closest('[data-mark]');
      if (mark && card) {
        marks[card.id] = mark.dataset.mark;
        save(key, marks);
        idx = (idx + 1) % order.length;
        shown = false;
        draw();
        return;
      }
      if (e.target.closest('[data-go]') && card && card.go) {
        DesignStudy.showMap();
        if (card.go.flow != null) DesignGraph.startFlowAt(card.go.flow);
        if (card.go.node) DesignGraph.selectNode(card.go.node);
        return;
      }
      if (e.target.closest('[data-check]') && card) {
        if (typeof AIChat !== 'undefined') AIChat.ask(`Practice question: "${card.q}"\nMy answer: `, { send: false });
        return;
      }
      if (e.target.closest('[data-quiz]')) {
        ask(`Interview me on ${item.title}. Ask one follow-up question at a time, the way a senior interviewer would, and wait for my answer before giving feedback.`);
        return;
      }
      if (e.target.closest('[data-reset]')) {
        Object.keys(marks).forEach((k) => delete marks[k]);
        save(key, marks);
        order = deck.slice();
        idx = 0;
        shown = false;
        draw();
      }
    };
    draw();
  }

  /* ================= TOOLKIT ================= */
  const PRESETS = {
    'url-shortener': { writes: 100e6, ratio: 100, bytes: 500, years: 10, peak: 3, what: 'new short links' },
    instagram: { writes: 100e6, ratio: 200, bytes: 2e6, years: 10, peak: 3, what: 'new posts (media)' },
    gmail: { writes: 10e9, ratio: 3, bytes: 75e3, years: 10, peak: 2, what: 'emails received' },
    uber: { writes: 21.6e9, ratio: 1, bytes: 100, years: 1, peak: 3, what: 'driver GPS pings (1M drivers / 4 s)' },
    ledger: { writes: 50e6, ratio: 10, bytes: 1000, years: 7, peak: 5, what: 'transfers' },
    'core-bank': { writes: 20e6, ratio: 20, bytes: 1000, years: 10, peak: 4, what: 'postings' },
    'fintech-platform': { writes: 30e6, ratio: 20, bytes: 1000, years: 7, peak: 4, what: 'money movements' },
    'gsr-notification-service': { writes: 100e6, ratio: 1, bytes: 2000, years: 2, peak: 5, what: 'notifications' },
    'rate-limiter': { writes: 4.3e9, ratio: 1, bytes: 64, years: 0.003, peak: 3, what: 'API requests (each is a counter write)' },
    cache: { writes: 1.7e9, ratio: 10, bytes: 2000, years: 0.003, peak: 2, what: 'writes (reads are 200k/s)' },
    'market-data': { writes: 2e9, ratio: 10000, bytes: 100, years: 1, peak: 5, what: 'price ticks (each fanned out to 10k)' },
    'deepseek-inference': { writes: 500e6, ratio: 1, bytes: 8000, years: 1, peak: 3, what: 'API requests' }
  };
  const DEFAULT = { writes: 10e6, ratio: 10, bytes: 1000, years: 5, peak: 3, what: 'writes' };

  const fmtN = (n) => {
    if (!isFinite(n)) return '—';
    const a = Math.abs(n);
    if (a >= 1e12) return (n / 1e12).toFixed(1).replace(/\.0$/, '') + 'T';
    if (a >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (a >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return n >= 10 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, '');
  };
  const fmtB = (b) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
    let i = 0;
    while (b >= 1000 && i < units.length - 1) { b /= 1000; i++; }
    return (b >= 100 ? Math.round(b) : b.toFixed(1).replace(/\.0$/, '')) + ' ' + units[i];
  };
  const parseN = (s) => {
    const m = /^\s*([\d.]+)\s*([kmbt]?)\s*$/i.exec(String(s).replace(/,/g, ''));
    if (!m) return NaN;
    return parseFloat(m[1]) * ({ '': 1, k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[m[2].toLowerCase()]);
  };

  const LATENCY = [
    ['Read from memory (RAM)', '100 ns'],
    ['Redis GET, same datacenter', '0.2–0.5 ms'],
    ['SSD random read', '0.1 ms'],
    ['Round trip inside a datacenter', '0.5 ms'],
    ['Simple indexed DB query', '1–5 ms'],
    ['Read 1 MB sequentially from SSD', '1 ms'],
    ['HDD seek', '10 ms'],
    ['Round trip US east ↔ west', '70 ms'],
    ['Round trip US ↔ Europe', '150 ms']
  ];
  const CAPACITY = [
    ['Stateless app server', '1k–5k req/s'],
    ['Postgres / MySQL primary', '5k–10k writes/s'],
    ['Redis node', '~100k ops/s'],
    ['Kafka broker', '100s of MB/s'],
    ['1 day', '86,400 s ≈ 10⁵ s'],
    ['1M per day', '≈ 12 per second'],
    ['99.9% uptime', '8.8 h down / year'],
    ['99.99% uptime', '53 min down / year']
  ];

  function numbersHTML() {
    return `<div class="study-h">Latency</div>
      <table class="num-table">${LATENCY.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table>
      <div class="study-h">Capacity and time</div>
      <table class="num-table">${CAPACITY.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table>`;
  }

  function bindGlossary(el) {
    const list = el.querySelector('#gloss-list');
    const input = el.querySelector('#gloss-search');
    if (!list || !input) return;
    const draw = () => {
      const term = input.value.trim().toLowerCase();
      if (!term) { list.innerHTML = ''; return; }
      const items = ConceptLib.all.filter((c) => (c.name + ' ' + (c.aliases || []).join(' ') + ' ' + c.what).toLowerCase().includes(term));
      list.innerHTML = items.map((c) => `<details class="learn-card"><summary><b>${esc(c.name)}</b></summary>
        <div class="learn-body"><p>${esc(c.what)}</p><p class="dim">${esc(c.why)}</p>
        ${(c.usedBy || []).length ? `<div class="used-by">${c.usedBy.map((u) => `<i>${esc(u)}</i>`).join('')}</div>` : ''}</div></details>`).join('')
        || '<div class="study-intro">No match. Try Ask AI.</div>';
    };
    input.addEventListener('input', draw);
  }

  function renderToolkit(el, item, opts = {}) {
    const p = Object.assign({}, DEFAULT, PRESETS[item.id] || {});
    el.innerHTML = `
      <div class="study-intro">Pre-filled for this question. Type values like 100M, 2.5k, 1B.</div>
      <div class="calc-grid">
        <label><span>${esc(p.what)} / day</span><input data-k="writes" value="${fmtN(p.writes)}"></label>
        <label><span>Reads per write</span><input data-k="ratio" value="${fmtN(p.ratio)}"></label>
        <label><span>Bytes per record</span><input data-k="bytes" value="${fmtN(p.bytes)}"></label>
        <label><span>Keep for (years)</span><input data-k="years" value="${p.years}"></label>
        <label><span>Peak ÷ average</span><input data-k="peak" value="${p.peak}"></label>
        <label><span>Replicas</span><input data-k="repl" value="3"></label>
      </div>
      <div class="calc-out"></div>
      <div class="ask-row">
        <button class="btn tiny" data-copy type="button">Add these numbers to my answer</button>
        <button class="btn tiny ask-ai-btn" data-explain type="button">✦ Check my numbers</button>
      </div>`;

    const out = el.querySelector('.calc-out');
    let summary = '';
    const compute = () => {
      const v = {};
      el.querySelectorAll('[data-k]').forEach((i) => { v[i.dataset.k] = parseN(i.value); });
      const wq = v.writes / 86400, rq = wq * v.ratio;
      const perDay = v.writes * v.bytes;
      const total = perDay * 365 * v.years * v.repl;
      const egress = rq * v.bytes;
      const servers = Math.ceil((wq + rq) * v.peak / 2000);
      const rows = [
        ['Writes / s', `${fmtN(wq)} avg · ${fmtN(wq * v.peak)} peak`, `${fmtN(v.writes)} ÷ 86,400`],
        ['Reads / s', `${fmtN(rq)} avg · ${fmtN(rq * v.peak)} peak`, `writes/s × ${fmtN(v.ratio)}`],
        ['New data / day', fmtB(perDay), `${fmtN(v.writes)} × ${fmtB(v.bytes)}`],
        ['Total stored', fmtB(total), `per day × 365 × ${v.years} yr × ${v.repl} replicas`],
        ['Read bandwidth', fmtB(egress) + '/s', 'reads/s × record size'],
        ['App servers @2k req/s', String(isFinite(servers) ? servers : '—'), 'peak QPS ÷ 2,000']
      ];
      out.innerHTML = rows.map(([k, val, how]) => `<div><span>${k}</span><b>${val}</b><i>${esc(how)}</i></div>`).join('');
      summary = rows.map(([k, val, how]) => `${k}: ${val} (${how})`).join('\n');
    };
    el.querySelectorAll('[data-k]').forEach((i) => i.addEventListener('input', compute));
    compute();

    el.onclick = (e) => {
      e.stopPropagation();
      if (e.target.closest('[data-copy]')) { DesignStudy.appendToStage('est', summary); return; }
      if (e.target.closest('[data-explain]')) ask(`Check my back-of-envelope numbers for ${item.title} and tell me what they imply for the design (sharding, caching, number of servers):\n${summary}`);
    };
  }

  return { renderLearn, renderPractice, renderToolkit, numbersHTML };
})();
