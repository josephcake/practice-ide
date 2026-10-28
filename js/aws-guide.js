/* ============================================================
   AWS PAGE — lesson list, the architecture canvas (the shared
   DesignGraph renderer), and the side panel: decision guide,
   service cards, a scenario quiz, and the canvas inspector.
   ============================================================ */

const AwsGuide = (() => {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } };
  const KEY = (id) => 'gs.aws.' + id;
  const WIDTH_KEY = 'gs.aws.w';
  const COLLAPSED_KEY = 'gs.aws.collapsed';
  const DEFAULT_W = 460;

  const SVC = new Map(AWS_SERVICES.map((s) => [s.id, s]));
  const LESSONS = AWS_LESSONS.slice();
  const BY_ID = new Map(LESSONS.map((l) => [l.id, l]));
  const GROUPS = [['start', 'Start here'], ['core', 'Core services: which one?'], ['genai', 'Gen AI & ML on AWS']];
  const TABS = [['guide', 'Guide'], ['inspect', 'Inspect'], ['services', 'Services'], ['quiz', 'Quiz']];
  const catOf = (s) => AWS_CATEGORIES[s && s.cat] || AWS_CATEGORIES.other;
  const groupLabel = (g) => (GROUPS.find(([k]) => k === g) || [g, g])[1];
  const names = (L) => L.services.map((id) => (SVC.get(id) || {}).short).filter(Boolean).join(', ');

  let current = null;
  let st = { tab: 'guide', answers: {} };
  let scrollPos = {};
  let search = '';
  let width = Number(load(WIDTH_KEY, DEFAULT_W)) || DEFAULT_W;
  let hooks = { isDone: () => false, onOpen: (id) => open(id) };
  let stage, pane, tabsEl, bodyEl, inspectEl;

  /* ---------------- canvas maps ---------------- */
  function expandMap(L) {
    const m = L.map;
    const nodes = m.nodes.map(([id, svcId, sub, layer, detail, label, badge]) => {
      const s = SVC.get(svcId) || {};
      const cat = catOf(s);
      return {
        id, svc: svcId, label: label || s.short || svcId, sub, layer, detail, spec: [],
        shape: s.shape || 'service', color: cat.color,
        badge: badge || (s.nonAws ? (s.shape === 'client' ? 'USER' : 'EXTERNAL') : cat.badge)
      };
    });
    const edges = [];
    m.edges.forEach(([from, to, label, kind, detail]) => edges.push({ from, to, label, kind, detail }));
    const flow = m.flow.map(([title, detail, hops, kind]) => {
      const pairs = hops.split(',').map((h) => h.trim()).filter(Boolean).map((h) => h.split('>').map((x) => x.trim()));
      const seen = [];
      pairs.forEach(([a, b]) => { if (!seen.includes(a)) seen.push(a); if (!seen.includes(b)) seen.push(b); });
      return { title, detail, nodes: seen, edges: pairs, kind };
    });
    return {
      title: m.title, subtitle: m.subtitle, layers: m.layers, nodes, edges, flow,
      why: m.why, tradeoffs: m.tradeoffs, failures: [],
      basedOn: 'AWS documentation and decision guides (checked October 2026).',
      sources: m.sources || [], aws: true,
      // wider gaps between columns leave room for connection labels on these denser maps
      colw: 280
    };
  }
  if (typeof DESIGN_GRAPHS !== 'undefined') LESSONS.forEach((L) => { DESIGN_GRAPHS[L.id] = expandMap(L); });

  /* ---------------- service names become clickable ---------------- */
  const aliasPairs = [];
  AWS_SERVICES.forEach((s) => {
    if (s.nonAws) return;
    new Set([s.name, s.short, ...(s.aliases || [])]).forEach((a) => aliasPairs.push([esc(a), s.id]));
  });
  aliasPairs.sort((a, b) => b[0].length - a[0].length);
  const aliasMap = new Map(aliasPairs);
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const aliasRe = new RegExp(`(^|[^\\w-])(${aliasPairs.map(([a]) => escRe(a)).join('|')})(?![\\w-])`, 'g');

  /** Wraps the first mention of each AWS service in already-escaped text with a button. */
  function linkSvc(html, seen = new Set(), skip = null) {
    return String(html).replace(aliasRe, (m, pre, word) => {
      const id = aliasMap.get(word);
      if (!id || id === skip || seen.has(id)) return m;
      seen.add(id);
      return `${pre}<button type="button" class="svc-link" data-svc="${id}">${word}</button>`;
    });
  }

  function chip(id) {
    const s = SVC.get(id);
    if (!s) return '';
    return `<button type="button" class="svc-chip" data-svc="${id}" style="--cat:${catOf(s).color}" title="${esc(s.name)}: ${esc(s.plain)}">${esc(s.short)}</button>`;
  }

  function lessonsWith(id) {
    return LESSONS.filter((L) => L.services.includes(id) || L.map.nodes.some((n) => n[1] === id));
  }

  /** The lesson that teaches a service best: where it leads, then where it is on the canvas. */
  function lessonFor(id) {
    return LESSONS.find((L) => L.services[0] === id)
      || LESSONS.find((L) => L.services.includes(id) && L.map.nodes.some((n) => n[1] === id))
      || LESSONS.find((L) => L.map.nodes.some((n) => n[1] === id))
      || LESSONS.find((L) => L.services.includes(id));
  }

  /* ---------------- service card (inspector, Services tab, popover) ---------------- */
  function serviceCard(id, opts = {}) {
    const s = SVC.get(id);
    if (!s) return '';
    const c = catOf(s);
    if (s.nonAws) {
      return `<div class="aws-card" style="--cat:${c.color}"><div class="aws-card-head"><b>${esc(s.name)}</b></div><p class="aws-plain">${esc(s.plain)}</p></div>`;
    }
    const seen = new Set([id]);
    const L = (t) => linkSvc(esc(t), seen, id);
    const list = (arr) => `<ul>${arr.map((t) => `<li>${L(t)}</li>`).join('')}</ul>`;
    const others = opts.appears ? lessonsWith(id).filter((x) => !current || x.id !== current.id) : [];
    return `<div class="aws-card${opts.compact ? ' compact' : ''}" style="--cat:${c.color}">
      <div class="aws-card-head"><span class="aws-cat">${esc(c.badge)}</span><b>${esc(s.name)}</b>${s.aiKey ? '<span class="aws-ai-tag" title="Essential to AI and gen AI work">AI</span>' : ''}</div>
      <p class="aws-plain">${L(s.plain)}</p>
      ${s.analogy ? `<p class="aws-analogy"><span>Think of it as</span>${esc(s.analogy)}</p>` : ''}
      ${s.use ? `<div class="aws-row good"><span>Use it when</span>${list(opts.compact ? s.use.slice(0, 3) : s.use)}</div>` : ''}
      ${s.avoid ? `<div class="aws-row bad"><span>Pick something else when</span><ul>${s.avoid.map(([t, alt]) => `<li>${L(t)}${alt ? `<span class="aws-alt"><i>→</i>${chip(alt)}</span>` : ''}</li>`).join('')}</ul></div>` : ''}
      ${s.pay ? `<div class="aws-row"><span>How you pay</span><p>${L(s.pay)}</p></div>` : ''}
      ${!opts.compact && s.limits ? `<div class="aws-row"><span>Limits to know</span>${list(s.limits)}</div>` : ''}
      ${!opts.compact && s.ai ? `<div class="aws-row ai"><span>In AI and gen AI</span><p>${L(s.ai)}</p></div>` : ''}
      ${!opts.compact && s.who ? `<div class="aws-row"><span>Who uses it</span><div class="used-by">${s.who.map((w) => `<i>${esc(w)}</i>`).join('')}</div></div>` : ''}
      ${!opts.compact && s.tip ? `<div class="aws-tip"><b>Interview line</b>${esc(s.tip)}</div>` : ''}
      ${others.length ? `<div class="aws-row"><span>See it on a canvas</span><div class="aws-lesson-links">${others.slice(0, 4).map((x) => `<button type="button" class="linklike" data-open-lesson="${x.id}" data-focus="${id}">${esc(x.title)}</button>`).join('')}</div></div>` : ''}
      ${s.url ? `<div class="aws-card-foot"><a href="${esc(s.url)}" target="_blank" rel="noopener">AWS page ↗</a></div>` : ''}
    </div>`;
  }

  /* ---------------- popover for services that are not on this canvas ---------------- */
  function hidePop() {
    const pop = document.getElementById('aws-pop');
    if (pop) pop.classList.remove('on');
  }

  function showPop(anchor, id) {
    let pop = document.getElementById('aws-pop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'aws-pop';
      pop.className = 'aws-pop';
      document.body.appendChild(pop);
      pop.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]')) { hidePop(); return; }
        const lesson = e.target.closest('[data-open-lesson]');
        if (lesson) { hidePop(); openLesson(lesson.dataset.openLesson, lesson.dataset.focus); return; }
        const svc = e.target.closest('[data-svc]');
        if (svc) { e.stopPropagation(); showPop(svc, svc.dataset.svc); }
      });
    }
    const s = SVC.get(id);
    pop.innerHTML = `<button class="chat-mini aws-pop-close" data-close type="button" aria-label="Close">✕</button>
      ${serviceCard(id, { compact: true, appears: true })}
      <div class="aws-pop-note">Not on this canvas.</div>`;
    pop.classList.add('on');
    const r = anchor ? anchor.getBoundingClientRect() : { left: window.innerWidth / 2 - 170, bottom: 120, top: 120 };
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
    pop.style.top = (r.bottom + h + 12 > window.innerHeight ? Math.max(8, r.top - h - 8) : r.bottom + 6) + 'px';
    pop.setAttribute('aria-label', s ? s.name : 'AWS service');
  }

  /** Select the service on the canvas if it is there; otherwise show its card in a popover. */
  function focusService(id, anchor) {
    if (!current) return;
    const g = typeof DESIGN_GRAPHS !== 'undefined' ? DESIGN_GRAPHS[current.id] : null;
    const node = g && g.nodes.find((n) => n.svc === id);
    if (node && typeof DesignGraph !== 'undefined' && DesignGraph.currentId() === current.id) {
      hidePop();
      DesignGraph.selectNode(node.id);
      return;
    }
    showPop(anchor, id);
  }

  function openLesson(lessonId, focusId) {
    hooks.onOpen(lessonId);
    if (focusId) setTimeout(() => focusService(focusId), 60);
  }

  /* ---------------- side panel: Guide ---------------- */
  function compareTable(L) {
    const c = L.compare;
    const head = c.cols.map((col) => {
      const s = SVC.get(col);
      return `<th>${s ? chip(col) : `<span class="aws-col-label">${esc(col)}</span>`}</th>`;
    }).join('');
    return `<table class="aws-compare"><thead><tr><th></th>${head}</tr></thead>
      <tbody>${c.rows.map(([label, cells]) => `<tr><th>${esc(label)}</th>${cells.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function askBtn(label, question) {
    return `<button class="btn tiny ask-ai-btn" data-ask="${esc(question)}" type="button">✦ ${esc(label)}</button>`;
  }

  function flowButtons(L) {
    const g = DESIGN_GRAPHS[L.id];
    if (!g) return '';
    const tag = { write: ['rw-write', 'WRITE'], read: ['rw-read', 'READ'], background: ['rw-bg', 'BACKGROUND'] };
    return `<div class="aws-flows">${g.flow.map((f, i) => {
      const [cls, txt] = tag[f.kind] || tag.background;
      return `<button class="aws-flow" data-flow="${i}" type="button"><span class="rw-pill ${cls}">${txt}</span><b>${i + 1}. ${esc(f.title)}</b><span>${esc(f.detail)}</span></button>`;
    }).join('')}</div>`;
  }

  function indexHTML() {
    const cats = Object.keys(AWS_CATEGORIES).filter((k) => k !== 'other');
    return `<div class="study-h">Every service in this guide <span>${AWS_SERVICES.filter((s) => !s.nonAws).length}</span></div>
      <p class="aws-note">Click any service to see what it is, when to use it, and the lesson that shows it on a canvas.</p>
      <div class="aws-index">${cats.map((k) => {
        const c = AWS_CATEGORIES[k];
        const list = AWS_SERVICES.filter((s) => s.cat === k);
        return list.length ? `<div class="aws-index-cat" style="--cat:${c.color}"><div class="aws-index-h"><b>${esc(c.label)}</b><span>${esc(c.q)}</span></div><div class="aws-chips">${list.map((s) => chip(s.id)).join('')}</div></div>` : '';
      }).join('')}</div>`;
  }

  function guideHTML() {
    const L = current;
    const seen = new Set();
    const link = (t) => linkSvc(esc(t), seen);
    return `<section class="aws-hero">
        <div class="aws-kicker">${esc(groupLabel(L.group))} · ${L.services.length} services</div>
        <p class="aws-question">${esc(L.question)}</p>
        <p class="aws-summary">${link(L.summary)}</p>
        <div class="aws-chips">${L.services.map(chip).join('')}</div>
        <div class="aws-hero-actions">
          <button class="btn tiny primary" data-act="tour" type="button">▶ Walk through it on the canvas</button>
          ${askBtn('Explain it like I am new', `Explain the AWS services in "${L.title}" to someone new to AWS. For each one: a plain sentence and an everyday analogy. Then explain how they work together on the canvas.`)}
        </div>
      </section>
      ${L.decide ? `<div class="study-h">Pick the right one <span>${L.decide.length}</span></div>
        <ol class="aws-decide">${L.decide.map(([when, ids, why]) => `<li>
          <div class="aws-if"><i>If</i>${esc(when)}</div>
          <div class="aws-then"><i>→</i>${ids.map(chip).join('')}</div>
          ${why ? `<p>${linkSvc(esc(why))}</p>` : ''}
        </li>`).join('')}</ol>` : ''}
      ${L.compare ? `<div class="study-h">${esc(L.compare.title)}<button class="linklike aws-wide" data-act="compare-wide" type="button">Open wide ⤢</button></div>
        <div class="aws-compare-wrap">${compareTable(L)}</div>` : ''}
      ${L.examples ? `<div class="study-h">Real examples: which one, and why <span>${L.examples.length}</span></div>
        ${L.examples.map(([q, ids, why, not]) => `<div class="aws-example">
          <div class="aws-ex-q">${esc(q)}</div>
          <div class="aws-ex-pick"><span>Use</span>${ids.map(chip).join('')}</div>
          <p class="aws-ex-why">${linkSvc(esc(why))}</p>
          ${not ? `<p class="aws-ex-not"><b>Why not the alternative:</b> ${linkSvc(esc(not))}</p>` : ''}
        </div>`).join('')}` : ''}
      <div class="study-h">Walk through it on the canvas</div>
      <p class="aws-note">Each row is one thing a user does. Click it to light up every hop on the canvas, in order.</p>
      ${flowButtons(L)}
      ${L.id === 'aws-overview' ? indexHTML() : ''}
      <div class="ask-row">
        ${askBtn('Test me with a scenario', `Give me one realistic scenario where I must choose between ${names(L)}. Ask me which I would pick and why, then wait for my answer.`)}
        ${askBtn('What do interviewers ask?', `What do system design interviewers commonly ask about ${names(L)}? Give 5 questions, each with a one-line strong answer.`)}
      </div>`;
  }

  /* ---------------- side panel: Services ---------------- */
  function servicesHTML() {
    const L = current;
    const g = DESIGN_GRAPHS[L.id];
    const onMap = new Set(g ? g.nodes.map((n) => n.svc) : []);
    return `<div class="study-intro">Every AWS service in this lesson: what it is, when to use it, what to pick instead, and how you pay.</div>
      ${L.services.map((id, i) => {
        const s = SVC.get(id);
        if (!s) return '';
        return `<details class="aws-svc"${i === 0 ? ' open' : ''} style="--cat:${catOf(s).color}">
          <summary><span class="aws-dot"></span><b>${esc(s.short)}</b><span class="aws-svc-cat">${esc(catOf(s).label)}</span>
            ${onMap.has(id) ? `<button class="btn tiny" data-show="${id}" type="button">Show on canvas</button>` : ''}</summary>
          ${serviceCard(id)}
        </details>`;
      }).join('')}`;
  }

  /* ---------------- side panel: Quiz ---------------- */
  function quizScore() {
    const q = current.quiz || [];
    const answered = q.filter((_, i) => st.answers[i] != null).length;
    const right = q.filter(([, , a], i) => st.answers[i] === a).length;
    return { total: q.length, answered, right };
  }

  function quizHTML() {
    const L = current;
    const { total, answered, right } = quizScore();
    const allRight = total && right === total;
    return `<div class="aws-quiz-head"><b>Which service would you pick?</b><span>${right}/${total} correct</span>
        ${answered ? '<button class="btn tiny ghost" data-act="quiz-reset" type="button">Retry</button>' : ''}</div>
      <div class="quiz-progress"><div style="width:${total ? Math.round(answered / total * 100) : 0}%"></div></div>
      ${allRight ? `<div class="aws-quiz-done"><b>All correct.</b><span>${hooks.isDone(L.id) ? 'This lesson is marked done.' : 'Mark this lesson done to track your progress.'}</span>
        ${hooks.isDone(L.id) ? '' : '<button class="btn tiny primary" data-act="mark-done" type="button">Mark lesson done</button>'}</div>` : ''}
      ${(L.quiz || []).map(([q, opts, a, why], i) => {
        const pick = st.answers[i];
        const done = pick != null;
        return `<section class="aws-q${done ? (pick === a ? ' right' : ' wrong') : ''}">
          <div class="aws-q-n">Question ${i + 1} of ${total}</div>
          <p class="aws-q-text">${esc(q)}</p>
          <div class="aws-q-opts">${opts.map((o, j) => {
            const cls = !done ? '' : j === a ? ' correct' : j === pick ? ' picked' : ' muted';
            return `<button class="aws-opt${cls}" data-q="${i}" data-opt="${j}" type="button"${done ? ' disabled' : ''}>${esc(o)}</button>`;
          }).join('')}</div>
          ${done ? `<div class="aws-q-why"><b>${pick === a ? 'Correct.' : 'Not quite.'}</b> ${linkSvc(esc(why))}</div>` : ''}
        </section>`;
      }).join('')}
      <div class="ask-row">${askBtn('Quiz me with new scenarios', `Quiz me on ${names(L)}. Ask ONE realistic "which AWS service would you pick?" question with 4 options, then wait for my answer before explaining.`)}</div>`;
  }

  /* ---------------- render ---------------- */
  function render() {
    if (!current || !pane) return;
    const { total, right, answered } = quizScore();
    tabsEl.innerHTML = TABS.map(([k, label]) => {
      const n = k === 'quiz' && answered ? `<i class="aws-tab-n">${right}/${total}</i>` : '';
      return `<button class="study-tab${st.tab === k ? ' on' : ''}" data-tab="${k}" type="button">${label}${n}</button>`;
    }).join('');
    const inspecting = st.tab === 'inspect';
    inspectEl.hidden = !inspecting;
    bodyEl.hidden = inspecting;
    if (inspecting) return;
    bodyEl.innerHTML = st.tab === 'services' ? servicesHTML() : st.tab === 'quiz' ? quizHTML() : guideHTML();
    bodyEl.scrollTop = scrollPos[st.tab] || 0;
  }

  function setTab(tab) {
    if (!current || st.tab === tab) return;
    if (!bodyEl.hidden) scrollPos[st.tab] = bodyEl.scrollTop;
    st.tab = tab;
    render();
  }

  function persist() { if (current) save(KEY(current.id), { answers: st.answers }); }

  /* ---------------- sidebar ---------------- */
  function lessonHay(L) {
    const svc = L.services.map((id) => { const s = SVC.get(id) || {}; return [s.name, s.short, ...(s.aliases || [])].join(' '); }).join(' ');
    return [L.title, L.question, L.summary, svc].join(' ').toLowerCase();
  }

  function renderSidebar() {
    const list = document.getElementById('aws-list');
    if (!list) return;
    const q = search.trim().toLowerCase();
    const row = (L) => `<div class="item design-item aws-item${current && current.id === L.id ? ' on' : ''}" data-id="${L.id}" title="${esc(L.question)}">
      <span class="done-dot ${hooks.isDone(L.id) ? '' : 'off'}"></span>
      <span class="t">${esc(L.title)}</span>
      <span class="lvl aws-lvl" title="${L.services.length} AWS services">${L.services.length}</span>
    </div>`;
    let html = '';
    GROUPS.forEach(([g, label]) => {
      const items = LESSONS.filter((L) => L.group === g && (!q || lessonHay(L).includes(q)));
      if (!items.length) return;
      const done = items.filter((L) => hooks.isDone(L.id)).length;
      html += `<div class="group-h aws-group aws-group-${g}">${esc(label)} <span class="cnt">${done}/${items.length}</span></div>${items.map(row).join('')}`;
    });
    if (q.length >= 2) {
      const hits = AWS_SERVICES.filter((s) => !s.nonAws && [s.name, s.short, ...(s.aliases || []), s.plain].join(' ').toLowerCase().includes(q)).slice(0, 12);
      if (hits.length) {
        html += `<div class="group-h aws-group">Services <span class="cnt">${hits.length}</span></div>${hits.map((s) => `<div class="item design-item aws-svc-hit" data-svc-hit="${s.id}" title="${esc(s.plain)}">
          <span class="aws-dot" style="--cat:${catOf(s).color}"></span>
          <span class="t">${esc(s.short)} <small>${esc(catOf(s).label)}</small></span>
          <span class="lvl aws-lvl">open</span>
        </div>`).join('')}`;
      }
    }
    list.innerHTML = html || '<div class="empty" style="padding:16px 8px">No lessons or services match.</div>';
    const count = document.getElementById('aws-count');
    if (count) count.textContent = `${LESSONS.filter((L) => hooks.isDone(L.id)).length}/${LESSONS.length}`;
    const next = document.getElementById('btn-aws-next');
    if (next) next.disabled = !nextId();
  }

  function nextId() {
    const idx = current ? LESSONS.indexOf(current) : -1;
    const order = LESSONS.slice(idx + 1).concat(LESSONS.slice(0, idx + 1));
    const n = order.find((L) => !hooks.isDone(L.id));
    return n ? n.id : null;
  }

  /* ---------------- open / close ---------------- */
  function mount() {
    const canvas = document.getElementById('aws-canvas');
    const arch = document.getElementById('arch-modal');
    if (arch && canvas && arch.parentElement !== canvas) canvas.appendChild(arch);
    const side = document.querySelector('.arch-side');
    if (side && inspectEl && side.parentElement !== inspectEl) inspectEl.appendChild(side);
  }

  function open(id) {
    const L = BY_ID.get(id) || LESSONS[0];
    hidePop();
    current = L;
    st = { tab: 'guide', answers: (load(KEY(L.id), {}) || {}).answers || {} };
    scrollPos = {};
    mount();
    applyWidth();
    if (typeof DesignGraph !== 'undefined') DesignGraph.open(L.id, { inline: true });
    render();
    renderSidebar();
    return L;
  }

  function close() {
    hidePop();
    if (!current) return;
    const side = document.querySelector('.arch-side');
    const home = document.getElementById('study-inspect');
    if (side && home && side.parentElement !== home) home.appendChild(side);
    if (typeof DesignGraph !== 'undefined' && DesignGraph.currentId() === current.id) {
      DesignGraph.setExpanded(false);
      DesignGraph.close();
    }
    current = null;
  }

  function reset(id) {
    try { localStorage.removeItem(KEY(id)); } catch { /* ignore */ }
    if (current && current.id === id) { st.answers = {}; render(); }
  }

  /** The canvas selected a component or a user action: show it in the Inspect tab. */
  function notifyInspect() {
    if (!current || !document.body.classList.contains('mode-aws')) return;
    setTab('inspect');
  }

  /* ---------------- AI chat context ---------------- */
  function mapSummary(L) {
    const g = DESIGN_GRAPHS[L.id];
    if (!g) return '';
    const nodes = g.nodes.map((n) => `- ${n.label} (${(SVC.get(n.svc) || {}).name || n.svc}) as "${n.sub}": ${n.detail}`).join('\n');
    const flows = g.flow.map((f, i) => `${i + 1}. ${f.title}: ${f.detail}`).join('\n');
    return `${g.title}: ${g.subtitle}\nServices on the canvas:\n${nodes}\nUser actions:\n${flows}\nWhy it works:\n- ${g.why.join('\n- ')}\nTrade-offs:\n- ${g.tradeoffs.join('\n- ')}`;
  }

  function chatContext() {
    const L = current;
    if (!L) return null;
    const live = typeof DesignGraph !== 'undefined' && DesignGraph.isInline() && DesignGraph.currentId() === L.id;
    const focus = live ? DesignGraph.getFocus() : null;
    const node = focus && focus.type === 'node' ? (DESIGN_GRAPHS[L.id].nodes.find((n) => n.id === focus.id) || null) : null;
    const s = node ? SVC.get(node.svc) : null;
    const { total, right, answered } = quizScore();
    const prompt = [L.question, L.summary,
      'Decision guide:', ...(L.decide || []).map(([w, ids, why]) => `- ${w} → ${ids.map((id) => (SVC.get(id) || {}).short).join(', ')}. ${why}`),
      'Worked examples:', ...(L.examples || []).map(([q, ids, why]) => `- ${q} → ${ids.map((id) => (SVC.get(id) || {}).short).join(', ')}. ${why}`)].join('\n');
    const short = L.title.split(':')[0];
    const suggestions = s && !s.nonAws
      ? [`When should I NOT use ${s.short}?`, `Compare ${s.short} with its closest alternative in a table`, `What would ${s.short} cost for a small app?`, `How does ${s.short} come up in interviews?`]
      : [`Explain ${short} like I am new to AWS`, 'Give me a scenario and ask me which service to pick', 'Compare these services in a table, with costs', 'What do interviewers ask about these services?'];
    return {
      key: 'aws:' + L.id,
      label: 'AWS · ' + L.title,
      focusLabel: focus ? focus.label : '',
      page: 'design',
      context: {
        page: 'design',
        question: {
          title: 'AWS study: ' + L.title,
          kind: 'AWS services study (the learner is studying, not answering an interview question)',
          level: '', seniority: 'N/A', prompt,
          topics: L.services.map((id) => (SVC.get(id) || {}).name).filter(Boolean)
        },
        design: {
          map: mapSummary(L),
          focus: focus ? focus.text + (s && !s.nonAws ? ` AWS service: ${s.name}. ${s.plain}` : '') : '',
          stage: `Studying the ${st.tab} tab of the AWS page`,
          worksheet: answered ? `Quiz: ${right} of ${total} correct so far.` : ''
        },
        notes: ''
      },
      suggestions
    };
  }

  /* ---------------- events ---------------- */
  function onPanelClick(e) {
    const tab = e.target.closest('[data-tab]');
    if (tab && tabsEl.contains(tab)) { setTab(tab.dataset.tab); return; }
    // the inspector belongs to DesignGraph, which handles its own hops and Ask AI buttons
    const inInspector = inspectEl.contains(e.target);
    const show = e.target.closest('[data-show]');
    if (show) { e.preventDefault(); focusService(show.dataset.show, show); return; }
    const lesson = e.target.closest('[data-open-lesson]');
    if (lesson) { openLesson(lesson.dataset.openLesson, lesson.dataset.focus); return; }
    const svc = e.target.closest('[data-svc]');
    if (svc) { e.preventDefault(); focusService(svc.dataset.svc, svc); return; }
    if (inInspector) return;
    const flow = e.target.closest('[data-flow]');
    if (flow && typeof DesignGraph !== 'undefined') { DesignGraph.startFlowAt(Number(flow.dataset.flow)); return; }
    const opt = e.target.closest('[data-opt]');
    if (opt) {
      const qi = Number(opt.dataset.q);
      if (st.answers[qi] == null) { st.answers[qi] = Number(opt.dataset.opt); persist(); render(); }
      return;
    }
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'tour' && typeof DesignGraph !== 'undefined') DesignGraph.startFlowAt(0);
      if (a === 'quiz-reset') { st.answers = {}; persist(); scrollPos.quiz = 0; render(); }
      if (a === 'mark-done') { const btn = document.getElementById('btn-done'); if (btn) btn.click(); render(); }
      if (a === 'compare-wide') openCompareWide();
      return;
    }
    const ask = e.target.closest('[data-ask]');
    if (ask && typeof AIChat !== 'undefined') AIChat.ask(ask.dataset.ask);
  }

  function openCompareWide() {
    const modal = document.getElementById('plan-modal');
    if (!current || !current.compare || !modal) return;
    document.getElementById('plan-title').textContent = `${current.compare.title}: ${current.title}`;
    const body = document.getElementById('plan-body');
    body.innerHTML = `<div class="aws-compare-wrap wide">${compareTable(current)}</div>`;
    body.onclick = (e) => {
      const svc = e.target.closest('[data-svc]');
      if (svc) showPop(svc, svc.dataset.svc);
    };
    modal.classList.add('on');
  }

  /** `width` is what the user asked for; the panel shows it clamped so the canvas keeps at least 480px when it can. */
  function applyWidth() {
    const shown = stage && stage.offsetWidth ? stage.offsetWidth : window.innerWidth - 320;
    const max = Math.max(300, Math.min(780, shown - 480, shown * 0.5));
    const w = Math.max(300, Math.min(max, width));
    document.documentElement.style.setProperty('--aws-w', Math.round(w) + 'px');
  }

  function setWidth(w) {
    width = Math.max(300, Math.min(780, w));
    applyWidth();
  }

  function bindResizer() {
    const r = document.getElementById('resize-aws');
    if (!r) return;
    let drag = null;
    r.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      drag = { x: e.clientX, w: pane.getBoundingClientRect().width };
      r.classList.add('dragging');
      document.body.classList.add('resizing');
      try { r.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    r.addEventListener('pointermove', (e) => { if (drag) setWidth(drag.w + (drag.x - e.clientX)); });
    const stop = () => {
      if (!drag) return;
      drag = null;
      r.classList.remove('dragging');
      document.body.classList.remove('resizing');
      save(WIDTH_KEY, width);
    };
    r.addEventListener('pointerup', stop);
    r.addEventListener('pointercancel', stop);
    r.addEventListener('dblclick', () => { setWidth(DEFAULT_W); save(WIDTH_KEY, width); });
  }

  function setCollapsed(on) {
    if (stage) stage.classList.toggle('pane-collapsed', on);
    save(COLLAPSED_KEY, on);
    window.dispatchEvent(new Event('resize'));
  }

  function init() {
    stage = document.getElementById('aws-stage');
    pane = document.getElementById('aws-pane');
    tabsEl = document.getElementById('aws-tabs');
    bodyEl = document.getElementById('aws-body');
    inspectEl = document.getElementById('aws-inspect');
    if (!stage || !pane) return;
    setWidth(width);
    window.addEventListener('resize', () => { if (current) applyWidth(); });
    pane.addEventListener('click', onPanelClick);
    bodyEl.addEventListener('scroll', () => { if (current && !bodyEl.hidden) scrollPos[st.tab] = bodyEl.scrollTop; }, { passive: true });
    bindResizer();
    document.getElementById('aws-collapse').addEventListener('click', () => setCollapsed(true));
    document.getElementById('aws-reopen').addEventListener('click', () => setCollapsed(false));
    if (load(COLLAPSED_KEY, false)) setCollapsed(true);

    const list = document.getElementById('aws-list');
    list.addEventListener('click', (e) => {
      const hit = e.target.closest('[data-svc-hit]');
      if (hit) { const L = lessonFor(hit.dataset.svcHit); if (L) openLesson(L.id, hit.dataset.svcHit); return; }
      const row = e.target.closest('.aws-item');
      if (row) hooks.onOpen(row.dataset.id);
    });
    document.getElementById('aws-search').addEventListener('input', (e) => { search = e.target.value; renderSidebar(); });
    document.getElementById('btn-aws-next').addEventListener('click', () => { const id = nextId(); if (id) hooks.onOpen(id); });
    document.addEventListener('click', (e) => {
      const pop = document.getElementById('aws-pop');
      if (pop && pop.classList.contains('on') && !pop.contains(e.target) && !e.target.closest('[data-svc]')) hidePop();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePop(); });
  }

  init();

  return {
    open,
    close,
    reset,
    renderSidebar,
    serviceCard,
    notifyInspect,
    chatContext,
    focusService,
    bind: (h) => { hooks = Object.assign(hooks, h); },
    get: (id) => BY_ID.get(id) || null,
    all: () => LESSONS.slice(),
    current: () => current,
    nextId,
    isOpen: () => !!current
  };
})();
