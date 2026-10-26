/* ============================================================
   DESIGN STUDY PANEL — the docked right-hand panel on the
   System Design page. The user writes their answer here, step by
   step, then asks the AI to evaluate it against the reference.
   ============================================================ */

const DesignStudy = (() => {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } };
  const KEY = (id) => 'gs.study.' + id;
  const EVAL_KEY = (id) => 'gs.design.eval.' + id;
  const MIN_CHARS = 15;
  const TASK_HIDDEN_KEY = 'gs.brief.taskHidden';

  const DESIGN_STAGES = [
    { key: 'req', title: 'Clarify requirements', min: 5,
      goal: 'Say what the system must do, how well, and what you are not building.',
      prompts: ['Who uses it and what are the 2–3 core actions?', 'How big: users, requests per second, data size?', 'Latency, availability, and consistency targets?', 'What is explicitly out of scope?'],
      placeholder: 'Functional:\n- Users can …\n- Users can …\n\nNon-functional:\n- p99 latency < … ms, 99.9x% available\n- Consistency: …\n\nOut of scope:\n- …' },
    { key: 'est', title: 'Estimate scale', min: 5,
      goal: 'Turn the requirements into numbers that drive the design.',
      prompts: ['Reads and writes per second (average and peak)?', 'Storage per day and in total?', 'Which number forces a design decision (sharding, caching)?'],
      placeholder: 'Writes: 100M/day ÷ 86,400 ≈ 1.2k/s (peak ~3.5k/s)\nReads: 100 × writes ≈ 120k/s\nStorage: 100M × 500 B = 50 GB/day → ~180 TB over 10 years\nSo: reads must be cached; one DB primary is enough for writes.',
      tool: true },
    { key: 'hld', title: 'High-level design', min: 10,
      goal: 'Name the boxes and arrows, then walk one request end to end.',
      prompts: ['Write path: how does new data get in, step by step, and where is it stored?', 'Read path: how is data served back, and what absorbs the read load (cache, read replicas, CDN)?', 'Where do the load balancer, queues, and CDN sit, and which calls are synchronous vs queued?'],
      placeholder: 'Components:\n- Client → CDN (static files) / Load balancer → API gateway → services\n- Write queue: …   Cache: …   Read replicas: …\n\nWrite path (e.g. "create"):\n1. Client → load balancer → gateway → … service\n2. … service → write queue / primary DB\n\nRead path (e.g. "view"):\n1. Client → load balancer → gateway → … service\n2. … service → cache → (miss) read replica',
      compare: true },
    { key: 'deep', title: 'Deep dive', min: 15,
      goal: 'Pick the hardest part and go deep: data model, algorithm, consistency.',
      prompts: ['What is the hardest part of this problem, and why?', 'Data model / API for that part?', 'How does it stay correct under concurrency or retries?'],
      placeholder: 'The hard part is … because …\n\nMy approach:\n- …\n\nData model:\n- table/key: …\n\nWhy it is correct under retries/concurrency: …' },
    { key: 'risk', title: 'Failures & trade-offs', min: 5,
      goal: 'Say what breaks, how you would notice, and what you chose not to do.',
      prompts: ['If each key component fails, what do users see?', 'How do you detect it (which metric or alert)?', 'Which trade-offs did you make, and when would you choose differently?'],
      placeholder: 'If the cache dies → every read hits the DB → p99 spikes. Detect: hit-ratio alert. Mitigate: …\n\nTrade-off: I chose … over … because …; I would switch if …',
      failures: true },
    { key: 'wrap', title: 'Summarize', min: 3,
      goal: 'The 30-second version you would say at the end of the interview.',
      prompts: ['One sentence on the architecture.', 'The one decision you are most confident in, and the biggest risk.'],
      placeholder: 'In 30 seconds: …' }
  ];

  const BEHAVIORAL_STAGES = [
    { key: 'plan', title: 'Pick your story', min: 2,
      goal: 'Choose one real situation that fits the question. Real details beat polish.',
      prompts: ['Which real situation fits best?', 'What does the interviewer want to learn from this question?'],
      placeholder: 'Story: …\nWhy it fits: …' },
    { key: 'st', title: 'Situation & Task', min: 2,
      goal: 'One or two sentences of context with numbers, then what YOU owned.',
      prompts: ['What was at stake (users, money, time)?', 'What exactly was your responsibility?'],
      placeholder: 'Situation: At …, … (numbers)\nTask: I was responsible for …' },
    { key: 'action', title: 'Action', min: 3,
      goal: 'What you did, in order, and why. Say "I", not "we".',
      prompts: ['What did you do first, and why?', 'What decision did you make under uncertainty?', 'How did you communicate?'],
      placeholder: '1. I …\n2. I …\n3. I …' },
    { key: 'result', title: 'Result', min: 2,
      goal: 'Quantify the outcome and name the lasting fix.',
      prompts: ['What changed, in numbers?', 'What did you put in place so it does not happen again?'],
      placeholder: 'Result: … (numbers)\nLasting fix: …' },
    { key: 'reflect', title: 'Reflection & follow-ups', min: 2,
      goal: 'What you would do differently. Candour scores higher than a spotless story.',
      prompts: ['What would you do differently?', 'What follow-up questions do you expect?'],
      placeholder: 'Differently: …\nLikely follow-ups: …' }
  ];

  const DESIGN_RUBRIC = ['Requirements', 'Estimation', 'High-level design', 'Deep dive', 'Failures and trade-offs', 'Communication'];
  const BEHAVIORAL_RUBRIC = ['Structure (STAR)', 'Ownership', 'Specificity and numbers', 'Judgment and trade-offs', 'Reflection', 'Communication'];

  let item = null;
  let graph = null;
  let st = null;
  let evalState = { loading: false, error: null, record: null };
  let timer = { left: 45 * 60, running: false, handle: null };
  let pane, body, tabsEl, briefEl, inspectEl, termsEl;

  const isBehavioral = (q) => !!(q && q.noFramework);
  const stages = () => (isBehavioral(item) ? BEHAVIORAL_STAGES : DESIGN_STAGES);
  const written = (key) => ((st.answers[key] || '').replace(/\s/g, '').length >= MIN_CHARS);

  function stageForHint(text) {
    const t = text.toLowerCase();
    if (isBehavioral(item)) {
      if (/^situation|^task/.test(t)) return 'st';
      if (/^action/.test(t)) return 'action';
      if (/^result/.test(t)) return 'result';
      if (/follow-up|differently|second story/.test(t)) return 'reflect';
      return 'plan';
    }
    if (/requirement|clarif|non-goal|^start with/.test(t)) return 'req';
    if (/arithmetic|envelope|\bqps\b|per day|\/day|storage|bytes|62\^/.test(t)) return 'est';
    if (/high level|pipeline|decompose|draw it|model it as|^core structure/.test(t)) return 'hld';
    if (/fail|outage|\bdown\b|rollout|degrade|circuit|dlq|poison|trade-off|testing answer/.test(t)) return 'risk';
    return 'deep';
  }

  function hintsByStage() {
    const map = {};
    (item.hints || []).forEach((h) => { const k = stageForHint(h); (map[k] = map[k] || []).push(h); });
    return map;
  }

  function persist() { if (item) save(KEY(item.id), st); }

  /* ---------------- text exports ---------------- */
  function worksheetText() {
    if (!item || !st) return '';
    return stages().map((s, i) => {
      const a = (st.answers[s.key] || '').trim();
      return `Step ${i + 1}. ${s.title}:\n${a || '(not written yet)'}`;
    }).join('\n\n');
  }

  function mapSummary() {
    if (!graph) return '';
    const nodes = graph.nodes.map((n) => `- ${n.label} (${n.sub}; ${n.layer}): ${n.detail}`).join('\n');
    const flows = graph.flow.map((f, i) => `${i + 1}. ${f.title}: ${f.detail}`).join('\n');
    const fails = (graph.failures || []).map((f) => `- ${f.label}: ${f.detail} Mitigation: ${f.mitigation}`).join('\n');
    return `${graph.title}: ${graph.subtitle}\nComponents:\n${nodes}\nRequest paths:\n${flows}\nFailures:\n${fails}\nWhy it works:\n- ${graph.why.join('\n- ')}\nTrade-offs:\n- ${graph.tradeoffs.join('\n- ')}`;
  }

  function referenceText() {
    const parts = [];
    if (graph) parts.push(mapSummary());
    if ((item.hints || []).length) parts.push('Expert insights:\n- ' + item.hints.join('\n- '));
    if ((item.topics || []).length) parts.push('Good answers cover: ' + item.topics.join(', '));
    return parts.join('\n\n');
  }

  /* ---------------- brief + steps ---------------- */
  function briefHTML() {
    const b = (typeof DESIGN_BRIEFS !== 'undefined' && DESIGN_BRIEFS[item.id]) || DESIGN_BRIEF_FALLBACK;
    return `<section class="ask-card">
      <div class="ask-kicker">WHAT YOU ARE BEING ASKED${item.difficulty ? `<span class="diff-tag diff-${item.difficulty}">${{ easy: 'Easy', medium: 'Medium', hard: 'Hard' }[item.difficulty]}</span>` : ''}</div>
      <p class="ask-main">${esc(b.ask)}</p>
      ${b.examples.length ? `<div class="ask-h">For example, the system must handle:</div>
        <ul class="ask-examples">${b.examples.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
      <div class="ask-h">By the end you should have produced:</div>
      <ul class="ask-deliver">${b.deliver.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
      <details class="full-prompt"><summary>Full interview prompt</summary><div class="body-text">${typeof formatBody === 'function' ? formatBody(item.prompt) : esc(item.prompt)}</div></details>
      <div class="ask-actions">
        <button class="btn tiny ask-ai-btn" data-ask="${esc(`Before I start designing ${item.title}: explain what this question is really testing, give me one more concrete example of the system in use, and tell me what clarifying questions I should ask the interviewer.`)}" type="button">✦ Explain this task</button>
      </div>
    </section>`;
  }

  function stageHTML(s, i, hints) {
    const open = st.open === s.key;
    const done = written(s.key);
    const revealed = st.revealed[s.key] || 0;
    const tips = hints[s.key] || [];
    const g = graph;
    let extra = '';
    if (s.tool) extra += '<details class="inline-calc" data-calc><summary>Open the estimate calculator</summary><div id="inline-calc"></div></details>';
    if (s.compare && g) {
      extra += '<button class="btn tiny" data-act="verify" type="button">Done? Verify against the map →</button>';
    }
    return `<section class="stage${open ? ' open' : ''}${done ? ' done' : ''}" data-stage="${s.key}">
      <button class="stage-head" data-act="toggle" type="button">
        <span class="stage-num">${done ? '✓' : i + 1}</span>
        <span class="stage-title">${esc(s.title)}</span>
        <span class="stage-min">${s.min} min</span>
      </button>
      ${open ? `<div class="stage-body">
        <p class="stage-goal">${esc(s.goal)}</p>
        <ul class="stage-prompts">${s.prompts.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        <label class="stage-label" for="ans-${s.key}">Your answer</label>
        <textarea class="stage-answer" id="ans-${s.key}" data-answer="${s.key}" spellcheck="true" placeholder="${esc(s.placeholder)}">${esc(st.answers[s.key] || '')}</textarea>
        ${extra}
        ${tips.length ? `<div class="stage-tips">
          ${tips.slice(0, revealed).map((t) => `<div class="tip">${ConceptLib.linkTerms(esc(t))}</div>`).join('')}
          ${revealed < tips.length ? `<button class="linklike" data-act="reveal" type="button">Stuck? Reveal an expert insight (${revealed + 1} of ${tips.length})</button>` : ''}
        </div>` : ''}
        <div class="stage-foot">
          <button class="btn tiny ask-ai-btn" data-ask="${esc(`Give me feedback on just my "${s.title}" step for ${item.title}. What is good, what is missing, and one question the interviewer would push on?`)}" type="button">✦ Feedback on this step</button>
          <div class="spacer"></div>
          ${i < stages().length - 1 ? '<button class="btn tiny primary" data-act="next" type="button">Next step →</button>'
            : '<button class="btn tiny primary" data-act="to-eval" type="button">Evaluate my design →</button>'}
        </div>
      </div>` : ''}
    </section>`;
  }

  function evalHTML() {
    const count = stages().filter((s) => written(s.key)).length;
    const total = stages().length;
    const rec = evalState.record;
    const stale = rec && rec.answer !== worksheetText();
    let out = `<section class="eval-card" id="eval-card">
      <div class="eval-head"><b>AI evaluation</b><span>${count}/${total} steps written</span></div>`;
    if (evalState.loading) {
      out += '<div class="ai-loading"><span class="spinner"></span><span>Grading your design against the reference…</span></div>';
    } else {
      out += `<p class="eval-copy">When you have written your design, the AI grades it like a senior interviewer: a score per area, what is strong, what is missing, and the follow-ups to expect.</p>
        <button class="btn primary eval-btn" data-act="evaluate" type="button" ${count < 2 ? 'disabled title="Write at least two steps first"' : ''}>${rec ? 'Re-evaluate my design' : 'Evaluate my design'}</button>
        ${count < 2 ? '<div class="ai-note">Write at least two steps first.</div>' : ''}`;
    }
    if (evalState.error) out += `<div class="ai-error"><b>Could not evaluate.</b><div>${esc(evalState.error)}</div></div>`;
    if (rec && !evalState.loading) {
      const e = rec.evaluation;
      out += `${stale ? '<div class="tag tag-stale">your design changed since this evaluation</div>' : ''}
        <div class="eval-score">
          <div class="score-ring s${e.score}"><b>${e.score}</b><span>/5</span></div>
          <div><div class="score-level">${esc(e.level ? e.level.replace(/^./, (c) => c.toUpperCase()) + ' level' : '')}</div><p>${esc(e.summary)}</p></div>
        </div>
        <div class="rubric">${e.rubric.map((r) => `<div class="rubric-row">
          <span class="rubric-area">${esc(r.area)}</span>
          <span class="rubric-bar"><i style="width:${r.score * 20}%" class="s${r.score}"></i></span>
          <span class="rubric-n">${r.score}</span>
          <p>${esc(r.note)}</p></div>`).join('')}</div>
        ${e.strengths.length ? `<div class="eval-h good">Strong</div><ul class="eval-list">${e.strengths.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
        ${e.gaps.length ? `<div class="eval-h bad">Missing or wrong</div><ul class="eval-list">${e.gaps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
        ${e.missing_components.length ? `<div class="eval-h">Not mentioned</div><div class="stage-chips">${e.missing_components.map((m) => `<span class="arch-tag warn">${esc(m)}</span>`).join('')}
          ${graph ? '<button class="linklike" data-act="spot-missing" type="button">Show these on the map</button>' : ''}</div>` : ''}
        ${e.next_step ? `<div class="eval-next"><b>Do this next:</b> ${esc(e.next_step)}</div>` : ''}
        ${e.follow_ups.length ? `<div class="eval-h">Follow-ups the interviewer will ask</div>
          <div class="followups">${e.follow_ups.map((f) => `<button class="followup" data-follow="${esc(f)}" type="button"><span>${esc(f)}</span><i>Answer →</i></button>`).join('')}</div>` : ''}
        <div class="ask-row"><button class="btn tiny ask-ai-btn" data-ask="${esc(`About the evaluation of my ${item.title} design: which single change would raise my score the most, and show me what a stronger version of that part would say.`)}" type="button">✦ Ask a follow-up about this evaluation</button></div>`;
    }
    return out + '</section>';
  }


  function stepsHTML(taskHidden) {
    const hints = hintsByStage();
    const done = stages().filter((s) => written(s.key)).length;
    const oldNotes = (load('gs.notes', {}) || {})[item.id];
    return `<div class="steps-head">
        ${taskHidden ? '<button class="btn tiny" data-act="show-task" title="Show the task again" type="button">▸ Show task</button>' : ''}
        <b>Your design</b><span>Saves automatically.</span>
        <span class="steps-timer"><button class="study-timer" id="study-timer" data-act="timer" type="button">▶ 45:00</button><button class="chat-mini" data-act="timer-reset" title="Reset timer" type="button">↺</button></span>
        <div class="steps-bar"><i style="width:${Math.round(done / stages().length * 100)}%"></i></div>
      </div>
      ${stages().map((s, i) => stageHTML(s, i, hints)).join('')}
      ${evalHTML()}
      ${graph ? `<div class="verify-cta">
        <div><b>Next: verify on the map</b><span>Compare your answer with the reference architecture, walk through each user action, and check what each component protects against.</span></div>
        <button class="btn primary" data-act="verify" type="button">Open the map →</button>
      </div>` : ''}
      ${oldNotes ? `<details class="old-notes"><summary>Your earlier notes for this question</summary><pre>${esc(oldNotes)}</pre></details>` : ''}`;
  }

  /** Brief view: the task on the left, the candidate's answer on the right. No canvas. */
  function briefViewHTML() {
    const taskHidden = !!load(TASK_HIDDEN_KEY, false);
    if (taskHidden) {
      return `<div class="brief-grid task-hidden"><div class="brief-col right">${stepsHTML(true)}</div></div>`;
    }
    return `<div class="brief-grid">
      <div class="brief-col left">
        <div class="brief-col-head"><b>Task</b><button class="btn tiny ghost" data-act="hide-task" title="Hide the task to give your design more room" type="button">Hide ◂</button></div>
        ${briefHTML()}
        ${isBehavioral(item) ? '' : `<details class="brief-numbers"><summary>Numbers cheat sheet</summary>${DesignPractice.numbersHTML()}</details>`}
      </div>
      <div class="brief-col right">${stepsHTML()}</div>
    </div>`;
  }

  /** Map view side panel, "Your answer" tab: read-only answer next to the canvas. */
  function answerTabHTML() {
    const rec = evalState.record;
    const rows = stages().map((s, i) => {
      const a = (st.answers[s.key] || '').trim();
      return `<div class="answer-row${a ? '' : ' empty'}"><div class="answer-h"><span>${i + 1}</span>${esc(s.title)}</div>
        ${a ? `<pre>${esc(a)}</pre>` : '<em>Not written yet.</em>'}</div>`;
    }).join('');
    return `<div class="study-intro">Your answer from the Brief, side by side with the reference map. Compare what you wrote with what is on the canvas.</div>
      <div class="ask-row" style="margin:0 0 12px">
        <button class="btn tiny primary" data-act="compare" type="button">Check my components against the map</button>
        <button class="btn tiny" data-act="edit" type="button">← Edit in Brief</button>
      </div>
      <div class="compare-out" id="compare-out"></div>
      ${rec ? `<div class="answer-score"><div class="score-ring s${rec.evaluation.score}"><b>${rec.evaluation.score}</b><span>/5</span></div>
        <p>${esc(rec.evaluation.summary)}</p></div>` : ''}
      ${rows}`;
  }

  /* ---------------- render ---------------- */
  const TABS = [['inspect', 'Inspect'], ['answer', 'Your answer'], ['learn', 'Learn'], ['practice', 'Practice']];

  function applyView() {
    const stage = document.getElementById('design-stage');
    if (stage) {
      stage.classList.toggle('view-brief', st.view === 'brief');
      stage.classList.toggle('view-map', st.view === 'map');
    }
    document.body.classList.toggle('map-wide', st.view === 'map');
    if (st.view !== 'map') document.body.classList.remove('sidebar-peek');
    document.querySelectorAll('#design-views [data-view]').forEach((b) => {
      const on = b.dataset.view === st.view;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      if (b.dataset.view === 'map') {
        b.disabled = !graph;
        b.title = graph ? 'Verify your design on the interactive canvas' : 'This question has no architecture map';
      }
    });
  }

  function render() {
    if (!item || !pane) return;
    applyView();
    if (st.view === 'brief') {
      const top = briefEl.scrollTop;
      briefEl.innerHTML = briefViewHTML();
      body.innerHTML = '';
      sizeAnswers();
      briefEl.scrollTop = top;
    } else {
      briefEl.innerHTML = '';
      tabsEl.innerHTML = TABS.map(([k, l]) => `<button class="study-tab${st.tab === k ? ' on' : ''}" data-tab="${k}" type="button">${l}</button>`).join('');
      renderTerms();
      const inspecting = st.tab === 'inspect';
      if (inspectEl) inspectEl.hidden = !inspecting;
      body.hidden = inspecting;
      if (!inspecting) {
        const top = body.scrollTop;
        if (st.tab === 'learn') DesignPractice.renderLearn(body, item, graph);
        else if (st.tab === 'practice') DesignPractice.renderPractice(body, item, graph);
        else { body.onclick = null; body.innerHTML = answerTabHTML(); }
        body.scrollTop = top;
      }
    }
    renderTimer();
  }

  /** Every technical term on this map, in one plain sentence each. Collapsed until opened. */
  function renderTerms() {
    if (!termsEl || !graph) { if (termsEl) termsEl.hidden = true; return; }
    const { components, patterns } = DesignPractice.conceptsFor(item, graph);
    const rows = [
      ...components.map(({ c, nodes }) => ({ c, ids: nodes.map((n) => n.id) })),
      ...patterns.map((c) => ({ c, ids: [] }))
    ].filter(({ c }) => c.id !== 'client' && c.id !== 'service');
    termsEl.hidden = !rows.length;
    const wasOpen = termsEl.open || !!load('gs.terms.open', false);
    termsEl.innerHTML = `<summary><span>Plain-English terms</span><i>${rows.length}</i></summary>
      <dl class="terms-list">${rows.map(({ c, ids }) => `<div class="term-row${ids.length ? ' has-nodes' : ''}"${ids.length ? ` data-term-nodes="${esc(ids.join(','))}" title="Show on the map"` : ''}>
        <dt>${esc(c.name)}</dt><dd>${esc(c.plain || c.what)}</dd></div>`).join('')}</dl>`;
    termsEl.open = wasOpen;
  }

  function sizeAnswers() {
    briefEl.querySelectorAll('.stage-answer').forEach((t) => { t.style.height = 'auto'; t.style.height = Math.max(200, t.scrollHeight + 2) + 'px'; });
  }

  function setTab(tab) {
    st.tab = tab;
    persist();
    body.scrollTop = 0;
    render();
  }

  function setView(view) {
    if (!st) return;
    const next = view === 'map' && graph ? 'map' : 'brief';
    if (next === st.view) return;
    st.view = next;
    if (next === 'map') st.mapSeen = true;
    persist();
    if (next === 'brief' && typeof DesignGraph !== 'undefined') DesignGraph.setExpanded(false);
    render();
    window.dispatchEvent(new Event('resize'));
    if (typeof DesignGraph !== 'undefined') {
      DesignGraph.clearFocus();
      if (next === 'map') DesignGraph.relayout();
    }
    if (typeof AIChat !== 'undefined') AIChat.refresh();
  }

  function showMap() { setView('map'); }

  function showInspect() {
    if (st && st.view === 'map' && st.tab !== 'inspect') setTab('inspect');
  }

  /** The canvas selected something: flag the Inspect tab instead of switching to it. */
  function notifyInspect() {
    if (!st || st.view !== 'map' || st.tab === 'inspect') return;
    const tab = tabsEl.querySelector('[data-tab="inspect"]');
    if (tab) tab.classList.add('has-new');
  }

  function focusAnswer() {
    setTimeout(() => { const t = briefEl.querySelector('.stage.open .stage-answer'); if (t) t.focus(); }, 30);
  }

  /* ---------------- compare (keyword coverage) ---------------- */
  const GENERIC = new Set(['service', 'services', 'store', 'layer', 'system', 'the', 'and', 'per', 'with', 'data', 'api', 'app', 'client', 'user']);
  function compare() {
    const out = body.querySelector('#compare-out');
    if (!out || !graph) return;
    const text = Object.values(st.answers).join(' ').toLowerCase();
    const nodes = graph.nodes.filter((n) => !['Client', 'Consumers'].includes(n.layer));
    const hit = [], miss = [];
    nodes.forEach((n) => {
      const words = `${n.label} ${n.sub}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !GENERIC.has(w));
      (words.some((w) => text.includes(w)) ? hit : miss).push(n);
    });
    out.innerHTML = `<div class="compare-sum">You mentioned <b>${hit.length} of ${nodes.length}</b> reference components <span>(rough keyword match)</span></div>
      <div class="stage-chips">${hit.map((n) => `<span class="arch-tag ok">✓ ${esc(n.label)}</span>`).join('')}${miss.map((n) => `<span class="arch-tag warn">${esc(n.label)}</span>`).join('')}</div>
      ${miss.length ? `<button class="linklike" data-spot="${esc(miss.map((n) => n.id).join(','))}" type="button">Show the ${miss.length} I missed on the map</button>` : ''}`;
  }

  /* ---------------- evaluation ---------------- */
  async function evaluate() {
    if (!item || evalState.loading) return;
    const answer = worksheetText();
    evalState.loading = true;
    evalState.error = null;
    render();
    const card = briefEl.querySelector('#eval-card');
    if (card) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
    const target = item;
    try {
      const res = await fetch('/api/ai-design-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: {
          question: { title: item.title, kind: isBehavioral(item) ? 'behavioral' : 'system design', seniority: item.seniority || 'N/A', prompt: item.prompt },
          reference: referenceText(),
          answer,
          rubric: isBehavioral(item) ? BEHAVIORAL_RUBRIC : DESIGN_RUBRIC
        } })
      });
      let data = {};
      try { data = await res.json(); } catch { /* non-json */ }
      if (!res.ok) throw new Error(data.error || ('Evaluation failed (' + res.status + ')'));
      if (target !== item) return;
      evalState.record = { evaluation: data.evaluation, answer, at: data.at, model: data.model };
      save(EVAL_KEY(item.id), evalState.record);
    } catch (err) {
      if (target !== item) return;
      evalState.error = err instanceof TypeError ? 'Could not reach the AI server. Start it with: python3 server.py' : (err.message || 'Evaluation failed.');
    } finally {
      if (target === item) {
        evalState.loading = false;
        render();
        const c = briefEl.querySelector('#eval-card');
        if (c) c.scrollIntoView({ block: 'start' });
      }
    }
  }

  function spotMissing() {
    const e = evalState.record && evalState.record.evaluation;
    if (!e || !graph) return;
    const names = e.missing_components.map((m) => m.toLowerCase());
    const ids = graph.nodes.filter((n) => names.some((m) => m.includes(n.label.toLowerCase()) || n.label.toLowerCase().includes(m))).map((n) => n.id);
    showMap();
    if (ids.length) DesignGraph.spotlight(ids);
  }

  /* ---------------- timer ---------------- */
  function renderTimer() {
    const el = document.getElementById('study-timer');
    if (!el) return;
    const m = Math.floor(Math.max(0, timer.left) / 60), s = Math.max(0, timer.left) % 60;
    el.textContent = `${timer.running ? '❚❚' : '▶'} ${m}:${String(s).padStart(2, '0')}`;
    el.classList.toggle('low', timer.left <= 300);
    el.classList.toggle('running', timer.running);
    el.title = timer.running ? 'Pause the 45-minute mock interview timer' : 'Start a 45-minute mock interview timer (the step budgets add up to 45 min)';
  }
  function toggleTimer() {
    timer.running = !timer.running;
    clearInterval(timer.handle);
    if (timer.running) {
      timer.handle = setInterval(() => {
        timer.left -= 1;
        if (timer.left <= 0) { timer.running = false; clearInterval(timer.handle); if (typeof toast === 'function') toast('Time is up. Evaluate your design.'); }
        renderTimer();
      }, 1000);
    }
    renderTimer();
  }
  function resetTimer() { clearInterval(timer.handle); timer = { left: 45 * 60, running: false, handle: null }; renderTimer(); }

  /* ---------------- concept popover ---------------- */
  function showConcept(btn) {
    const c = ConceptLib.get(btn.dataset.concept);
    if (!c) return;
    let pop = document.getElementById('concept-pop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'concept-pop';
      pop.className = 'concept-pop';
      document.body.appendChild(pop);
      pop.addEventListener('click', (e) => {
        const a = e.target.closest('[data-ask]');
        if (a) { pop.classList.remove('on'); AIChat.ask(a.dataset.ask); }
        if (e.target.closest('[data-close]')) pop.classList.remove('on');
      });
    }
    pop.innerHTML = `<div class="concept-pop-h"><b>${esc(c.name)}</b><button class="chat-mini" data-close type="button">✕</button></div>
      <p>${esc(c.what)}</p><p class="dim"><b>Why:</b> ${esc(c.why)}</p>
      ${(c.tradeoffs || []).length ? `<p class="dim"><b>Trade-off:</b> ${esc(c.tradeoffs[0])}</p>` : ''}
      ${(c.usedBy || []).length ? `<div class="used-by">${c.usedBy.map((u) => `<i>${esc(u)}</i>`).join('')}</div>` : ''}
      <button class="btn tiny ask-ai-btn" data-ask="${esc(`Explain ${c.name}${item ? ' in the context of ' + item.title : ''} with a concrete example.`)}" type="button">✦ Explain with an example</button>`;
    const r = btn.getBoundingClientRect();
    pop.classList.add('on');
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
    pop.style.top = (r.bottom + h + 12 > window.innerHeight ? Math.max(8, r.top - h - 8) : r.bottom + 6) + 'px';
  }


  /* ---------------- events ---------------- */
  function onClick(e) {
    const act = e.target.closest('[data-act]');
    const stageEl = e.target.closest('[data-stage]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'toggle' && stageEl) { st.open = st.open === stageEl.dataset.stage ? null : stageEl.dataset.stage; persist(); render(); if (st.open) focusAnswer(); }
      if (a === 'next' && stageEl) {
        const list = stages();
        const i = list.findIndex((s) => s.key === stageEl.dataset.stage);
        st.open = list[i + 1] ? list[i + 1].key : null;
        persist();
        render();
        const next = briefEl.querySelector('.stage.open');
        if (next) next.scrollIntoView({ block: 'start', behavior: 'smooth' });
        focusAnswer();
      }
      if (a === 'to-eval') { st.open = null; persist(); render(); evaluate(); }
      if (a === 'reveal' && stageEl) { st.revealed[stageEl.dataset.stage] = (st.revealed[stageEl.dataset.stage] || 0) + 1; persist(); render(); }
      if (a === 'hide-task' || a === 'show-task') { save(TASK_HIDDEN_KEY, a === 'hide-task'); render(); }
      if (a === 'compare') compare();
      if (a === 'timer') toggleTimer();
      if (a === 'timer-reset') resetTimer();
      if (a === 'evaluate') evaluate();
      if (a === 'spot-missing') spotMissing();
      if (a === 'verify') { st.tab = 'answer'; setView('map'); }
      if (a === 'edit') setView('brief');
      return;
    }
    const spot = e.target.closest('[data-spot]');
    if (spot) { showMap(); DesignGraph.spotlight(spot.dataset.spot.split(',')); return; }
    const follow = e.target.closest('[data-follow]');
    if (follow) { AIChat.ask(`Interviewer follow-up on my ${item.title} design: "${follow.dataset.follow}"\nMy answer: `, { send: false }); return; }
    const ask = e.target.closest('[data-ask]');
    if (ask) AIChat.ask(ask.dataset.ask);
  }

  function onToggle(e) {
    const calc = e.target.closest && e.target.closest('[data-calc]');
    if (calc && calc.open) {
      const mount = calc.querySelector('#inline-calc');
      if (mount && !mount.childElementCount) DesignPractice.renderToolkit(mount, item, { calcOnly: true });
    }
  }

  function onInput(e) {
    const t = e.target.closest('[data-answer]');
    if (!t || !st) return;
    st.answers[t.dataset.answer] = t.value;
    persist();
    t.style.height = 'auto';
    t.style.height = Math.max(200, t.scrollHeight + 2) + 'px';
    const sec = t.closest('.stage');
    const done = written(t.dataset.answer);
    if (sec && sec.classList.contains('done') !== done) {
      sec.classList.toggle('done', done);
      const num = sec.querySelector('.stage-num');
      if (num) num.textContent = done ? '✓' : String(stages().findIndex((s) => s.key === t.dataset.answer) + 1);
      const count = stages().filter((s) => written(s.key)).length;
      const bar = briefEl.querySelector('.steps-bar i');
      if (bar) bar.style.width = Math.round(count / stages().length * 100) + '%';
      const head = briefEl.querySelector('.eval-head span');
      if (head) head.textContent = `${count}/${stages().length} steps written`;
      const btn = briefEl.querySelector('.eval-btn');
      if (btn) btn.disabled = count < 2;
    }
  }

  function init() {
    pane = document.getElementById('study-pane');
    briefEl = document.getElementById('brief-view');
    if (!pane || !briefEl) return;
    body = document.getElementById('study-body');
    tabsEl = document.getElementById('study-tabs');
    inspectEl = document.getElementById('study-inspect');
    termsEl = document.getElementById('study-terms');
    if (termsEl) {
      termsEl.addEventListener('toggle', () => save('gs.terms.open', termsEl.open));
      termsEl.addEventListener('click', (e) => {
        const t = e.target.closest('[data-term-nodes]');
        if (t && t.dataset.termNodes) DesignGraph.spotlight(t.dataset.termNodes.split(','));
      });
    }
    const side = document.querySelector('#arch-modal .arch-side');
    if (side && inspectEl) inspectEl.appendChild(side);
    tabsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
    body.addEventListener('click', (e) => { if (st && st.tab === 'answer') onClick(e); });
    briefEl.addEventListener('click', (e) => { if (st) onClick(e); });
    briefEl.addEventListener('input', onInput);
    briefEl.addEventListener('toggle', onToggle, true);
    document.getElementById('design-views').addEventListener('click', (e) => {
      const b = e.target.closest('[data-view]');
      if (b && !b.disabled) setView(b.dataset.view);
    });
    document.getElementById('study-collapse').addEventListener('click', () => setCollapsed(true));
    document.getElementById('study-reopen').addEventListener('click', () => setCollapsed(false));
    document.addEventListener('click', (e) => {
      const term = e.target.closest('.term[data-concept]');
      if (term) { e.preventDefault(); showConcept(term); return; }
      const pop = document.getElementById('concept-pop');
      if (pop && pop.classList.contains('on') && !pop.contains(e.target)) pop.classList.remove('on');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { const pop = document.getElementById('concept-pop'); if (pop) pop.classList.remove('on'); }
    });
    if (load('gs.study.collapsed', false)) setCollapsed(true);
  }

  function setCollapsed(on) {
    const stage = document.getElementById('design-stage');
    if (stage) stage.classList.toggle('study-collapsed', on);
    save('gs.study.collapsed', on);
    window.dispatchEvent(new Event('resize'));
  }

  function open(q) {
    item = q;
    graph = typeof DESIGN_GRAPHS !== 'undefined' ? DESIGN_GRAPHS[q.id] || null : null;
    const saved = load(KEY(q.id), null);
    st = Object.assign({ view: 'brief', tab: 'inspect', open: stages()[0].key, answers: {}, revealed: {}, mapSeen: false }, saved || {});
    if (!TABS.some(([k]) => k === st.tab)) st.tab = 'inspect';
    st.view = 'brief';
    evalState = { loading: false, error: null, record: load(EVAL_KEY(q.id), null) };
    resetTimer();
    render();
  }

  function close() {
    clearInterval(timer.handle);
    timer.running = false;
    const stage = document.getElementById('design-stage');
    if (stage) stage.classList.remove('view-brief', 'view-map');
    document.body.classList.remove('map-wide', 'sidebar-peek');
    item = null;
  }

  function appendToStage(key, text) {
    if (!st) return;
    st.answers[key] = ((st.answers[key] || '').trim() + '\n' + text).trim();
    st.open = key;
    persist();
    if (st.view !== 'brief') setView('brief'); else render();
    if (typeof toast === 'function') toast('Added to your Estimate step');
  }

  function chatContext() {
    if (!item || !st) return null;
    const open = stages().find((s) => s.key === st.open);
    const canSeeMap = st.view === 'map' || st.mapSeen;
    return {
      map: canSeeMap ? mapSummary() : (graph ? '(The candidate is testing themselves in the Brief and has not opened the reference map yet. Do not list its components unless they ask.)' : ''),
      stage: st.view === 'map' ? 'Verifying on the map' : (open ? open.title : ''),
      worksheet: worksheetText()
    };
  }

  init();

  return {
    open,
    close,
    showMap,
    showInspect,
    notifyInspect,
    setView,
    view: () => (st ? st.view : 'brief'),
    appendToStage,
    chatContext,
    toggleTimer,
    focusAnswer: () => { if (st) { if (!st.open) st.open = stages()[0].key; persist(); setView('brief'); render(); focusAnswer(); } },
    isMapShown: () => !!(st && st.view === 'map'),
    linkTerms: (html) => ConceptLib.linkTerms(html)
  };
})();
