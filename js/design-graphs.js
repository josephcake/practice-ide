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
    Consumers: '#7ab8ff', Provider: '#d99bff', Event: '#2dd4bf'
  };
  const NH = 62, TOP = 96, LEFT = 40;

  const state = {
    id: null, g: null, selected: null, selectedEdge: null,
    tab: 'inspect', view: { x: 0, y: 0, w: 1, h: 1 }, target: { x: 0, y: 0, w: 1, h: 1 }, W: 1, H: 1,
    flow: -1, timer: null, panning: false, last: null, inline: false,
    raf: null, smooth: 80,
    layout: (() => { try { return JSON.parse(localStorage.getItem('gs.arch.layout')) === 'paths' ? 'paths' : 'layers'; } catch (e) { return 'layers'; } })(),
    route: (() => { try { return JSON.parse(localStorage.getItem('gs.arch.route')) === 'ortho' ? 'ortho' : 'curved'; } catch (e) { return 'curved'; } })()
  };

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const cut = (value, n) => {
    const text = String(value == null ? '' : value);
    return text.length > n ? text.slice(0, n - 1) + '…' : text;
  };
  const colorFor = (layer) => COLORS[layer] || '#9aa8bd';

  let modal, svg, panel, legend;
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
    byId('arch-reset').addEventListener('click', () => resetView());
    const inspBtn = byId('arch-inspector');
    if (inspBtn) inspBtn.addEventListener('click', () => toggleInspector());
    const sideClose = byId('arch-side-close');
    if (sideClose) sideClose.addEventListener('click', () => showInspector(false));
    const layoutSeg = byId('arch-layout');
    if (layoutSeg) layoutSeg.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-layout]');
      if (btn) setLayout(btn.dataset.layout);
    });
    const routeSeg = byId('arch-route');
    if (routeSeg) routeSeg.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-route]');
      if (btn) setRoute(btn.dataset.route);
    });
    const expandBtn = byId('arch-expand');
    if (expandBtn) expandBtn.addEventListener('click', () => setExpanded());

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
      const down = state.downAt;
      const dragged = down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4;
      if (!dragged && hasFocus()) clearFocus();
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

    svg.addEventListener('pointerdown', (event) => {
      state.downAt = { x: event.clientX, y: event.clientY };
      if (event.target.closest('[data-node]') || event.target.closest('[data-edge]')) return;
      state.panning = true;
      state.last = { x: event.clientX, y: event.clientY };
      svg.classList.add('dragging');
      try { svg.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }
    });
    svg.addEventListener('pointermove', (event) => {
      if (!state.panning || !state.last) return;
      const rect = svg.getBoundingClientRect();
      const dx = (event.clientX - state.last.x) * state.target.w / rect.width;
      const dy = (event.clientY - state.last.y) * state.target.h / rect.height;
      state.target.x -= dx;
      state.target.y -= dy;
      state.last = { x: event.clientX, y: event.clientY };
      animateView(32);
    });
    const endPan = () => { state.panning = false; state.last = null; svg.classList.remove('dragging'); };
    svg.addEventListener('pointerup', endPan);
    svg.addEventListener('pointercancel', endPan);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
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
    buildLegend();
    render();
    resetView(true);
    setTab('inspect');
    showInspector(false);
    modal.classList.toggle('inline', inline);
    modal.classList.toggle('on', !inline);
    document.body.classList.toggle('modal-open', !inline);
    if (!inline) byId('arch-close').focus();
    emit();
  }

  function close() {
    if (!modal) return;
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
    const colw = count >= 7 ? 216 : 224;
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
    const { positions, W, H, nw, nh, labelMax, subMax, colw } = layout();
    state.W = W;
    state.H = H;

    const defs = svgDefs();

    const layers = graph.layers.map((layer, i) => {
      const x = LEFT + i * colw + nw / 2;
      return `<text class="arch-layer" x="${x}" y="38" text-anchor="middle" fill="${colorFor(layer)}">${esc(layer.toUpperCase())}</text>
        <line x1="${x}" y1="52" x2="${x}" y2="${H - 22}" stroke="${colorFor(layer)}" stroke-opacity=".14"></line>`;
    }).join('');

    const labelMarkup = [];
    const edgeMarkup = graph.edges.map((edge, index) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) return '';
      const x1 = from.x + nw, y1 = from.y + nh / 2;
      const x2 = to.x, y2 = to.y + nh / 2;
      const forward = x2 >= x1;
      const route = layerRoute(x1, y1, x2, y2, forward, index, nh);
      const d = route.d;
      const targetNode = nodeMap.get(edge.to);
      const isReturn = !!(targetNode && (targetNode.layer === 'Client' || targetNode.layer === 'Consumers' || targetNode.id === 'recipient' || targetNode.id === 'user'));
      const labelX = route.lx;
      const labelY = route.ly;
      if (edge.kind !== 'obs') {
        labelMarkup.push(`<g class="edge-label-wrap ${edge.kind}${isReturn ? ' return' : ''}" data-edge="${index}"><text class="arch-edge-label ${edge.kind}" x="${labelX}" y="${labelY}" text-anchor="middle">${esc(edge.label)}</text></g>`);
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

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
    svg.innerHTML = defs + layers + edgeMarkup + nodeMarkup + `<g class="edge-labels">${labelMarkup.join('')}</g>`;
    clearHighlights();
  }

  const SHAPE_BADGE = { client: 'USER', edge: 'EDGE', service: 'SERVICE', queue: 'QUEUE', db: 'DATABASE', cache: 'CACHE', external: 'EXTERNAL', obs: 'MONITOR' };

  function shapeOf(node) {
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
    const c = typeof ConceptLib !== 'undefined' ? ConceptLib.forNode(node) : null;
    if (c && c.id === 'lb') return 'LOAD BALANCER';
    if (c && c.id === 'cdn') return 'CDN';
    if (c && c.id === 'websocket') return 'REAL-TIME';
    if (c && c.id === 'waitingroom') return 'WAITING ROOM';
    if (node.layer === 'Gateway') return 'GATEWAY';
    return SHAPE_BADGE[shape] || '';
  }

  function nodeShape(node, x, y, nw, nh, labelMax, subMax) {
    const color = colorFor(node.layer);
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
    const flow = state.flow, sel = state.selected, edge = state.selectedEdge;
    render();
    if (flow >= 0) startFlowAt(flow);
    else if (sel) selectNode(sel);
    else if (edge != null) selectEdge(edge);
  }

  function isReturnEdge(edge) {
    const t = nodeMap.get(edge.to);
    return !!(t && (t.layer === 'Client' || t.layer === 'Consumers'));
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
        <text class="path-row-title" x="${left - 12}" y="${y0 + 12}" data-flow-title="${r}">${step.kind && step.kind !== 'background' ? `<tspan class="rw-tag rw-${step.kind}">${step.kind === 'write' ? 'WRITE PATH' : 'READ PATH'}</tspan><tspan dx="8">` : '<tspan>'}${r + 1}. ${esc(step.title)}</tspan></text>
        ${edgesSvg}${nodesSvg}<g class="edge-labels">${labelsSvg}</g>
      </g>`;
    });

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
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
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const placed = [];
    svg.querySelectorAll('.edge-label-wrap').forEach((wrap) => {
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
        if (!boxes.some((o) => hit(o, box)) && !placed.some((o) => hit(o, box))) {
          placed.push(box);
          free = true;
          break;
        }
      }
      if (!free) { t.setAttribute('x', x0); t.setAttribute('y', y0); }
      wrap.classList.toggle('crowded', !free);
    });
  }

  function render() {
    if (state.layout === 'paths') renderPathView();
    else renderSVG();
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    declutterLabels();
    bindPulses();
    const seg = byId('arch-layout');
    if (seg) seg.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
    const routeSeg = byId('arch-route');
    if (routeSeg) routeSeg.querySelectorAll('[data-route]').forEach((b) => b.classList.toggle('on', b.dataset.route === state.route));
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
    const btn = byId('arch-expand');
    if (btn) {
      btn.classList.toggle('on', next);
      btn.textContent = next ? '⤡' : '⤢';
      btn.title = next ? 'Exit full screen (Esc)' : 'Expand canvas to full screen (E · Esc to exit)';
      btn.setAttribute('aria-label', next ? 'Exit full screen' : 'Expand canvas');
    }
    requestAnimationFrame(() => resetView(true));
  }

  function svgPoint(event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    return matrix ? point.matrixTransform(matrix.inverse()) : { x: state.W / 2, y: state.H / 2 };
  }

  function applyView() {
    svg.setAttribute('viewBox', `${state.view.x} ${state.view.y} ${state.view.w} ${state.view.h}`);
    const v = state.view;
    const more = v.x + v.w < state.W - 4 || v.y + v.h < state.H - 4;
    const canvas = svg.parentElement;
    let hint = canvas.querySelector('.arch-more');
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'arch-more';
      hint.textContent = 'Drag to see more →';
      canvas.appendChild(hint);
    }
    hint.classList.toggle('on', more);
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

  /** Fit the whole map if it stays readable; otherwise open at a readable zoom from the top-left. */
  function resetView(immediate = false) {
    let w = state.W, h = state.H;
    const { cw, ch } = drawingArea();
    if (cw > 0 && ch > 0 && Math.min(cw / w, ch / h) < MIN_READABLE_SCALE) {
      w = cw / MIN_READABLE_SCALE;
      h = ch / MIN_READABLE_SCALE;
    }
    state.target = { x: 0, y: 0, w, h };
    if (immediate) {
      state.view = { x: 0, y: 0, w, h };
      applyView();
      return;
    }
    animateView(90);
  }

  function zoomAt(factor, anchor) {
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
    if (el) el.classList.add('selected');
    setTab('inspect');
    renderInspector();
    showInspector(true);
    emit();
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
      const color = colorFor(node.layer);
      const all = edgesByNode.get(node.id) || [];
      const out = all.filter((i) => graph.edges[i].from === node.id);
      const inc = all.filter((i) => graph.edges[i].to === node.id);
      const connRow = (i, dir) => {
        const e = graph.edges[i];
        const other = dir === 'out' ? e.to : e.from;
        return `<li data-go="edge:${i}"><span class="conn-dir">${dir === 'out' ? '→' : '←'}</span><b>${esc(nodeLabel(other))}</b><span class="hop-kind">${esc(e.kind)} · ${esc(e.label)}</span></li>`;
      };
      const flows = graph.flow.map((f, i) => (f.nodes.includes(node.id) ? i : -1)).filter((i) => i >= 0);
      const concept = typeof ConceptLib !== 'undefined' ? ConceptLib.forNode(node) : null;
      const shape = shapeOf(node);
      panel.innerHTML = `<div class="arch-panel-kicker" style="color:${color}">${esc(SHAPE_BADGE[shape] || '')} · ${esc(node.layer.toUpperCase())} LAYER</div>
        <h4>${esc(node.label)}</h4>
        <p class="arch-panel-sub">${esc(node.sub)}</p>
        <div class="arch-section-h">In this design</div>
        <p class="arch-panel-body">${link(node.detail)}</p>
        ${listHTML(node.spec)}
        ${riskHTML(node, false)}
        ${concept ? conceptCard(concept) : ''}
        ${out.length ? `<div class="arch-section-h">Sends to</div><ul class="conn-list">${out.map((i) => connRow(i, 'out')).join('')}</ul>` : ''}
        ${inc.length ? `<div class="arch-section-h">Receives from</div><ul class="conn-list">${inc.map((i) => connRow(i, 'in')).join('')}</ul>` : ''}
        ${flows.length ? `<div class="arch-section-h">Used in user actions</div><div class="arch-tags">${flows.map((i) => `<button class="arch-tag" data-go="flow:${i}">${i + 1}. ${esc(graph.flow[i].title)}</button>`).join('')}</div>` : ''}
        <div class="ask-row">
          ${askBtn('Why is this here?', `In ${graph.title}, what problem does the ${node.label} (${node.sub}) solve, and what would go wrong without it?`)}
          ${askBtn('Alternatives?', `What are the alternatives to the ${node.label} (${node.sub}) in ${graph.title}, and when would I pick each one?`)}
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
      ${['write', 'read'].map((k) => {
        const items = graph.flow.map((f, i) => ({ f, i })).filter(({ f }) => f.kind === k);
        return items.length ? `<div class="arch-section-h"><span class="rw-pill rw-${k}">${k === 'write' ? 'WRITE PATH' : 'READ PATH'}</span></div>
          <div class="arch-tags">${items.map(({ f, i }) => `<button class="arch-tag" data-go="flow:${i}">${esc(f.title)}</button>`).join('')}</div>` : '';
      }).join('')}
      <ol class="read-steps">
        <li><b>Columns are layers.</b> Requests enter on the left (client) and go deeper to the right (services, queues, data).</li>
        <li><b>Arrows are connections.</b> Solid blue = the caller waits (sync). Dashed amber = handed off to a queue (async). Mint = the answer going back to the user.</li>
        <li><b>Switch to User actions</b> to see each thing a user does as its own row, hop by hop. Click a row title to highlight it.</li>
        <li><b>Click any box</b> to see what it does, what goes wrong without it, and what happens if it breaks.</li>
      </ol>
      <div class="arch-hint">Scroll to zoom · drag to pan · click empty canvas to clear.</div>`;
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
    relayout: () => { if (state.g && svg && svg.getBoundingClientRect().width) { declutterLabels(); resetView(true); } },
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
