/* ============================================================
   SYSTEM DESIGN CATALOG
   Every design question is registered here with its brief and its
   architecture map in a compact form, then expanded into
   DESIGN_QUESTIONS / DESIGN_GRAPHS / DESIGN_BRIEFS.

   map.nodes:    [id, label, sub, layer, detail, [spec...]]
   map.edges:    [from, to, label, kind, detail]      kind: sync | async | obs
   map.flow:     [title, detail, 'a>b, b>c, ...']      a user action, hop by hop
   map.failures: [label, 'failed ids', 'affected ids', detail, mitigation]
   ============================================================ */

const DIFFICULTY = {
  easy: { level: 1, label: 'Easy' },
  medium: { level: 2, label: 'Medium' },
  hard: { level: 3, label: 'Hard' }
};

const DesignCatalog = (() => {
  const list = [];
  const ids = (text) => String(text || '').split(/\s+/).filter(Boolean);

  function expandMap(m) {
    const nodes = m.nodes.map(([id, label, sub, layer, detail, spec]) => ({ id, label, sub, layer, detail, spec: spec || [] }));
    const edges = m.edges.map(([from, to, label, kind, detail]) => ({ from, to, label, kind, detail }));
    const flow = m.flow.map(([title, detail, hops]) => {
      const pairs = hops.split(',').map((h) => h.trim()).filter(Boolean).map((h) => h.split('>').map((x) => x.trim()));
      const seen = [];
      pairs.forEach(([a, b]) => { if (!seen.includes(a)) seen.push(a); if (!seen.includes(b)) seen.push(b); });
      return { title, detail, nodes: seen, edges: pairs };
    });
    const failures = (m.failures || []).map(([label, failed, affected, detail, mitigation]) => ({
      label, nodes: ids(failed), affected: ids(affected), detail, mitigation
    }));
    const used = new Set(nodes.map((n) => n.layer));
    const layers = (m.layers || ['Client', 'Edge', 'Service', 'Async', 'Data', 'Obs']).filter((l) => used.has(l));
    return { title: m.title, subtitle: m.subtitle, layers, nodes, edges, flow, why: m.why, tradeoffs: m.tradeoffs, failures };
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
      if (q.map) DESIGN_GRAPHS[q.id] = expandMap(Object.assign({ title: q.title.replace(/^Design (an? )?/, '') }, q.map));
      if (q.brief) DESIGN_BRIEFS[q.id] = q.brief;
    });
  }

  return { add, install, all: () => list.slice() };
})();
