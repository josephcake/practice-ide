/* ============================================================
   SYSTEM DESIGN CATALOG
   Every design question is registered here with its brief; its
   architecture map comes from DESIGN_MAPS (js/design-maps-*.js).
   Both are expanded into DESIGN_QUESTIONS / DESIGN_GRAPHS / DESIGN_BRIEFS.

   nodes:    [id, label, sub, layer, detail, [spec...]]
   edges:    [from, to, label, kind, detail]      kind: sync | async | obs
   flow:     [title, detail, 'a>b, b>c, ...', kind]  kind: read | write | background
   failures: [label, 'failed ids', 'affected ids', detail, mitigation]
   ============================================================ */

const DIFFICULTY = {
  easy: { level: 1, label: 'Easy' },
  medium: { level: 2, label: 'Medium' },
  hard: { level: 3, label: 'Hard' }
};

/** Read path, write path, or background work, guessed from an action's wording when a map does not say. */
const DesignInfra = (() => {
  function kindOf(id, title) {
    const t = title.toLowerCase();
    if (/^(open|read|load|search|view|watch|browse|get|see|show|pan|find|join|receive|consume|keep watching|check|list|look up)\b/.test(t)) return 'read';
    if (/^(create|post|upload|write|send|place|submit|save|swipe|hold|buy|charge|transfer|publish|emit|ingest|record|type|edit|schedule|count|click|report|accept|request)\b/.test(t)) return 'write';
    return 'background';
  }

  return { kindOf };
})();

const DesignCatalog = (() => {
  const list = [];
  const ids = (text) => String(text || '').split(/\s+/).filter(Boolean);

  function expandMap(id, m) {
    const nodes = m.nodes.map(([id, label, sub, layer, detail, spec]) => ({ id, label, sub, layer, detail, spec: spec || [] }));
    const edges = [];
    m.edges.forEach(([from, to, label, kind, detail]) => {
      const same = edges.find((e) => e.from === from && e.to === to);
      if (!same) return edges.push({ from, to, label, kind, detail });
      if (same.label !== label) same.label += ' · ' + label;
      if (detail && same.detail !== detail) same.detail += ' ' + detail;
    });
    const flow = m.flow.map(([title, detail, hops, kind]) => {
      const pairs = hops.split(',').map((h) => h.trim()).filter(Boolean).map((h) => h.split('>').map((x) => x.trim()));
      const seen = [];
      pairs.forEach(([a, b]) => { if (!seen.includes(a)) seen.push(a); if (!seen.includes(b)) seen.push(b); });
      return { title, detail, nodes: seen, edges: pairs, kind: kind || DesignInfra.kindOf(id, title) };
    });
    const failures = (m.failures || []).map(([label, failed, affected, detail, mitigation]) => ({
      label, nodes: ids(failed), affected: ids(affected), detail, mitigation
    }));
    const used = new Set(nodes.map((n) => n.layer));
    const layers = (m.layers || ['Client', 'Edge', 'Gateway', 'Service', 'Async', 'Data', 'Obs']).filter((l) => used.has(l));
    return { title: m.title, subtitle: m.subtitle, layers, nodes, edges, flow, why: m.why, tradeoffs: m.tradeoffs, failures, basedOn: m.basedOn, sources: m.sources || [] };
  }

  function add(q) {
    list.push(q);
  }

  /** Expands every registered question into the globals the app reads. */
  function install() {
    const order = { easy: 0, medium: 1, hard: 2 };
    list.forEach((q, i) => { q.order = i; });
    list.sort((a, b) => order[a.difficulty] - order[b.difficulty] || a.order - b.order);
    list.forEach((q) => {
      const d = DIFFICULTY[q.difficulty];
      DESIGN_QUESTIONS.push({
        id: q.id,
        level: d.level,
        difficulty: q.difficulty,
        cat: q.cat,
        title: q.title,
        prompt: q.prompt,
        hints: q.hints,
        topics: q.topics
      });
      const title = q.title.replace(/^Design (an? )?/, '');
      const researched = typeof DESIGN_MAPS !== 'undefined' && DESIGN_MAPS[q.id];
      if (researched) DESIGN_GRAPHS[q.id] = expandMap(q.id, Object.assign({ title }, researched));
      if (q.brief) DESIGN_BRIEFS[q.id] = q.brief;
    });
  }

  return { add, install, all: () => list.slice() };
})();
