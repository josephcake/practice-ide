/* ============================================================
   SYSTEM DESIGN — interactive architecture maps
   Each graph is a layered architecture: components, flows,
   failure drills, and the reasoning for why the design works.
   ============================================================ */

const DESIGN_GRAPHS = {
  'url-shortener': {
    title: 'URL shortener',
    subtitle: 'Write once, redirect forever: cache-first reads over an immutable mapping',
    layers: ['Client', 'Edge', 'Service', 'Async', 'Data', 'Obs'],
    nodes: [
      { id: 'client', label: 'Client', sub: 'Browser / SDK', layer: 'Client', detail: 'Creates short links and follows redirects.', spec: ['Reads dominate writes by roughly 100:1.', 'Follows HTTP redirects directly.'] },
      { id: 'api', label: 'API gateway', sub: 'TLS, auth, quota', layer: 'Edge', detail: 'Single entry point for shorten and redirect calls.', spec: ['Terminates TLS and authenticates API keys.', 'Rate-limits abusive clients before services.'] },
      { id: 'shortener', label: 'Shorten service', sub: 'POST /shorten', layer: 'Service', detail: 'Validates the URL, allocates a code, persists the mapping.', spec: ['Idempotent by (owner, long URL).', 'Rejects private and blocklisted destinations.'] },
      { id: 'idgen', label: 'Code allocator', sub: 'Ranges + base62', layer: 'Service', detail: 'Hands out codes without a network round trip per request.', spec: ['Preallocates ranges to avoid a hot counter.', 'Obfuscation keeps codes unguessable.'] },
      { id: 'redirect', label: 'Redirect service', sub: 'GET /:code', layer: 'Service', detail: 'Resolves a code and returns a 302 to the target.', spec: ['Cache-first read path.', 'Falls back to the mapping store on a miss.'] },
      { id: 'analytics', label: 'Click stream', sub: 'Kafka / firehose', layer: 'Async', detail: 'Consumes click events without blocking redirects.', spec: ['Fire-and-forget from the redirect path.', 'Feeds analytics and abuse detection.'] },
      { id: 'cache', label: 'Redirect cache', sub: 'Redis, 99% hit', layer: 'Data', detail: 'Stores code → URL for the hot read path.', spec: ['Mappings are immutable, so invalidation is rare.', 'Hot keys are replicated to avoid one hot shard.'] },
      { id: 'db', label: 'Mapping store', sub: 'Sharded KV', layer: 'Data', detail: 'Durable source of truth for every short link.', spec: ['Shard by code: each lookup hits one shard.', 'Stores owner, target, expiry, and status.'] },
      { id: 'metrics', label: 'Metrics / traces', sub: 'SLOs, p99', layer: 'Obs', detail: 'Tracks redirect latency, hit ratio, and allocation lag.', spec: ['Redirect p99 is the primary SLO.', 'Alerts on cache hit ratio drops.'] }
    ],
    edges: [
      { from: 'client', to: 'api', label: 'HTTPS', kind: 'sync', detail: 'All traffic enters through the gateway.' },
      { from: 'api', to: 'shortener', label: 'POST', kind: 'sync', detail: 'Write path: create a short link.' },
      { from: 'shortener', to: 'idgen', label: 'allocate', kind: 'sync', detail: 'Get a fresh code from a preallocated range.' },
      { from: 'shortener', to: 'db', label: 'put', kind: 'sync', detail: 'Persist code → URL before returning.' },
      { from: 'shortener', to: 'api', label: 'code', kind: 'sync', detail: 'The created code goes back through the API to the client.' },
      { from: 'api', to: 'client', label: 'short URL', kind: 'sync', detail: 'Return the new short link to its creator.' },
      { from: 'api', to: 'redirect', label: 'GET', kind: 'sync', detail: 'Read path: resolve a code.' },
      { from: 'redirect', to: 'cache', label: 'lookup / fill', kind: 'sync', detail: 'Cache-first lookup; the redirect fills it after a miss.' },
      { from: 'cache', to: 'redirect', label: 'hit', kind: 'sync', detail: 'The cached URL returns to the redirect service.' },
      { from: 'redirect', to: 'db', label: 'miss', kind: 'sync', detail: 'Only misses touch the mapping store.' },
      { from: 'db', to: 'redirect', label: 'URL', kind: 'sync', detail: 'The mapping store returns the target on a miss.' },
      { from: 'redirect', to: 'client', label: '302', kind: 'sync', detail: 'The user finally receives the redirect to the target URL.' },
      { from: 'redirect', to: 'analytics', label: 'click', kind: 'async', detail: 'Emit a click event and return immediately.' },
      { from: 'api', to: 'metrics', label: 'traces', kind: 'obs', detail: 'Request latency and error budget.' },
      { from: 'db', to: 'metrics', label: 'stats', kind: 'obs', detail: 'Shard health, replication lag.' }
    ],
    flow: [
      { title: 'Create a short link', detail: 'Validate, allocate a code, persist, and return the short URL through the API to the client.', nodes: ['client', 'api', 'shortener', 'idgen', 'db'], edges: [['client', 'api'], ['api', 'shortener'], ['shortener', 'idgen'], ['shortener', 'db'], ['shortener', 'api'], ['api', 'client']] },
      { title: 'Redirect on a cache hit', detail: 'The code is hot: Redis returns the URL and the redirect service sends 302 back to the user.', nodes: ['client', 'api', 'redirect', 'cache'], edges: [['client', 'api'], ['api', 'redirect'], ['redirect', 'cache'], ['cache', 'redirect'], ['redirect', 'client']] },
      { title: 'Miss, fill, and record the click', detail: 'On a miss read the store, return the URL, send the 302, and emit the click asynchronously.', nodes: ['client', 'redirect', 'cache', 'db', 'analytics'], edges: [['redirect', 'cache'], ['redirect', 'db'], ['db', 'redirect'], ['redirect', 'client'], ['redirect', 'analytics']] }
    ],
    why: [
      'Reads are served from memory; the database only sees writes and cache misses, so the hot path scales horizontally.',
      'Codes are allocated from preallocated ranges, avoiding a global counter or coordination on every write.',
      'Mappings never change, so caching needs TTL only for deletions and abuse takedowns.',
      'Sharding by code makes each lookup single-shard and lets the cache sit in front of the same key.',
      'Click analytics is asynchronous, so a slow consumer never adds latency to a redirect.',
      'The user loop closes at the 302 (and the short-URL response); analytics is a side path, not the response.'
    ],
    tradeoffs: [
      '301 is cacheable and fast but hides clicks; 302 keeps analytics at the cost of more requests.',
      'Custom aliases need a uniqueness check and a conditional write to win races.',
      'Cache invalidation is rare but still needed for expiry, deletion, and abuse.',
      'Hot links require key replication or a CDN; one shard will not carry a viral link.'
    ],
    failures: [
      { label: 'Cache cluster down', nodes: ['cache'], affected: ['redirect', 'db'], detail: 'Every redirect becomes a database read; p99 spikes and the store becomes the bottleneck.', mitigation: 'Request coalescing, a replicated cache, and a circuit breaker that degrades to DB reads.' },
      { label: 'Allocator down', nodes: ['idgen'], affected: ['shortener'], detail: 'New links cannot get a code, although existing redirects continue to work.', mitigation: 'Keep a local buffer of preallocated ranges and fall back to a Snowflake-style ID.' }
    ]
  },

  'rate-limiter': {
    title: 'Distributed rate limiter',
    subtitle: 'One atomic decision per request, with a local safety net',
    layers: ['Client', 'Edge', 'Service', 'Data', 'Obs'],
    nodes: [
      { id: 'client', label: 'Client', sub: 'Tenant / user', layer: 'Client', detail: 'Calls the API with an identity and route.', spec: ['Identity can be API key, tenant, or IP.', 'Bursts matter more than averages.'] },
      { id: 'gateway', label: 'API gateway', sub: 'Enforcement point', layer: 'Edge', detail: 'Calls the limiter before routing the request.', spec: ['Adds <1 ms in the common case.', 'Rejects with 429 + Retry-After.'] },
      { id: 'limiter', label: 'Limiter service', sub: 'Policy + decision', layer: 'Service', detail: 'Builds a key and asks the counter store for a decision.', spec: ['Key: tenant + route + window.', 'Token bucket smooths bursts.'] },
      { id: 'redis', label: 'Counter store', sub: 'Redis + Lua', layer: 'Data', detail: 'Atomic check-and-decrement of the token bucket.', spec: ['Lua makes read-modify-write atomic.', 'Counters expire with the window.'] },
      { id: 'config', label: 'Policy config', sub: 'Limits per plan', layer: 'Data', detail: 'Central rules for plans, routes, and overrides.', spec: ['Versioned and pushed to limiters.', 'Tenant overrides win over defaults.'] },
      { id: 'fallback', label: 'Local fallback', sub: 'In-process bucket', layer: 'Service', detail: 'Keeps limiting when Redis is unavailable.', spec: ['Approximate but keeps the gateway alive.', 'Can fail open or closed per route.'] },
      { id: 'metrics', label: 'Metrics', sub: 'Allow / deny / latency', layer: 'Obs', detail: 'Shows deny rate, Redis latency, and fallback usage.', spec: ['Alert on fallback activation.', 'Per-tenant dashboards catch noisy neighbors.'] }
    ],
    edges: [
      { from: 'client', to: 'gateway', label: 'request', kind: 'sync', detail: 'Every API call passes the gateway.' },
      { from: 'gateway', to: 'limiter', label: 'check', kind: 'sync', detail: 'Ask for a decision before routing.' },
      { from: 'limiter', to: 'redis', label: 'atomic', kind: 'sync', detail: 'One Lua script performs read + decrement.' },
      { from: 'redis', to: 'limiter', label: 'allow/deny', kind: 'sync', detail: 'Decision includes remaining tokens and reset time.' },
      { from: 'limiter', to: 'gateway', label: 'decision', kind: 'sync', detail: 'Allow, or reject with 429 and Retry-After.' },
      { from: 'gateway', to: 'client', label: '200 / 429', kind: 'sync', detail: 'The caller finally receives the allowed response or the quota error.' },
      { from: 'config', to: 'limiter', label: 'rules', kind: 'async', detail: 'Policy updates are pushed, not fetched per request.' },
      { from: 'limiter', to: 'fallback', label: 'on error', kind: 'sync', detail: 'Use the local bucket if Redis fails.' },
      { from: 'limiter', to: 'metrics', label: 'emit', kind: 'obs', detail: 'Decisions and latency are recorded.' }
    ],
    flow: [
      { title: 'Normal request', detail: 'Gateway calls the limiter; the limiter builds a key and runs one atomic token-bucket check.', nodes: ['client', 'gateway', 'limiter', 'redis'], edges: [['client', 'gateway'], ['gateway', 'limiter'], ['limiter', 'redis']] },
      { title: 'Allow or reject', detail: 'Allowed requests continue with quota headers; denied requests get 429 and Retry-After back to the caller.', nodes: ['client', 'redis', 'limiter', 'gateway'], edges: [['redis', 'limiter'], ['limiter', 'gateway'], ['gateway', 'client']] },
      { title: 'Redis unavailable', detail: 'The limiter switches to the local bucket and records that fallback is active.', nodes: ['limiter', 'fallback', 'metrics'], edges: [['limiter', 'fallback'], ['limiter', 'metrics']] }
    ],
    why: [
      'The check is one atomic operation, so concurrent requests cannot both consume the last token.',
      'Token buckets allow short bursts while enforcing a long-run average, which matches real client behavior.',
      'Policy lives centrally but is pushed to limiters, keeping the hot path free of config lookups.',
      'A local fallback preserves availability when the shared counter store is unreachable.',
      'Returning remaining quota and reset time lets well-behaved clients back off instead of hammering.',
      'The response loop is limiter → gateway → client: the limiter itself never answers the caller.'
    ],
    tradeoffs: [
      'Fail-open keeps availability but can allow abuse; fail-closed protects the backend but turns an outage into an outage for everyone.',
      'A precise sliding window costs more memory; a fixed window is cheap but allows a double burst at the boundary.',
      'One Redis round trip per request is usually fine, but extreme QPS may need local pre-checks.',
      'Clock skew between gateway nodes makes window boundaries fuzzy; use the store clock as the source of truth.'
    ],
    failures: [
      { label: 'Redis outage', nodes: ['redis'], affected: ['limiter', 'gateway'], detail: 'Distributed counters are unavailable; every gateway node is on its own.', mitigation: 'Local buckets per node, fail-open for read traffic, fail-closed for sensitive writes.' },
      { label: 'Config push fails', nodes: ['config'], affected: ['limiter'], detail: 'Limiters keep the previous policy instead of blocking requests.', mitigation: 'Versioned config with last-known-good, plus a manual override.' }
    ]
  },

  cache: {
    title: 'Distributed read-through cache',
    subtitle: 'Serve hot reads from memory, protect the origin on a miss',
    layers: ['Client', 'Service', 'Data', 'Async', 'Obs'],
    nodes: [
      { id: 'client', label: 'Client', sub: 'API consumer', layer: 'Client', detail: 'Reads and writes business entities.', spec: ['Read-heavy workload.', 'Tolerates bounded staleness.'] },
      { id: 'service', label: 'Service', sub: 'Read-through logic', layer: 'Service', detail: 'Checks the cache, loads from the origin on a miss, then fills it.', spec: ['Single-flight per key.', 'Writes invalidate rather than update.'] },
      { id: 'cache', label: 'Cache cluster', sub: 'Redis, sharded', layer: 'Data', detail: 'Stores serialized entities under a namespaced key.', spec: ['Consistent hashing spreads keys.', 'TTL is the safety net.'] },
      { id: 'db', label: 'Origin database', sub: 'Source of truth', layer: 'Data', detail: 'Durable store for every entity.', spec: ['Only sees misses and writes.', 'Replicas can serve read fallbacks.'] },
      { id: 'invalidation', label: 'Invalidation bus', sub: 'CDC / events', layer: 'Async', detail: 'Propagates writes to every cache node.', spec: ['Delete-on-write, not update.', 'Ordered per entity.'] },
      { id: 'metrics', label: 'Cache metrics', sub: 'Hit ratio, p99', layer: 'Obs', detail: 'Tracks hit ratio, evictions, and origin load.', spec: ['Alert when hit ratio drops.', 'Watch for hot keys.'] }
    ],
    edges: [
      { from: 'client', to: 'service', label: 'read', kind: 'sync', detail: 'Read request enters the service.' },
      { from: 'service', to: 'cache', label: 'get', kind: 'sync', detail: 'Cache-first lookup.' },
      { from: 'cache', to: 'service', label: 'hit / miss', kind: 'sync', detail: 'A hit returns the value; a miss tells the service to load the origin.' },
      { from: 'service', to: 'db', label: 'read / write', kind: 'sync', detail: 'Misses read the origin; writes commit to the source of truth.' },
      { from: 'db', to: 'service', label: 'value', kind: 'sync', detail: 'The origin returns the value for the cache fill.' },
      { from: 'service', to: 'client', label: 'value / ack', kind: 'sync', detail: 'The caller finally receives the value or write acknowledgement.' },
      { from: 'db', to: 'invalidation', label: 'CDC', kind: 'async', detail: 'Every committed write emits an invalidation.' },
      { from: 'invalidation', to: 'cache', label: 'evict', kind: 'async', detail: 'Delete the key so the next read reloads.' },
      { from: 'cache', to: 'metrics', label: 'stats', kind: 'obs', detail: 'Hit ratio and eviction rate.' }
    ],
    flow: [
      { title: 'Cache hit', detail: 'The service reads the key and returns the value to the client; the origin sees nothing.', nodes: ['client', 'service', 'cache'], edges: [['client', 'service'], ['service', 'cache'], ['cache', 'service'], ['service', 'client']] },
      { title: 'Cache miss', detail: 'The miss returns to the service; it loads the origin, fills the cache, and returns to the client.', nodes: ['client', 'service', 'cache', 'db'], edges: [['service', 'cache'], ['cache', 'service'], ['service', 'db'], ['db', 'service'], ['service', 'client']] },
      { title: 'Write invalidates', detail: 'Commit, acknowledge the client, emit CDC, and delete the key on every node.', nodes: ['client', 'service', 'db', 'invalidation', 'cache'], edges: [['service', 'db'], ['service', 'client'], ['db', 'invalidation'], ['invalidation', 'cache']] }
    ],
    why: [
      'Most reads never touch the database, so origin capacity is reserved for misses and writes.',
      'Read-through keeps loading logic in one place instead of leaking it into every caller.',
      'Delete-on-write plus TTL avoids stale data without trying to update every cached copy.',
      'Single-flight and jittered TTLs stop a popular key from stampeding the origin when it expires.',
      'Consistent hashing means adding a node moves only a fraction of keys.',
      'The loop is cache → service → client on a hit, and origin → service → client on a miss; the cache never talks to the database itself.'
    ],
    tradeoffs: [
      'A short TTL improves freshness but lowers hit ratio; a long TTL saves the origin but serves staler data.',
      'Delete-on-write has a race with a concurrent read that can repopulate an old value; versioned keys or a short lock closes it.',
      'Hot keys still concentrate load; replicate them or add a small local cache.',
      'A cache outage shifts the full read load to the origin, so the origin needs headroom or a circuit breaker.'
    ],
    failures: [
      { label: 'Cache cluster down', nodes: ['cache'], affected: ['service', 'db'], detail: 'All reads hit the origin; latency and load jump immediately.', mitigation: 'Request coalescing, origin read replicas, and a degrade-to-DB circuit breaker.' },
      { label: 'Invalidation lag', nodes: ['invalidation'], affected: ['cache', 'service'], detail: 'Stale reads persist until the event arrives or TTL expires.', mitigation: 'Bounded TTL, per-entity version checks, and replayable CDC.' }
    ]
  },

  'market-data': {
    title: 'Market-data fan-out',
    subtitle: 'One sequenced feed, many consumers, no per-subscriber bottleneck',
    layers: ['Feed', 'Ingest', 'Service', 'Async', 'Consumers', 'Data', 'Obs'],
    nodes: [
      { id: 'exchange', label: 'Exchange feed', sub: 'Publisher', layer: 'Feed', detail: 'Produces price updates and trade prints.', spec: ['Messages can arrive out of order.', 'Sequencing is the receiver’s job.'] },
      { id: 'gateway', label: 'Ingest gateway', sub: 'Validate + normalize', layer: 'Ingest', detail: 'Normalizes symbols, timestamps, and message types.', spec: ['Drops duplicates early.', 'Backpressure to the publisher.'] },
      { id: 'sequencer', label: 'Sequencer', sub: 'Single writer per feed', layer: 'Service', detail: 'Assigns a monotonic sequence number to every message.', spec: ['One writer per symbol or feed.', 'The ordering point for all consumers.'] },
      { id: 'ring', label: 'Ring buffer', sub: 'Bounded, lock-free', layer: 'Async', detail: 'Hands messages to fan-out workers without copying per consumer.', spec: ['Fixed capacity with backpressure.', 'Slow consumers are detached.'] },
      { id: 'workers', label: 'Fan-out workers', sub: 'Multicast', layer: 'Async', detail: 'Pushes to subscribers and conflates when behind.', spec: ['Per-subscriber queues are bounded.', 'Conflation keeps the latest price.'] },
      { id: 'subscribers', label: 'Subscribers', sub: '~10k clients', layer: 'Consumers', detail: 'Trading UIs, algorithms, and internal services.', spec: ['Some need every tick; others only latest.', 'Connect and disconnect constantly.'] },
      { id: 'snapshot', label: 'Snapshot store', sub: 'Latest state', layer: 'Data', detail: 'Holds the latest book per symbol for new subscribers.', spec: ['Snapshot + deltas is the contract.', 'Replayed before live tail.'] },
      { id: 'metrics', label: 'Lag / gaps', sub: 'Observability', layer: 'Obs', detail: 'Tracks sequence gaps and consumer lag.', spec: ['Alert on any gap.', 'Lag per subscriber is visible.'] }
    ],
    edges: [
      { from: 'exchange', to: 'gateway', label: 'feed', kind: 'sync', detail: 'Raw market data from the venue.' },
      { from: 'gateway', to: 'sequencer', label: 'normalized', kind: 'sync', detail: 'Validated messages enter the sequence.' },
      { from: 'sequencer', to: 'ring', label: 'seq n', kind: 'sync', detail: 'Message is written once with a sequence number.' },
      { from: 'ring', to: 'workers', label: 'claim', kind: 'async', detail: 'Workers claim batches from the ring.' },
      { from: 'workers', to: 'subscribers', label: 'push', kind: 'async', detail: 'Fan-out to every subscriber.' },
      { from: 'snapshot', to: 'subscribers', label: 'snapshot', kind: 'sync', detail: 'New subscriber gets state plus a sequence.' },
      { from: 'ring', to: 'snapshot', label: 'update', kind: 'async', detail: 'Snapshots are derived from the same order.' },
      { from: 'workers', to: 'metrics', label: 'lag', kind: 'obs', detail: 'Consumer lag and gap detection.' }
    ],
    flow: [
      { title: 'Publish and sequence', detail: 'The venue feed is normalized and assigned a monotonic sequence number by a single writer.', nodes: ['exchange', 'gateway', 'sequencer'], edges: [['exchange', 'gateway'], ['gateway', 'sequencer']] },
      { title: 'Fan out', detail: 'The ring buffer feeds workers, which push to bounded subscriber queues and conflate when behind.', nodes: ['sequencer', 'ring', 'workers', 'subscribers'], edges: [['sequencer', 'ring'], ['ring', 'workers'], ['workers', 'subscribers']] },
      { title: 'Subscribe mid-stream', detail: 'A new subscriber receives a snapshot plus the sequence, then the live tail with no gap.', nodes: ['snapshot', 'subscribers', 'ring'], edges: [['snapshot', 'subscribers'], ['ring', 'snapshot']] }
    ],
    why: [
      'A single sequencer defines the order once; every consumer sees the same sequence instead of racing on raw feed order.',
      'The ring buffer and bounded per-subscriber queues isolate slow consumers from fast ones.',
      'Conflation gives slow consumers the latest value instead of an ever-growing backlog.',
      'Snapshot + delta is the only correct way to join mid-stream without replaying history.',
      'Gap detection makes lost messages visible instead of silently corrupting state.',
      'The loop ends at workers → subscribers (and snapshot → subscribers): those are the user-facing consumer apps.'
    ],
    tradeoffs: [
      'Single writer per feed simplifies ordering but caps throughput per symbol and needs fast failover.',
      'Lossy conflation helps latency but breaks consumers that need every tick.',
      'Bounded queues protect the publisher but force a policy: drop, disconnect, or block.',
      'Fan-out by copy is simple but expensive at 10k consumers; multicast or shared memory is faster but more complex.'
    ],
    failures: [
      { label: 'Slow subscriber', nodes: ['subscribers'], affected: ['workers', 'ring'], detail: 'One consumer cannot keep up; its queue grows without bound.', mitigation: 'Bound the queue, conflate to the latest value, then disconnect and resnapshot.' },
      { label: 'Sequence gap', nodes: ['sequencer'], affected: ['workers', 'subscribers'], detail: 'A missing sequence number means every downstream state is suspect.', mitigation: 'Detect gaps immediately, request replay, and resnapshot before resuming.' }
    ]
  },

  'order-book': {
    title: 'Real-time order book + matching engine',
    subtitle: 'Deterministic single-writer matching with replayable state',
    layers: ['Client', 'Edge', 'Service', 'Data', 'Obs'],
    nodes: [
      { id: 'participant', label: 'Participant', sub: 'FIX session', layer: 'Client', detail: 'A broker or trading client with a session on the gateway.', spec: ['Session-level sequence numbers.', 'Can cancel and replace orders.'] },
      { id: 'gateway', label: 'Order gateway', sub: 'FIX / WebSocket', layer: 'Edge', detail: 'Accepts orders and cancels from participants.', spec: ['Validates session and sequence.', 'Never trusts client timestamps.'] },
      { id: 'risk', label: 'Pre-trade risk', sub: 'Limits + credit', layer: 'Service', detail: 'Rejects orders that breach limits before they reach the book.', spec: ['Checks buying power and position limits.', 'Must be fast and deterministic.'] },
      { id: 'sequencer', label: 'Sequencer', sub: 'Total order', layer: 'Service', detail: 'Assigns one global order to every accepted message.', spec: ['Single writer per symbol.', 'The input to deterministic replay.'] },
      { id: 'matcher', label: 'Matching engine', sub: 'Single writer', layer: 'Service', detail: 'Matches incoming orders against the book by price then time.', spec: ['No locks in the hot path.', 'One symbol per engine instance.'] },
      { id: 'book', label: 'Order book', sub: 'Price levels + FIFO', layer: 'Data', detail: 'In-memory price levels, each a FIFO queue of orders.', spec: ['Best bid/ask at O(1).', 'Price-time priority.'] },
      { id: 'trades', label: 'Trade publisher', sub: 'Fills + acks', layer: 'Service', detail: 'Emits fills and acknowledgements to participants.', spec: ['Sequence-numbered.', 'Idempotent by order id.'] },
      { id: 'journal', label: 'Append-only journal', sub: 'Durable log', layer: 'Data', detail: 'Records inputs and outputs for recovery and audit.', spec: ['fsync policy is explicit.', 'Replay rebuilds exact state.'] },
      { id: 'replica', label: 'Hot replica', sub: 'Deterministic replay', layer: 'Data', detail: 'Replays the same journal to stay ready for failover.', spec: ['Same code, same inputs.', 'Promotion is a sequence decision.'] },
      { id: 'metrics', label: 'Latency / depth', sub: 'Observability', layer: 'Obs', detail: 'Tracks matching latency, book depth, and rejects.', spec: ['p99 in microseconds.', 'Alert on book crossing.'] }
    ],
    edges: [
      { from: 'participant', to: 'gateway', label: 'FIX', kind: 'sync', detail: 'Session-validated order enters the gateway.' },
      { from: 'gateway', to: 'risk', label: 'order', kind: 'sync', detail: 'Order enters pre-trade checks.' },
      { from: 'risk', to: 'sequencer', label: 'accept', kind: 'sync', detail: 'Only accepted orders get a sequence.' },
      { from: 'sequencer', to: 'matcher', label: 'seq n', kind: 'sync', detail: 'The matcher consumes a total order.' },
      { from: 'matcher', to: 'book', label: 'match', kind: 'sync', detail: 'Walk price levels until filled.' },
      { from: 'matcher', to: 'trades', label: 'fill', kind: 'sync', detail: 'Emit fills and acknowledgements.' },
      { from: 'trades', to: 'gateway', label: 'fills', kind: 'sync', detail: 'Fills go back through the participant gateway.' },
      { from: 'gateway', to: 'participant', label: 'acks / fills', kind: 'sync', detail: 'The participant finally receives the order outcome.' },
      { from: 'matcher', to: 'journal', label: 'append', kind: 'sync', detail: 'Persist the input and resulting events.' },
      { from: 'journal', to: 'replica', label: 'replay', kind: 'async', detail: 'Replica rebuilds the same state.' },
      { from: 'gateway', to: 'metrics', label: 'latency', kind: 'obs', detail: 'End-to-end order latency.' },
      { from: 'book', to: 'metrics', label: 'depth', kind: 'obs', detail: 'Depth and imbalance.' }
    ],
    flow: [
      { title: 'Accept an order', detail: 'Session validation, pre-trade risk, then a global sequence number.', nodes: ['participant', 'gateway', 'risk', 'sequencer'], edges: [['participant', 'gateway'], ['gateway', 'risk'], ['risk', 'sequencer']] },
      { title: 'Match and return fills', detail: 'The matcher walks price levels, emits fills, and the gateway returns them to the participant.', nodes: ['participant', 'gateway', 'sequencer', 'matcher', 'book', 'trades'], edges: [['sequencer', 'matcher'], ['matcher', 'book'], ['matcher', 'trades'], ['trades', 'gateway'], ['gateway', 'participant']] },
      { title: 'Persist and replicate', detail: 'Journal the inputs and outputs; the replica replays the same sequence.', nodes: ['matcher', 'journal', 'replica'], edges: [['matcher', 'journal'], ['journal', 'replica']] }
    ],
    why: [
      'A single writer per symbol removes locks and makes the outcome deterministic.',
      'Price-time priority is the fairness contract: better price first, then earlier time.',
      'The journal is the source of truth; replaying it recreates the exact book after a crash.',
      'Sequence numbers make duplicates and gaps detectable, which is how double fills are prevented.',
      'Sharding by symbol scales across symbols without sharing mutable state.',
      'Fills and acknowledgements return through the gateway to the participant; the trade publisher is not the end of the loop.'
    ],
    tradeoffs: [
      'Durability versus latency: fsync every event is safe but slower; batching risks losing the tail.',
      'Single writer is simple but a hot symbol cannot use more than one core.',
      'In-memory books are fast but require a replay strategy and enough RAM for depth.',
      'Colocation reduces latency but increases operational complexity.'
    ],
    failures: [
      { label: 'Matching engine crash', nodes: ['matcher'], affected: ['book', 'trades', 'gateway'], detail: 'The book is unavailable until state is rebuilt or the replica is promoted.', mitigation: 'Replay the journal on the replica, verify the last sequence, then promote.' },
      { label: 'Replica lag', nodes: ['replica'], affected: ['journal', 'matcher'], detail: 'Failover would lose recent events and produce a different book.', mitigation: 'Block promotion until caught up, or replay from the journal before accepting orders.' }
    ]
  },

  ledger: {
    title: 'Double-entry payments ledger',
    subtitle: 'Every movement is two entries, one atomic transaction, one idempotency key',
    layers: ['Client', 'Edge', 'Service', 'Data', 'Async', 'Obs'],
    nodes: [
      { id: 'client', label: 'Client', sub: 'Treasury app', layer: 'Client', detail: 'The application that requests a transfer.', spec: ['Generates one idempotency key per request.', 'Retries safely on timeouts.'] },
      { id: 'api', label: 'Payment API', sub: 'POST /transfer', layer: 'Edge', detail: 'Accepts a transfer request with an idempotency key.', spec: ['Authenticates and validates the request.', 'Never trusts a client-generated balance.'] },
      { id: 'ledger', label: 'Ledger service', sub: 'Transaction boundary', layer: 'Service', detail: 'Owns the debit and credit as one atomic unit.', spec: ['Both entries commit or neither does.', 'Balances are derived, not authoritative.'] },
      { id: 'idem', label: 'Idempotency store', sub: 'Key → result', layer: 'Data', detail: 'Returns the original result for a repeated request.', spec: ['Unique key per client request.', 'Stores the response, not just a flag.'] },
      { id: 'accounts', label: 'Accounts', sub: 'Balance cache', layer: 'Data', detail: 'Current balance per account, updated in the same transaction.', spec: ['Derived from entries.', 'Optimistic or row-level locking.'] },
      { id: 'entries', label: 'Entries log', sub: 'Append-only', layer: 'Data', detail: 'Immutable debit/credit records with a transaction id.', spec: ['Sum of a transaction is zero.', 'Never updated or deleted.'] },
      { id: 'outbox', label: 'Transactional outbox', sub: 'Reliable events', layer: 'Async', detail: 'Writes the event in the same transaction as the entries.', spec: ['No dual-write problem.', 'Relay publishes at least once.'] },
      { id: 'settlement', label: 'Settlement', sub: 'Downstream rails', layer: 'Async', detail: 'Moves money with external payment rails.', spec: ['Consumes outbox events.', 'Separate from the ledger commit.'] },
      { id: 'recon', label: 'Reconciliation', sub: 'Ledger vs rails', layer: 'Service', detail: 'Compares internal entries with external statements.', spec: ['Catches missed or duplicated settlements.', 'Runs continuously, not monthly.'] },
      { id: 'metrics', label: 'Audit / metrics', sub: 'Invariants', layer: 'Obs', detail: 'Monitors zero-sum and settlement lag.', spec: ['Alert on any imbalance.', 'Full audit trail per transaction.'] }
    ],
    edges: [
      { from: 'client', to: 'api', label: 'transfer', kind: 'sync', detail: 'Request includes an idempotency key.' },
      { from: 'api', to: 'ledger', label: 'submit', kind: 'sync', detail: 'Request enters the ledger service.' },
      { from: 'ledger', to: 'idem', label: 'check', kind: 'sync', detail: 'Reject duplicates before doing work.' },
      { from: 'ledger', to: 'accounts', label: 'lock', kind: 'sync', detail: 'Lock or version the two accounts.' },
      { from: 'ledger', to: 'entries', label: 'debit+credit', kind: 'sync', detail: 'Append both entries atomically.' },
      { from: 'ledger', to: 'outbox', label: 'event', kind: 'sync', detail: 'Event is written in the same transaction.' },
      { from: 'ledger', to: 'api', label: 'posted', kind: 'sync', detail: 'The committed result returns to the API.' },
      { from: 'api', to: 'client', label: 'receipt', kind: 'sync', detail: 'The client finally receives the transfer receipt.' },
      { from: 'entries', to: 'accounts', label: 'balances', kind: 'sync', detail: 'Balances are projections of the immutable entries.' },
      { from: 'outbox', to: 'settlement', label: 'publish', kind: 'async', detail: 'Relay sends the settlement instruction.' },
      { from: 'settlement', to: 'recon', label: 'statement', kind: 'async', detail: 'External results feed reconciliation.' },
      { from: 'entries', to: 'recon', label: 'entries', kind: 'sync', detail: 'Reconciliation reads the immutable entries and compares them with the statements.' },
      { from: 'ledger', to: 'metrics', label: 'invariants', kind: 'obs', detail: 'Zero-sum and lag checks.' }
    ],
    flow: [
      { title: 'Accept with idempotency', detail: 'Validate the request; a repeated key returns the stored result instead of moving money again.', nodes: ['client', 'api', 'ledger', 'idem'], edges: [['client', 'api'], ['api', 'ledger'], ['ledger', 'idem']] },
      { title: 'Commit both sides', detail: 'Lock the accounts, append debit and credit, write the outbox, and return the receipt through the API.', nodes: ['client', 'api', 'ledger', 'accounts', 'entries', 'outbox'], edges: [['ledger', 'accounts'], ['ledger', 'entries'], ['ledger', 'outbox'], ['ledger', 'api'], ['api', 'client']] },
      { title: 'Settle and reconcile', detail: 'The outbox relay drives settlement; reconciliation reads the entries and compares them with external statements.', nodes: ['outbox', 'settlement', 'recon', 'entries'], edges: [['outbox', 'settlement'], ['settlement', 'recon'], ['entries', 'recon']] }
    ],
    why: [
      'Double-entry makes every movement self-checking: debits and credits must sum to zero.',
      'The append-only entries log is the source of truth; balances are a projection that can be rebuilt.',
      'One transaction for both sides prevents money from existing on only one account.',
      'An idempotency key turns retries into the same result, which is essential on flaky networks.',
      'The transactional outbox avoids the dual-write problem between the ledger and settlement.',
      'Continuous reconciliation catches whatever the protocol still misses.',
      'The client only sees the receipt after the ledger commits both sides; a partial posting never becomes a user-visible success.'
    ],
    tradeoffs: [
      'Strong consistency protects balances but limits throughput; sharding by account can deadlock across transfers.',
      'Locking hot accounts serializes them; optimistic retries work better for low contention.',
      'Settlement is asynchronous, so the ledger can be correct while the external rail lags.',
      'Append-only storage grows forever; snapshot + archive keeps replay bounded.'
    ],
    failures: [
      { label: 'Partial write', nodes: ['entries'], affected: ['accounts', 'ledger'], detail: 'A debit without a credit would create money.', mitigation: 'Single database transaction plus a zero-sum invariant check and reconciliation.' },
      { label: 'Outbox relay stuck', nodes: ['outbox'], affected: ['settlement', 'recon'], detail: 'The ledger is correct but settlement never happens.', mitigation: 'Lag alerts, replayable outbox, and reconciliation against the rail.' }
    ]
  },

  risk: {
    title: 'Real-time risk / P&L',
    subtitle: 'Event-sourced positions, marked to market, checked before the next trade',
    layers: ['Client', 'Feed', 'Service', 'Data', 'Async', 'Obs'],
    nodes: [
      { id: 'user', label: 'Risk ops / trader', sub: 'Dashboard + pages', layer: 'Client', detail: 'The human who consumes exposure, P&L, and limit alerts.', spec: ['Sees data freshness with every number.', 'Gets paged on hard breaches.'] },
      { id: 'trades', label: 'Trade events', sub: 'Fills / bookings', layer: 'Feed', detail: 'Every executed trade enters as an immutable event.', spec: ['Ordered per account.', 'Idempotent by trade id.'] },
      { id: 'market', label: 'Market data', sub: 'Prices', layer: 'Feed', detail: 'Latest marks for every instrument.', spec: ['Stale marks are flagged.', 'One price per symbol per tick.'] },
      { id: 'risk', label: 'Risk engine', sub: 'Positions + limits', layer: 'Service', detail: 'Applies trades to positions and checks limits.', spec: ['Pre-trade and post-trade paths.', 'Deterministic per account.'] },
      { id: 'positions', label: 'Positions', sub: 'Event-sourced', layer: 'Data', detail: 'Current quantity and cost per account/instrument.', spec: ['Rebuilt from trade events.', 'Snapshots bound replay.'] },
      { id: 'pnl', label: 'P&L calculator', sub: 'Realized + unrealized', layer: 'Service', detail: 'Computes realized P&L from trades and unrealized from marks.', spec: ['Incremental on each event.', 'Snapshots for fast restart.'] },
      { id: 'limits', label: 'Limit checks', sub: 'Exposure / drawdown', layer: 'Service', detail: 'Blocks or alerts when exposure breaches a limit.', spec: ['Hard blocks before execution.', 'Soft alerts after the fact.'] },
      { id: 'alerts', label: 'Alerting', sub: 'Risk ops', layer: 'Async', detail: 'Pages risk operators on breaches and stale data.', spec: ['Deduplicated alerts.', 'Runbook attached.'] },
      { id: 'metrics', label: 'Risk dashboard', sub: 'Exposure, P&L', layer: 'Obs', detail: 'Live view for traders and risk managers.', spec: ['Per-desk and per-account.', 'Freshness timestamp visible.'] }
    ],
    edges: [
      { from: 'trades', to: 'risk', label: 'fill', kind: 'sync', detail: 'Apply the trade to positions.' },
      { from: 'market', to: 'risk', label: 'marks', kind: 'sync', detail: 'Price updates drive unrealized P&L.' },
      { from: 'risk', to: 'positions', label: 'update', kind: 'sync', detail: 'Position is the folded state of trades.' },
      { from: 'positions', to: 'pnl', label: 'quantity', kind: 'sync', detail: 'P&L reads current positions.' },
      { from: 'market', to: 'pnl', label: 'mark', kind: 'sync', detail: 'Unrealized P&L uses the latest price.' },
      { from: 'pnl', to: 'limits', label: 'exposure', kind: 'sync', detail: 'Check limits against current risk.' },
      { from: 'limits', to: 'alerts', label: 'breach', kind: 'async', detail: 'Notify risk operations.' },
      { from: 'pnl', to: 'metrics', label: 'dashboard', kind: 'obs', detail: 'Live risk view.' },
      { from: 'metrics', to: 'user', label: 'exposure / P&L', kind: 'sync', detail: 'The dashboard finally returns the computed risk to the user.' },
      { from: 'alerts', to: 'user', label: 'page', kind: 'async', detail: 'Risk operators receive the breach alert.' }
    ],
    flow: [
      { title: 'Trade arrives', detail: 'Validate and dedupe the trade, then apply it to the account position.', nodes: ['trades', 'risk', 'positions'], edges: [['trades', 'risk'], ['risk', 'positions']] },
      { title: 'Mark and compute', detail: 'Combine the position with the latest mark to update realized and unrealized P&L.', nodes: ['positions', 'pnl', 'market'], edges: [['positions', 'pnl'], ['market', 'pnl']] },
      { title: 'Check and alert', detail: 'Compare exposure with limits; hard-block or alert, publish to the dashboard, and page the operator.', nodes: ['user', 'pnl', 'limits', 'alerts', 'metrics'], edges: [['pnl', 'limits'], ['limits', 'alerts'], ['pnl', 'metrics'], ['metrics', 'user'], ['alerts', 'user']] }
    ],
    why: [
      'Positions are a fold over immutable trade events, so they can always be rebuilt and audited.',
      'P&L separates realized (from trades) and unrealized (from marks), which makes the number explainable.',
      'Pre-trade checks stop a breach before it happens; post-trade checks catch what slipped through.',
      'Incremental updates with periodic snapshots keep latency low without unbounded replay.',
      'Stale market data is surfaced as a first-class risk, not hidden behind a number.',
      'The loop closes at the dashboard and the paging path: a computed risk that nobody sees is not a risk control.'
    ],
    tradeoffs: [
      'Real-time marks improve accuracy but a stale or bad tick can move P&L sharply; freshness checks matter.',
      'Pre-trade checks add latency to the order path; cache limits locally and reconcile centrally.',
      'Event sourcing grows storage; snapshots + retention make replay practical.',
      'Per-account determinism is easy; cross-account netting requires a consistent global view.'
    ],
    failures: [
      { label: 'Stale market data', nodes: ['market'], affected: ['pnl', 'limits', 'metrics'], detail: 'Unrealized P&L and limit checks use an old price.', mitigation: 'Flag staleness, block new risk on stale instruments, and alert the data team.' },
      { label: 'Out-of-order trade', nodes: ['trades'], affected: ['risk', 'positions'], detail: 'Applying trades out of order produces the wrong position and P&L.', mitigation: 'Sequence per account, buffer gaps, and replay from the last snapshot.' }
    ]
  },

  'gsr-notification-service': {
    title: 'Notification service for transaction processing',
    subtitle: 'Fan out one transaction event to many channels without duplicates or lost alerts',
    layers: ['Event', 'Service', 'Async', 'Provider', 'Client', 'Data', 'Obs'],
    nodes: [
      { id: 'txn', label: 'Transaction events', sub: 'Payments / trades', layer: 'Event', detail: 'Business events that may require a notification.', spec: ['At-least-once delivery.', 'Carries a stable event id.'] },
      { id: 'api', label: 'Notification API', sub: 'Ingest + validate', layer: 'Service', detail: 'Accepts events, resolves the audience, and enqueues work.', spec: ['Validates schema and tenant.', 'Returns fast; no provider calls inline.'] },
      { id: 'dedupe', label: 'Dedupe / idempotency', sub: 'Event + channel', layer: 'Service', detail: 'Ensures a retry or replay does not send twice.', spec: ['Key: event + recipient + channel.', 'Window covers provider retries.'] },
      { id: 'queue', label: 'Priority queue', sub: 'Critical / bulk', layer: 'Async', detail: 'Durable queue with separate lanes for critical alerts.', spec: ['Critical transactions never wait behind bulk mail.', 'DLQ for poison messages.'] },
      { id: 'workers', label: 'Channel workers', sub: 'Email / SMS / push', layer: 'Service', detail: 'Render templates and call the right provider.', spec: ['Per-channel concurrency limits.', 'Backoff and jitter on retries.'] },
      { id: 'prefs', label: 'Preferences', sub: 'Opt-in / quiet hours', layer: 'Data', detail: 'Per-user channel preferences and compliance rules.', spec: ['Checked before sending.', 'Auditable changes.'] },
      { id: 'templates', label: 'Template service', sub: 'Versioned copy', layer: 'Data', detail: 'Central copy and localization for every message.', spec: ['Versioned, rollbackable.', 'Rendered with strict escaping.'] },
      { id: 'providers', label: 'Provider adapters', sub: 'Email / SMS / push', layer: 'Provider', detail: 'Isolates each vendor behind a common interface.', spec: ['Circuit breaker per provider.', 'Failover to a secondary vendor.'] },
      { id: 'recipient', label: 'Recipient', sub: 'Email / SMS / push', layer: 'Client', detail: 'The end user who actually receives the message.', spec: ['The final delivery hop.', 'Receipts flow back to the delivery store.'] },
      { id: 'delivery', label: 'Delivery store', sub: 'Status + receipts', layer: 'Data', detail: 'Tracks queued, sent, delivered, bounced, failed.', spec: ['Idempotent status updates.', 'Source for support and audit.'] },
      { id: 'dlq', label: 'Dead-letter queue', sub: 'Poison messages', layer: 'Async', detail: 'Holds messages that exhausted retries.', spec: ['Inspectable and replayable.', 'Alerts on growth.'] },
      { id: 'metrics', label: 'Audit + metrics', sub: 'Send rate / failures', layer: 'Obs', detail: 'Tracks throughput, provider errors, and lag.', spec: ['Per-channel SLOs.', 'Alert on backlog and bounce spikes.'] }
    ],
    edges: [
      { from: 'txn', to: 'api', label: 'event', kind: 'sync', detail: 'Transaction event enters the service.' },
      { from: 'api', to: 'dedupe', label: 'claim', kind: 'sync', detail: 'Claim event + recipient + channel.' },
      { from: 'api', to: 'queue', label: 'enqueue', kind: 'async', detail: 'Durable work item with priority.' },
      { from: 'queue', to: 'workers', label: 'deliver', kind: 'async', detail: 'Workers process by channel.' },
      { from: 'workers', to: 'prefs', label: 'check', kind: 'sync', detail: 'Respect opt-in and quiet hours.' },
      { from: 'workers', to: 'templates', label: 'render', kind: 'sync', detail: 'Fetch and render the right template.' },
      { from: 'workers', to: 'providers', label: 'send', kind: 'sync', detail: 'Call the channel adapter.' },
      { from: 'providers', to: 'recipient', label: 'deliver', kind: 'sync', detail: 'The provider finally delivers the message to the user.' },
      { from: 'providers', to: 'delivery', label: 'receipt', kind: 'async', detail: 'Record delivered/bounced.' },
      { from: 'queue', to: 'dlq', label: 'poison', kind: 'async', detail: 'Exhausted retries go to DLQ.' },
      { from: 'api', to: 'metrics', label: 'audit', kind: 'obs', detail: 'Every decision is logged.' }
    ],
    flow: [
      { title: 'Accept and dedupe', detail: 'Validate the event, resolve the audience, and claim an idempotency key per recipient/channel.', nodes: ['txn', 'api', 'dedupe'], edges: [['txn', 'api'], ['api', 'dedupe']] },
      { title: 'Queue and render', detail: 'Enqueue by priority; a worker checks preferences and renders the template.', nodes: ['api', 'queue', 'workers', 'prefs', 'templates'], edges: [['api', 'queue'], ['queue', 'workers'], ['workers', 'prefs'], ['workers', 'templates']] },
      { title: 'Send, retry, record', detail: 'Call the provider, deliver to the recipient, record the receipt, and send exhausted retries to DLQ.', nodes: ['workers', 'providers', 'recipient', 'delivery', 'dlq', 'metrics'], edges: [['workers', 'providers'], ['providers', 'recipient'], ['providers', 'delivery'], ['queue', 'dlq'], ['api', 'metrics']] }
    ],
    why: [
      'The API only accepts and enqueues, so a slow provider never blocks transaction processing.',
      'Idempotency per event + recipient + channel makes retries and replays safe.',
      'Critical and bulk lanes prevent a marketing blast from delaying a payment alert.',
      'Provider adapters with circuit breakers isolate a vendor outage and allow failover.',
      'The delivery store and audit log answer “did the customer get it?” for support and compliance.',
      'A DLQ keeps poison messages from looping forever while preserving them for replay.',
      'The loop closes at provider → recipient; the delivery receipt is how the system knows the user actually got it.'
    ],
    tradeoffs: [
      'At-least-once plus dedupe is practical; exactly-once across providers is not.',
      'Aggressive retries improve delivery but can amplify a provider outage; use backoff and breakers.',
      'More channels mean more per-channel limits, templates, and compliance rules.',
      'Priority lanes help critical traffic but require capacity planning so bulk work still drains.'
    ],
    failures: [
      { label: 'Provider outage', nodes: ['providers'], affected: ['workers', 'delivery', 'metrics'], detail: 'Sends fail for one channel; retries pile up and latency grows.', mitigation: 'Circuit breaker, secondary provider, and a queue that drains when the provider returns.' },
      { label: 'Queue backlog', nodes: ['queue'], affected: ['workers', 'dlq'], detail: 'Delivery lags, and critical alerts can miss their SLA.', mitigation: 'Priority lanes, autoscaled workers, backlog alerts, and shedding bulk traffic.' },
      { label: 'Poison message', nodes: ['dlq'], affected: ['workers'], detail: 'One malformed event fails forever and blocks its shard.', mitigation: 'Bounded retries, DLQ, inspect and replay after a fix.' }
    ]
  }
};

/* ============================================================
   Renderer — layered SVG, pan/zoom, node inspector, request
   trace, and failure drills. No external dependencies.
   ============================================================ */

const DesignGraph = (() => {
  const COLORS = {
    Client: '#7ab8ff', Edge: '#d99bff', Service: '#2dd4bf', Async: '#f2c75e',
    Data: '#f5a65b', Obs: '#9aa8bd', Feed: '#7ab8ff', Ingest: '#d99bff',
    Consumers: '#7ab8ff', Provider: '#d99bff', Event: '#2dd4bf'
  };
  const NH = 56, TOP = 104, LEFT = 40;

  const state = {
    id: null, g: null, selected: null, selectedEdge: null, failure: null,
    tab: 'inspect', view: { x: 0, y: 0, w: 1, h: 1 }, target: { x: 0, y: 0, w: 1, h: 1 }, W: 1, H: 1,
    flow: -1, timer: null, panning: false, last: null, inline: false,
    raf: null, smooth: 80
  };

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const cut = (value, n) => {
    const text = String(value == null ? '' : value);
    return text.length > n ? text.slice(0, n - 1) + '…' : text;
  };
  const colorFor = (layer) => COLORS[layer] || '#9aa8bd';

  let modal, svg, panel, legend, failureSelect, flowbar, narration, stepLabel, traceBtn;
  let nodeMap = new Map();
  let edgesByNode = new Map();

  function byId(id) { return document.getElementById(id); }

  function init() {
    modal = byId('arch-modal');
    if (!modal) return;
    svg = byId('arch-svg');
    panel = byId('arch-panel');
    legend = byId('arch-legend');
    failureSelect = byId('arch-failure');
    flowbar = byId('arch-flowbar');
    narration = byId('arch-narration');
    stepLabel = byId('arch-step');
    traceBtn = byId('arch-trace');

    byId('arch-close').addEventListener('click', close);
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    byId('arch-zoom-in').addEventListener('click', () => zoomCenter(0.82));
    byId('arch-zoom-out').addEventListener('click', () => zoomCenter(1.22));
    byId('arch-reset').addEventListener('click', () => resetView());
    byId('arch-inspector').addEventListener('click', () => toggleInspector());
    byId('arch-side-close').addEventListener('click', () => showInspector(false));
    failureSelect.addEventListener('change', onFailure);
    byId('arch-paths').addEventListener('click', (event) => {
      const step = event.target.closest('[data-flow]');
      if (step) startFlowAt(Number(step.dataset.flow));
    });
    traceBtn.addEventListener('click', toggleTrace);
    byId('arch-prev').addEventListener('click', () => stepTrace(-1));
    byId('arch-next').addEventListener('click', () => stepTrace(1));
    byId('arch-play').addEventListener('click', togglePlay);

    document.querySelectorAll('#arch-modal [data-atab]').forEach((btn) => {
      btn.addEventListener('click', () => setTab(btn.dataset.atab));
    });

    svg.addEventListener('click', (event) => {
      const node = event.target.closest('[data-node]');
      if (node) { selectNode(node.dataset.node); return; }
      const edge = event.target.closest('[data-edge]');
      if (edge) selectEdge(Number(edge.dataset.edge));
    });

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
      if (event.key === 'Escape' && modal.classList.contains('on')) close();
    });
  }

  function open(id, options) {
    const graph = DESIGN_GRAPHS[id];
    if (!graph || !modal) return;
    const inline = !!(options && options.inline);
    state.inline = inline;
    stopPlay();
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
    state.id = id;
    state.g = graph;
    state.selected = null;
    state.selectedEdge = null;
    state.failure = null;
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
    buildFailures();
    buildPaths();
    renderSVG();
    resetView(true);
    setTab('inspect');
    byId('arch-step').textContent = '—';
    narration.textContent = 'Pick a step, or press Trace request.';
    traceBtn.textContent = 'Trace request';
    showInspector(false);
    modal.classList.toggle('inline', inline);
    modal.classList.toggle('on', !inline);
    document.body.classList.toggle('modal-open', !inline);
    if (!inline) byId('arch-close').focus();
  }

  function close() {
    if (!modal) return;
    stopPlay();
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
    modal.classList.remove('on', 'inline', 'inspector-open');
    document.body.classList.remove('modal-open');
    state.flow = -1;
    state.inline = false;
  }

  function buildLegend() {
    const layers = state.g.layers.map((layer) => (
      `<span class="arch-legend-item"><i style="background:${colorFor(layer)}"></i>${esc(layer)}</span>`
    )).join('');
    legend.innerHTML = layers
      + '<span class="arch-legend-sep"></span>'
      + '<span class="arch-edge-key"><i class="arch-key-dot sync"></i>sync</span>'
      + '<span class="arch-edge-key"><i class="arch-key-dot async"></i>async</span>'
      + '<span class="arch-edge-key"><i class="arch-key-dot obs"></i>telemetry</span>'
      + '<span class="arch-edge-key"><i class="arch-key-dot return"></i>return</span>';
  }

  function buildFailures() {
    const failures = state.g.failures || [];
    failureSelect.innerHTML = '<option value="">Failure drill</option>' + failures.map((failure, index) => (
      `<option value="${index}">${esc(failure.label)}</option>`
    )).join('');
    failureSelect.disabled = !failures.length;
  }

  function buildPaths() {
    byId('arch-paths').innerHTML = state.g.flow.map((step, index) => (
      `<button class="arch-path-step" data-flow="${index}" title="${esc(step.detail)}">
        <span class="n">${index + 1}</span><span>${esc(step.title)}</span>
      </button>`
    )).join('');
  }

  function layout() {
    const graph = state.g;
    const count = graph.layers.length;
    const colw = count >= 7 ? 158 : count === 6 ? 176 : 194;
    const nw = count >= 7 ? 132 : count === 6 ? 150 : 160;
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

  function renderSVG() {
    const graph = state.g;
    const { positions, W, H, nw, nh, labelMax, subMax, colw } = layout();
    state.W = W;
    state.H = H;

    const defs = `<defs>
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

    const layers = graph.layers.map((layer, i) => {
      const x = LEFT + i * colw + nw / 2;
      return `<text class="arch-layer" x="${x}" y="38" text-anchor="middle" fill="${colorFor(layer)}">${esc(layer.toUpperCase())}</text>
        <line x1="${x}" y1="52" x2="${x}" y2="${H - 22}" stroke="${colorFor(layer)}" stroke-opacity=".14"></line>`;
    }).join('');

    const edgeMarkup = graph.edges.map((edge, index) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) return '';
      const x1 = from.x + nw, y1 = from.y + nh / 2;
      const x2 = to.x, y2 = to.y + nh / 2;
      const forward = x2 >= x1;
      const dx = Math.max(52, Math.abs(x2 - x1) * 0.45);
      const d = forward
        ? `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
        : `M ${x1} ${y1} C ${x1 + 90} ${y1 - 75}, ${x2 - 90} ${y2 + 75}, ${x2} ${y2}`;
      const targetNode = nodeMap.get(edge.to);
      const isReturn = !!(targetNode && (targetNode.layer === 'Client' || targetNode.layer === 'Consumers' || targetNode.id === 'recipient' || targetNode.id === 'user'));
      const labelX = (x1 + x2) / 2;
      const labelY = (y1 + y2) / 2 - (forward ? 7 : 0) + ((index % 5) - 2) * 7;
      const label = edge.kind === 'obs' ? '' : `<text class="arch-edge-label ${edge.kind}" x="${labelX}" y="${labelY}" text-anchor="middle">${esc(edge.label)}</text>`;
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
        ${label}
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
      if (!pos) return '';
      const color = colorFor(node.layer);
      return `<g class="arch-node" data-node="${esc(node.id)}" transform="translate(${pos.x},${pos.y})">
        <rect class="arch-node-box" width="${nw}" height="${nh}" rx="9" stroke="${color}" stroke-opacity=".5"></rect>
        <rect class="arch-node-bar" width="4" height="${nh}" rx="2" fill="${color}"></rect>
        <text class="arch-node-label" x="13" y="23">${esc(cut(node.label, labelMax))}</text>
        <text class="arch-node-sub" x="13" y="41">${esc(cut(node.sub, subMax))}</text>
        <title>${esc(node.detail)}</title>
      </g>`;
    }).join('');

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
    svg.innerHTML = defs + layers + edgeMarkup + nodeMarkup;
    clearHighlights();
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

  function resetView(immediate = false) {
    state.target = { x: 0, y: 0, w: state.W, h: state.H };
    if (immediate) {
      state.view = { x: 0, y: 0, w: state.W, h: state.H };
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
    svg.querySelectorAll('.arch-edge-group').forEach((el) => el.classList.remove('dim', 'hot', 'fail', 'warn', 'flowing'));
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
    svg.querySelectorAll('.arch-edge-group').forEach((el) => {
      const active = edges.has(Number(el.dataset.edge));
      el.classList.toggle('dim', !active);
      if (active) el.classList.add(mode === 'fail' ? 'fail' : (mode === 'flow' ? 'flowing' : 'hot'));
      if (active && mode === 'flow') el.classList.add('hot');
    });
  }

  function selectNode(id) {
    stopPlay();
    stopFlow();
    state.failure = null;
    failureSelect.value = '';
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
  }

  function selectEdge(index) {
    stopPlay();
    stopFlow();
    state.failure = null;
    failureSelect.value = '';
    const edge = state.g.edges[index];
    if (!edge) return;
    state.selected = null;
    state.selectedEdge = index;
    focusNodes([edge.from, edge.to], [index], 'node');
    setTab('inspect');
    renderInspector();
    showInspector(true);
  }

  function onFailure() {
    stopPlay();
    stopFlow();
    state.selected = null;
    state.selectedEdge = null;
    setTab('inspect');
    const value = failureSelect.value;
    state.failure = value === '' ? null : Number(value);
    if (state.failure == null) {
      clearHighlights();
      renderInspector();
      return;
    }
    const failure = state.g.failures[state.failure];
    const failed = new Set(failure.nodes);
    const affected = new Set(failure.affected || []);
    const edges = state.g.edges.map((edge, index) => (
      failed.has(edge.from) || failed.has(edge.to) || affected.has(edge.from) || affected.has(edge.to) ? index : -1
    )).filter((index) => index >= 0);
    clearHighlights();
    svg.querySelectorAll('[data-node]').forEach((el) => {
      const id = el.dataset.node;
      const isFail = failed.has(id);
      const isWarn = affected.has(id);
      el.classList.toggle('dim', !isFail && !isWarn);
      if (isFail) el.classList.add('fail');
      if (isWarn) el.classList.add('warn');
    });
    svg.querySelectorAll('.arch-edge-group').forEach((el) => {
      const index = Number(el.dataset.edge);
      const edge = state.g.edges[index];
      const active = failed.has(edge.from) || failed.has(edge.to);
      el.classList.toggle('dim', !edges.includes(index));
      if (active) el.classList.add('fail');
      else if (edges.includes(index)) el.classList.add('hot');
    });
    renderInspector();
    showInspector(true);
  }

  function toggleTrace() {
    if (state.flow >= 0) {
      stopPlay();
      stopFlow();
      clearHighlights();
      renderInspector();
      return;
    }
    startFlowAt(0);
  }

  function startFlowAt(index) {
    stopPlay();
    state.failure = null;
    failureSelect.value = '';
    state.selected = null;
    state.selectedEdge = null;
    state.flow = Math.max(0, Math.min(state.g.flow.length - 1, index));
    applyFlow();
  }

  function stopFlow() {
    state.flow = -1;
    if (stepLabel) stepLabel.textContent = '—';
    if (narration) narration.textContent = 'Pick a step, or press Trace request.';
    if (traceBtn) traceBtn.textContent = 'Trace request';
    const paths = byId('arch-paths');
    if (paths) paths.querySelectorAll('[data-flow]').forEach((el) => el.classList.remove('on'));
  }

  function stepTrace(delta) {
    if (state.flow < 0) {
      startFlowAt(0);
      return;
    }
    const next = Math.max(0, Math.min(state.g.flow.length - 1, state.flow + delta));
    state.flow = next;
    applyFlow();
  }

  function applyFlow() {
    const step = state.g.flow[state.flow];
    if (!step) return;
    const edges = step.edges.map(([from, to]) => (
      state.g.edges.findIndex((edge) => edge.from === from && edge.to === to)
    )).filter((index) => index >= 0);
    focusNodes(step.nodes, edges, 'flow');
    stepLabel.textContent = `${state.flow + 1}/${state.g.flow.length}`;
    narration.textContent = step.detail;
    traceBtn.textContent = 'Stop trace';
    byId('arch-paths').querySelectorAll('[data-flow]').forEach((el) => {
      el.classList.toggle('on', Number(el.dataset.flow) === state.flow);
    });
    setTab('inspect');
    renderInspector();
  }

  function togglePlay() {
    if (state.timer) {
      stopPlay();
      return;
    }
    if (state.flow < 0) startFlowAt(0);
    byId('arch-play').textContent = '❚❚ Pause';
    state.timer = setInterval(() => {
      if (state.flow >= state.g.flow.length - 1) {
        stopPlay();
        return;
      }
      state.flow += 1;
      applyFlow();
    }, 2100);
  }

  function stopPlay() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
    const play = byId('arch-play');
    if (play) play.textContent = '▶ Play';
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
    return `<ul class="arch-list">${(items || []).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
  }

  function renderInspector() {
    const graph = state.g;
    if (!graph || !panel) return;

    if (state.tab === 'why') {
      panel.innerHTML = `<div class="arch-panel-kicker">WHY IT WORKS</div>
        <h4>${esc(graph.title)}</h4>
        <p class="arch-panel-sub">${esc(graph.subtitle)}</p>
        ${listHTML(graph.why)}`;
      return;
    }
    if (state.tab === 'tradeoffs') {
      panel.innerHTML = `<div class="arch-panel-kicker">TRADE-OFFS</div>
        <h4>What you give up</h4>
        ${listHTML(graph.tradeoffs)}
        <div class="arch-hint">Strong answers name the trade-off and the condition under which they would choose the other side.</div>`;
      return;
    }

    if (state.failure != null) {
      const failure = graph.failures[state.failure];
      panel.innerHTML = `<div class="arch-panel-kicker danger">FAILURE DRILL</div>
        <h4>${esc(failure.label)}</h4>
        <p class="arch-panel-sub">${esc(failure.detail)}</p>
        <div class="arch-panel-block"><span>Mitigation</span><p>${esc(failure.mitigation)}</p></div>
        <div class="arch-tags">${failure.nodes.map((id) => `<span class="arch-tag fail">${esc(nodeMap.get(id)?.label || id)}</span>`).join('')}
        ${(failure.affected || []).map((id) => `<span class="arch-tag warn">${esc(nodeMap.get(id)?.label || id)}</span>`).join('')}</div>
        <div class="arch-hint">Select “Failure drill” again to clear it.</div>`;
      return;
    }

    if (state.flow >= 0) {
      const step = graph.flow[state.flow];
      panel.innerHTML = `<div class="arch-panel-kicker">TRACE ${state.flow + 1}/${graph.flow.length}</div>
        <h4>${esc(step.title)}</h4>
        <p class="arch-panel-sub">${esc(step.detail)}</p>
        <div class="arch-tags">${step.nodes.map((id) => `<span class="arch-tag">${esc(nodeMap.get(id)?.label || id)}</span>`).join('')}</div>
        <div class="arch-hint">Use ← / → or Play to walk the request through the system.</div>`;
      return;
    }

    if (state.selectedEdge != null) {
      const edge = graph.edges[state.selectedEdge];
      panel.innerHTML = `<div class="arch-panel-kicker">CONNECTION</div>
        <h4>${esc(nodeMap.get(edge.from)?.label || edge.from)} → ${esc(nodeMap.get(edge.to)?.label || edge.to)}</h4>
        <p class="arch-panel-sub">${esc(edge.detail || '')}</p>
        <div class="arch-defs">
          <div><span>Flow</span><b>${esc(edge.label)}</b></div>
          <div><span>Type</span><b>${esc(edge.kind)}</b></div>
        </div>`;
      return;
    }

    if (state.selected != null) {
      const node = nodeMap.get(state.selected);
      if (!node) return;
      const color = colorFor(node.layer);
      panel.innerHTML = `<div class="arch-panel-kicker" style="color:${color}">${esc(node.layer.toUpperCase())}</div>
        <h4>${esc(node.label)}</h4>
        <p class="arch-panel-sub">${esc(node.sub)}</p>
        <p class="arch-panel-body">${esc(node.detail)}</p>
        ${listHTML(node.spec)}
        <div class="arch-defs">
          <div><span>Incoming</span><b>${edgeCount(node.id, 'in')}</b></div>
          <div><span>Outgoing</span><b>${edgeCount(node.id, 'out')}</b></div>
        </div>`;
      return;
    }

    panel.innerHTML = `<div class="arch-panel-kicker">INTERACTIVE MAP</div>
      <h4>${esc(graph.title)}</h4>
      <p class="arch-panel-sub">${esc(graph.subtitle)}</p>
      <div class="arch-stats">
        <div><b>${graph.nodes.length}</b><span>components</span></div>
        <div><b>${graph.layers.length}</b><span>layers</span></div>
        <div><b>${graph.flow.length}</b><span>trace steps</span></div>
      </div>
      <div class="arch-panel-block"><span>Start here</span><p>Press <b>Trace request</b> to animate the critical path, then click any component for its role, design choices, and failure behavior.</p></div>
      <div class="arch-hint">Blue dots = sync · amber diamonds = async · gray squares = telemetry · mint = return to the user. Packets animate along each edge.<br>Scroll to zoom · drag to pan · click a node or connection.</div>`;
  }

  function edgeCount(id, direction) {
    return state.g.edges.filter((edge) => (direction === 'in' ? edge.to === id : edge.from === id)).length;
  }

  init();

  return {
    open,
    close,
    toggleInspector,
    has: (id) => !!DESIGN_GRAPHS[id]
  };
})();
