/* ============================================================
   SYSTEM DESIGN — interactive architecture map renderer
   ============================================================ */

// Maps are registered by design-catalog*.js
const DESIGN_GRAPHS = {};

/* ============================================================
   Renderer — layered SVG, pan/zoom, node inspector, request
   trace, and per-component risk notes. No external dependencies.
   ============================================================ */

const DesignGraph = (() => {
  const COLORS = {
    Client: '#7ab8ff', Edge: '#b89cff', Gateway: '#e39bf0', Service: '#2dd4bf', Async: '#f2c75e',
    Data: '#f5a65b', Obs: '#9aa8bd', Feed: '#7ab8ff', Ingest: '#d99bff',
    Consumers: '#7ab8ff', Provider: '#d99bff', Event: '#2dd4bf',
    Compute: '#2dd4bf', Workers: '#2dd4bf', Tools: '#2dd4bf', Events: '#f2c75e', Queues: '#f2c75e',
    AI: '#ff7aa8', Security: '#9ee35d', Analytics: '#d99bff', Storage: '#f5a65b', Network: '#b89cff', Deploy: '#a9b6cb'
  };
  const NH = 62, TOP = 96, LEFT = 40;

  const state = {
    id: null, g: null, selected: null, selectedEdge: null,
    tab: 'inspect', view: { x: 0, y: 0, w: 1, h: 1 }, target: { x: 0, y: 0, w: 1, h: 1 }, W: 1, H: 1,
    flow: -1, timer: null, panning: false, last: null, inline: false,
    raf: null, smooth: 80,
    layout: (() => { try { return JSON.parse(localStorage.getItem('gs.arch.layout')) === 'paths' ? 'paths' : 'layers'; } catch (e) { return 'layers'; } })(),
    route: (() => { try { return JSON.parse(localStorage.getItem('gs.arch.route')) === 'ortho' ? 'ortho' : 'curved'; } catch (e) { return 'curved'; } })(),
    // 'auto' follows the device: top → down when the screen is portrait and phone/tablet sized
    dir: (() => { try { const v = JSON.parse(localStorage.getItem('gs.arch.dir')); return v === 'lr' || v === 'td' ? v : 'auto'; } catch (e) { return 'auto'; } })(),
    legend: (() => { try { const v = JSON.parse(localStorage.getItem('gs.arch.legend')); return v === 'on' || v === 'off' ? v : null; } catch (e) { return null; } })(),
    flowDir: 'lr', perRow: 2, box: null, fitted: true,
    pointers: new Map(), pinch: null, moved: false
  };
  const PORTRAIT = typeof window.matchMedia === 'function' ? window.matchMedia('(orientation: portrait)') : null;
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ } };

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const cut = (value, n) => {
    const text = String(value == null ? '' : value);
    return text.length > n ? text.slice(0, n - 1) + '…' : text;
  };
  const colorFor = (layer) => COLORS[layer] || '#9aa8bd';

  let modal, svg, panel, legend, menuEl, menuBtn, menuScrim;
  let nodeMap = new Map();
  let edgesByNode = new Map();
  const listeners = [];
  const emit = () => listeners.forEach((fn) => { try { fn(getFocus()); } catch (e) { /* listener bug */ } });
  const link = (text) => (typeof ConceptLib !== 'undefined' ? ConceptLib.linkTerms(esc(text)) : esc(text));
  const nodeLabel = (id) => (nodeMap.get(id) ? nodeMap.get(id).label : id);
  const KIND_MEANING = {
    sync: 'Synchronous: the caller waits for the answer before it can continue. Adds directly to user-facing latency.',
    async: 'Asynchronous: the caller hands off work (usually through a queue or log) and moves on. Decouples speed and failures.',
    obs: 'Telemetry: metrics, logs, or traces. Never on the user path, but how you find out something is wrong.'
  };

  function byId(id) { return document.getElementById(id); }

  function init() {
    modal = byId('arch-modal');
    if (!modal) return;
    svg = byId('arch-svg');
    panel = byId('arch-panel');
    legend = byId('arch-legend');

    byId('arch-close').addEventListener('click', close);
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    byId('arch-zoom-in').addEventListener('click', () => zoomCenter(0.82));
    byId('arch-zoom-out').addEventListener('click', () => zoomCenter(1.22));
    const inspBtn = byId('arch-inspector');
    if (inspBtn) inspBtn.addEventListener('click', () => toggleInspector());
    const sideClose = byId('arch-side-close');
    if (sideClose) sideClose.addEventListener('click', () => showInspector(false));

    menuEl = byId('arch-menu');
    menuBtn = byId('arch-menu-btn');
    menuScrim = byId('arch-menu-scrim');
    const toolbar = byId('arch-toolbar');
    if (toolbar) toolbar.addEventListener('click', onControl);
    if (menuEl) menuEl.addEventListener('click', onControl);
    if (menuBtn) menuBtn.addEventListener('click', (event) => { event.stopPropagation(); setMenu(!!(menuEl && menuEl.hidden)); });
    if (menuScrim) menuScrim.addEventListener('click', () => setMenu(false));
    window.addEventListener('resize', () => { if (menuEl && !menuEl.hidden) placeMenu(); });

    // re-fit when the canvas changes size (rotation, side panels, window resize)
    let sizeRaf = 0;
    const queueResize = () => { cancelAnimationFrame(sizeRaf); sizeRaf = requestAnimationFrame(onCanvasResize); };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(queueResize).observe(svg);
    else window.addEventListener('resize', queueResize);
    if (PORTRAIT) {
      const onTurn = () => { queueResize(); syncControls(); };
      if (PORTRAIT.addEventListener) PORTRAIT.addEventListener('change', onTurn);
      else if (PORTRAIT.addListener) PORTRAIT.addListener(onTurn);
    }

    document.querySelectorAll('#arch-modal [data-atab]').forEach((btn) => {
      btn.addEventListener('click', () => setTab(btn.dataset.atab));
    });

    panel.addEventListener('click', (event) => {
      const go = event.target.closest('[data-go]');
      if (go) {
        const [kind, value] = go.dataset.go.split(':');
        if (kind === 'node') selectNode(value);
        if (kind === 'edge') selectEdge(Number(value));
        if (kind === 'flow') startFlowAt(Number(value));
        return;
      }
      const ask = event.target.closest('[data-ask]');
      if (ask && typeof AIChat !== 'undefined') AIChat.ask(ask.dataset.ask);
    });

    svg.addEventListener('click', (event) => {
      if (state.moved) { state.moved = false; return; }
      const title = event.target.closest('[data-flow-title]');
      if (title) {
        const row = Number(title.dataset.flowTitle);
        if (state.flow === row) clearFocus(); else startFlowAt(row);
        return;
      }
      const node = event.target.closest('[data-node]');
      if (node) { selectNode(node.dataset.node); return; }
      const edge = event.target.closest('[data-edge]');
      if (edge) { selectEdge(Number(edge.dataset.edge)); return; }
      if (hasFocus()) clearFocus();
    });

    svg.addEventListener('mouseover', (event) => {
      const g = event.target.closest('[data-edge]');
      svg.querySelectorAll('.edge-label-wrap.peek').forEach((el) => el.classList.remove('peek'));
      if (g) svg.querySelectorAll(`.edge-label-wrap[data-edge="${g.dataset.edge}"]`).forEach((el) => el.classList.add('peek'));
    });
    svg.addEventListener('mouseleave', () => svg.querySelectorAll('.edge-label-wrap.peek').forEach((el) => el.classList.remove('peek')));

    svg.addEventListener('wheel', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
      const delta = Math.max(-220, Math.min(220, event.deltaY * unit));
      const sensitivity = event.ctrlKey ? 0.006 : 0.0018;
      const factor = Math.exp(delta * sensitivity);
      zoom(factor, svgPoint(event));
    }, { passive: false });

    // one finger or the mouse pans (from anywhere, even on a component); two fingers pinch to zoom
    svg.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (state.pointers.size === 1) {
        state.moved = false;
        state.downAt = { x: event.clientX, y: event.clientY };
        state.panning = true;
        state.last = { x: event.clientX, y: event.clientY };
      } else if (state.pointers.size === 2) {
        const [p, q] = [...state.pointers.values()];
        state.pinch = { d: Math.hypot(p.x - q.x, p.y - q.y), mid: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 } };
        state.panning = false;
        state.moved = true;
        try { svg.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }
      }
    });
    svg.addEventListener('pointermove', (event) => {
      if (!state.pointers.has(event.pointerId)) return;
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (state.pinch && state.pointers.size >= 2) {
        const [p, q] = [...state.pointers.values()];
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
        panBy(mid.x - state.pinch.mid.x, mid.y - state.pinch.mid.y);
        if (d > 0 && state.pinch.d > 0) zoom(state.pinch.d / d, svgPointAt(mid.x, mid.y));
        state.pinch = { d, mid };
        return;
      }
      if (!state.panning || !state.last) return;
      if (!state.moved) {
        if (Math.hypot(event.clientX - state.downAt.x, event.clientY - state.downAt.y) < 6) return;
        state.moved = true;
        svg.classList.add('dragging');
        try { svg.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }
      }
      panBy(event.clientX - state.last.x, event.clientY - state.last.y);
      state.last = { x: event.clientX, y: event.clientY };
    });
    const endPointer = (event) => {
      state.pointers.delete(event.pointerId);
      if (state.pointers.size < 2) state.pinch = null;
      if (state.pointers.size === 1) {
        const [p] = [...state.pointers.values()];
        state.panning = true;
        state.last = { x: p.x, y: p.y };
        return;
      }
      if (!state.pointers.size) { state.panning = false; state.last = null; svg.classList.remove('dragging'); }
    };
    svg.addEventListener('pointerup', endPointer);
    svg.addEventListener('pointercancel', endPointer);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (menuEl && !menuEl.hidden) { event.stopImmediatePropagation(); setMenu(false); return; }
      if (modal.classList.contains('expanded')) { event.stopImmediatePropagation(); setExpanded(false); return; }
      if (modal.classList.contains('on')) close();
    });
  }

  function open(id, options) {
    const graph = DESIGN_GRAPHS[id];
    if (!graph || !modal) return;
    const inline = !!(options && options.inline);
    state.inline = inline;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
    state.id = id;
    state.g = graph;
    state.selected = null;
    state.selectedEdge = null;
    state.flow = -1;
    nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
    edgesByNode = new Map();
    graph.nodes.forEach((node) => edgesByNode.set(node.id, []));
    graph.edges.forEach((edge, index) => {
      if (edgesByNode.has(edge.from)) edgesByNode.get(edge.from).push(index);
      if (edgesByNode.has(edge.to)) edgesByNode.get(edge.to).push(index);
    });

    byId('arch-title').textContent = graph.title;
    byId('arch-sub').textContent = graph.subtitle;
    // visible before rendering: label placement measures text with getBBox, which is 0×0 while hidden
    modal.classList.toggle('inline', inline);
    modal.classList.toggle('on', !inline);
    buildLegend();
    applyLegend();
    render();
    resetView(true);
    setTab('inspect');
    showInspector(false);
    document.body.classList.toggle('modal-open', !inline);
    if (!inline) byId('arch-close').focus();
    emit();
  }

  /* ---------- canvas settings: gear menu, direction, legend ---------- */
  function onControl(event) {
    const b = event.target.closest('button');
    if (!b || b === menuBtn) return;
    const d = b.dataset;
    if (d.layout) setLayout(d.layout);
    else if (d.route) setRoute(d.route);
    else if (d.dir) setDir(d.dir);
    else if (d.legend) setLegend(d.legend === 'on');
    else if (d.act === 'fit') { setMenu(false); resetView(); }
    else if (d.act === 'expand') { setMenu(false); setExpanded(); }
    else if (d.act === 'close-menu') setMenu(false);
  }

  function setMenu(open) {
    if (!menuEl) return;
    if (open) {
      const canvas = byId('arch-canvas');
      menuEl.classList.toggle('narrow', !!canvas && canvas.clientWidth < 640);
      syncControls();
    }
    menuEl.hidden = !open;
    if (menuScrim) menuScrim.hidden = !open;
    if (open) placeMenu();
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.classList.toggle('on', open);
    }
  }

  /** Drop-down under the gear; phone CSS turns it into a bottom sheet and ignores these offsets. */
  function placeMenu() {
    if (!menuBtn || !menuEl) return;
    const r = menuBtn.getBoundingClientRect();
    menuEl.style.top = Math.round(r.bottom + 8) + 'px';
    menuEl.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
    menuEl.style.maxHeight = Math.max(220, Math.round(window.innerHeight - r.bottom - 20)) + 'px';
  }

  /** Auto: top → down when the device is upright (phone or tablet), or the map area is too narrow for left → right. */
  function topDown() {
    if (state.dir === 'td') return true;
    if (state.dir === 'lr') return false;
    const portrait = PORTRAIT ? PORTRAIT.matches : window.innerHeight > window.innerWidth;
    const canvas = byId('arch-canvas');
    const cw = canvas ? canvas.clientWidth : 0;
    return (portrait && window.innerWidth < 900) || (cw > 0 && cw < 560);
  }

  function setDir(dir) {
    state.dir = dir === 'td' || dir === 'lr' ? dir : 'auto';
    save('gs.arch.dir', state.dir);
    if (state.g && topDown() !== (state.flowDir === 'td')) { render(); restoreHighlight(); resetView(true); }
    syncControls();
  }

  function legendShown() {
    if (state.legend) return state.legend === 'on';
    const canvas = byId('arch-canvas');
    return !canvas || !canvas.clientWidth || canvas.clientWidth >= 640;
  }

  function setLegend(on) {
    state.legend = on ? 'on' : 'off';
    save('gs.arch.legend', state.legend);
    applyLegend();
  }

  function applyLegend() {
    const canvas = byId('arch-canvas');
    if (canvas) {
      canvas.classList.toggle('legend-on', state.legend === 'on');
      canvas.classList.toggle('legend-off', state.legend === 'off');
    }
    syncControls();
  }

  function syncControls() {
    const each = (attr, fn) => document.querySelectorAll(`#arch-toolbar [${attr}], #arch-menu [${attr}]`).forEach(fn);
    each('data-layout', (b) => b.classList.toggle('on', b.dataset.layout === state.layout));
    each('data-route', (b) => b.classList.toggle('on', b.dataset.route === state.route));
    each('data-dir', (b) => b.classList.toggle('on', b.dataset.dir === state.dir));
    const shown = legendShown();
    each('data-legend', (b) => b.classList.toggle('on', (b.dataset.legend === 'on') === shown));
    const note = byId('arch-dir-note');
    if (note) {
      note.textContent = state.dir === 'auto'
        ? `Auto is using ${topDown() ? 'top → down' : 'left → right'} here. It goes top → down when the screen is upright or the map area is narrow.`
        : `Always ${state.dir === 'td' ? 'top → down' : 'left → right'}. Choose Auto to follow the screen.`;
    }
  }

  function close() {
    if (!modal) return;
    setMenu(false);
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
    modal.classList.remove('on', 'inline', 'inspector-open', 'expanded');
    document.body.classList.remove('arch-expanded');
    document.body.classList.remove('modal-open');
    state.flow = -1;
    state.inline = false;
  }

  function shapeIcon(shape) {
    const w = 22, h = 14;
    return `<svg class="legend-shape shape-${shape}" width="${w}" height="${h}" viewBox="-1 -1 ${w + 2} ${h + 2}" aria-hidden="true">${
      shapeOutline(shape, w, h).replace(/ rx="(\d+(\.\d+)?)"/g, (m, v) => ` rx="${Math.min(Number(v), h / 2)}"`)
    }</svg>`;
  }

  function buildLegend() {
    const shapes = [...new Set(state.g.nodes.map((node) => shapeOf(node)))];
    const order = ['client', 'edge', 'service', 'queue', 'cache', 'db', 'external', 'obs'];
    const label = (s) => (typeof SHAPE_INFO !== 'undefined' && SHAPE_INFO[s] ? SHAPE_INFO[s].label : s);
    legend.innerHTML = order.filter((s) => shapes.includes(s)).map((s) => (
      `<span class="arch-legend-item shape">${shapeIcon(s)}${esc(label(s))}</span>`
    )).join('')
      + '<span class="arch-legend-sep"></span>'
      + '<span class="arch-edge-key"><i class="arch-key-dot sync"></i>sync</span>'
      + '<span class="arch-edge-key"><i class="arch-key-dot async"></i>async</span>'
      + '<span class="arch-edge-key"><i class="arch-key-dot obs"></i>telemetry</span>'
      + '<span class="arch-edge-key"><i class="arch-key-dot return"></i>return</span>';
  }

  function layout() {
    const graph = state.g;
    const count = graph.layers.length;
    const nw = 188;
    const colw = graph.colw || (count >= 7 ? 216 : 224);
    const labelMax = Math.max(13, Math.floor((nw - 20) / 7.2));
    const subMax = Math.max(14, Math.floor((nw - 18) / 6.3));
    const columns = graph.layers.map((layer) => graph.nodes.filter((node) => node.layer === layer));
    const rows = Math.max(1, ...columns.map((column) => column.length));
    const rowh = rows <= 2 ? 130 : rows === 3 ? 108 : 92;
    const W = LEFT + count * colw + 24;
    const H = TOP + rows * rowh + 30;
    const positions = new Map();
    columns.forEach((column, i) => {
      const offset = (rows - column.length) * rowh / 2;
      column.forEach((node, j) => {
        positions.set(node.id, { x: LEFT + i * colw, y: TOP + offset + j * rowh });
      });
    });
    return { positions, W, H, rows, nw, nh: NH, labelMax, subMax, colw, rowh };
  }

  // top → down sizing: as many components per row as stay readable at the canvas width
  const TD = { nw: 188, gap: 16, side: 24, top: 70, head: 28, rowGap: 30, bandGap: 72, minScale: 0.76 };

  function columnsThatFit(cw) {
    const width = cw == null ? drawingArea().cw : cw;
    if (!(width > 0)) return 2;
    const room = width / TD.minScale - TD.side * 2 + TD.gap;
    return Math.max(1, Math.min(6, Math.floor(room / (TD.nw + TD.gap))));
  }

  /** Layers become horizontal bands stacked top to bottom; a band wraps onto more rows when it is wider than the screen. */
  function layoutTD() {
    const graph = state.g;
    const { nw, gap, side, head, rowGap, bandGap } = TD;
    const per = state.perRow = columnsThatFit();
    const W = side * 2 + per * nw + (per - 1) * gap;
    const positions = new Map();
    const bands = [];
    let y = TD.top;
    graph.layers.forEach((layer) => {
      const nodes = graph.nodes.filter((node) => node.layer === layer);
      if (!nodes.length) return;
      const rowsN = Math.ceil(nodes.length / per);
      nodes.forEach((node, i) => {
        const r = Math.floor(i / per);
        const inRow = Math.min(per, nodes.length - r * per);
        const x0 = (W - (inRow * nw + (inRow - 1) * gap)) / 2;
        positions.set(node.id, { x: x0 + (i % per) * (nw + gap), y: y + head + r * (NH + rowGap) });
      });
      const bottom = y + head + rowsN * NH + (rowsN - 1) * rowGap;
      bands.push({ layer, top: y, bottom });
      y = bottom + bandGap;
    });
    const H = y - bandGap + 36;
    return { positions, W, H, nw, nh: NH, labelMax: 0, subMax: 0, bands };
  }

  /**
   * Path for a top → down edge. Down to a lower band leaves the bottom of the box and enters the top;
   * across a row runs side to side; back up (responses) runs along the nearer outer edge of the map.
   */
  function tdRoute(a, b, nw, nh, index, W) {
    const ortho = state.route === 'ortho';
    const acx = a.x + nw / 2, bcx = b.x + nw / 2;
    if (b.y >= a.y + nh) {
      const lean = Math.max(-nw / 3, Math.min(nw / 3, (bcx - acx) * 0.18));
      const x1 = acx + lean, y1 = a.y + nh, x2 = bcx - lean, y2 = b.y;
      if (ortho) {
        if (Math.abs(x1 - x2) < 1) return { d: `M ${x1} ${y1} V ${y2}`, lx: x1, ly: (y1 + y2) / 2 };
        const my = Math.round(y2 - TD.bandGap / 2 + ((index % 3) - 1) * 7);
        return { d: `M ${x1} ${y1} V ${my} H ${x2} V ${y2}`, lx: (x1 + x2) / 2, ly: my - 5 };
      }
      const dy = Math.max(28, (y2 - y1) * 0.45);
      return { d: `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`, lx: (x1 + x2) / 2, ly: (y1 + y2) / 2 + ((index % 3) - 1) * 6 };
    }
    if (Math.abs(b.y - a.y) < 1) {
      const right = b.x > a.x;
      const y = a.y + nh / 2;
      if (Math.abs(b.x - a.x) <= nw + TD.gap + 1) {
        const x1 = right ? a.x + nw : a.x, x2 = right ? b.x : b.x + nw;
        return { d: `M ${x1} ${y} H ${x2}`, lx: (x1 + x2) / 2, ly: y - 10 };
      }
      const lift = 24 + (index % 3) * 6;
      const x1 = acx + (right ? 12 : -12), x2 = bcx + (right ? -12 : 12);
      return ortho
        ? { d: `M ${x1} ${a.y} V ${a.y - lift} H ${x2} V ${b.y}`, lx: (x1 + x2) / 2, ly: a.y - lift - 5 }
        : { d: `M ${x1} ${a.y} C ${x1} ${a.y - lift}, ${x2} ${b.y - lift}, ${x2} ${b.y}`, lx: (x1 + x2) / 2, ly: a.y - lift * 0.75 - 4 };
    }
    const right = (acx + bcx) / 2 >= W / 2;
    const x1 = right ? a.x + nw : a.x, x2 = right ? b.x + nw : b.x;
    const y1 = a.y + nh / 2 + 6, y2 = b.y + nh / 2 - 6;
    const off = 10 + (index % 3) * 5;
    const lane = right ? Math.max(x1, x2) + off : Math.min(x1, x2) - off;
    const d = ortho
      ? `M ${x1} ${y1} H ${lane} V ${y2} H ${x2}`
      : `M ${x1} ${y1} C ${lane + (right ? 8 : -8)} ${y1}, ${lane + (right ? 8 : -8)} ${y2}, ${x2} ${y2}`;
    return { d, lx: lane + (right ? -4 : 4), ly: (y1 + y2) / 2, lane: true, anchor: right ? 'end' : 'start' };
  }

  function svgDefs() {
    return `<defs>
      <marker id="arch-arrow-sync" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#5f9fe8"></path>
      </marker>
      <marker id="arch-arrow-async" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#d6a63f"></path>
      </marker>
      <marker id="arch-arrow-obs" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#7f8da4"></path>
      </marker>
      <marker id="arch-arrow-return" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#7ee0c2"></path>
      </marker>
    </defs>`;
  }

  function renderSVG() {
    const graph = state.g;
    const td = state.flowDir === 'td';
    const L = td ? layoutTD() : layout();
    const { positions, W, H, nw, nh, labelMax, subMax } = L;
    state.W = W;
    state.H = H;

    const defs = svgDefs();

    const layers = td
      ? L.bands.map(({ layer, top }) => `<text class="arch-layer" x="${TD.side}" y="${top + 13}" fill="${colorFor(layer)}">${esc(layer.toUpperCase())}</text>
        <line x1="${TD.side}" y1="${top + 20}" x2="${W - TD.side}" y2="${top + 20}" stroke="${colorFor(layer)}" stroke-opacity=".14"></line>`).join('')
      : graph.layers.map((layer, i) => {
        const x = LEFT + i * L.colw + nw / 2;
        return `<text class="arch-layer" x="${x}" y="38" text-anchor="middle" fill="${colorFor(layer)}">${esc(layer.toUpperCase())}</text>
        <line x1="${x}" y1="52" x2="${x}" y2="${H - 22}" stroke="${colorFor(layer)}" stroke-opacity=".14"></line>`;
      }).join('');

    const labelMarkup = [];
    const edgeMarkup = graph.edges.map((edge, index) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) return '';
      let route, x1, y1, x2, y2;
      if (td) {
        route = tdRoute(from, to, nw, nh, index, W);
        x1 = from.x; y1 = from.y; x2 = to.x; y2 = to.y;
      } else {
        x1 = from.x + nw; y1 = from.y + nh / 2;
        x2 = to.x; y2 = to.y + nh / 2;
        route = layerRoute(x1, y1, x2, y2, x2 >= x1, index, nh);
      }
      const d = route.d;
      const targetNode = nodeMap.get(edge.to);
      const isReturn = !!(targetNode && (targetNode.layer === 'Client' || targetNode.layer === 'Consumers' || targetNode.id === 'recipient' || targetNode.id === 'user'));
      if (edge.kind !== 'obs') {
        // labels on the outer lanes would hang off the screen edge, so they appear only when the connection is highlighted
        labelMarkup.push(`<g class="edge-label-wrap ${edge.kind}${isReturn ? ' return' : ''}${route.lane ? ' lane crowded' : ''}" data-edge="${index}"><text class="arch-edge-label ${edge.kind}" x="${route.lx}" y="${route.ly}" text-anchor="${route.anchor || 'middle'}">${esc(edge.label)}</text></g>`);
      }
      const distance = Math.hypot(x2 - x1, y2 - y1) + 90;
      const duration = Math.min(5.4, Math.max(2.2, distance / 260)) + (edge.kind === 'async' ? 0.7 : edge.kind === 'obs' ? 1.5 : 0);
      const begin = -((index * 0.43) % 4).toFixed(2);
      const packetShape = edge.kind === 'sync'
        ? '<circle class="packet-core" r="3.6"></circle>'
        : edge.kind === 'async'
          ? '<rect class="packet-core" x="-3.5" y="-3.5" width="7" height="7" rx="1" transform="rotate(45)"></rect>'
          : '<rect class="packet-core" x="-2.5" y="-2.5" width="5" height="5" rx="0.8"></rect>';
      return `<g class="arch-edge-group ${edge.kind}${isReturn ? ' return' : ''}" data-edge="${index}">
        <path id="arch-edge-path-${index}" class="arch-edge ${edge.kind}${isReturn ? ' return' : ''}" d="${d}" marker-end="url(#arch-arrow-${isReturn ? 'return' : edge.kind})"></path>
        <g class="arch-packet ${edge.kind}" aria-hidden="true">
          <circle class="packet-halo" r="8"></circle>
          ${packetShape}
          <animateMotion dur="${duration.toFixed(2)}s" begin="${begin}s" repeatCount="indefinite">
            <mpath href="#arch-edge-path-${index}" xlink:href="#arch-edge-path-${index}"></mpath>
          </animateMotion>
        </g>
        <title>${esc(edge.detail || edge.label)}</title>
      </g>`;
    }).join('');

    const nodeMarkup = graph.nodes.map((node) => {
      const pos = positions.get(node.id);
      return pos ? nodeShape(node, pos.x, pos.y, nw, nh, labelMax, subMax) : '';
    }).join('');

    svg.innerHTML = defs + layers + edgeMarkup + nodeMarkup + `<g class="edge-labels">${labelMarkup.join('')}</g>`;
    clearHighlights();
  }

  const SHAPE_BADGE = { client: 'USER', edge: 'EDGE', service: 'SERVICE', queue: 'QUEUE', db: 'DATABASE', cache: 'CACHE', external: 'EXTERNAL', obs: 'MONITOR' };

  function shapeOf(node) {
    if (node.shape) return node.shape;
    return typeof ConceptLib !== 'undefined' ? ConceptLib.shapeFor(node) : 'service';
  }

  /** Outline path for each component type, so a store never looks like a service. */
  function shapeOutline(shape, w, h) {
    const r = 7;
    switch (shape) {
      case 'client':
        return `<rect class="arch-node-box" width="${w}" height="${h}" rx="${h / 2}"></rect>`;
      case 'edge':
        return `<path class="arch-node-box" d="M 12 0 H ${w - 12} L ${w} ${h / 2} L ${w - 12} ${h} H 12 L 0 ${h / 2} Z"></path>`;
      case 'db':
      case 'cache':
        return `<path class="arch-node-box" d="M 0 ${r} A ${w / 2} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${w / 2} ${r} 0 0 1 0 ${h - r} Z"></path>
          <path class="arch-node-cap" d="M 0 ${r} A ${w / 2} ${r} 0 0 0 ${w} ${r}"></path>
          ${shape === 'db' ? `<path class="arch-node-cap faint" d="M 0 ${r + 7} A ${w / 2} ${r} 0 0 0 ${w} ${r + 7}"></path>` : ''}`;
      case 'queue':
        return `<rect class="arch-node-box" width="${w}" height="${h}" rx="4"></rect>
          ${[0, 1, 2].map((i) => `<line class="arch-node-slot" x1="${w - 8 - i * 6}" y1="9" x2="${w - 8 - i * 6}" y2="${h - 9}"></line>`).join('')}`;
      case 'external':
        return `<rect class="arch-node-box dashed" width="${w}" height="${h}" rx="12"></rect>`;
      case 'obs':
        return `<rect class="arch-node-box dotted" width="${w}" height="${h}" rx="4"></rect>`;
      default:
        return `<rect class="arch-node-box" width="${w}" height="${h}" rx="9"></rect>`;
    }
  }

  /** 16×16 line icon for each component type, drawn in the component's color. */
  const SHAPE_ICON = {
    client: '<circle cx="8" cy="5.5" r="2.6"/><path d="M3 14c.6-3 2.6-4.4 5-4.4s4.4 1.4 5 4.4"/>',
    edge: '<path d="M8 1.8 13.5 4v4.2c0 3-2.3 5.1-5.5 6-3.2-.9-5.5-3-5.5-6V4z"/><path d="m5.6 8 1.7 1.7L10.6 6.4"/>',
    service: '<rect x="2" y="2.5" width="12" height="4.5" rx="1.2"/><rect x="2" y="9" width="12" height="4.5" rx="1.2"/><path d="M4.5 4.75h.01M4.5 11.25h.01"/>',
    queue: '<rect x="1.5" y="5" width="3.6" height="6" rx=".8"/><rect x="6.2" y="5" width="3.6" height="6" rx=".8"/><rect x="10.9" y="5" width="3.6" height="6" rx=".8"/>',
    db: '<ellipse cx="8" cy="3.8" rx="5.5" ry="2"/><path d="M2.5 3.8v8.4c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V3.8"/><path d="M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2"/>',
    cache: '<path d="M9.2 1.5 3.5 9h4l-1 5.5L12.5 7h-4z"/>',
    external: '<path d="M4.5 12.5a3 3 0 0 1-.4-6A4.2 4.2 0 0 1 12.2 6a3.3 3.3 0 0 1-.2 6.5z"/>',
    obs: '<path d="M2 13.5h12"/><path d="m3 10.5 3-3.5 2.5 2 4.5-5"/>'
  };

  /** The type tag above each name: specific for edge components, the shape family otherwise. */
  function badgeFor(node, shape) {
    if (node.badge) return node.badge;
    const c = typeof ConceptLib !== 'undefined' ? ConceptLib.forNode(node) : null;
    if (c && c.id === 'lb') return 'LOAD BALANCER';
    if (c && c.id === 'cdn') return 'CDN';
    if (c && c.id === 'websocket') return 'REAL-TIME';
    if (c && c.id === 'waitingroom') return 'WAITING ROOM';
    if (node.layer === 'Gateway') return 'GATEWAY';
    return SHAPE_BADGE[shape] || '';
  }

  function nodeShape(node, x, y, nw, nh, labelMax, subMax) {
    const color = node.color || colorFor(node.layer);
    const shape = shapeOf(node);
    const cyl = shape === 'db' || shape === 'cache';
    const pad = shape === 'edge' ? 14 : shape === 'client' ? 14 : 10;
    const top = cyl ? 4 : 0;
    const slots = shape === 'queue' ? 24 : 0;
    const chip = 26, chipY = Math.round((nh - chip) / 2 + top / 2);
    const tx = pad + chip + 9;
    // characters that fit in the space right of the icon (14px sans name, 11.5px sans description)
    const room = nw - tx - 8 - slots - (shape === 'edge' ? 10 : 0);
    const lmax = Math.max(8, Math.floor(room / 7.3));
    const smax = Math.max(8, Math.floor(room / 6));
    return `<g class="arch-node shape-${shape}" data-node="${esc(node.id)}" data-box="${x},${y},${nw},${nh}" transform="translate(${x},${y})" style="--node-color:${color}">
      ${shapeOutline(shape, nw, nh)}
      <g class="arch-node-icon" transform="translate(${pad},${chipY})">
        <rect class="icon-chip" width="${chip}" height="${chip}" rx="7"></rect>
        <g class="icon-glyph" transform="translate(5,5)">${SHAPE_ICON[shape] || SHAPE_ICON.service}</g>
      </g>
      <text class="arch-node-badge" x="${tx}" y="${17 + top}">${badgeFor(node, shape)}</text>
      <text class="arch-node-label" x="${tx}" y="${34 + top}">${esc(cut(node.label, lmax))}</text>
      <text class="arch-node-sub" x="${tx}" y="${49 + top}">${esc(cut(node.sub, smax))}</text>
      <title>${esc(node.label)} (${esc(SHAPE_BADGE[shape] || '').toLowerCase()}): ${esc(node.detail)}</title>
    </g>`;
  }

  function packetMarkup(kind, pathId, distance, index) {
    const duration = Math.min(5.4, Math.max(2.2, distance / 260)) + (kind === 'async' ? 0.7 : kind === 'obs' ? 1.5 : 0);
    const begin = -((index * 0.43) % 4).toFixed(2);
    const core = kind === 'sync'
      ? '<circle class="packet-core" r="3.6"></circle>'
      : kind === 'async'
        ? '<rect class="packet-core" x="-3.5" y="-3.5" width="7" height="7" rx="1" transform="rotate(45)"></rect>'
        : '<rect class="packet-core" x="-2.5" y="-2.5" width="5" height="5" rx="0.8"></rect>';
    return `<g class="arch-packet ${kind}" aria-hidden="true">
      <circle class="packet-halo" r="8"></circle>${core}
      <animateMotion dur="${duration.toFixed(2)}s" begin="${begin}s" repeatCount="indefinite">
        <mpath href="#${pathId}" xlink:href="#${pathId}"></mpath>
      </animateMotion>
    </g>`;
  }

  /** Path for a Components-view edge: smooth curves, or only horizontal/vertical segments. */
  function layerRoute(x1, y1, x2, y2, forward, index, nh) {
    if (state.route !== 'ortho') {
      const dx = Math.max(52, Math.abs(x2 - x1) * 0.45);
      return {
        d: forward
          ? `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
          : `M ${x1} ${y1} C ${x1 + 90} ${y1 - 75}, ${x2 - 90} ${y2 + 75}, ${x2} ${y2}`,
        lx: (x1 + x2) / 2,
        ly: (y1 + y2) / 2 - (forward ? 7 : 0) + ((index % 5) - 2) * 7
      };
    }
    if (forward) {
      if (Math.abs(y1 - y2) < 1) return { d: `M ${x1} ${y1} H ${x2}`, lx: (x1 + x2) / 2, ly: y1 - 6 };
      const mx = Math.round(x1 + (x2 - x1) / 2 + ((index % 3) - 1) * 9);
      return { d: `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`, lx: (x1 + mx) / 2, ly: y1 - 6 };
    }
    const out = x1 + 16 + (index % 3) * 6;
    const back = x2 - 16 - (index % 3) * 6;
    const low = Math.max(y1, y2) + nh / 2 + 18 + (index % 4) * 9;
    return { d: `M ${x1} ${y1} H ${out} V ${low} H ${back} V ${y2} H ${x2}`, lx: (out + back) / 2, ly: low - 5 };
  }

  /** Each time a packet arrives at the end of a connection, pulse the component it entered. */
  function bindPulses() {
    svg.querySelectorAll('.arch-edge-group').forEach((group) => {
      const edge = state.g.edges[Number(group.dataset.edge)];
      const anim = group.querySelector('animateMotion');
      if (!edge || !anim || edge.kind === 'obs') return;
      anim.addEventListener('repeatEvent', () => {
        if (group.classList.contains('dim')) return;
        const scope = group.closest('.path-row') || svg;
        const node = scope.querySelector(`[data-node="${edge.to}"]`);
        if (!node || node.classList.contains('dim')) return;
        node.classList.remove('pulse');
        void node.getBoundingClientRect();
        node.classList.add('pulse');
        clearTimeout(node.pulseTimer);
        node.pulseTimer = setTimeout(() => node.classList.remove('pulse'), 650);
      });
    });
  }

  function setRoute(route) {
    if (!state.g) return;
    state.route = route === 'ortho' ? 'ortho' : 'curved';
    try { localStorage.setItem('gs.arch.route', JSON.stringify(state.route)); } catch (e) { /* ignore */ }
    if (state.raf) { cancelAnimationFrame(state.raf); state.raf = null; }
    state.view.x = state.target.x;
    state.view.y = state.target.y;
    state.view.w = state.target.w;
    state.view.h = state.target.h;
    const kept = { x: state.view.x, y: state.view.y, w: state.view.w, h: state.view.h };
    render({ preserveView: true });
    restoreHighlight();
    syncControls();
    const restore = () => {
      state.view.x = kept.x; state.view.y = kept.y; state.view.w = kept.w; state.view.h = kept.h;
      state.target.x = kept.x; state.target.y = kept.y; state.target.w = kept.w; state.target.h = kept.h;
      applyView();
    };
    restore();
    requestAnimationFrame(restore);
  }

  function isReturnEdge(edge) {
    const t = nodeMap.get(edge.to);
    return !!(t && (t.layer === 'Client' || t.layer === 'Consumers'));
  }

  /** The order each user action visits its components, starting with the first hop. */
  function flowOrders() {
    return state.g.flow.map((step) => {
      const order = [];
      step.edges.forEach(([a, b]) => { if (!order.includes(a)) order.push(a); if (!order.includes(b)) order.push(b); });
      step.nodes.forEach((id) => { if (!order.includes(id)) order.push(id); });
      return order;
    });
  }

  function pathTitle(step, r, max) {
    const tag = step.kind ? (step.kind === 'write' ? 'WRITE PATH' : step.kind === 'read' ? 'READ PATH' : 'BEHIND THE SCENES') : '';
    const room = max ? Math.max(12, max - (tag ? tag.length + 2 : 0)) : 999;
    return (tag ? `<tspan class="rw-tag rw-${step.kind === 'background' ? 'bg' : step.kind}">${tag}</tspan><tspan dx="8">` : '<tspan>')
      + `${esc(cut(`${r + 1}. ${step.title}`, room))}</tspan>`;
  }

  /**
   * Top → down User actions: each action is a section, its components stacked in hop order.
   * Skips forward curve down the right side, responses curve back up the left side.
   */
  function renderPathViewTD() {
    const graph = state.g;
    const nw = TD.nw, nh = NH, vgap = 50, side = 112, head = 40, sectionGap = 34;
    const ortho = state.route === 'ortho';
    const W = side * 2 + nw;
    const cx = W / 2, x0 = side;
    const orders = flowOrders();
    let y = 58;
    let body = '';
    graph.flow.forEach((step, r) => {
      const order = orders[r];
      const top = y;
      const ny = (id) => top + head + order.indexOf(id) * (nh + vgap);
      const height = head + order.length * nh + (order.length - 1) * vgap + 18;
      let edgesSvg = '', labelsSvg = '';
      step.edges.forEach(([a, b], k) => {
        const gi = graph.edges.findIndex((e) => e.from === a && e.to === b);
        const edge = graph.edges[gi];
        if (!edge) return;
        const ia = order.indexOf(a), ib = order.indexOf(b);
        const ya = ny(a), yb = ny(b);
        const ret = isReturnEdge(edge);
        let d, bx, by, lx, anchor;
        if (ib === ia + 1) {
          d = `M ${cx} ${ya + nh} V ${yb}`;
          bx = cx; by = (ya + nh + yb) / 2; lx = cx + 16; anchor = 'start';
        } else {
          const right = ib > ia;
          const edgeX = right ? x0 + nw : x0;
          const y1 = ya + nh / 2 + (right ? 8 : -8), y2 = yb + nh / 2 + (right ? -8 : 8);
          const lane = edgeX + (right ? 1 : -1) * (24 + Math.min(4, Math.abs(ib - ia)) * 7);
          d = ortho
            ? `M ${edgeX} ${y1} H ${lane} V ${y2} H ${edgeX}`
            : `M ${edgeX} ${y1} C ${lane} ${y1}, ${lane} ${y2}, ${edgeX} ${y2}`;
          bx = ortho ? lane : edgeX + (lane - edgeX) * 0.75;
          by = (y1 + y2) / 2;
          lx = bx + (right ? 15 : -15);
          anchor = right ? 'start' : 'end';
        }
        const pid = `arch-pp-${r}-${k}`;
        // ~6.6 units per character of label text; the full label is in the tooltip and the side panel
        const room = anchor === 'end' ? lx - 6 : W - 6 - lx;
        edgesSvg += `<g class="arch-edge-group ${edge.kind}${ret ? ' return' : ''}" data-edge="${gi}">
          <path id="${pid}" class="arch-edge ${edge.kind}${ret ? ' return' : ''}" d="${d}" marker-end="url(#arch-arrow-${ret ? 'return' : edge.kind})"></path>
          ${packetMarkup(edge.kind, pid, 160, k)}
          <title>${k + 1}. ${esc(nodeLabel(a))} → ${esc(nodeLabel(b))}: ${esc(edge.detail || edge.label)}</title>
        </g>`;
        labelsSvg += `<g class="edge-label-wrap ${edge.kind}${ret ? ' return' : ''}" data-edge="${gi}">
          <g class="hop-badge" transform="translate(${bx},${by})"><circle r="10"></circle><text y="4" text-anchor="middle">${k + 1}</text></g>
          <text class="arch-edge-label ${edge.kind}" x="${lx}" y="${by + 4}" text-anchor="${anchor}">${esc(cut(edge.label, Math.max(4, Math.floor(room / 6.6))))}</text>
        </g>`;
      });
      const nodesSvg = order.map((id) => {
        const node = nodeMap.get(id);
        return node ? nodeShape(node, x0, ny(id), nw, nh, 0, 0) : '';
      }).join('');
      body += `<g class="path-row" data-row="${r}">
        <rect class="path-row-bg" x="10" y="${top - 6}" width="${W - 20}" height="${height}" rx="12"></rect>
        <text class="path-row-title" x="22" y="${top + 20}" data-flow-title="${r}">${pathTitle(step, r, 40)}</text>
        ${edgesSvg}${nodesSvg}<g class="edge-labels">${labelsSvg}</g>
      </g>`;
      y = top + height + sectionGap;
    });
    state.W = W;
    state.H = y - sectionGap + 20;
    svg.innerHTML = svgDefs() + `<text class="arch-layer" x="22" y="34" fill="#8fa3bf">USER ACTIONS</text>` + body;
    clearHighlights();
  }

  /* ---------- Paths layout: one row per request path, every hop numbered ---------- */
  function renderPathView() {
    const graph = state.g;
    const nw = 188, nh = NH, colw = 300, rowh = 186, left = 44, top = 64;
    const ortho = state.route === 'ortho';
    const labelMax = Math.floor((nw - 26) / 7.2), subMax = Math.floor((nw - 22) / 6.3);
    let maxCols = 1;
    const rows = graph.flow.map((step) => {
      const order = [];
      step.edges.forEach(([a, b]) => { if (!order.includes(a)) order.push(a); if (!order.includes(b)) order.push(b); });
      step.nodes.forEach((id) => { if (!order.includes(id)) order.push(id); });
      maxCols = Math.max(maxCols, order.length);
      return order;
    });
    const W = left + maxCols * colw + 10;
    const H = top + graph.flow.length * rowh + 10;
    state.W = W;
    state.H = H;

    let body = '';
    graph.flow.forEach((step, r) => {
      const order = rows[r];
      const y0 = top + r * rowh;
      const pos = (id) => ({ x: left + order.indexOf(id) * colw, y: y0 + 34 });
      let edgesSvg = '';
      let labelsSvg = '';
      step.edges.forEach(([a, b], k) => {
        const gi = graph.edges.findIndex((e) => e.from === a && e.to === b);
        const edge = graph.edges[gi];
        if (!edge) return;
        const pa = pos(a), pb = pos(b);
        const ia = order.indexOf(a), ib = order.indexOf(b);
        const ret = isReturnEdge(edge);
        let d, lx, ly;
        if (ib === ia + 1) {
          const x1 = pa.x + nw, x2 = pb.x, yy = pa.y + nh / 2;
          d = `M ${x1} ${yy} L ${x2} ${yy}`;
          lx = (x1 + x2) / 2; ly = yy;
        } else if (ib > ia) {
          const x1 = pa.x + nw / 2 + 14, x2 = pb.x + nw / 2 - 14, lift = 22 + (ib - ia) * 4;
          d = ortho
            ? `M ${x1} ${pa.y} V ${pa.y - lift} H ${x2} V ${pb.y}`
            : `M ${x1} ${pa.y} C ${x1} ${pa.y - lift}, ${x2} ${pb.y - lift}, ${x2} ${pb.y}`;
          lx = (x1 + x2) / 2; ly = pa.y - lift + (ortho ? 0 : 2);
        } else {
          const x1 = pa.x + nw / 2 - 14, x2 = pb.x + nw / 2 + 14, drop = 26 + (ia - ib) * 5;
          d = ortho
            ? `M ${x1} ${pa.y + nh} V ${pa.y + nh + drop} H ${x2} V ${pb.y + nh}`
            : `M ${x1} ${pa.y + nh} C ${x1} ${pa.y + nh + drop}, ${x2} ${pb.y + nh + drop}, ${x2} ${pb.y + nh}`;
          lx = (x1 + x2) / 2; ly = pa.y + nh + drop - (ortho ? 0 : 2);
        }
        const pid = `arch-pp-${r}-${k}`;
        edgesSvg += `<g class="arch-edge-group ${edge.kind}${ret ? ' return' : ''}" data-edge="${gi}">
          <path id="${pid}" class="arch-edge ${edge.kind}${ret ? ' return' : ''}" d="${d}" marker-end="url(#arch-arrow-${ret ? 'return' : edge.kind})"></path>
          ${packetMarkup(edge.kind, pid, 260, k)}
          <title>${k + 1}. ${esc(nodeLabel(a))} → ${esc(nodeLabel(b))}: ${esc(edge.detail || edge.label)}</title>
        </g>`;
        labelsSvg += `<g class="edge-label-wrap ${edge.kind}${ret ? ' return' : ''}" data-edge="${gi}">
          <g class="hop-badge" transform="translate(${lx},${ly})"><circle r="10"></circle><text y="4" text-anchor="middle">${k + 1}</text></g>
          <text class="arch-edge-label ${edge.kind}" x="${lx}" y="${ly - 16}" text-anchor="middle">${esc(edge.label)}</text>
        </g>`;
      });
      const nodesSvg = order.map((id) => {
        const node = nodeMap.get(id);
        const p = pos(id);
        return node ? nodeShape(node, p.x, p.y, nw, nh, labelMax, subMax) : '';
      }).join('');
      body += `<g class="path-row" data-row="${r}">
        <rect class="path-row-bg" x="${left - 26}" y="${y0 - 8}" width="${W - left + 16}" height="${rowh - 14}" rx="10"></rect>
        <text class="path-row-title" x="${left - 12}" y="${y0 + 12}" data-flow-title="${r}">${step.kind ? `<tspan class="rw-tag rw-${step.kind === 'background' ? 'bg' : step.kind}">${step.kind === 'write' ? 'WRITE PATH' : step.kind === 'read' ? 'READ PATH' : 'BEHIND THE SCENES'}</tspan><tspan dx="8">` : '<tspan>'}${r + 1}. ${esc(step.title)}</tspan></text>
        ${edgesSvg}${nodesSvg}<g class="edge-labels">${labelsSvg}</g>
      </g>`;
    });

    svg.innerHTML = svgDefs() + `<text class="arch-layer" x="${left - 12}" y="30" fill="#8fa3bf">USER ACTIONS, HOP BY HOP · numbers show the order · arcs below the row are responses · click a title to highlight it</text>` + body;
    clearHighlights();
  }

  /**
   * Move each connection label to a nearby spot where it covers no component and no other label.
   * Labels with no free spot stay hidden until their connection is hovered or highlighted.
   */
  function declutterLabels() {
    const boxes = [...svg.querySelectorAll('[data-box]')].map((n) => {
      const [x, y, w, h] = n.dataset.box.split(',').map(Number);
      return { x: x - 4, y: y - 4, w: w + 8, h: h + 8 };
    });
    svg.querySelectorAll('.arch-layer, .path-row-title').forEach((t) => {
      const b = t.getBBox();
      if (b.width) boxes.push({ x: b.x - 4, y: b.y - 3, w: b.width + 8, h: b.height + 6 });
    });
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const placed = [];
    svg.querySelectorAll('.edge-label-wrap').forEach((wrap) => {
      if (wrap.classList.contains('lane')) return;
      const badge = wrap.querySelector('.hop-badge');
      if (badge) {
        const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(badge.getAttribute('transform') || '');
        if (m) placed.push({ x: +m[1] - 12, y: +m[2] - 12, w: 24, h: 24 });
      }
      const t = wrap.querySelector('.arch-edge-label');
      if (!t) return;
      const x0 = Number(t.getAttribute('x'));
      const y0 = Number(t.getAttribute('y'));
      const tries = [];
      [0, -13, 13, -26, 26, -39, 39].forEach((dy) => [0, -28, 28, -56, 56].forEach((dx) => tries.push([dx, dy])));
      tries.sort((a, b) => Math.hypot(a[0], a[1] * 1.6) - Math.hypot(b[0], b[1] * 1.6));
      let free = false;
      for (const [dx, dy] of tries) {
        t.setAttribute('x', x0 + dx);
        t.setAttribute('y', y0 + dy);
        const b = t.getBBox();
        const box = { x: b.x - 4, y: b.y - 2, w: b.width + 8, h: b.height + 4 };
        const inside = b.x >= 0 && b.x + b.width <= state.W;
        if (inside && !boxes.some((o) => hit(o, box)) && !placed.some((o) => hit(o, box))) {
          placed.push(box);
          free = true;
          break;
        }
      }
      if (!free) { t.setAttribute('x', x0); t.setAttribute('y', y0); }
      wrap.classList.toggle('crowded', !free);
    });
  }

  function render(options) {
    const preserve = !!(options && options.preserveView);
    state.flowDir = topDown() ? 'td' : 'lr';
    if (state.layout === 'paths') { if (state.flowDir === 'td') renderPathViewTD(); else renderPathView(); }
    else renderSVG();
    modal.classList.toggle('flow-td', state.flowDir === 'td');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (preserve) applyView();
    else svg.setAttribute('viewBox', `0 0 ${state.W} ${state.H}`);
    declutterLabels();
    bindPulses();
    syncControls();
  }

  /** Put back the selection or user-action highlight after a redraw, without touching the side panel. */
  function restoreHighlight() {
    if (!state.g) return;
    if (state.flow >= 0 && state.g.flow[state.flow]) {
      const step = state.g.flow[state.flow];
      const edges = step.edges.map(([from, to]) => state.g.edges.findIndex((e) => e.from === from && e.to === to)).filter((i) => i >= 0);
      focusNodes(step.nodes, edges, 'flow');
      svg.querySelectorAll('.path-row').forEach((row) => row.classList.toggle('off', Number(row.dataset.row) !== state.flow));
    } else if (state.selected != null && nodeMap.get(state.selected)) {
      const connected = edgesByNode.get(state.selected) || [];
      const nodes = new Set([state.selected]);
      connected.forEach((i) => { nodes.add(state.g.edges[i].from); nodes.add(state.g.edges[i].to); });
      focusNodes(nodes, connected, 'node');
      const el = svg.querySelector(`[data-node="${state.selected}"]`);
      if (el) el.classList.add('selected');
    } else if (state.selectedEdge != null && state.g.edges[state.selectedEdge]) {
      const e = state.g.edges[state.selectedEdge];
      focusNodes([e.from, e.to], [state.selectedEdge], 'node');
    }
  }

  function needsRedraw(cw) {
    const td = topDown();
    return td !== (state.flowDir === 'td') || (td && state.layout !== 'paths' && columnsThatFit(cw) !== state.perRow);
  }

  /** The canvas changed size: redraw if the direction or row width must change, otherwise keep the zoom. */
  function onCanvasResize() {
    if (!state.g || !svg) return;
    const { cw, ch } = drawingArea();
    if (!(cw > 0 && ch > 0)) return;
    if (needsRedraw(cw)) {
      render();
      restoreHighlight();
      resetView(true);
      return;
    }
    const prev = state.box;
    if (prev && Math.abs(prev.cw - cw) < 1 && Math.abs(prev.ch - ch) < 1) return;
    if (state.fitted || !prev) { resetView(true); return; }
    if (state.raf) { cancelAnimationFrame(state.raf); state.raf = null; }
    const perPx = state.target.w / prev.cw;
    state.target = { x: state.target.x, y: state.target.y, w: perPx * cw, h: perPx * ch };
    state.view = Object.assign({}, state.target);
    state.box = { cw, ch };
    applyView();
  }

  function setLayout(layout) {
    if (!state.g) return;
    state.layout = layout === 'paths' ? 'paths' : 'layers';
    try { localStorage.setItem('gs.arch.layout', JSON.stringify(state.layout)); } catch (e) { /* ignore */ }
    const flow = state.flow, sel = state.selected, edge = state.selectedEdge;
    render();
    resetView(true);
    if (flow >= 0) startFlowAt(flow);
    else if (sel) selectNode(sel);
    else if (edge != null) selectEdge(edge);
  }

  function setExpanded(on) {
    if (!modal) return;
    const next = typeof on === 'boolean' ? on : !modal.classList.contains('expanded');
    modal.classList.toggle('expanded', next);
    document.body.classList.toggle('arch-expanded', next);
    document.querySelectorAll('#arch-toolbar [data-act="expand"], #arch-menu [data-act="expand"]').forEach((btn) => {
      btn.classList.toggle('on', next);
      btn.title = next ? 'Exit full screen (Esc)' : 'Expand canvas to full screen (E · Esc to exit)';
      btn.setAttribute('aria-label', next ? 'Exit full screen' : 'Expand canvas');
      const icon = btn.querySelector('.tb-expand-icon');
      if (icon) icon.textContent = next ? '⤡' : '⤢';
      const text = btn.querySelector('.tb-expand-label');
      if (text) text.textContent = next ? 'Exit full screen' : 'Full screen';
    });
    requestAnimationFrame(() => resetView(true));
  }

  function svgPoint(event) {
    return svgPointAt(event.clientX, event.clientY);
  }

  function svgPointAt(clientX, clientY) {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = svg.getScreenCTM();
    return matrix ? point.matrixTransform(matrix.inverse()) : { x: state.W / 2, y: state.H / 2 };
  }

  /** Move the map by a distance in screen pixels. */
  function panBy(dx, dy) {
    const { cw, ch } = drawingArea();
    if (!(cw > 0 && ch > 0)) return;
    const perPx = Math.max(state.target.w / cw, state.target.h / ch);
    state.target.x -= dx * perPx;
    state.target.y -= dy * perPx;
    state.fitted = false;
    animateView(32);
  }

  function applyView() {
    svg.setAttribute('viewBox', `${state.view.x} ${state.view.y} ${state.view.w} ${state.view.h}`);
    const v = state.view;
    const right = v.x + v.w < state.W - 4, below = v.y + v.h < state.H - 4;
    const canvas = svg.parentElement;
    let hint = canvas.querySelector('.arch-more');
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'arch-more';
      canvas.appendChild(hint);
    }
    hint.textContent = right ? 'Drag to see more →' : 'Drag up to see more ↓';
    hint.classList.toggle('on', right || below);
    const label = byId('arch-zoom');
    if (label) label.textContent = Math.round((state.W / state.view.w) * 100) + '%';
  }

  function animateView(rate = 80) {
    state.smooth = rate;
    if (state.raf) return;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(56, now - last);
      last = now;
      const k = 1 - Math.exp(-dt / state.smooth);
      const v = state.view;
      const t = state.target;
      v.x += (t.x - v.x) * k;
      v.y += (t.y - v.y) * k;
      v.w += (t.w - v.w) * k;
      v.h += (t.h - v.h) * k;
      const settled = Math.abs(t.x - v.x) < 0.08 && Math.abs(t.y - v.y) < 0.08
        && Math.abs(t.w - v.w) < 0.08 && Math.abs(t.h - v.h) < 0.08;
      if (settled) {
        v.x = t.x; v.y = t.y; v.w = t.w; v.h = t.h;
        applyView();
        state.raf = null;
        return;
      }
      applyView();
      state.raf = requestAnimationFrame(tick);
    };
    state.raf = requestAnimationFrame(tick);
  }

  // below this zoom the canvas text becomes hard to read, so large maps open partly visible instead
  const MIN_READABLE_SCALE = 0.9;

  function drawingArea() {
    const r = svg.getBoundingClientRect();
    const cs = getComputedStyle(svg);
    return {
      cw: r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      ch: r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
    };
  }

  /** A view box with the canvas's shape that shows the whole w × h area, centered. */
  function centeredBox(w, h, aspect) {
    if (w / h > aspect) { const bh = w / aspect; return { x: 0, y: (h - bh) / 2, w, h: bh }; }
    const bw = h * aspect;
    return { x: (w - bw) / 2, y: 0, w: bw, h };
  }

  /**
   * Top → down: fill the width, starting at the top. Left → right: fit the whole map when it stays readable
   * or the screen is a phone; otherwise open at a readable zoom from the top-left.
   */
  function resetView(immediate = false) {
    const { cw, ch } = drawingArea();
    let box = { x: 0, y: 0, w: state.W, h: state.H };
    if (cw > 0 && ch > 0) {
      const aspect = cw / ch;
      if (state.flowDir === 'td') {
        const h = state.W / aspect;
        box = { x: 0, y: h > state.H ? (state.H - h) / 2 : 0, w: state.W, h };
      } else if (Math.min(cw / state.W, ch / state.H) >= MIN_READABLE_SCALE || Math.min(window.innerWidth, window.innerHeight) <= 520) {
        box = centeredBox(state.W, state.H, aspect);
      } else {
        box = { x: 0, y: 0, w: cw / MIN_READABLE_SCALE, h: ch / MIN_READABLE_SCALE };
      }
      state.box = { cw, ch };
    }
    state.target = box;
    state.fitted = true;
    if (immediate) {
      if (state.raf) { cancelAnimationFrame(state.raf); state.raf = null; }
      state.view = Object.assign({}, box);
      applyView();
      return;
    }
    animateView(90);
  }

  function zoomAt(factor, anchor) {
    state.fitted = false;
    const base = state.target;
    const minW = state.W * 0.35;
    const maxW = state.W * 1.9;
    const nextW = Math.max(minW, Math.min(maxW, base.w * factor));
    const ratio = nextW / base.w;
    const nextH = base.h * ratio;
    state.target = {
      x: anchor.x - (anchor.x - base.x) * ratio,
      y: anchor.y - (anchor.y - base.y) * ratio,
      w: nextW,
      h: nextH
    };
    animateView(70);
  }

  function zoom(factor, point) {
    const base = state.target;
    const anchor = {
      x: base.x + (point.x - state.view.x) * (base.w / state.view.w),
      y: base.y + (point.y - state.view.y) * (base.h / state.view.h)
    };
    zoomAt(factor, anchor);
  }

  function zoomCenter(factor) {
    const base = state.target;
    zoomAt(factor, { x: base.x + base.w / 2, y: base.y + base.h / 2 });
  }

  function showInspector(open) {
    if (!state.inline || !modal) return;
    if (open && typeof DesignStudy !== 'undefined') DesignStudy.notifyInspect();
    if (open && typeof AwsGuide !== 'undefined') AwsGuide.notifyInspect();
    modal.classList.toggle('inspector-open', open);
    const side = modal.querySelector('.arch-side');
    if (side) side.toggleAttribute('inert', !open);
    const btn = byId('arch-inspector');
    if (btn) btn.classList.toggle('on', open);
  }

  function toggleInspector(force) {
    if (!state.inline || !modal) return;
    const open = typeof force === 'boolean' ? force : !modal.classList.contains('inspector-open');
    showInspector(open);
  }

  function clearHighlights() {
    if (!svg) return;
    svg.querySelectorAll('[data-node]').forEach((el) => el.classList.remove('dim', 'hot', 'fail', 'warn', 'selected'));
    svg.querySelectorAll('.arch-edge-group, .edge-label-wrap').forEach((el) => el.classList.remove('dim', 'hot', 'fail', 'warn', 'flowing', 'peek'));
    svg.querySelectorAll('.path-row').forEach((el) => el.classList.remove('off'));
  }

  function focusNodes(nodeIds, edgeIndexes, mode) {
    clearHighlights();
    const nodes = new Set(nodeIds);
    const edges = new Set(edgeIndexes);
    svg.querySelectorAll('[data-node]').forEach((el) => {
      const active = nodes.has(el.dataset.node);
      el.classList.toggle('dim', !active);
      if (active) el.classList.add(mode === 'fail' ? 'fail' : 'hot');
    });
    svg.querySelectorAll('.arch-edge-group, .edge-label-wrap').forEach((el) => {
      const active = edges.has(Number(el.dataset.edge));
      el.classList.toggle('dim', !active);
      if (active) el.classList.add(mode === 'fail' ? 'fail' : (mode === 'flow' ? 'flowing' : 'hot'));
      if (active && mode === 'flow') el.classList.add('hot');
    });
  }

  function selectNode(id) {
    stopFlow();
    state.selected = id;
    state.selectedEdge = null;
    const connected = edgesByNode.get(id) || [];
    const nodes = new Set([id]);
    connected.forEach((index) => {
      const edge = state.g.edges[index];
      nodes.add(edge.from);
      nodes.add(edge.to);
    });
    focusNodes(nodes, connected, 'node');
    const el = svg.querySelector(`[data-node="${id}"]`);
    if (el) {
      el.classList.add('selected');
      const [x, y, w, h] = (el.dataset.box || '').split(',').map(Number);
      if (w) revealBox(x, y, w, h);
    }
    setTab('inspect');
    renderInspector();
    showInspector(true);
    emit();
  }

  /** Pan along whichever axis is needed so the area is on screen (e.g. picked from the side panel while off-screen). */
  function revealBox(x, y, w, h) {
    const t = state.target;
    const pad = 12;
    let nx = t.x, ny = t.y;
    if (x < t.x + pad || x + w > t.x + t.w - pad) nx = w > t.w ? x - pad : x + w / 2 - t.w / 2;
    if (y < t.y + pad || y + h > t.y + t.h - pad) ny = h > t.h - pad * 2 ? y - pad * 3 : y + h / 2 - t.h / 2;
    if (nx === t.x && ny === t.y) return;
    state.target = { x: nx, y: ny, w: t.w, h: t.h };
    state.fitted = false;
    animateView(90);
  }

  function selectEdge(index) {
    stopFlow();
    const edge = state.g.edges[index];
    if (!edge) return;
    state.selected = null;
    state.selectedEdge = index;
    focusNodes([edge.from, edge.to], [index], 'node');
    setTab('inspect');
    renderInspector();
    showInspector(true);
    emit();
  }

  function hasFocus() {
    return state.selected != null || state.selectedEdge != null || state.flow >= 0
      || !!(svg && svg.querySelector('.dim'));
  }

  function clearFocus() {
    stopFlow();
    state.selected = null;
    state.selectedEdge = null;
    clearHighlights();
    renderInspector();
    emit();
  }

  /** Highlights a set of nodes (e.g. components the candidate missed). */
  function spotlight(ids) {
    if (!state.g) return;
    stopFlow();
    state.selected = null;
    state.selectedEdge = null;
    const set = new Set(ids);
    clearHighlights();
    svg.querySelectorAll('[data-node]').forEach((el) => {
      const on = set.has(el.dataset.node);
      el.classList.toggle('dim', !on);
      if (on) el.classList.add('warn');
    });
    svg.querySelectorAll('.arch-edge-group, .edge-label-wrap').forEach((el) => el.classList.add('dim'));
    renderInspector();
    emit();
  }

  function getFocus() {
    const g = state.g;
    if (!g) return null;
    if (state.flow >= 0 && g.flow[state.flow]) {
      const step = g.flow[state.flow];
      const hops = step.edges.map(([a, b]) => `${nodeLabel(a)} → ${nodeLabel(b)}`).join('; ');
      return { type: 'flow', index: state.flow, label: step.title, text: `Request path ${state.flow + 1} "${step.title}": ${step.detail} Hops: ${hops}` };
    }
    if (state.selectedEdge != null && g.edges[state.selectedEdge]) {
      const e = g.edges[state.selectedEdge];
      const label = `${nodeLabel(e.from)} → ${nodeLabel(e.to)}`;
      return { type: 'edge', index: state.selectedEdge, label, text: `Connection ${label} (${e.kind}, "${e.label}"): ${e.detail}` };
    }
    if (state.selected != null && nodeMap.get(state.selected)) {
      const n = nodeMap.get(state.selected);
      return { type: 'node', id: n.id, label: n.label, text: `Component "${n.label}" (${n.sub}, ${n.layer} layer): ${n.detail} ${(n.spec || []).join(' ')}` };
    }
    return null;
  }


  function startFlowAt(index) {
    state.selected = null;
    state.selectedEdge = null;
    state.flow = Math.max(0, Math.min(state.g.flow.length - 1, index));
    if (state.layout !== 'paths') {
      state.layout = 'paths';
      try { localStorage.setItem('gs.arch.layout', JSON.stringify('paths')); } catch (e) { /* ignore */ }
      render();
      resetView(true);
    }
    applyFlow();
  }

  function stopFlow() {
    state.flow = -1;
  }

  function applyFlow() {
    const step = state.g.flow[state.flow];
    if (!step) return;
    const edges = step.edges.map(([from, to]) => (
      state.g.edges.findIndex((edge) => edge.from === from && edge.to === to)
    )).filter((index) => index >= 0);
    focusNodes(step.nodes, edges, 'flow');
    svg.querySelectorAll('.path-row').forEach((row) => row.classList.toggle('off', Number(row.dataset.row) !== state.flow));
    const bg = svg.querySelector(`.path-row[data-row="${state.flow}"] .path-row-bg`);
    if (bg) revealBox(+bg.getAttribute('x'), +bg.getAttribute('y'), +bg.getAttribute('width'), +bg.getAttribute('height'));
    setTab('inspect');
    renderInspector();
    showInspector(true);
    emit();
  }

  function setTab(tab) {
    state.tab = tab;
    if (!panel) return;
    panel.parentElement.querySelectorAll('[data-atab]').forEach((el) => {
      el.classList.toggle('on', el.dataset.atab === tab);
    });
    if (tab === 'inspect') renderInspector();
    else renderInspector();
  }

  function listHTML(items) {
    return `<ul class="arch-list">${(items || []).map((item) => `<li>${link(item)}</li>`).join('')}</ul>`;
  }

  /** What goes wrong without this component, and what happens if it breaks. Map-specific text wins. */
  function riskFor(node) {
    const c = typeof ConceptLib !== 'undefined' ? ConceptLib.forNode(node) : null;
    const specific = (state.g.failures || []).find((f) => f.nodes.includes(node.id));
    if (!c || (!c.without && !specific)) return null;
    return {
      without: c.without || '',
      breaks: specific ? specific.detail : c.breaks || '',
      protect: specific ? specific.mitigation : c.protect || '',
      hits: specific ? (specific.affected || []).map(nodeLabel) : []
    };
  }

  function riskHTML(node, compact) {
    const r = riskFor(node);
    if (!r) return '';
    return `<div class="risk${compact ? ' compact' : ''}">
      ${r.without ? `<div class="risk-row without"><span>Without it</span><p>${link(r.without)}</p></div>` : ''}
      ${r.breaks ? `<div class="risk-row breaks"><span>If it breaks</span><p>${link(r.breaks)}</p>
        ${!compact && r.hits.length ? `<p class="risk-hits">Hit hardest: ${esc(r.hits.join(', '))}</p>` : ''}
        ${r.protect ? `<p class="risk-protect"><b>Protect it:</b> ${link(r.protect)}</p>` : ''}</div>` : ''}
    </div>`;
  }

  /** The general building-block lesson behind a component: what, why, trade-offs, who uses it. */
  function conceptCard(c) {
    return `<div class="concept-card">
      <div class="concept-head"><span class="concept-kicker">CONCEPT</span><b>${esc(c.name)}</b></div>
      <div class="concept-row"><span>What it does</span><p>${esc(c.what)}</p></div>
      <div class="concept-row"><span>Why it is used</span><p>${esc(c.why)}</p></div>
      ${(c.tradeoffs || []).length ? `<div class="concept-row"><span>Trade-offs</span><ul>${c.tradeoffs.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      ${(c.usedBy || []).length ? `<div class="concept-row"><span>Used by</span><div class="used-by">${c.usedBy.map((u) => `<i>${esc(u)}</i>`).join('')}</div></div>` : ''}
      ${c.alt && c.alt !== '—' ? `<div class="concept-row"><span>Alternative</span><p>${esc(c.alt)}</p></div>` : ''}
    </div>`;
  }

  const askBtn = (label, question) => `<button class="btn tiny ask-ai-btn" data-ask="${esc(question)}" type="button">✦ ${esc(label)}</button>`;

  function hopRow(edgeIndex, n) {
    const edge = state.g.edges[edgeIndex];
    if (!edge) return '';
    return `<li class="hop ${edge.kind}" data-go="edge:${edgeIndex}">
      <span class="hop-n">${n}</span>
      <span class="hop-body"><b>${esc(nodeLabel(edge.from))} → ${esc(nodeLabel(edge.to))}</b>
      <span class="hop-kind">${esc(edge.kind)} · ${esc(edge.label)}</span>
      <span class="hop-detail">${link(edge.detail || '')}</span></span>
    </li>`;
  }

  function renderInspector() {
    const graph = state.g;
    if (!graph || !panel) return;

    if (state.tab === 'why') {
      panel.innerHTML = `<div class="arch-panel-kicker">WHY IT WORKS</div>
        <h4>${esc(graph.title)}</h4>
        <p class="arch-panel-sub">${esc(graph.subtitle)}</p>
        ${listHTML(graph.why)}
        ${askBtn('Explain why this design works', `Explain in plain language why the ${graph.title} design works. Which requirement forces each key choice?`)}`;
      return;
    }
    if (state.tab === 'tradeoffs') {
      panel.innerHTML = `<div class="arch-panel-kicker">TRADE-OFFS</div>
        <h4>What you give up</h4>
        ${listHTML(graph.tradeoffs)}
        <div class="arch-hint">Strong answers name the trade-off and the condition under which they would choose the other side.</div>
        ${askBtn('Compare the options in a table', `For the ${graph.title} design, compare the main trade-offs in a small table: option, benefit, cost, when to choose it.`)}`;
      return;
    }

    if (state.flow >= 0) {
      const step = graph.flow[state.flow];
      const edges = step.edges.map(([from, to]) => graph.edges.findIndex((e) => e.from === from && e.to === to)).filter((i) => i >= 0);
      panel.innerHTML = `<div class="arch-panel-kicker">${step.kind === 'write' ? '<span class="rw-pill rw-write">WRITE PATH</span>' : step.kind === 'read' ? '<span class="rw-pill rw-read">READ PATH</span>' : ''}USER ACTION ${state.flow + 1}/${graph.flow.length}</div>
        <h4>${esc(step.title)}</h4>
        <p class="arch-panel-sub">${link(step.detail)}</p>
        <div class="arch-section-h">Hop by hop</div>
        <ol class="hop-list">${edges.map((i, n) => hopRow(i, n + 1)).join('')}</ol>
        ${askBtn('Walk me through this action', `Walk me through the "${step.title}" user action of ${graph.title} hop by hop. For each hop, say why it is sync or async and what latency it adds.`)}
        <div class="arch-hint">Click a hop to inspect it · click empty canvas to clear.</div>`;
      return;
    }

    if (state.selectedEdge != null) {
      const edge = graph.edges[state.selectedEdge];
      panel.innerHTML = `<div class="arch-panel-kicker">CONNECTION · ${esc(edge.kind.toUpperCase())}</div>
        <h4><button class="linklike" data-go="node:${esc(edge.from)}">${esc(nodeLabel(edge.from))}</button> → <button class="linklike" data-go="node:${esc(edge.to)}">${esc(nodeLabel(edge.to))}</button></h4>
        <p class="arch-panel-body">${link(edge.detail || '')}</p>
        <div class="arch-defs">
          <div><span>Carries</span><b>${esc(edge.label)}</b></div>
          <div><span>Type</span><b>${esc(edge.kind)}</b></div>
        </div>
        <div class="arch-panel-block"><span>What ${esc(edge.kind)} means</span><p>${esc(KIND_MEANING[edge.kind] || '')}</p></div>
        ${askBtn(`Why is this ${edge.kind}?`, `In ${graph.title}, why is the ${nodeLabel(edge.from)} → ${nodeLabel(edge.to)} connection ${edge.kind}? What would break or slow down if it were the other way?`)}`;
      return;
    }

    if (state.selected != null) {
      const node = nodeMap.get(state.selected);
      if (!node) return;
      const color = node.color || colorFor(node.layer);
      const awsCard = node.svc && typeof AwsGuide !== 'undefined' ? AwsGuide.serviceCard(node.svc) : '';
      const all = edgesByNode.get(node.id) || [];
      const out = all.filter((i) => graph.edges[i].from === node.id);
      const inc = all.filter((i) => graph.edges[i].to === node.id);
      const connRow = (i, dir) => {
        const e = graph.edges[i];
        const other = dir === 'out' ? e.to : e.from;
        return `<li data-go="edge:${i}"><span class="conn-dir">${dir === 'out' ? '→' : '←'}</span><b>${esc(nodeLabel(other))}</b><span class="hop-kind">${esc(e.kind)} · ${esc(e.label)}</span></li>`;
      };
      const flows = graph.flow.map((f, i) => (f.nodes.includes(node.id) ? i : -1)).filter((i) => i >= 0);
      const concept = !awsCard && typeof ConceptLib !== 'undefined' ? ConceptLib.forNode(node) : null;
      const shape = shapeOf(node);
      panel.innerHTML = `<div class="arch-panel-kicker" style="color:${color}">${esc(node.badge || SHAPE_BADGE[shape] || '')} · ${esc(node.layer.toUpperCase())} LAYER</div>
        <h4>${esc(node.label)}</h4>
        <p class="arch-panel-sub">${esc(node.sub)}</p>
        <div class="arch-section-h">In this design</div>
        <p class="arch-panel-body">${link(node.detail)}</p>
        ${listHTML(node.spec)}
        ${awsCard ? `<div class="arch-section-h">The service</div>${awsCard}` : riskHTML(node, false)}
        ${concept ? conceptCard(concept) : ''}
        ${out.length ? `<div class="arch-section-h">Sends to</div><ul class="conn-list">${out.map((i) => connRow(i, 'out')).join('')}</ul>` : ''}
        ${inc.length ? `<div class="arch-section-h">Receives from</div><ul class="conn-list">${inc.map((i) => connRow(i, 'in')).join('')}</ul>` : ''}
        ${flows.length ? `<div class="arch-section-h">Used in user actions</div><div class="arch-tags">${flows.map((i) => `<button class="arch-tag" data-go="flow:${i}">${i + 1}. ${esc(graph.flow[i].title)}</button>`).join('')}</div>` : ''}
        <div class="ask-row">
          ${graph.aws ? askBtn('Why this service here?', `In the AWS architecture "${graph.title}", why is ${node.label} the right choice for "${node.sub}"? What would I use instead, and in which situation?`)
            : askBtn('Why is this here?', `In ${graph.title}, what problem does the ${node.label} (${node.sub}) solve, and what would go wrong without it?`)}
          ${graph.aws ? askBtn('When not to use it?', `When should I NOT use ${node.label} on AWS? Give 3 concrete situations and the AWS service I should pick instead for each.`)
            : askBtn('Alternatives?', `What are the alternatives to the ${node.label} (${node.sub}) in ${graph.title}, and when would I pick each one?`)}
        </div>`;
      return;
    }

    panel.innerHTML = `<div class="arch-panel-kicker">OVERVIEW</div>
      <h4>${esc(graph.title)}</h4>
      <p class="arch-panel-sub">${esc(graph.subtitle)}</p>
      <div class="arch-stats">
        <div><b>${graph.nodes.length}</b><span>components</span></div>
        <div><b>${graph.flow.length}</b><span>user actions</span></div>
      </div>
      ${['write', 'read', 'background'].map((k) => {
        const items = graph.flow.map((f, i) => ({ f, i })).filter(({ f }) => f.kind === k);
        const head = k === 'background' ? '<span class="rw-pill rw-bg">BEHIND THE SCENES</span>' : `<span class="rw-pill rw-${k}">${k === 'write' ? 'WRITE PATH' : 'READ PATH'}</span>`;
        return items.length ? `<div class="arch-section-h">${head}</div>
          <div class="arch-tags">${items.map(({ f, i }) => `<button class="arch-tag" data-go="flow:${i}">${esc(f.title)}</button>`).join('')}</div>` : '';
      }).join('')}
      ${graph.basedOn ? `<div class="arch-based">
        <div class="arch-section-h">Based on</div>
        <p>${esc(graph.basedOn)}</p>
        ${graph.sources.length ? `<ul>${graph.sources.map(([label, url]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a></li>`).join('')}</ul>` : ''}
      </div>` : ''}
      <ol class="read-steps">
        ${state.flowDir === 'td'
          ? '<li><b>Rows are layers.</b> Requests enter at the top (client) and go deeper as you move down (services, queues, data).</li>'
          : '<li><b>Columns are layers.</b> Requests enter on the left (client) and go deeper to the right (services, queues, data).</li>'}
        <li><b>Arrows are connections.</b> Solid blue = the caller waits (sync). Dashed amber = handed off to a queue (async). Mint = the answer going back to the user.</li>
        <li><b>Switch to User actions</b> to see each thing a user does on its own, hop by hop. Click its title to highlight it.</li>
        <li><b>Change the direction</b> in the ⚙ settings: left → right, top → down, or Auto (follows how you hold the screen).</li>
        ${graph.aws
          ? '<li><b>Box colors are AWS categories</b> (compute, storage, database, AI…). <b>Click any box</b> to see what the service is, when to use it, what to pick instead, and how you pay.</li>'
          : '<li><b>Click any box</b> to see what it does, what goes wrong without it, and what happens if it breaks.</li>'}
      </ol>
      <div class="arch-hint">Scroll or pinch to zoom · drag to pan · tap empty canvas to clear.</div>`;
  }

  init();

  return {
    open,
    close,
    toggleInspector,
    selectNode,
    selectEdge,
    startFlowAt,
    clearFocus,
    spotlight,
    getFocus,
    getGraph: () => state.g,
    setLayout,
    setRoute,
    /** Re-place labels and re-fit once the canvas is actually visible. */
    relayout: () => {
      if (!state.g || !svg || !svg.getBoundingClientRect().width) return;
      if (needsRedraw()) { render(); restoreHighlight(); } else declutterLabels();
      applyLegend();
      resetView(true);
    },
    setExpanded,
    conceptCard,
    shapeIcon,
    shapeOf,
    layout: () => state.layout,
    currentId: () => state.id,
    isInline: () => !!state.inline,
    onChange: (fn) => listeners.push(fn),
    has: (id) => !!DESIGN_GRAPHS[id]
  };
})();
