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

/* ------------------------------------------------------------
   Standard infrastructure each map opts into.
   lb:       put a load balancer in front of this entry node (auto-detected when true)
   cdn:      add a CDN for static files and media
   replicas: { db, reads: [service ids whose access to db is read-only] }
   cache:    { db, readers: [service ids] }  a read cache in front of db
   queue:    { from, to }  buffer the from → to writes in a write queue
   ------------------------------------------------------------ */
const DESIGN_INFRA = {
  'url-shortener': { lb: true, replicas: { db: 'db', reads: ['redirect'] } },
  pastebin: { lb: true, replicas: { db: 'meta', reads: [] }, read: { via: 'write', patch: 'Read a paste' } },
  webhook: { lb: false, cache: { db: 'subs', readers: ['ingest'] },
    read: { newClient: ['merchant', 'Merchant', 'Dashboard', 'The customer checking whether events were delivered.'], service: ['dash', 'Dashboard API', 'Delivery history', 'Serves delivery attempts and replay controls to merchants.'], store: 'log', entry: null, title: 'View delivery history', detail: 'Merchants read every attempt (status, latency) from the delivery log.' } },
  typeahead: { lb: 'cdn' },
  tinder: { lb: true, cdn: true, queue: { from: 'swipe', to: 'swipes' }, cache: { db: 'matches', readers: [] },
    read: { via: 'match', title: 'See my matches', detail: 'The match list is read from the cache, falling back to the match store.' } },
  leetcode: { lb: true, cdn: true, cache: { db: 'tests', readers: ['judge'] }, replicas: { db: 'subs', reads: [] },
    read: { via: 'submit', title: 'View my submissions', detail: 'Past submissions and verdicts are read from read replicas, keeping load off the primary.' } },
  'rate-limiter': { lb: true },
  'google-calendar': { lb: true, cdn: true, cache: { db: 'store', readers: ['expand'] }, replicas: { db: 'store', reads: ['expand'] } },
  twitter: { lb: true, cdn: true, replicas: { db: 'tweets', reads: ['timeline'] } },
  yelp: { lb: true, cache: { db: 'bizdb', readers: ['biz'] }, replicas: { db: 'revdb', reads: [] }, queue: { from: 'reviews', to: 'revdb' },
    read: { via: 'reviews', patch: 'Open a business' } },
  netflix: { lb: true },
  robinhood: { lb: true, cdn: true, replicas: { db: 'orderdb', reads: [] },
    read: { via: 'orders', title: 'View my orders', detail: 'Order history and status come from read replicas, never the primary that takes new orders.' } },
  dropbox: { lb: true, cache: { db: 'metadb', readers: [] },
    read: { via: 'meta', client: 'device', title: 'Browse my files', detail: 'Folder listings are served from the metadata cache, falling back to the database.' } },
  'google-docs': { lb: true, cdn: true, cache: { db: 'snap', readers: ['docs'] } },
  ticketmaster: { lb: 'wait', cdn: true, replicas: { db: 'inv', reads: [] }, read: { via: 'events', entry: 'gw', patch: 'Get in during an on-sale' } },
  'live-comments': { lb: 'edgews', cdn: true },
  'news-aggregator': { lb: 'cdn', replicas: { db: 'stories', reads: ['feed'] } },
  'post-search': { lb: true, cdn: true, cache: { db: 'shards', readers: ['broker'] } },
  gopuff: { lb: true, cdn: true, cache: { db: 'inv', readers: ['catalog'] }, replicas: { db: 'inv', reads: ['catalog'] } },
  'online-auction': { lb: true, cdn: true, cache: { db: 'auctions', readers: [] },
    read: { via: 'bids', client: 'bidder', title: 'Open an auction page', detail: 'The current price and leader come from the cache; the auction store answers misses.' } },
  'metrics-monitoring': { lb: true, cache: { db: 'tsdb', readers: ['query'] } },
  'job-scheduler': { lb: false, replicas: { db: 'jobs', reads: [] },
    read: { via: 'api', entry: null, title: 'List my jobs', detail: 'Job definitions and next run times are read from read replicas.' } },
  'payment-system': { lb: true, replicas: { db: 'paydb', reads: [] },
    read: { via: 'payments', title: 'Look up a payment', detail: 'Payment status and history are read from read replicas.' } },
  'web-crawler': { lb: false,
    read: { newClient: ['indexer', 'Search indexer', 'Downstream', 'The search system that consumes crawled pages.'], service: ['pageapi', 'Page API', 'Fetch stored pages', 'Serves stored pages and their metadata to the indexer.'], store: 'pages', entry: null, title: 'Look up a crawled page', detail: 'The indexer reads stored pages through the page API, never from the fetchers.' } },
  'ad-click-aggregator': { lb: true },
  'top-k': { lb: true, cdn: true, cache: { db: 'results', readers: ['api'] } },
  uber: { lb: true, replicas: { db: 'tripdb', reads: [] },
    read: { via: 'trips', client: 'rider', title: 'View trip history', detail: 'Past trips and receipts are read from read replicas.' } },
  'pub-sub': { lb: false },
  'chat-app': { lb: true, cdn: true, cache: { db: 'msgs', readers: [] },
    read: { via: 'chat', client: 'recipient', title: 'Open a conversation', detail: 'Recent messages come from the cache; older history from the message store.' } },
  youtube: { lb: true, replicas: { db: 'meta', reads: [] },
    read: { service: ['videos', 'Video service', 'Watch pages', 'Serves titles, view counts, and video status for watch pages.'], client: 'viewer', title: 'Open a video page', detail: 'Video details come from read replicas; the primary only takes uploads and status changes.' } },
  'news-feed': { lb: true, cdn: true, replicas: { db: 'inbox', reads: ['feed'] } },
  instagram: { lb: true, replicas: { db: 'meta', reads: ['feed'] } },
  'distributed-cache': { lb: false },
  'kv-store': { lb: false, read: { via: 'coord', store: 'replicas', entry: null, client: 'client', title: 'Read a key', detail: 'The coordinator asks R replicas and returns the newest value it sees.' } },
  'google-maps': { lb: true },
  'core-bank': { lb: true, cdn: true, replicas: { db: 'core', reads: ['accounts'] } }
};

const DesignInfra = (() => {
  const hops = (text) => text.split(',').map((h) => h.trim()).filter(Boolean).map((h) => h.split('>').map((x) => x.trim()));
  const join = (pairs) => pairs.map(([a, b]) => `${a}>${b}`).join(', ');
  const EDGE_KEEP = /cdn|edge cache|waiting room/i;

  /** CDN and load balancers sit in front of the gateway tier, so they get their own column. */
  function splitEdgeColumn(nodes) {
    nodes.forEach((n) => { if (n[3] === 'Edge' && !EDGE_KEEP.test(n[1])) n[3] = 'Gateway'; });
  }

  function apply(id, m) {
    const nodes = m.nodes.map((n) => n.slice());
    let edges = m.edges.map((e) => e.slice());
    const flows = m.flow.map((f) => f.slice());
    const infra = DESIGN_INFRA[id] || {};
    const has = (x) => nodes.some((n) => n[0] === x);
    const node = (x) => nodes.find((n) => n[0] === x);
    const rewrite = (fn) => flows.forEach((f) => { f[2] = join(hops(f[2]).flatMap(fn)); });
    splitEdgeColumn(nodes);
    const clients = new Set(nodes.filter((n) => n[3] === 'Client').map((n) => n[0]));

    if (infra.lb) {
      let entry = infra.lb === true ? (nodes.find((n) => n[3] === 'Gateway') || [])[0] : infra.lb;
      if (entry && has(entry) && !has('lb')) {
        nodes.push(['lb', 'Load balancer', 'L7 + health checks', 'Edge',
          'Spreads incoming traffic across many copies of the next tier and stops sending to unhealthy ones.',
          ['Terminates TLS.', 'Health checks every few seconds.', 'Lets you add servers without clients noticing.']]);
        if (node(entry)[3] === 'Edge' && !EDGE_KEEP.test(node(entry)[1])) node(entry)[3] = 'Gateway';
        const out = [];
        edges.forEach((e) => {
          if (clients.has(e[0]) && e[1] === entry) out.push([e[0], 'lb', e[2], e[3], e[4]]);
          else if (e[0] === entry && clients.has(e[1])) out.push(['lb', e[1], e[2], e[3], e[4]]);
          else out.push(e);
        });
        edges = out;
        edges.push(['lb', entry, 'healthy instance', 'sync', 'Forward to one of many identical instances.']);
        if (m.edges.some((e) => e[0] === entry && clients.has(e[1]))) {
          edges.push([entry, 'lb', 'response', 'sync', 'Responses flow back through the load balancer.']);
        }
        rewrite(([a, b]) => {
          if (clients.has(a) && b === entry) return [[a, 'lb'], ['lb', entry]];
          if (a === entry && clients.has(b)) return [[entry, 'lb'], ['lb', b]];
          return [[a, b]];
        });
      }
    }

    if (infra.cdn && !nodes.some((n) => /cdn/i.test(n[1]))) {
      const client = [...clients][0];
      nodes.push(['cdn', 'CDN', 'Static + media', 'Edge',
        'Serves the app\'s JavaScript, CSS, and images from servers close to each user.',
        ['Cached at the edge.', 'Origin only sees misses.']]);
      edges.push([client, 'cdn', 'assets', 'sync', 'Load the app\'s static files and images.']);
      edges.push(['cdn', client, 'files', 'sync', 'Static files come back from a nearby edge server.']);
    }

    if (infra.queue && has(infra.queue.from) && has(infra.queue.to)) {
      const { from, to } = infra.queue;
      nodes.push(['wq', 'Write queue', 'Kafka / SQS', 'Async',
        'Buffers bursts of writes so the database receives them at a steady rate.',
        ['Durable: nothing is lost if the database is slow.', 'Writers acknowledge after enqueue.']]);
      const old = edges.find((e) => e[0] === from && e[1] === to);
      edges = edges.filter((e) => !(e[0] === from && e[1] === to));
      edges.push([from, 'wq', 'enqueue write', 'async', 'Hand the write to the queue and return.']);
      edges.push(['wq', to, old ? old[2] : 'apply', 'async', 'Workers apply queued writes in order.']);
      rewrite(([a, b]) => (a === from && b === to ? [[from, 'wq'], ['wq', to]] : [[a, b]]));
    }

    const readTarget = {};
    if (infra.replicas && has(infra.replicas.db)) {
      const { db, reads } = infra.replicas;
      const ro = db + 'Ro';
      nodes.push([ro, 'Read replicas', 'Copies for reads', 'Data',
        'Read-only copies of the ' + node(db)[1].toLowerCase() + ' that serve read traffic, so the primary only handles writes.',
        ['Kept current by replication.', 'May lag the primary by a moment.', 'Add more as reads grow.']]);
      edges.push([db, ro, 'replicate', 'async', 'Every committed write is copied to the replicas.']);
      reads.forEach((r) => { readTarget[r] = ro; });
      edges = edges.map((e) => {
        if (reads.includes(e[0]) && e[1] === db) return [e[0], ro, e[2], e[3], e[4]];
        if (e[0] === db && reads.includes(e[1])) return [ro, e[1], e[2], e[3], e[4]];
        return e;
      });
      rewrite(([a, b]) => {
        if (reads.includes(a) && b === db) return [[a, ro]];
        if (a === db && reads.includes(b)) return [[ro, b]];
        return [[a, b]];
      });
    }

    if (infra.cache && has(infra.cache.db) && !nodes.some((n) => n[0] === 'rcache')) {
      const { db, readers } = infra.cache;
      nodes.push(['rcache', 'Read cache', 'Redis', 'Data',
        'Keeps hot ' + node(db)[1].toLowerCase() + ' data in memory so most reads never reach the database.',
        ['Cache-aside with TTL.', 'Invalidated on write.']]);
      edges.push([db, 'rcache', 'invalidate', 'async', 'Writes evict stale entries.']);
      readers.filter(has).forEach((r) => {
        edges.push([r, 'rcache', 'get', 'sync', 'Check the cache first.']);
        edges.push(['rcache', r, 'hit', 'sync', 'Most reads end here.']);
      });
      const targets = new Set([db, readTarget[readers[0]]].filter(Boolean));
      rewrite(([a, b]) => (readers.includes(a) && targets.has(b) ? [[a, 'rcache'], [a, b]] : [[a, b]]));
    }

    if (infra.read) addReadPath(infra, nodes, edges, flows, clients, has);

    return Object.assign({}, m, { nodes, edges, flow: flows });
  }

  /** Makes sure every map shows how data is read back, through the cache and/or read replicas. */
  function addReadPath(infra, nodes, edges, flows, clients, has) {
    const r = infra.read;
    if (r.newClient && !has(r.newClient[0])) {
      const [cid, label, sub, detail] = r.newClient;
      nodes.push([cid, label, sub, 'Client', detail, []]);
      clients.add(cid);
      r.client = cid;
    }
    const hasEdge = (a, b) => edges.some((e) => e[0] === a && e[1] === b);
    const addEdge = (a, b, label, kind, detail) => { if (!hasEdge(a, b)) edges.push([a, b, label, kind, detail]); };
    let via = r.via;
    if (r.service) {
      const [id, label, sub, detail] = r.service;
      if (!has(id)) nodes.push([id, label, sub, 'Service', detail, ['Read-only.', 'Scales independently of writes.']]);
      via = id;
    }
    const entry = r.entry === null ? null : (r.entry || (has('lb') ? (edges.find((e) => e[0] === 'lb' && !clients.has(e[1])) || [])[1] : null));
    const client = r.client || [...clients][0];
    const ro = infra.replicas && has(infra.replicas.db + 'Ro') ? infra.replicas.db + 'Ro' : null;
    const cache = infra.cache && has('rcache') ? 'rcache' : null;
    const db = infra.replicas ? infra.replicas.db : infra.cache ? infra.cache.db : null;
    const reads = [];
    if (cache) { addEdge(via, cache, 'get', 'sync', 'Check the cache first.'); addEdge(cache, via, 'hit', 'sync', 'Most reads end here.'); reads.push([via, cache]); }
    const store = r.store || ro || db;
    if (store) {
      addEdge(via, store, 'read', 'sync', ro ? 'Reads go to a replica, not the primary.' : 'Cache misses read the store.');
      addEdge(store, via, 'rows', 'sync', 'The data comes back.');
      reads.push([via, store], [store, via]);
    }
    if (r.patch) {
      const f = flows.find((x) => x[0] === r.patch);
      if (!f) return;
      const pairs = hops(f[2]);
      const at = pairs.findIndex(([, b]) => b === via);
      pairs.splice(at >= 0 ? at + 1 : pairs.length, 0, ...reads);
      f[2] = join(pairs);
      return;
    }
    const pairs = [];
    const front = entry || via;
    if (has('lb') && entry) {
      addEdge(client, 'lb', 'HTTPS', 'sync', 'Read requests enter through the load balancer.');
      pairs.push([client, 'lb'], ['lb', entry]);
    } else {
      addEdge(client, front, 'read', 'sync', 'Read request.');
      pairs.push([client, front]);
    }
    if (entry) { addEdge(entry, via, 'read', 'sync', 'Route the read.'); pairs.push([entry, via]); }
    pairs.push(...reads);
    if (entry) {
      addEdge(via, entry, 'data', 'sync', 'Results go back to the gateway.');
      pairs.push([via, entry]);
      if (has('lb')) {
        addEdge(entry, 'lb', 'response', 'sync', 'Responses flow back through the load balancer.');
        addEdge('lb', client, 'response', 'sync', 'The user gets the data.');
        pairs.push([entry, 'lb'], ['lb', client]);
      } else {
        addEdge(entry, client, 'data', 'sync', 'The user gets the data.');
        pairs.push([entry, client]);
      }
    } else {
      addEdge(via, client, 'data', 'sync', 'The caller gets the data.');
      pairs.push([via, client]);
    }
    flows.push([r.title, r.detail, join(pairs)]);
  }

  // actions whose wording would be read the wrong way
  const KIND = {
    'typeahead:Type a prefix': 'read',
    'robinhood:Get filled': 'write',
    'gopuff:Check out': 'write',
    'netflix:Press play': 'read',
    'dropbox:Sync another device': 'read',
    'chat-app:Come back online': 'read',
    'distributed-cache:Miss and fill': 'read',
    'uber:Driver accepts': 'write',
    'news-feed:A friend posts': 'write',
    'news-feed:Engage': 'write',
    'leetcode:Update the contest': 'write',
    'typeahead:Learn from searches': 'write',
    'rate-limiter:Allowed request': 'write',
    'rate-limiter:Over the limit': 'read',
    'netflix:Prepare a new release': 'write',
    'post-search:Index a new post': 'write',
    'web-crawler:Fetch a page': 'write',
    'web-crawler:Discover links': 'write',
    'google-maps:Update traffic': 'write'
  };

  /** Read path, write path, or background work, from what the user action does. */
  function kindOf(id, title) {
    if (KIND[id + ':' + title]) return KIND[id + ':' + title];
    const t = title.toLowerCase();
    if (/^(open|read|load|search|view|watch|browse|get|see|show|pan|find|join|receive|consume|keep watching|check a|list|look up)\b/.test(t)) return 'read';
    if (/^(create|post|upload|write|send|place|submit|save|swipe|hold|buy|charge|transfer|publish|emit|ingest|record|type|edit|schedule|count|click|report|accept|request|drivers report)\b/.test(t)) return 'write';
    return 'background';
  }

  return { apply, kindOf };
})();

const DesignCatalog = (() => {
  const list = [];
  const ids = (text) => String(text || '').split(/\s+/).filter(Boolean);

  function expandMap(id, m) {
    const nodes = m.nodes.map(([id, label, sub, layer, detail, spec]) => ({ id, label, sub, layer, detail, spec: spec || [] }));
    const edges = m.edges.map(([from, to, label, kind, detail]) => ({ from, to, label, kind, detail }));
    const flow = m.flow.map(([title, detail, hops]) => {
      const pairs = hops.split(',').map((h) => h.trim()).filter(Boolean).map((h) => h.split('>').map((x) => x.trim()));
      const seen = [];
      pairs.forEach(([a, b]) => { if (!seen.includes(a)) seen.push(a); if (!seen.includes(b)) seen.push(b); });
      return { title, detail, nodes: seen, edges: pairs, kind: DesignInfra.kindOf(id, title) };
    });
    const failures = (m.failures || []).map(([label, failed, affected, detail, mitigation]) => ({
      label, nodes: ids(failed), affected: ids(affected), detail, mitigation
    }));
    const used = new Set(nodes.map((n) => n.layer));
    const layers = (m.layers || ['Client', 'Edge', 'Gateway', 'Service', 'Async', 'Data', 'Obs']).filter((l) => used.has(l));
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
      if (q.map) DESIGN_GRAPHS[q.id] = expandMap(q.id, DesignInfra.apply(q.id, Object.assign({ title: q.title.replace(/^Design (an? )?/, '') }, q.map)));
      if (q.brief) DESIGN_BRIEFS[q.id] = q.brief;
    });
  }

  return { add, install, all: () => list.slice() };
})();
