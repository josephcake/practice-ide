/* ============================================================
   CONCEPT LIBRARY
   One card per building block or pattern. Components on the maps
   resolve to a card through `match` (tested against id + label + sub).
   `shape` drives how the node is drawn on the canvas.
   `aliases` are the phrases auto-linked inside explanations.
   ============================================================ */

const CONCEPTS = [
  /* ---------------- clients and edge ---------------- */
  {
    id: 'client', name: 'Client', kind: 'component', shape: 'client',
    match: /\b(client|browser|mobile|app|rider|driver|participant|subscriber|user|recipient|trader|regulator|builder ui|ide)\b/,
    what: 'Whatever a human or program uses to talk to your system: a browser, a phone app, an SDK, a trading terminal.',
    why: 'Every design starts and ends here. The request path begins at the client and the response must make it back.',
    tradeoffs: ['Logic in the client (optimistic UI, local cache) feels fast but cannot be trusted for money or security.', 'Thin clients are easy to update; thick clients work offline.'],
    usedBy: ['Every product'],
    alt: 'Server-rendered pages vs rich clients'
  },
  {
    id: 'cdn', name: 'CDN', kind: 'component', shape: 'edge',
    match: /\bcdn\b|edge media/, aliases: ['CDN', 'origin shield', 'origin shielding'],
    what: 'A network of servers close to users that caches static bytes (images, video, JS) and serves them without touching your origin.',
    why: 'Physics: a round trip across an ocean is ~150 ms. Serving from 20 ms away makes media fast and removes most origin load.',
    tradeoffs: ['Cached content is hard to take down instantly (purges take seconds to minutes).', 'Costs scale with egress bytes.', 'Signed URLs are needed for private content.'],
    usedBy: ['Cloudflare', 'Akamai', 'Fastly', 'Netflix Open Connect', 'Meta / Instagram edge'],
    alt: 'Serving directly from object storage (fine for small scale)',
    without: "Every image and video byte comes from your origin, often across an ocean. Pages load slowly far from your datacenter, and egress and origin load grow with every view.",
    breaks: "Requests fall through to the origin. Media gets slow everywhere and the origin can be overwhelmed by traffic the CDN used to absorb.",
    protect: "Use multiple CDNs, an origin shield, and placeholder images so pages still render."
  },
  {
    id: 'gateway', name: 'API gateway', kind: 'component', shape: 'edge',
    match: /gateway|channel api|\bedge\b|ingest gateway|order gateway/, aliases: ['API gateway', 'gateway'],
    what: 'The single front door for API traffic: terminates TLS, authenticates, rate-limits, and routes each request to the right service.',
    why: 'Cross-cutting concerns live in one place instead of being re-implemented (and forgotten) in every service.',
    tradeoffs: ['An extra network hop (usually < 1 ms).', 'A shared component every team depends on: needs high availability.', 'Too much business logic here turns it into a monolith.'],
    usedBy: ['Netflix Zuul', 'Amazon API Gateway', 'Kong', 'Envoy at Lyft'],
    alt: 'Load balancer + per-service auth (simpler, less control)',
    without: "Every service has to do its own TLS, auth, and rate limiting. Someone eventually forgets one, and clients have to know the address of every service.",
    breaks: "Nothing gets in. The whole product is down even though every service behind it is healthy.",
    protect: "Run several stateless gateway instances behind a load balancer across zones, and keep business logic out of it."
  },
  {
    id: 'lb', name: 'Load balancer', kind: 'component', shape: 'edge',
    match: /load balanc/, aliases: ['load balancer', 'load balancing'],
    what: 'Spreads incoming connections across many identical servers and stops sending traffic to unhealthy ones.',
    why: 'Lets you scale horizontally and survive a server dying without users noticing.',
    tradeoffs: ['L4 (TCP) is fast but blind to URLs; L7 (HTTP) can route by path but costs more CPU.', 'Sticky sessions break even spreading.'],
    usedBy: ['AWS ELB / ALB', 'NGINX', 'HAProxy', 'Google Maglev'],
    alt: 'DNS round-robin (cheap, slow to react)',
    without: "One server takes all traffic, and when it dies everything dies. You cannot add capacity by adding servers.",
    breaks: "All traffic stops at the front door, or keeps going to dead servers if health checks fail.",
    protect: "Run redundant load balancers (active/active), with fast health checks and DNS failover."
  },
  {
    id: 'proxy', name: 'Reverse proxy / preview router', kind: 'component', shape: 'edge',
    match: /preview|proxy/,
    what: 'Routes a public URL to a process running somewhere inside your fleet (for example port 5000 inside a user sandbox).',
    why: 'Gives every project a stable, authenticated URL without exposing internal hosts.',
    tradeoffs: ['Must re-route when the backend moves.', 'Long-lived connections (WebSocket, HMR) need special care.'],
    usedBy: ['Vercel preview URLs', 'Replit', 'NGINX', 'Cloudflare Tunnel'],
    alt: 'Direct port exposure (insecure)',
    without: "Every project would need its own public address and certificate, and internal hosts would be exposed directly.",
    breaks: "Previews and published URLs stop loading, even though the apps behind them are still running.",
    protect: "Run the proxy stateless and replicated, with a routing table that rebuilds on restart."
  },

  /* ---------------- async ---------------- */
  {
    id: 'dlq', name: 'Dead-letter queue', kind: 'component', shape: 'queue',
    match: /dead-letter|\bdlq\b|poison/, aliases: ['dead-letter queue', 'DLQ', 'poison message'],
    what: 'A side queue where messages go after they fail too many times.',
    why: 'One malformed message cannot block the whole queue or retry forever, and you keep it to inspect and replay.',
    tradeoffs: ['Someone has to watch and drain it.', 'Replay must be idempotent.'],
    usedBy: ['Amazon SQS', 'Kafka dead-letter topics', 'RabbitMQ'],
    alt: 'Drop and log (loses data)',
    without: "A single malformed message is retried forever, blocks everything behind it, or is silently dropped and lost.",
    breaks: "Failed messages have nowhere to go, so they are dropped or keep clogging the main queue.",
    protect: "Alert on DLQ growth, make it durable, and provide a safe replay tool."
  },
  {
    id: 'ring', name: 'Ring buffer', kind: 'component', shape: 'queue',
    match: /ring buffer|ring\b/, aliases: ['ring buffer'],
    what: 'A fixed-size circular array that a producer writes into and consumers read from by sequence number, with no locks or allocation.',
    why: 'Moves millions of messages per second between threads with predictable microsecond latency.',
    tradeoffs: ['Fixed capacity: a slow reader forces a policy (block, drop, or detach).', 'Harder to reason about than a plain queue.'],
    usedBy: ['LMAX Disruptor', 'Linux io_uring', 'High-frequency trading systems'],
    alt: 'Blocking queue (simpler, slower)',
    without: "Threads hand off messages through locks and allocations, so latency becomes unpredictable and throughput drops sharply under load.",
    breaks: "The buffer fills when a reader stalls, and the producer has to block, drop, or disconnect someone.",
    protect: "Detach slow readers, size the buffer for bursts, and resnapshot consumers that fall behind."
  },
  {
    id: 'outbox', name: 'Transactional outbox', kind: 'component', shape: 'queue',
    match: /outbox/, aliases: ['transactional outbox', 'outbox', 'dual-write', 'dual write'],
    what: 'Write the business change and an "event to publish" row in the same database transaction; a relay later publishes those rows to the message bus.',
    why: 'Solves the dual-write problem: you can never commit the payment but lose the event (or send the event for a payment that rolled back).',
    tradeoffs: ['Events are delayed by the relay (usually milliseconds).', 'Consumers must handle duplicates (at-least-once).'],
    usedBy: ['Debezium outbox router', 'Payment and banking platforms', 'Microservices at scale'],
    alt: 'Change data capture on the main tables',
    without: "You write to the database and then publish to the bus separately. A crash in between leaves a committed payment with no event, or an event for a payment that rolled back.",
    breaks: "Events stop flowing. The source of truth stays correct, but downstream systems (settlement, notifications) silently fall behind.",
    protect: "Alert on outbox lag, make the relay restartable from the last published row, and keep consumers idempotent."
  },
  {
    id: 'workers', name: 'Worker pool', kind: 'component', shape: 'service',
    match: /workers?\b|transcod|batch|settlement|reporting|relay/,
    what: 'Stateless processes that pull jobs from a queue and do the slow work (send email, transcode video, settle payments).',
    why: 'Keeps slow or flaky work off the user request path, and scales independently by queue depth.',
    tradeoffs: ['Results are eventually consistent.', 'Retries need idempotency and backoff.'],
    usedBy: ['Sidekiq at GitHub and Shopify', 'Celery at Instagram', 'AWS Lambda'],
    alt: 'Doing the work inline (simple, slow, fragile)',
    without: "Slow work (emails, transcoding, settlement) runs inside the user's request, so responses take seconds and a flaky dependency fails the whole request.",
    breaks: "Jobs pile up in the queue. Users do not see errors right away, but results (emails, renditions, settlements) arrive late or not at all.",
    protect: "Autoscale on queue depth, retry with backoff, and send poison jobs to a dead-letter queue."
  },

  {
    id: 'stream', name: 'Event log / message bus', kind: 'component', shape: 'queue',
    match: /kafka|event bus|click stream|firehose|bus\b|invalidation|cdc|transaction events|trade events|events\b|stream(er)?\b|fan-out|fanout|delivery queue|request queue|priority queue|queue\b|feed fan/,
    aliases: ['Kafka', 'message queue', 'event bus', 'message bus', 'pub/sub'],
    what: 'A durable, ordered log of events. Producers append; many consumers read at their own pace using an offset.',
    why: 'Decouples services in time and speed: the producer does not wait for, or break because of, slow consumers. Lets you replay history.',
    tradeoffs: ['Usually at-least-once delivery: consumers must be idempotent.', 'Ordering is only guaranteed within a partition.', 'Another system to operate.'],
    usedBy: ['Kafka at LinkedIn (its origin), Uber, Netflix', 'Amazon SQS / Kinesis', 'Google Pub/Sub', 'RabbitMQ'],
    alt: 'Direct synchronous calls (simpler, tightly coupled)',
    without: "Services call each other directly and synchronously. One slow consumer slows the producer, and an outage in one service cascades into the others. There is no history to replay.",
    breaks: "Producers cannot hand off work. Depending on the design they block, buffer locally, or drop events, and downstream views go stale.",
    protect: "Replicate partitions across brokers, buffer at the producer with limits, and let consumers resume from their offset."
  },
  /* ---------------- data ---------------- */
  {
    id: 'cache', name: 'Cache (Redis / Memcached)', kind: 'component', shape: 'cache',
    match: /cache|redis|counter store|feed cache|kv \/ prompt|prefix/,
    aliases: ['cache', 'Redis', 'Memcached', 'cache-aside', 'read-through', 'write-through', 'hit ratio'],
    what: 'An in-memory key-value store that keeps hot data close to the service so most reads never touch the database.',
    why: 'Memory reads take ~0.1 ms vs several ms for a database, and a 99% hit ratio means the database sees 100× fewer reads.',
    tradeoffs: ['Stale data: you must choose TTLs and an invalidation strategy.', 'A cache outage can stampede the database.', 'Memory is expensive per GB.'],
    usedBy: ['Meta memcache (TAO)', 'Twitter timelines in Redis', 'Stack Overflow', 'GitHub'],
    alt: 'Read replicas (fresher, slower)',
    without: "Every read goes to the database. Latency rises from about 0.1 ms to several ms, and the database needs many times more capacity for the same traffic.",
    breaks: "All reads suddenly hit the database. Latency spikes and the database can be overwhelmed (a cache stampede).",
    protect: "Replicate the cache, coalesce identical requests (single-flight), and keep a circuit breaker that sheds load from the database."
  },
  {
    id: 'objectstore', name: 'Object storage', kind: 'component', shape: 'db',
    match: /object store|blob|media|project files|model store|weights/,
    aliases: ['object storage', 'S3', 'blob storage'],
    what: 'Stores large immutable files (photos, video, raw emails, model weights) by key, cheaply and durably.',
    why: 'Large bytes do not belong in your database. Object stores give 11 nines of durability at a fraction of the cost.',
    tradeoffs: ['Higher latency (tens of ms) than a database.', 'No partial updates or queries: you replace whole objects.'],
    usedBy: ['Amazon S3', 'Google Cloud Storage', 'Meta Haystack', 'Dropbox Magic Pocket'],
    alt: 'Distributed file system (HDFS)',
    without: "Large files are stored in the database or on app servers' disks. The database bloats, backups crawl, and files are lost when a server dies.",
    breaks: "Uploads fail and media that is not already cached at the edge cannot be served.",
    protect: "Use a managed store with cross-region replication, and let the CDN keep serving cached copies."
  },
  {
    id: 'search', name: 'Search index', kind: 'component', shape: 'db',
    match: /search index|inverted index|\bindex\b|search\b/, aliases: ['inverted index', 'Elasticsearch', 'search index'],
    what: 'An inverted index that maps each word to the documents containing it, so text queries answer in milliseconds.',
    why: 'A LIKE query over billions of rows is a full scan. An index turns it into a few lookups.',
    tradeoffs: ['Updated asynchronously, so newly written data is not searchable for a moment.', 'Large and expensive to rebuild.'],
    usedBy: ['Elasticsearch at GitHub and Wikipedia', 'Lucene', 'Twitter Earlybird', 'Gmail search'],
    alt: 'Database full-text index (fine at small scale)',
    without: "Text search becomes a full scan of the primary database, which is slow and steals capacity from real traffic.",
    breaks: "Search returns errors or stale results, while the rest of the product keeps working.",
    protect: "Degrade gracefully (show recent items from the database), and keep the index rebuildable from the source of truth."
  },
  {
    id: 'geo', name: 'Geospatial index', kind: 'component', shape: 'db',
    match: /geospatial|h3|geohash/, aliases: ['geohash', 'H3', 'geospatial index'],
    what: 'Divides the map into cells (hexagons or squares) so "drivers near me" becomes a lookup of a few neighbouring cells.',
    why: 'Computing the distance to a million drivers per request is impossible; cell lookups make it O(nearby).',
    tradeoffs: ['Cell size is a trade-off: too big returns too many candidates, too small misses neighbours.', 'Moving objects need constant reindexing.'],
    usedBy: ['Uber H3', 'Google S2 (Maps, Foursquare)', 'Lyft (geohash)', 'Redis GEO'],
    alt: 'Quadtree or R-tree',
    without: "Finding nearby drivers means measuring the distance to every driver on every request. That is far too slow at a million drivers.",
    breaks: "Matching cannot find nearby supply, so requests wait or fail even though drivers are online.",
    protect: "Shard by city, replicate in memory, and rebuild quickly from the live location stream."
  },
  {
    id: 'ledger', name: 'Ledger (double-entry)', kind: 'component', shape: 'db',
    match: /ledger|entries log|journal|core ledger/, aliases: ['double-entry', 'ledger', 'append-only', 'journal', 'write-ahead log'],
    what: 'An append-only record where every money movement is at least two entries (debit and credit) that sum to zero.',
    why: 'Money can never be created or lost silently, every balance is explainable, and history is never edited, only reversed.',
    tradeoffs: ['Grows forever: needs snapshots and archiving.', 'Strong consistency limits write throughput on hot accounts.'],
    usedBy: ['Stripe', 'Square Books', 'Every bank core', 'Modern Treasury'],
    alt: 'Mutable balance column (simple, unauditable)',
    without: "Balances are a single mutable number. You cannot explain how a balance was reached, and a bug or partial write can create or destroy money unnoticed.",
    breaks: "No money can move safely. The product has to stop accepting transfers (fail closed) until the ledger is back.",
    protect: "Use synchronous replication, idempotent retries, a read-only mode for balances, and continuous reconciliation."
  },
  {
    id: 'idem', name: 'Idempotency store', kind: 'component', shape: 'db',
    match: /idempot|dedupe/, aliases: ['idempotency key', 'idempotency', 'idempotent', 'dedupe', 'deduplication'],
    what: 'Remembers each request\'s unique key and the result it produced, so a retry returns the same result instead of repeating the action.',
    why: 'Networks time out. Without it, a retried "send $25" sends $50.',
    tradeoffs: ['Extra write per request.', 'Keys need a retention window.', 'Key choice matters: too broad blocks legitimate repeats.'],
    usedBy: ['Stripe Idempotency-Key header', 'Adyen', 'AWS APIs (client tokens)'],
    alt: 'Natural unique constraints in the database',
    without: "A client that times out and retries performs the action twice: two charges, two transfers, two emails.",
    breaks: "You cannot tell retries from new requests. Either block writes, or accept a risk of duplicates.",
    protect: "Store keys in the same database transaction as the result, and fail closed for money-moving requests."
  },
  {
    id: 'warehouse', name: 'Data warehouse', kind: 'component', shape: 'db',
    match: /warehouse|\bdw\b/, aliases: ['data warehouse', 'change data capture'],
    what: 'A separate analytical database, fed by change data capture, for reports and heavy queries.',
    why: 'Analysts and regulators can scan years of data without slowing down the production database.',
    tradeoffs: ['Data lags production by minutes to hours.', 'Another copy to secure and reconcile.'],
    usedBy: ['Snowflake', 'Google BigQuery', 'Amazon Redshift'],
    alt: 'Read replica for reports',
    without: "Reports and analysts run heavy queries against the production database and slow down customers.",
    breaks: "Reports and dashboards go stale, but customer traffic is unaffected.",
    protect: "Make CDC replayable so the warehouse can catch up, and show data freshness on reports."
  },
  {
    id: 'database', name: 'Database', kind: 'component', shape: 'db',
    match: /\bdb\b|database|store\b|mapping|accounts|positions|snapshot|metadata|trip store|config|preferences|templates|persistent fs|delivery store|package cache|order book|book\b|files\b/,
    aliases: ['sharded', 'sharding', 'shard', 'replica', 'replication', 'ACID', 'Postgres'],
    what: 'The durable source of truth. Relational databases (Postgres, MySQL) give transactions; key-value stores (DynamoDB, Cassandra) give simple, massive scale.',
    why: 'Everything else (caches, indexes, queues) can be rebuilt. The database is what must not lose data.',
    tradeoffs: ['One primary limits write throughput; sharding fixes that but makes cross-shard queries hard.', 'Strong consistency costs latency and availability.'],
    usedBy: ['Postgres at Instagram (sharded)', 'MySQL at GitHub, Shopify, Uber', 'DynamoDB at Amazon', 'Cassandra at Netflix, Apple'],
    alt: 'Pick relational for transactions, key-value for scale',
    without: "There is no durable source of truth. Anything in memory is lost on a restart, and caches have nothing to rebuild from.",
    breaks: "Writes fail. Reads may continue from caches or replicas, but anything that needs fresh or durable data stops.",
    protect: "Replicate with automatic failover, take backups with point-in-time recovery, and keep retries idempotent."
  },

  /* ---------------- observability ---------------- */
  {
    id: 'obs', name: 'Observability (metrics, logs, traces)', kind: 'component', shape: 'obs',
    match: /metric|trace|observab|audit|dashboard|lag \/ gaps|latency \/ depth|slo/, aliases: ['p99', 'SLO', 'tail latency', 'tracing'],
    what: 'Metrics (numbers over time), logs (events), and traces (one request across services) that tell you what the system is doing.',
    why: 'You cannot fix what you cannot see. Interviewers expect you to name the metric that would page you.',
    tradeoffs: ['High-cardinality metrics get expensive.', 'Sampling traces saves money but can miss rare failures.'],
    usedBy: ['Prometheus + Grafana', 'Datadog', 'Jaeger (from Uber)', 'Google Dapper'],
    alt: '—',
    without: "You learn about outages from customers, and have no data to find the cause or prove the fix worked.",
    breaks: "The system keeps serving users, but you are blind: alerts do not fire and incidents go unnoticed.",
    protect: "Monitor the monitoring (heartbeat alerts), and keep basic health checks independent of the main pipeline."
  },

  /* ---------------- services ---------------- */
  {
    id: 'ratelimiter', name: 'Rate limiter', kind: 'component', shape: 'service',
    match: /limiter|fallback|local bucket/, aliases: ['token bucket', 'leaky bucket', 'sliding window', 'rate limit', 'rate-limit'],
    what: 'Counts requests per key (user, API key, IP) and rejects ones over the limit with HTTP 429.',
    why: 'Protects your system from abuse and noisy neighbours, and enforces paid plan limits.',
    tradeoffs: ['Central counters are accurate but add a network hop; local counters are fast but approximate.', 'Fail-open risks abuse; fail-closed risks an outage.'],
    usedBy: ['Stripe (token bucket in Redis)', 'GitHub API', 'Cloudflare', 'Envoy'],
    alt: 'Queueing / backpressure instead of rejecting',
    without: "One client or bot can flood the API, starving everyone else and running up costs.",
    breaks: "You must choose: let everything through (fail open, risk abuse) or reject traffic (fail closed, cause an outage).",
    protect: "Keep a local in-process fallback bucket, and decide fail-open or fail-closed per route."
  },
  {
    id: 'idgen', name: 'ID generator', kind: 'component', shape: 'service',
    match: /allocator|idgen|code alloc/, aliases: ['base62', 'Snowflake'],
    what: 'Hands out unique IDs (or short codes) without every request coordinating on one global counter.',
    why: 'A single counter is a bottleneck and single point of failure. Pre-allocated ranges or time-based IDs scale.',
    tradeoffs: ['Ranges leave gaps when a node dies.', 'Time-based IDs depend on clocks.', 'Sequential IDs are guessable.'],
    usedBy: ['Twitter Snowflake', 'Instagram sharded IDs', 'Discord Snowflakes'],
    alt: 'Random IDs with collision check',
    without: "Every write has to coordinate on one global counter, which becomes a bottleneck and a single point of failure, or random IDs risk collisions.",
    breaks: "New records cannot get an ID, so creates fail while reads keep working.",
    protect: "Pre-allocate ID ranges locally, and fall back to time-based IDs (Snowflake style)."
  },
  {
    id: 'sequencer', name: 'Sequencer / single writer', kind: 'component', shape: 'service',
    match: /sequencer|matching engine|matcher/, aliases: ['sequencer', 'sequence number', 'single writer', 'single-writer', 'deterministic replay'],
    what: 'One component that stamps every input with an increasing sequence number and processes them in that order on one thread.',
    why: 'Defines one true order, so there are no locks or races, and replaying the same inputs reproduces the exact same state.',
    tradeoffs: ['One thread caps throughput per shard (shard by symbol or account).', 'Needs fast failover to a hot replica.'],
    usedBy: ['LMAX exchange', 'NASDAQ', 'CME Globex', 'Kafka partition leaders'],
    alt: 'Locks and multi-threading (faster on paper, nondeterministic)',
    without: "Several threads process orders concurrently. Ordering depends on timing, you need locks, and replaying the same inputs can produce a different result.",
    breaks: "Nothing is ordered or processed, so the market or stream halts.",
    protect: "Keep a hot replica replaying the same journal and promote it after verifying the last sequence number."
  },
  {
    id: 'replica', name: 'Hot replica', kind: 'component', shape: 'db',
    match: /replica/,
    what: 'A standby copy that applies the same inputs and is ready to take over instantly.',
    why: 'Failover in milliseconds instead of rebuilding state from scratch.',
    tradeoffs: ['Double the hardware.', 'Lagging replicas lose recent data on failover.'],
    usedBy: ['Exchange matching engines', 'Postgres streaming replication', 'MySQL semi-sync'],
    alt: 'Cold restore from backups',
    without: "Recovering from a crash means rebuilding state from scratch, which can take minutes to hours.",
    breaks: "You lose your fast failover. The primary keeps working, but the next crash means a long outage.",
    protect: "Alert on replica lag and block promotion until the replica has caught up."
  },
  {
    id: 'risk', name: 'Risk / fraud engine', kind: 'component', shape: 'service',
    match: /risk|fraud|aml|limit checks|kyc|identity/, aliases: ['pre-trade', 'fraud'],
    what: 'Scores or checks each transaction against rules and models before (and after) money moves.',
    why: 'Stopping a bad transaction is far cheaper than recovering money after it settled.',
    tradeoffs: ['Every check adds latency to the critical path.', 'False positives block real customers.'],
    usedBy: ['Stripe Radar', 'PayPal risk', 'Bank AML systems'],
    alt: 'Post-transaction monitoring only',
    without: "Bad or fraudulent transactions go through, and you only find out after money has left.",
    breaks: "You must choose: block all transactions (safe, but an outage) or let them through unchecked (risky).",
    protect: "Fail closed for high-risk or high-value paths, cache simple rules locally, and review after the fact."
  },
  {
    id: 'scheduler', name: 'Scheduler', kind: 'component', shape: 'service',
    match: /scheduler|dispatch|matching\b/, aliases: ['continuous batching', 'bin packing'],
    what: 'Decides what runs where and when: placing containers on machines, batching GPU requests, or offering trips to drivers.',
    why: 'Good placement keeps hardware busy and users waiting less.',
    tradeoffs: ['Optimal scheduling is expensive; greedy is fast and usually good enough.', 'Fairness vs utilisation.'],
    usedBy: ['Kubernetes', 'Google Borg', 'vLLM (continuous batching)', 'Uber dispatch'],
    alt: '—',
    without: "Work lands on random machines. Some overload while others sit idle, and requests wait longer than they need to.",
    breaks: "New work cannot be placed, but work that is already running continues.",
    protect: "Run schedulers in leader/standby mode, and let running work keep going during a scheduler outage."
  },
  {
    id: 'sandbox', name: 'Sandbox / container runtime', kind: 'component', shape: 'service',
    match: /sandbox|container|microvm|gpu workers/,
    what: 'An isolated environment with CPU, memory, and network limits where untrusted code runs.',
    why: 'User or AI-generated code must never touch the host or other users.',
    tradeoffs: ['Stronger isolation (microVMs) is slower to start than containers.', 'Warm pools cut cold starts but waste idle capacity.'],
    usedBy: ['AWS Firecracker (Lambda, Fly.io)', 'gVisor (Cloud Run)', 'Docker', 'Replit'],
    alt: 'Process-level sandboxing (weaker)',
    without: "Untrusted code runs directly on your servers, where it can read other users' data or take down the host.",
    breaks: "Users cannot run or preview their code. Other users are unaffected if isolation holds.",
    protect: "Restart automatically, restore from the last snapshot, and keep warm spares."
  },
  {
    id: 'collab', name: 'Real-time collaboration (CRDT / OT)', kind: 'component', shape: 'service',
    match: /collab|crdt/, aliases: ['CRDT', 'operational transform'],
    what: 'Merges edits from several people typing at once so everyone converges on the same document.',
    why: 'Locking a file for one editor kills collaboration.',
    tradeoffs: ['CRDTs work offline but grow metadata; OT needs a central server.', 'Hard to test; convergence bugs are subtle.'],
    usedBy: ['Google Docs (OT)', 'Figma (CRDT-inspired)', 'Yjs / Automerge'],
    alt: 'File locking',
    without: "Only one person can edit at a time, or concurrent edits overwrite each other.",
    breaks: "Users fall back to editing alone, and edits made during the outage must merge when it reconnects.",
    protect: "Keep edits locally and resync when the connection returns. CRDTs make that merge automatic."
  },
  {
    id: 'llm', name: 'Model inference', kind: 'component', shape: 'service',
    match: /codegen model|\bllm\b/, aliases: ['KV cache', 'prefill', 'decode'],
    what: 'Runs a large language model: prefill reads the prompt, decode generates tokens one by one.',
    why: 'The core of any AI product; also its biggest cost and latency driver.',
    tradeoffs: ['Bigger models answer better but slower and costlier.', 'Batching raises throughput but adds queueing delay.'],
    usedBy: ['vLLM', 'NVIDIA TensorRT-LLM', 'DeepSeek', 'OpenAI'],
    alt: 'Smaller distilled model for easy requests',
    without: "There is no AI product. Every answer has to be authored by hand.",
    breaks: "Generations stall or fail. Users wait with no output.",
    protect: "Stream partial output, retry on another replica if no tokens have been sent yet, and keep a fallback model."
  },
  {
    id: 'provider', name: 'External provider adapter', kind: 'component', shape: 'external',
    match: /provider|exchange feed|market data|smtp/,
    what: 'Wraps a third party (SMS vendor, card network, exchange feed, email servers) behind your own interface.',
    why: 'You cannot control their uptime. An adapter lets you add timeouts, circuit breakers, and a second vendor.',
    tradeoffs: ['Lowest-common-denominator API across vendors.', 'Two vendors double integration work.'],
    usedBy: ['Twilio', 'SendGrid', 'APNs / FCM', 'Visa / Mastercard networks'],
    alt: 'Call the vendor directly (fragile)',
    without: "Your code calls each vendor directly. Every vendor quirk leaks into your system, and switching vendors means a rewrite.",
    breaks: "That channel stops: no SMS, no card authorizations, no price feed. Retries can pile up and amplify the outage.",
    protect: "Add a circuit breaker, a second vendor to fail over to, and a queue that drains when the vendor recovers."
  },
  {
    id: 'service', name: 'Application service', kind: 'component', shape: 'service',
    match: /.*/,
    what: 'Stateless code that owns one piece of business logic and talks to its data stores.',
    why: 'Stateless services scale by adding copies behind a load balancer, and fail without losing data.',
    tradeoffs: ['Splitting into many services adds network hops and operational load.', 'One big service is simpler until teams collide.'],
    usedBy: ['Every large backend'],
    alt: 'Monolith vs microservices',
    without: "Its logic has to live somewhere else: inside another service (a bigger, more coupled monolith) or in the client (untrusted).",
    breaks: "The feature it owns stops working, and any caller waiting on it slows down or errors.",
    protect: "Run several instances across zones, set timeouts and retries on callers, and degrade the feature instead of the whole product."
  },

  /* ---------------- patterns (not boxes, but you must explain them) ---------------- */
  { id: 'p-cb', name: 'Circuit breaker', kind: 'pattern', aliases: ['circuit breaker', 'circuit breakers'],
    what: 'After repeated failures to a dependency, stop calling it for a while and fail fast or use a fallback.',
    why: 'Prevents a slow dependency from tying up all your threads and taking you down with it.',
    tradeoffs: ['Needs tuning: too eager trips on blips, too lazy does not help.'], usedBy: ['Netflix Hystrix', 'resilience4j', 'Envoy'] },
  { id: 'p-backoff', name: 'Exponential backoff with jitter', kind: 'pattern', aliases: ['backoff', 'jitter', 'jittered'],
    what: 'Wait longer after each failed retry (1 s, 2 s, 4 s …) plus a random offset.',
    why: 'Stops thousands of clients retrying in lockstep and hammering a recovering service.',
    tradeoffs: ['Slower recovery for individual requests.'], usedBy: ['AWS SDKs', 'gRPC', 'Every robust client'] },
  { id: 'p-stampede', name: 'Cache stampede / single-flight', kind: 'pattern', aliases: ['stampede', 'thundering herd', 'single-flight', 'request coalescing', 'coalescing'],
    what: 'When a hot key expires, many requests miss at once. Single-flight lets one request load it while the rest wait for that result.',
    why: 'Without it, a cache expiry can send 10,000 identical queries to the database in one second.',
    tradeoffs: ['Waiting requests add latency for one load.'], usedBy: ['Go singleflight', 'Meta memcache leases', 'NGINX proxy_cache_lock'] },
  { id: 'p-hotkey', name: 'Hot key / hot shard', kind: 'pattern', aliases: ['hot key', 'hot keys', 'hot shard', 'hot account', 'hot accounts', 'celebrity'],
    what: 'One key (a viral link, a celebrity, a busy account) gets far more traffic than any shard can handle.',
    why: 'Sharding spreads keys, not load. One hot key still lands on one shard.',
    tradeoffs: ['Replicating the key or splitting it adds complexity.'], usedBy: ['Twitter celebrity timelines', 'Instagram', 'DynamoDB adaptive capacity'] },
  { id: 'p-consistent-hash', name: 'Consistent hashing', kind: 'pattern', aliases: ['consistent hashing'],
    what: 'Places keys and servers on a ring; each key belongs to the next server clockwise.',
    why: 'Adding or removing a server moves only about 1/N of the keys instead of nearly all of them.',
    tradeoffs: ['Needs virtual nodes to spread evenly.'], usedBy: ['Amazon Dynamo', 'Cassandra', 'Discord', 'Memcached clients'] },
  { id: 'p-fanout', name: 'Fan-out on write vs read', kind: 'pattern', aliases: ['fan-out on write', 'fan out on write', 'fan-out on read', 'hybrid fan-out'],
    what: 'Write: push each new post into every follower\'s feed at post time. Read: build the feed by pulling from followees at read time.',
    why: 'Write makes reads instant but explodes for celebrities; read is cheap to write but slow to read. Big feeds use a hybrid.',
    tradeoffs: ['Storage and write amplification vs read latency.'], usedBy: ['Twitter timelines', 'Instagram feed', 'LinkedIn feed'] },
  { id: 'p-conflation', name: 'Conflation', kind: 'pattern', aliases: ['conflation', 'conflate', 'conflates'],
    what: 'When a consumer falls behind, skip intermediate updates and send only the latest value per key.',
    why: 'For prices, only the current price matters; a growing backlog of stale ticks is worse than useless.',
    tradeoffs: ['Lossy: wrong for consumers that need every event.'], usedBy: ['Market-data distributors', 'Bloomberg terminals', 'Game state sync'] },
  { id: 'p-snapshot-delta', name: 'Snapshot + delta', kind: 'pattern', aliases: ['snapshot + delta', 'snapshot plus delta', 'resnapshot'],
    what: 'A new consumer first receives the full current state with a sequence number, then only changes after that number.',
    why: 'Joining mid-stream without replaying all history, and without a gap.',
    tradeoffs: ['Must buffer deltas during the snapshot to avoid a race.'], usedBy: ['Exchange market data', 'Kafka compacted topics', 'Firebase'] },
  { id: 'p-backpressure', name: 'Backpressure', kind: 'pattern', aliases: ['backpressure'],
    what: 'A slow consumer signals the producer to slow down (or the producer stops when a bounded buffer is full).',
    why: 'Unbounded queues end in out-of-memory crashes.',
    tradeoffs: ['Slows the producer; sometimes dropping is better.'], usedBy: ['TCP flow control', 'Reactive Streams', 'Kafka consumers'] },
  { id: 'p-delivery', name: 'At-least-once vs exactly-once', kind: 'pattern', aliases: ['at-least-once', 'exactly-once', 'at most once'],
    what: 'At-least-once: messages may repeat but are never lost. Exactly-once across systems is practically "at-least-once + idempotent consumer".',
    why: 'Interviewers test whether you know exactly-once delivery across a network is not a free guarantee.',
    tradeoffs: ['Dedupe storage and logic on the consumer.'], usedBy: ['Kafka', 'SQS', 'Payment webhooks'] },
  { id: 'p-saga', name: 'Saga vs two-phase commit', kind: 'pattern', aliases: ['saga', '2PC', 'two-phase commit', 'compensating'],
    what: '2PC locks all participants until everyone agrees. A saga runs local steps one by one and undoes earlier ones with compensating actions if a later step fails.',
    why: 'Cross-service or cross-shard money movement needs one of them.',
    tradeoffs: ['2PC: consistent but blocking. Saga: available but temporarily inconsistent.'], usedBy: ['Uber Cadence / Temporal workflows', 'Bank transfers across systems'] },
  { id: 'p-event-sourcing', name: 'Event sourcing', kind: 'pattern', aliases: ['event sourcing', 'event-sourced'],
    what: 'Store the list of events (trade happened) as the source of truth; current state is a fold over them.',
    why: 'Full audit trail, and you can rebuild state or compute new views from history.',
    tradeoffs: ['Replay gets slow without snapshots; schema evolution of events is hard.'], usedBy: ['Trading and risk systems', 'LMAX', 'Accounting systems'] },
  { id: 'p-consistency', name: 'Strong vs eventual consistency', kind: 'pattern', aliases: ['eventual consistency', 'eventually consistent', 'strong consistency', 'strongly consistent', 'staleness'],
    what: 'Strong: every read sees the latest write. Eventual: reads may be briefly stale but converge.',
    why: 'Money and inventory need strong; likes, feeds, and counts can be eventual. Saying which data needs which is a senior signal.',
    tradeoffs: ['Strong costs latency and availability during partitions (CAP).'], usedBy: ['Spanner (strong)', 'DynamoDB (both)', 'Cassandra (tunable)'] },
  { id: 'p-failopen', name: 'Fail-open vs fail-closed', kind: 'pattern', aliases: ['fail-open', 'fail open', 'fail-closed', 'fail closed'],
    what: 'When a safety dependency is down, fail-open lets traffic through; fail-closed blocks it.',
    why: 'Rate limits for reads usually fail open; money movement and risk limits fail closed.',
    tradeoffs: ['Availability vs safety. Say which and why per path.'], usedBy: ['Rate limiters', 'Fraud checks', 'Auth systems'] },
  { id: 'p-cdc', name: 'Change data capture', kind: 'pattern', aliases: ['CDC'],
    what: 'Read the database\'s commit log and stream every change to other systems (caches, search, warehouse).',
    why: 'Keeps derived systems in sync without the application doing extra writes.',
    tradeoffs: ['Derived systems lag slightly.'], usedBy: ['Debezium', 'LinkedIn Databus', 'DynamoDB Streams'] },
  { id: 'p-ttl', name: 'TTL (time to live)', kind: 'pattern', aliases: ['TTL', 'TTLs'],
    what: 'An expiry time on a cached value or record, after which it is dropped.',
    why: 'A safety net that bounds how stale cached data can get, even if invalidation is missed.',
    tradeoffs: ['Short TTL: fresher, more misses. Long TTL: fewer misses, staler.'], usedBy: ['Redis', 'DNS', 'CDNs'] },
  { id: 'p-reconcile', name: 'Reconciliation', kind: 'pattern', aliases: ['reconciliation', 'reconcile'],
    what: 'Regularly compare two records of the same truth (your ledger vs the bank statement) and flag differences.',
    why: 'Protocols fail in ways you did not predict; reconciliation catches what slipped through.',
    tradeoffs: ['Someone has to investigate breaks.'], usedBy: ['Every payments company and bank'] }
];

/* ---------------- shapes ---------------- */
const SHAPE_INFO = {
  client: { label: 'Client / user', hint: 'pill' },
  edge: { label: 'Gateway / edge', hint: 'hexagon' },
  service: { label: 'Service', hint: 'rectangle' },
  queue: { label: 'Queue / stream', hint: 'queue' },
  db: { label: 'Database / store', hint: 'cylinder' },
  cache: { label: 'Cache', hint: 'cylinder' },
  external: { label: 'External system', hint: 'dashed edge' },
  obs: { label: 'Monitoring', hint: 'dashed box' }
};

const ConceptLib = (() => {
  const byId = new Map(CONCEPTS.map((c) => [c.id, c]));
  const cache = new Map();
  function forNode(node) {
    if (!node) return null;
    const key = node.id + '|' + node.label + '|' + node.sub;
    if (cache.has(key)) return cache.get(key);
    const hay = `${node.id} ${node.label} ${node.sub}`.toLowerCase();
    let found = null;
    for (const c of CONCEPTS) {
      if (c.kind !== 'component' || c.id === 'service' || c.id === 'client') continue;
      if (c.match.test(hay)) { found = c; break; }
    }
    if (!found && (node.layer === 'Client' || node.layer === 'Consumers')) found = byId.get('client');
    if (!found && node.layer === 'Obs') found = byId.get('obs');
    if (!found && node.layer === 'Data') found = byId.get('database');
    if (!found && node.layer === 'Async') found = byId.get('stream');
    if (!found) found = byId.get('service');
    cache.set(key, found);
    return found;
  }

  /** The drawn shape: the layer sets the family, the concept picks within it. */
  function shapeFor(node) {
    const c = forNode(node);
    const shape = c ? c.shape : 'service';
    switch (node.layer) {
      case 'Client': case 'Consumers': return 'client';
      case 'Obs': return 'obs';
      case 'Edge': case 'Ingest': return 'edge';
      case 'Provider': return 'external';
      case 'Service': return 'service';
      case 'Data': return ['db', 'cache', 'queue'].includes(shape) ? shape : 'db';
      case 'Async': case 'Event': case 'Feed':
        return shape === 'service' || shape === 'external' ? shape : 'queue';
      default: return shape || 'service';
    }
  }

  /* term linking for explanations */
  const terms = [];
  CONCEPTS.forEach((c) => (c.aliases || []).forEach((a) => terms.push({ a, c })));
  terms.sort((x, y) => y.a.length - x.a.length);
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const re = new RegExp(`(^|[^\\w-])(${terms.map((t) => escRe(t.a)).join('|')})(?![\\w-])`, 'gi');
  const lookup = new Map(terms.map((t) => [t.a.toLowerCase(), t.c]));

  /** Wraps known terms in already-escaped HTML text with clickable buttons. */
  function linkTerms(html) {
    const seen = new Set();
    return String(html).replace(re, (m, pre, word) => {
      const c = lookup.get(word.toLowerCase());
      if (!c || seen.has(c.id)) return m;
      seen.add(c.id);
      return `${pre}<button type="button" class="term" data-concept="${c.id}">${word}</button>`;
    });
  }

  return { all: CONCEPTS, get: (id) => byId.get(id), forNode, shapeFor, linkTerms };
})();
