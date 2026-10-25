/* ============================================================
   ASK AI — side chat for follow-up questions on the current task.
   Separate from the AI hint agent: its own endpoint (/api/ai-chat),
   its own history per question, and a context provider set by app.js.
   ============================================================ */

const AIChat = (() => {
  const HISTORY_MAX = 40;
  const SEND_MAX = 14;
  const WIDTH_KEY = 'gs.chat.w';
  const OPEN_KEY = 'gs.chat.open';
  const historyKey = (id) => 'gs.chat.' + id;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } };

  const state = {
    key: null,
    messages: [],
    busy: false,
    controller: null,
    error: null,
    provider: null
  };

  let pane, log, input, sendBtn, ctxChip, suggest, resizer;

  /* ---------------- markdown (escape first, then a safe subset) ---------------- */
  function inline(text) {
    return text
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>')
      .replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  }

  function md(src) {
    const lines = esc(src).split('\n');
    const out = [];
    let i = 0;
    let list = null;
    const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    while (i < lines.length) {
      const line = lines[i];
      const fence = /^\s*```(\w*)\s*$/.exec(line);
      if (fence) {
        closeList();
        const body = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { body.push(lines[i]); i++; }
        i++;
        out.push(`<pre class="chat-code">${body.join('\n')}</pre>`);
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        closeList();
        const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
        const head = cells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        out.push(`<table class="chat-table"><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${
          rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
        continue;
      }
      const h = /^\s*(#{1,4})\s+(.*)$/.exec(line);
      if (h) { closeList(); out.push(`<h5>${inline(h[2])}</h5>`); i++; continue; }
      const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
      const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      if (ul || ol) {
        const kind = ul ? 'ul' : 'ol';
        if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; }
        out.push(`<li>${inline((ul || ol)[1])}</li>`);
        i++;
        continue;
      }
      if (!line.trim()) { closeList(); i++; continue; }
      closeList();
      const para = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !/^\s*([-*•]\s|\d+[.)]\s|#{1,4}\s|```|\|)/.test(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      out.push(`<p>${inline(para.join('<br>'))}</p>`);
    }
    closeList();
    return out.join('');
  }

  /* ---------------- context ---------------- */
  function current() {
    if (!state.provider) return null;
    try { return state.provider(); } catch { return null; }
  }

  function syncKey() {
    const ctx = current();
    const key = ctx && ctx.key;
    if (key === state.key) return ctx;
    if (state.busy && state.controller) state.controller.abort();
    state.key = key || null;
    state.messages = key ? load(historyKey(key), []) : [];
    if (!Array.isArray(state.messages)) state.messages = [];
    state.error = null;
    return ctx;
  }

  /* ---------------- render ---------------- */
  function renderChrome(ctx) {
    if (!pane) return;
    if (ctxChip) {
      ctxChip.textContent = ctx ? (ctx.focusLabel ? `${ctx.label} · ${ctx.focusLabel}` : ctx.label) : 'No question open';
      ctxChip.title = 'The AI sees this question' + (ctx && ctx.focusLabel ? ' and what you are focused on' : '') + ', plus your current work.';
    }
    if (suggest) {
      const items = (ctx && ctx.suggestions) || [];
      suggest.innerHTML = items.slice(0, 4).map((s) => `<button class="chat-chip" type="button">${esc(s)}</button>`).join('');
      suggest.style.display = items.length && !state.busy ? '' : 'none';
    }
  }

  function renderLog() {
    if (!log) return;
    const msgs = state.messages;
    if (!msgs.length) {
      const ctx = current();
      log.innerHTML = `<div class="chat-empty">
        <b>Ask anything about ${esc(ctx ? ctx.label : 'this question')}.</b>
        <span>The AI already sees the question, your work so far${ctx && ctx.page === 'design' ? ', and the part of the map you are looking at' : ''}. Try a suggestion below, or type your own follow-up.</span>
      </div>`;
    } else {
      log.innerHTML = msgs.map((m, idx) => {
        if (m.role === 'user') return `<div class="chat-msg user"><div class="chat-bubble">${esc(m.content).replace(/\n/g, '<br>')}</div></div>`;
        const pending = state.busy && idx === msgs.length - 1;
        const body = m.content ? md(m.content) : '<span class="chat-typing"><i></i><i></i><i></i></span>';
        return `<div class="chat-msg ai${pending ? ' pending' : ''}"><div class="chat-bubble">${body}</div>${
          !pending && m.content ? `<div class="chat-msg-actions"><button class="chat-mini" data-copy="${idx}" type="button">Copy</button></div>` : ''}</div>`;
      }).join('');
    }
    if (state.error) {
      log.insertAdjacentHTML('beforeend', `<div class="chat-error"><b>Could not get an answer.</b><span>${esc(state.error)}</span>
        <button class="btn tiny" data-retry type="button">Try again</button></div>`);
    }
    log.scrollTop = log.scrollHeight;
  }

  function render() {
    const ctx = syncKey();
    renderChrome(ctx);
    renderLog();
    if (sendBtn) {
      sendBtn.textContent = state.busy ? 'Stop' : 'Send';
      sendBtn.classList.toggle('primary', !state.busy);
    }
  }

  /* ---------------- send ---------------- */
  function persist() {
    if (!state.key) return;
    const trimmed = state.messages.filter((m) => m.content).slice(-HISTORY_MAX);
    save(historyKey(state.key), trimmed);
  }

  async function send(text) {
    const question = String(text || '').trim();
    if (!question || state.busy) return;
    const ctx = syncKey();
    if (!ctx) { state.error = 'Open a question first.'; render(); return; }

    state.error = null;
    state.messages.push({ role: 'user', content: question });
    const reply = { role: 'assistant', content: '' };
    state.messages.push(reply);
    state.busy = true;
    persist();
    render();

    const key = state.key;
    const controller = new AbortController();
    state.controller = controller;
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const history = state.messages.slice(0, -1).filter((m) => m.content).slice(-SEND_MAX)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: ctx.context || {}, messages: history }),
        signal: controller.signal
      });
      if (!res.ok) {
        let data = {};
        try { data = await res.json(); } catch { /* not json */ }
        throw new Error(data.error || ('Chat failed (' + res.status + ')'));
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let frame = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (state.key !== key) return;
        reply.content += decoder.decode(value, { stream: true });
        if (!frame) frame = requestAnimationFrame(() => { frame = null; renderLog(); });
      }
      reply.content += decoder.decode();
      if (!reply.content.trim()) throw new Error('The model returned an empty answer. Try again.');
    } catch (err) {
      if (state.key !== key) return;
      if (err && err.name === 'AbortError') {
        if (!reply.content) state.messages.pop();
        else reply.content += '\n\n_(stopped)_';
      } else {
        state.messages.pop();
        state.error = err instanceof TypeError
          ? 'Could not reach the AI server. Start it with: python3 server.py'
          : (err && err.message) || 'Chat failed.';
      }
    } finally {
      clearTimeout(timer);
      if (state.key === key) {
        state.busy = false;
        state.controller = null;
        persist();
        render();
      }
    }
  }

  function retry() {
    const lastUser = [...state.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    const idx = state.messages.lastIndexOf(lastUser);
    state.messages.splice(idx, 1);
    send(lastUser.content);
  }

  /* ---------------- open / close ---------------- */
  function isOpen() { return document.body.classList.contains('chat-open'); }

  function setOpen(on) {
    document.body.classList.toggle('chat-open', on);
    if (pane) pane.toggleAttribute('inert', !on);
    save(OPEN_KEY, on);
    const btn = document.getElementById('btn-chat');
    if (btn) btn.classList.toggle('on', on);
    if (on) {
      render();
      setTimeout(() => input && input.focus(), 30);
    }
    window.dispatchEvent(new Event('resize'));
  }

  function toggle() { setOpen(!isOpen()); }

  /** Opens the chat and either sends `text` or places it in the input. */
  function ask(text, opts = {}) {
    setOpen(true);
    if (opts.send === false) {
      input.value = text;
      input.focus();
      autoGrow();
      return;
    }
    send(text);
  }

  function autoGrow() {
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(160, input.scrollHeight) + 'px';
  }

  /* ---------------- resize ---------------- */
  function applyWidth(w) {
    const max = Math.max(300, Math.min(640, window.innerWidth - 520));
    const width = Math.max(300, Math.min(max, w));
    document.documentElement.style.setProperty('--chat-w', Math.round(width) + 'px');
    return width;
  }

  function bindResizer() {
    if (!resizer) return;
    let drag = null;
    resizer.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      drag = { x: e.clientX, w: pane.getBoundingClientRect().width };
      resizer.classList.add('dragging');
      document.body.classList.add('resizing');
      try { resizer.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    resizer.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const w = applyWidth(drag.w + (drag.x - e.clientX));
      save(WIDTH_KEY, w);
      window.dispatchEvent(new Event('resize'));
    });
    const stop = () => {
      if (!drag) return;
      drag = null;
      resizer.classList.remove('dragging');
      document.body.classList.remove('resizing');
    };
    resizer.addEventListener('pointerup', stop);
    resizer.addEventListener('pointercancel', stop);
    resizer.addEventListener('dblclick', () => { applyWidth(380); save(WIDTH_KEY, 380); window.dispatchEvent(new Event('resize')); });
  }

  /* ---------------- init ---------------- */
  function init() {
    pane = document.getElementById('chat-pane');
    if (!pane) return;
    log = document.getElementById('chat-log');
    input = document.getElementById('chat-input');
    sendBtn = document.getElementById('chat-send');
    ctxChip = document.getElementById('chat-ctx');
    suggest = document.getElementById('chat-suggest');
    resizer = document.getElementById('resize-chat');
    applyWidth(Number(load(WIDTH_KEY, 380)) || 380);
    bindResizer();

    document.getElementById('chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (state.busy) { if (state.controller) state.controller.abort(); return; }
      const text = input.value;
      input.value = '';
      autoGrow();
      send(text);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        document.getElementById('chat-form').requestSubmit();
      }
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
    });
    input.addEventListener('input', autoGrow);
    suggest.addEventListener('click', (e) => {
      const chip = e.target.closest('.chat-chip');
      if (chip) send(chip.textContent);
    });
    log.addEventListener('click', (e) => {
      if (e.target.closest('[data-retry]')) { retry(); return; }
      const copy = e.target.closest('[data-copy]');
      if (copy) {
        const msg = state.messages[Number(copy.dataset.copy)];
        if (msg && navigator.clipboard) navigator.clipboard.writeText(msg.content).then(() => { copy.textContent = 'Copied'; });
      }
    });
    document.getElementById('chat-close').addEventListener('click', () => setOpen(false));
    document.getElementById('chat-clear').addEventListener('click', () => {
      if (state.busy && state.controller) state.controller.abort();
      state.messages = [];
      state.error = null;
      persist();
      render();
    });
    const btn = document.getElementById('btn-chat');
    if (btn) btn.addEventListener('click', toggle);
    pane.toggleAttribute('inert', true);
    if (load(OPEN_KEY, false)) setOpen(true);
  }

  return {
    init,
    md,
    ask,
    toggle,
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen,
    forget: (key) => {
      try { localStorage.removeItem(historyKey(key)); } catch { /* ignore */ }
      if (state.key !== key) return;
      if (state.busy && state.controller) state.controller.abort();
      state.messages = [];
      state.error = null;
      if (isOpen()) render();
    },
    refresh: () => {
      const prev = state.key;
      const ctx = syncKey();
      if (!isOpen()) return;
      if (state.key !== prev) render();
      else renderChrome(ctx);
    },
    setContextProvider: (fn) => { state.provider = fn; }
  };
})();
