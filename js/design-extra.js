/* ============================================================
   Additional system-design questions + architecture maps
   Loaded after questions.js and design-graphs.js, before app.js.
   ============================================================ */

const EXTRA_DESIGN_QUESTIONS = [
  {
    id: 'fintech-platform', level: 3, cat: 'Fintech',
    title: 'Design a consumer fintech platform',
    prompt: [
      'Design the core platform for a consumer fintech company: onboarding/KYC, accounts, peer-to-peer transfers, card payments, and the ledger behind all of it. 10M users, 99.99% availability, money movement strongly consistent and auditable.',
      '',
      'Cover the money path end to end, then deep-dive the ledger, card authorization, fraud, and failure handling.'
    ].join('\n'),
    hints: [
      'Separate the money path from side effects: the ledger is the source of truth, notifications and analytics are downstream events.',
      'KYC gates account creation; model onboarding as a state machine (pending review, approved, rejected) and never block the whole app on a slow vendor.',
      'Every transfer carries an idempotency key; store the original response so retries return the same result.',
      'Card authorization is synchronous with a tight timeout; capture and settlement are asynchronous. Make reversal idempotent.',
      'Ledger: double-entry, integer minor units, append-only postings, ACID commit, derived balances, outbox for reliable events.',
      'Fraud runs pre-authorization with hard rules and async with models. Money paths fail closed, read paths fail open.',
      'Reconcile against the card network and bank rails continuously; drift is a first-class alert.',
      'Shard by account; hot accounts and cross-shard transfers need explicit locking or saga semantics.'
    ],
    topics: ['KYC state machine', 'Ledger as source of truth', 'Idempotency keys', 'Card auth vs capture', 'Fraud pre/post', 'Outbox events', 'Reconciliation', 'Sharding accounts']
  },
  {
    id: 'instagram', level: 3, cat: 'Social',
    title: 'Design Instagram',
    prompt: [
      'Design Instagram: photo/video upload, follow graph, home feed, likes/comments, search, and notifications. 500M DAU, heavily read-skewed, sub-second feed loads, media served globally.',
      '',
      'Focus on media storage and delivery, feed generation, and what happens when someone with 100M followers posts.'
    ].join('\n'),
    hints: [
      'Split media bytes from metadata: object storage + CDN for blobs, a sharded metadata store for posts and counters.',
      'Upload is write-once; transcode variants asynchronously and never block the upload response on all renditions.',
      'Feed generation is a hybrid: fan out on write for normal users, fan out on read for celebrities, then merge.',
      'Cache the hydrated feed per user with cursor pagination; do not use offset pagination at scale.',
      'The social graph is read-heavy; cache follow lists and keep counts eventually consistent.',
      'Search is a separate inverted index fed by CDC, not a query against the primary metadata DB.',
      'Celebrity posts create a hot-key problem; pull their recent posts at read time instead of pushing to 100M inboxes.',
      'Media delivery: signed CDN URLs, edge caching, and origin shielding; invalidate only on delete/takedown.'
    ],
    topics: ['Object storage + CDN', 'Async transcoding', 'Hybrid fan-out', 'Celebrity hot key', 'Cursor pagination', 'Feed cache', 'Social graph cache', 'Search index']
  },
  {
    id: 'uber', level: 3, cat: 'Marketplace',
    title: 'Design Uber',
    prompt: [
      'Design Uber: riders request trips, drivers stream location, the system matches them in real time, computes pricing/surge, handles the trip lifecycle, and charges the rider. 10M rides/day, 1M concurrent drivers, matches within about a minute.',
      '',
      'Go deep on geospatial indexing, dispatch state, and what breaks during a city-wide surge.'
    ].join('\n'),
    hints: [
      'Location updates are high-volume and ephemeral: keep the latest position per driver in memory, indexed by H3/geohash cells.',
      'Shard by city or region; a global index is unnecessary and adds latency.',
      'Matching is a state machine: requested -> offered -> accepted -> arriving -> in-trip -> completed/cancelled. Every transition is idempotent.',
      'Dispatch is a loop: find nearby available drivers, offer with a timeout, re-offer, then broaden the radius.',
      'Pricing reads live supply/demand per cell; surge is a pricing output, not a hard-coded multiplier.',
      'Trip completion emits events for payments, receipts, and notifications; the trip store is the source of truth.',
      'Driver location can be slightly stale for display but not for matching; define a freshness budget per use.',
      'Failure: matching outage should degrade to manual dispatch/queue, not lose requests.'
    ],
    topics: ['Geospatial index (H3)', 'In-memory locations', 'Dispatch state machine', 'City sharding', 'Surge pricing', 'Idempotent trips', 'Freshness budgets', 'Async payments']
  },
  {
    id: 'core-bank', level: 3, cat: 'Banking',
    title: 'Design a core banking system',
    prompt: [
      'Design the core banking system for a retail bank: accounts, transfers, the general ledger, interest and fees, statements, fraud/AML checks, and regulatory reporting. Strong consistency, full auditability, and end-of-day processing.',
      '',
      'This is the bank-grade version of the ledger question: ACID, batch, controls, and reconciliation matter as much as throughput.'
    ].join('\n'),
    hints: [
      'Core ledger is double-entry and append-only; account balances are projections with periodic snapshots.',
      'Transfers are one ACID transaction across both accounts; idempotency keys and a state machine prevent double posting.',
      'Interest and fees accrue daily and post at defined cutoffs; the end-of-day batch is a controlled, restartable job.',
      'Regulatory reporting reads a warehouse fed by CDC, not the hot core database.',
      'Fraud/AML checks run before posting for high-risk transfers and asynchronously for monitoring.',
      'Every change is auditable: who, what, when, before/after, and the originating channel.',
      'Reconciliation compares the core ledger, the general ledger, and external rails; breaks are investigated, never silently adjusted.',
      'Failure: the core DB fails over with strong consistency; the batch resumes from a checkpoint, not from the beginning.'
    ],
    topics: ['Double-entry core', 'ACID transfers', 'Idempotency', 'EOD batch', 'Interest accrual', 'Immutable audit', 'AML/fraud', 'Reconciliation', 'Regulatory reporting']
  },
  {
    id: 'deepseek-inference', level: 3, cat: 'AI infrastructure',
    title: 'Design DeepSeek inference',
    prompt: [
      'Design the inference platform behind a DeepSeek-style LLM API: millions of users, streaming tokens, multi-tenant quota, a GPU fleet, and frequent model releases. Optimize p99 latency and GPU utilization without starving small tenants.',
      '',
      'Cover admission, batching, KV cache, routing, streaming, billing, and failure isolation.'
    ].join('\n'),
    hints: [
      'Split prefill (prompt processing) from decode (token generation); they have different compute and batching profiles.',
      'Continuous batching: add and remove requests every step instead of waiting for a full batch. This is the core throughput win.',
      'KV cache is the scarce resource; account for it in admission control and evict carefully.',
      'Route by model, context length, and tenant tier; keep model replicas warm and shard large models across GPUs.',
      'Stream tokens over SSE/WebSocket; meter input and output tokens separately for billing and quota.',
      'Quota is enforced at admission, not mid-stream; a fair scheduler prevents one tenant from occupying the fleet.',
      'Prompt cache and prefix cache reduce repeat work for long system prompts; invalidate on model version changes.',
      'Failure: isolate a bad GPU/node, drain it, and retry the request only if it has not emitted tokens yet.'
    ],
    topics: ['Prefill vs decode', 'Continuous batching', 'KV cache', 'Model sharding', 'Admission control', 'Token streaming', 'Multi-tenant fairness', 'Metering', 'GPU autoscaling']
  },
  {
    id: 'lovable', level: 2, cat: 'AI apps',
    title: 'Design Lovable',
    prompt: [
      'Design Lovable: a user types a prompt, an AI generates a full-stack app, the app runs in a live preview, and the user iterates conversationally before publishing. Thousands of concurrent projects, untrusted generated code, strict cost controls.',
      '',
      'Focus on the generation loop, sandbox isolation, preview routing, and versions/rollback.'
    ].join('\n'),
    hints: [
      'The builder is an orchestrator, not one giant prompt: plan, generate files, apply a patch, install dependencies, build, preview.',
      'Every generation runs in an isolated sandbox with CPU/memory/time/network limits; never execute generated code on the API host.',
      'Snapshot the project before each generation so the user can diff and roll back.',
      'Stream progress and generated files; a 60-second silent generation feels broken even if it works.',
      'Preview is a per-project reverse proxy to the sandbox port, with auth and a stable URL.',
      'Use a package cache and warm base images to cut cold-start time; a build that takes minutes loses the user.',
      'Meter model tokens, build minutes, and preview uptime; enforce quotas before expensive work starts.',
      'Publishing promotes an immutable snapshot to a separate runtime; never publish directly from a mutable sandbox.'
    ],
    topics: ['Generation orchestrator', 'Sandbox isolation', 'Snapshots/rollback', 'Streaming progress', 'Preview proxy', 'Package cache', 'Cost/quotas', 'Publish pipeline']
  },
  {
    id: 'replit', level: 3, cat: 'Dev tools',
    title: 'Design Replit',
    prompt: [
      'Design Replit: a browser IDE with multiplayer editing, persistent workspaces, code execution, package installs, previews, and deploys. Millions of workspaces, fast cold starts, strong isolation between users.',
      '',
      'Deep-dive the workspace runtime, collaboration, persistence, and preview routing.'
    ].join('\n'),
    hints: [
      'Each workspace is a container (or microVM) with a persistent filesystem; the scheduler places it on a node with capacity.',
      'Warm pools and snapshot/restore make cold starts tolerable; a blank container for every open is too slow.',
      'Collaboration is CRDT/OT over a WebSocket; the filesystem is the durable source, the CRDT is the live editing state.',
      'Language servers run per workspace or pooled per language; route requests by workspace.',
      'Package installs go through a shared cache/proxy; do not hit the public registry from every workspace.',
      'Preview is an authenticated reverse proxy to a port inside the workspace; terminate TLS at the edge.',
      'Isolation is the security boundary: no host mounts, seccomp, network policy, and CPU/memory limits.',
      'Deploys promote an immutable build, not the running dev container.'
    ],
    topics: ['Workspace containers', 'Warm pools', 'CRDT collaboration', 'Persistent FS', 'Language servers', 'Package cache', 'Preview proxy', 'Isolation', 'Immutable deploys']
  },
  {
    id: 'gmail', level: 3, cat: 'Communication',
    title: 'Design Gmail',
    prompt: [
      'Design Gmail: send and receive email for billions of messages, threads, labels, search, spam/phishing filtering, offline support, and push notifications. Durability and search latency matter as much as inbox load time.',
      '',
      'Cover SMTP ingress, storage, indexing, spam, threading, and delivery guarantees.'
    ].join('\n'),
    hints: [
      'Messages are immutable blobs; mailbox metadata and labels are separate and mutable.',
      'Shard by user/mailbox; a single user inbox is the consistency unit.',
      'SMTP ingress accepts, spools, and queues; never do spam scoring and storage inline in the SMTP handshake.',
      'Spam/phishing is a pipeline of reputation, authentication (SPF/DKIM/DMARC), content models, and user feedback.',
      'Search is an inverted index fed asynchronously; accept index lag and surface it if needed.',
      'Threading is derived from Message-ID/References/In-Reply-To plus provider-specific heuristics.',
      'Push uses IDLE/WebSocket/APNs; offline clients resync by history/cursor.',
      'Deduplicate by Message-ID per mailbox; retries from senders are common.',
      'Storage tiering: hot recent messages, cold archive, and legal hold/compliance retention.'
    ],
    topics: ['Immutable messages', 'Per-user sharding', 'SMTP queue', 'Spam pipeline', 'Inverted index', 'Threading', 'Push/IDLE', 'Dedupe', 'Storage tiering']
  }
];

const EXTRA_DESIGN_GRAPHS = {
  'fintech-platform': {
    title: 'Consumer fintech platform',
    subtitle: 'One ledger behind onboarding, transfers, cards, and fraud',
    layers: ['Client', 'Edge', 'Service', 'Async', 'Data', 'Obs'],
    nodes: [
      { id: 'app', label: 'Mobile app', sub: 'iOS / Android', layer: 'Client', detail: 'The consumer surface for onboarding, transfers, and cards.', spec: ['Uses short-lived tokens.', 'Never caches balances as truth.'] },
      { id: 'api', label: 'API gateway', sub: 'Auth, quota, routing', layer: 'Edge', detail: 'Single entry point for every product call.', spec: ['Authenticates and rate-limits.', 'Routes to product services.'] },
      { id: 'kyc', label: 'Identity / KYC', sub: 'KYC + sanctions', layer: 'Service', detail: 'Verifies identity, sanctions, and account eligibility.', spec: ['State machine, not a boolean.', 'Vendor calls are async with retries.'] },
      { id: 'accounts', label: 'Accounts', sub: 'Limits + balances', layer: 'Service', detail: 'Account lifecycle, limits, and balance projections.', spec: ['Balances derived from the ledger.', 'Limits enforced before money moves.'] },
      { id: 'payments', label: 'Payment service', sub: 'P2P + ACH', layer: 'Service', detail: 'Owns transfer state and calls risk and ledger.', spec: ['Idempotency per request.', 'Saga for external rails.'] },
      { id: 'cards', label: 'Card processor', sub: 'Auth + capture', layer: 'Service', detail: 'Authorizes card transactions and captures later.', spec: ['Auth has a hard timeout.', 'Reversals are idempotent.'] },
      { id: 'risk', label: 'Fraud / risk', sub: 'Velocity + rules', layer: 'Service', detail: 'Scores transactions before money moves.', spec: ['Hard rules pre-auth.', 'Models run async.'] },
      { id: 'ledger', label: 'Ledger', sub: 'Double-entry', layer: 'Service', detail: 'The source of truth for every money movement.', spec: ['Append-only postings.', 'Integer minor units.'] },
      { id: 'bus', label: 'Event bus', sub: 'Kafka + outbox', layer: 'Async', detail: 'Reliable downstream events without dual writes.', spec: ['Outbox in the ledger transaction.', 'At-least-once consumers.'] },
      { id: 'notify', label: 'Notifications', sub: 'Email / push', layer: 'Async', detail: 'Sends receipts, alerts, and KYC updates.', spec: ['Never blocks the money path.', 'Deduplicated per event.'] },
      { id: 'ledgerdb', label: 'Ledger DB', sub: 'Postgres, ACID', layer: 'Data', detail: 'Durable, strongly consistent ledger storage.', spec: ['One transaction per transfer.', 'Point-in-time recovery.'] },
      { id: 'obs', label: 'Audit / SLOs', sub: 'Observability', layer: 'Obs', detail: 'Tracks money invariants, latency, and audit trails.', spec: ['Alert on any imbalance.', 'Every decision is traceable.'] }
    ],
    edges: [
      { from: 'app', to: 'api', label: 'HTTPS', kind: 'sync', detail: 'All product traffic enters the gateway.' },
      { from: 'api', to: 'kyc', label: 'onboard', kind: 'sync', detail: 'Start or resume identity verification.' },
      { from: 'api', to: 'accounts', label: 'balance', kind: 'sync', detail: 'Read account state and limits.' },
      { from: 'kyc', to: 'api', label: 'KYC result', kind: 'sync', detail: 'The verification result returns to the API.' },
      { from: 'accounts', to: 'api', label: 'balance', kind: 'sync', detail: 'The account snapshot returns to the API.' },
      { from: 'api', to: 'payments', label: 'transfer', kind: 'sync', detail: 'Create an idempotent money movement.' },
      { from: 'api', to: 'cards', label: 'authorize', kind: 'sync', detail: 'Card authorization path.' },
      { from: 'payments', to: 'risk', label: 'screen', kind: 'sync', detail: 'Pre-transaction fraud decision.' },
      { from: 'cards', to: 'risk', label: 'auth risk', kind: 'sync', detail: 'Card-specific velocity and rules.' },
      { from: 'risk', to: 'ledger', label: 'approve', kind: 'sync', detail: 'Only approved movements post.' },
      { from: 'payments', to: 'ledger', label: 'post', kind: 'sync', detail: 'Debit and credit commit together.' },
      { from: 'ledger', to: 'payments', label: 'posted', kind: 'sync', detail: 'The committed transfer returns to the payment orchestrator.' },
      { from: 'ledger', to: 'cards', label: 'captured', kind: 'sync', detail: 'The card capture result returns to the card processor.' },
      { from: 'ledger', to: 'ledgerdb', label: 'ACID', kind: 'sync', detail: 'One transaction for both sides.' },
      { from: 'ledger', to: 'bus', label: 'outbox', kind: 'async', detail: 'Event commits with the postings.' },
      { from: 'bus', to: 'notify', label: 'alert', kind: 'async', detail: 'Receipts and status updates.' },
      { from: 'payments', to: 'api', label: 'result', kind: 'sync', detail: 'The payment result returns to the API.' },
      { from: 'cards', to: 'api', label: 'auth result', kind: 'sync', detail: 'The card authorization result returns to the API.' },
      { from: 'api', to: 'app', label: 'response', kind: 'sync', detail: 'The app finally receives the product response.' },
      { from: 'notify', to: 'app', label: 'push / receipt', kind: 'async', detail: 'The async user loop closes with a push or receipt.' },
      { from: 'api', to: 'obs', label: 'traces', kind: 'obs', detail: 'Request and decision trace.' },
      { from: 'ledger', to: 'obs', label: 'invariants', kind: 'obs', detail: 'Zero-sum and reconciliation checks.' }
    ],
    flow: [
      { title: 'Onboard and open an account', detail: 'KYC verifies identity and sanctions, the account is created, and the result returns through the API to the app.', nodes: ['app', 'api', 'kyc', 'accounts'], edges: [['app', 'api'], ['api', 'kyc'], ['api', 'accounts'], ['kyc', 'api'], ['accounts', 'api'], ['api', 'app']] },
      { title: 'Move money', detail: 'The payment is screened, the ledger commits both sides and returns the result, and the app gets the response.', nodes: ['app', 'api', 'payments', 'risk', 'ledger', 'ledgerdb'], edges: [['app', 'api'], ['api', 'payments'], ['payments', 'risk'], ['risk', 'ledger'], ['payments', 'ledger'], ['ledger', 'ledgerdb'], ['ledger', 'payments'], ['payments', 'api'], ['api', 'app']] },
      { title: 'Card auth and notify', detail: 'Authorization returns to the app; capture posts, the capture result returns to cards, and the outbox pushes the receipt.', nodes: ['app', 'api', 'cards', 'risk', 'ledger', 'ledgerdb', 'bus', 'notify'], edges: [['cards', 'risk'], ['risk', 'ledger'], ['ledger', 'ledgerdb'], ['ledger', 'cards'], ['ledger', 'bus'], ['bus', 'notify'], ['cards', 'api'], ['api', 'app'], ['notify', 'app']] }
    ],
    why: [
      'One ledger is the source of truth; product services project balances and never own money state.',
      'KYC is a state machine, so a slow vendor delays onboarding without blocking existing accounts.',
      'Idempotency keys plus a transfer state machine make retries safe across flaky networks.',
      'Card authorization and capture are separated: the fast path authorizes, the durable path posts.',
      'The transactional outbox avoids dual writes between the ledger and notifications/analytics.',
      'Fraud checks run before money moves; downstream models refine risk without blocking the path.',
      'Every product response returns through the API to the app, and notifications close the async user loop.'
    ],
    tradeoffs: [
      'Strong consistency for money limits throughput; shard by account and accept cross-shard sagas.',
      'Card auth must be fast, so some fraud decisions are probabilistic and corrected post-auth.',
      'A central ledger is simpler to audit but harder to scale than per-product ledgers.',
      'Fail-closed money paths protect balances but turn a dependency outage into a product outage.'
    ],
    failures: [
      { label: 'Ledger DB down', nodes: ['ledgerdb'], affected: ['ledger', 'payments', 'cards'], detail: 'No money can move safely; the product must fail closed.', mitigation: 'HA failover, idempotent retries, and a read-only mode for balances.' },
      { label: 'KYC vendor down', nodes: ['kyc'], affected: ['accounts'], detail: 'New onboarding stalls, but existing users can transact.', mitigation: 'Queue verifications, retry with backoff, and allow manual review.' },
      { label: 'Card auth timeout', nodes: ['cards'], affected: ['risk', 'ledger'], detail: 'The network may have authorized while the response was lost.', mitigation: 'Idempotent auth ids, network reconciliation, and safe reversal.' }
    ]
  },

  instagram: {
    title: 'Instagram',
    subtitle: 'Media bytes at the edge, metadata in shards, feeds in a hybrid fan-out',
    layers: ['Client', 'Edge', 'Service', 'Async', 'Data', 'Obs'],
    nodes: [
      { id: 'app', label: 'Client', sub: 'iOS / Android / web', layer: 'Client', detail: 'Uploads media and reads the feed.', spec: ['Optimistic likes.', 'Cursor-based feed.'] },
      { id: 'cdn', label: 'CDN', sub: 'Edge media cache', layer: 'Edge', detail: 'Serves images and video from the edge.', spec: ['Signed URLs.', 'Origin shielding.'] },
      { id: 'api', label: 'API gateway', sub: 'Auth + routing', layer: 'Edge', detail: 'Entry point for uploads, feed, and social actions.', spec: ['Rate-limits and authenticates.', 'Routes by product.'] },
      { id: 'upload', label: 'Upload service', sub: 'Write path', layer: 'Service', detail: 'Accepts media, validates, and stores originals.', spec: ['Write-once blobs.', 'Returns before transcoding.'] },
      { id: 'feed', label: 'Feed service', sub: 'Hydrate + merge', layer: 'Service', detail: 'Builds the home feed from inboxes and celebrity pulls.', spec: ['Hybrid fan-out.', 'Cursor pagination.'] },
      { id: 'social', label: 'Social graph', sub: 'Follows + counts', layer: 'Service', detail: 'Follows, blocks, and follower counts.', spec: ['Read-heavy cache.', 'Eventually consistent counts.'] },
      { id: 'search', label: 'Search', sub: 'Inverted index', layer: 'Service', detail: 'Searches people, hashtags, and posts.', spec: ['Federal index.', 'Async CDC feed.'] },
      { id: 'transcode', label: 'Transcoder', sub: 'Variants + thumbnails', layer: 'Async', detail: 'Produces renditions for every device.', spec: ['Parallel per profile.', 'Idempotent by media id.'] },
      { id: 'fanout', label: 'Feed fan-out', sub: 'Inbox writer', layer: 'Async', detail: 'Pushes new posts into follower inboxes.', spec: ['Bounded workers.', 'Celebrities handled at read.'] },
      { id: 'media', label: 'Object store', sub: 'Originals + variants', layer: 'Data', detail: 'Durable blob storage for all media.', spec: ['Lifecycle tiering.', 'Immutable objects.'] },
      { id: 'meta', label: 'Metadata DB', sub: 'Posts + counters', layer: 'Data', detail: 'Post records, captions, likes, comments.', spec: ['Sharded by post/user.', 'Counters async.'] },
      { id: 'feedcache', label: 'Feed cache', sub: 'Per-user inbox', layer: 'Data', detail: 'Precomputed post ids per follower.', spec: ['Bounded length.', 'Rebuild on miss.'] },
      { id: 'obs', label: 'Observability', sub: 'SLOs + pipeline lag', layer: 'Obs', detail: 'Tracks feed latency, upload failures, and fan-out lag.', spec: ['Fan-out lag alert.', 'CDN hit ratio.'] }
    ],
    edges: [
      { from: 'app', to: 'cdn', label: 'media', kind: 'sync', detail: 'Images and video served from the edge.' },
      { from: 'app', to: 'api', label: 'API', kind: 'sync', detail: 'Uploads, feed, likes, search.' },
      { from: 'api', to: 'upload', label: 'upload', kind: 'sync', detail: 'Create a post with media.' },
      { from: 'upload', to: 'media', label: 'store', kind: 'sync', detail: 'Write the original blob.' },
      { from: 'upload', to: 'transcode', label: 'job', kind: 'async', detail: 'Transcode after the upload returns.' },
      { from: 'transcode', to: 'media', label: 'variants', kind: 'async', detail: 'Write all renditions and thumbnails.' },
      { from: 'api', to: 'feed', label: 'feed', kind: 'sync', detail: 'Read the home feed.' },
      { from: 'feed', to: 'feedcache', label: 'inbox', kind: 'sync', detail: 'Read precomputed post ids.' },
      { from: 'feed', to: 'social', label: 'follows', kind: 'sync', detail: 'Filter and rank by graph.' },
      { from: 'feed', to: 'meta', label: 'hydrate', kind: 'sync', detail: 'Fetch post records and counters.' },
      { from: 'api', to: 'search', label: 'query', kind: 'sync', detail: 'People, hashtags, posts.' },
      { from: 'search', to: 'meta', label: 'index src', kind: 'async', detail: 'CDC feeds the inverted index.' },
      { from: 'social', to: 'fanout', label: 'new post', kind: 'async', detail: 'Fan out to follower inboxes.' },
      { from: 'fanout', to: 'feedcache', label: 'push', kind: 'async', detail: 'Append post ids.' },
      { from: 'media', to: 'cdn', label: 'origin', kind: 'sync', detail: 'CDN pulls on a cache miss.' },
      { from: 'cdn', to: 'app', label: 'bytes', kind: 'sync', detail: 'The app finally receives the image or video bytes.' },
      { from: 'upload', to: 'api', label: 'post', kind: 'sync', detail: 'The new post id returns to the API.' },
      { from: 'feed', to: 'api', label: 'items', kind: 'sync', detail: 'The ranked feed returns to the API.' },
      { from: 'search', to: 'api', label: 'results', kind: 'sync', detail: 'Search results return to the API.' },
      { from: 'api', to: 'app', label: 'JSON / feed', kind: 'sync', detail: 'The app finally receives the feed, post, or search JSON.' },
      { from: 'api', to: 'obs', label: 'traces', kind: 'obs', detail: 'End-to-end request tracing.' }
    ],
    flow: [
      { title: 'Upload and transcode', detail: 'Accept the upload, store the original, return the post, and transcode renditions asynchronously.', nodes: ['app', 'api', 'upload', 'media', 'transcode'], edges: [['app', 'api'], ['api', 'upload'], ['upload', 'media'], ['upload', 'transcode'], ['transcode', 'media'], ['upload', 'api'], ['api', 'app']] },
      { title: 'Load the feed', detail: 'Read and merge the feed, hydrate metadata, and return the JSON plus media to the app.', nodes: ['app', 'api', 'feed', 'feedcache', 'social', 'meta', 'cdn'], edges: [['app', 'api'], ['api', 'feed'], ['feed', 'feedcache'], ['feed', 'social'], ['feed', 'meta'], ['feed', 'api'], ['api', 'app'], ['cdn', 'app']] },
      { title: 'Fan out and deliver bytes', detail: 'Write post ids into follower inboxes, then serve the media bytes from the CDN.', nodes: ['social', 'fanout', 'feedcache', 'media', 'cdn', 'app'], edges: [['social', 'fanout'], ['fanout', 'feedcache'], ['media', 'cdn'], ['cdn', 'app']] }
    ],
    why: [
      'Media bytes and metadata scale differently; separating them lets each use the right storage.',
      'The CDN serves almost every image/video byte, so the origin only sees cold misses.',
      'Hybrid fan-out keeps normal users fast while avoiding 100M inbox writes for celebrities.',
      'Feed caches store ids, not full posts: hydration gives fresh captions and counts.',
      'Cursor pagination stays stable while new posts arrive at the top.',
      'Transcoding is asynchronous and idempotent, so a retry cannot corrupt a rendition.',
      'The user loop returns twice: JSON through the API and media bytes through the CDN.'
    ],
    tradeoffs: [
      'Fan-out on write is fast to read but expensive for celebrities; read-time merge adds latency.',
      'Eventual counters make likes instant but can show stale numbers briefly.',
      'Index lag means a new post may not be searchable immediately.',
      'CDN caching reduces origin load but complicates takedowns and signed URL expiry.'
    ],
    failures: [
      { label: 'CDN origin down', nodes: ['cdn'], affected: ['media', 'feed', 'app'], detail: 'Media requests fail or go straight to the origin and overload it.', mitigation: 'Origin shield, multi-CDN failover, and a placeholder render.' },
      { label: 'Fan-out lag', nodes: ['fanout'], affected: ['feedcache', 'feed'], detail: 'New posts do not appear in follower feeds for minutes.', mitigation: 'Scale workers by queue depth and merge recent posts at read time.' },
      { label: 'Transcode backlog', nodes: ['transcode'], affected: ['media'], detail: 'Uploads exist but have no playable renditions.', mitigation: 'Priority lanes, parallel profiles, and a fallback original.' }
    ]
  },

  uber: {
    title: 'Uber',
    subtitle: 'A real-time marketplace sharded by city, with in-memory geography',
    layers: ['Client', 'Edge', 'Service', 'Async', 'Data', 'Obs'],
    nodes: [
      { id: 'rider', label: 'Rider app', sub: 'Request + track', layer: 'Client', detail: 'Requests trips and tracks the driver.', spec: ['Optimistic request state.', 'Live ETA updates.'] },
      { id: 'driver', label: 'Driver app', sub: 'Location + offers', layer: 'Client', detail: 'Streams GPS and accepts offers.', spec: ['Batched location pings.', 'Offer timeout UI.'] },
      { id: 'api', label: 'API gateway', sub: 'Auth + routing', layer: 'Edge', detail: 'Entry point for riders and drivers.', spec: ['Route by city.', 'Rate-limit location updates.'] },
      { id: 'location', label: 'Location service', sub: 'Stream + latest', layer: 'Service', detail: 'Ingests GPS and keeps the latest position per driver.', spec: ['In-memory hot path.', 'Freshness budget.'] },
      { id: 'matching', label: 'Matching / dispatch', sub: 'Offer loop', layer: 'Service', detail: 'Finds nearby drivers and runs the offer state machine.', spec: ['Expand radius on retry.', 'Idempotent offers.'] },
      { id: 'trip', label: 'Trip service', sub: 'Lifecycle', layer: 'Service', detail: 'Owns trip state from requested to completed.', spec: ['Source of truth.', 'Every transition idempotent.'] },
      { id: 'pricing', label: 'Pricing / surge', sub: 'Supply + demand', layer: 'Service', detail: 'Quotes fares and computes surge per cell.', spec: ['Reads live supply.', 'Versioned quote.'] },
      { id: 'payments', label: 'Payments', sub: 'Charge + receipt', layer: 'Service', detail: 'Charges the rider and pays the driver.', spec: ['Idempotent charge.', 'Async settlements.'] },
      { id: 'bus', label: 'Event bus', sub: 'Kafka', layer: 'Async', detail: 'Trip and location events for downstream systems.', spec: ['Ordered per trip.', 'At-least-once.'] },
      { id: 'notify', label: 'Notifications', sub: 'Push / SMS', layer: 'Async', detail: 'Driver offers, receipts, and ETA updates.', spec: ['Priority for offers.', 'Deduplicated.'] },
      { id: 'geo', label: 'Geospatial index', sub: 'H3 / geohash', layer: 'Data', detail: 'Finds available drivers in nearby cells.', spec: ['City-sharded.', 'Cell-level availability.'] },
      { id: 'tripdb', label: 'Trip store', sub: 'Durable state', layer: 'Data', detail: 'Durable trip records and transitions.', spec: ['Write-ahead log.', 'Point-in-time recovery.'] },
      { id: 'obs', label: 'Observability', sub: 'Match + lag', layer: 'Obs', detail: 'Tracks match rate, location lag, and ETA error.', spec: ['Per-city dashboards.', 'Alert on stale supply.'] }
    ],
    edges: [
      { from: 'rider', to: 'api', label: 'request', kind: 'sync', detail: 'Request a trip.' },
      { from: 'driver', to: 'api', label: 'session', kind: 'sync', detail: 'Go online and accept offers.' },
      { from: 'driver', to: 'location', label: 'GPS', kind: 'async', detail: 'High-volume location stream.' },
      { from: 'location', to: 'geo', label: 'index', kind: 'sync', detail: 'Update the latest cell position.' },
      { from: 'api', to: 'matching', label: 'match', kind: 'sync', detail: 'Start the dispatch loop.' },
      { from: 'matching', to: 'geo', label: 'nearby', kind: 'sync', detail: 'Find available drivers by cell.' },
      { from: 'geo', to: 'matching', label: 'drivers', kind: 'sync', detail: 'The nearby driver set returns to dispatch.' },
      { from: 'matching', to: 'trip', label: 'create', kind: 'sync', detail: 'Create the trip state machine.' },
      { from: 'trip', to: 'pricing', label: 'quote', kind: 'sync', detail: 'Price the trip and surge.' },
      { from: 'pricing', to: 'trip', label: 'fare', kind: 'sync', detail: 'The fare and surge return to the trip.' },
      { from: 'trip', to: 'payments', label: 'charge', kind: 'sync', detail: 'Charge on completion.' },
      { from: 'payments', to: 'trip', label: 'charge result', kind: 'sync', detail: 'The charge result returns to the trip.' },
      { from: 'trip', to: 'tripdb', label: 'persist', kind: 'sync', detail: 'Durable trip transitions.' },
      { from: 'trip', to: 'bus', label: 'events', kind: 'async', detail: 'Completion and status events.' },
      { from: 'trip', to: 'api', label: 'status', kind: 'sync', detail: 'Trip state returns to the API for the rider.' },
      { from: 'api', to: 'rider', label: 'match / ETA', kind: 'sync', detail: 'The rider finally receives the match and live ETA.' },
      { from: 'bus', to: 'notify', label: 'push', kind: 'async', detail: 'Receipts and ETA updates.' },
      { from: 'notify', to: 'rider', label: 'receipt / ETA', kind: 'async', detail: 'The rider receives async trip updates.' },
      { from: 'notify', to: 'driver', label: 'offer / trip', kind: 'async', detail: 'The driver receives the next offer or trip update.' },
      { from: 'api', to: 'obs', label: 'traces', kind: 'obs', detail: 'Request and match tracing.' }
    ],
    flow: [
      { title: 'Drivers stream location', detail: 'GPS updates land in the location service and the geospatial index.', nodes: ['driver', 'location', 'geo'], edges: [['driver', 'location'], ['location', 'geo']] },
      { title: 'Match a rider', detail: 'The dispatch loop gets nearby drivers, creates a trip, and returns the match and ETA to the rider.', nodes: ['rider', 'api', 'matching', 'geo', 'trip'], edges: [['rider', 'api'], ['api', 'matching'], ['matching', 'geo'], ['geo', 'matching'], ['matching', 'trip'], ['trip', 'api'], ['api', 'rider']] },
      { title: 'Complete, charge, notify', detail: 'Get the fare, charge the trip, persist it, then push receipts to the rider and offers to the driver.', nodes: ['rider', 'driver', 'trip', 'pricing', 'payments', 'tripdb', 'bus', 'notify'], edges: [['trip', 'pricing'], ['pricing', 'trip'], ['trip', 'payments'], ['payments', 'trip'], ['trip', 'tripdb'], ['trip', 'bus'], ['bus', 'notify'], ['notify', 'rider'], ['notify', 'driver']] }
    ],
    why: [
      'Locations are ephemeral and high-volume, so the latest position lives in memory, not a database row per tick.',
      'H3/geohash cells turn “nearby” into a small set of cell lookups and make city sharding natural.',
      'The dispatch loop is a state machine with timeouts, so retries and re-offers are safe.',
      'Trips are the durable unit; location can be eventually consistent, trip state cannot.',
      'Surge is computed from live supply/demand per cell, which keeps pricing local and explainable.',
      'Payment and notification are downstream events, keeping the trip path fast.',
      'The loop closes at api → rider for match/ETA and notify → rider/driver for async updates.'
    ],
    tradeoffs: [
      'In-memory locations are fast but require replication and a rebuild on restart.',
      'City sharding simplifies scale but cross-city trips need explicit handling.',
      'Aggressive offer timeouts improve match rate but can feel rushed to drivers.',
      'Surge balances supply/demand but is politically and socially sensitive; cap and explain it.'
    ],
    failures: [
      { label: 'Location lag', nodes: ['location'], affected: ['geo', 'matching'], detail: 'Drivers appear somewhere they were 30 seconds ago, so offers go to the wrong place.', mitigation: 'Freshness checks, reject stale drivers, and fall back to last-known cell with a penalty.' },
      { label: 'Matching outage', nodes: ['matching'], affected: ['api', 'trip'], detail: 'Riders cannot get a driver even though supply exists.', mitigation: 'Queue requests, degrade to manual dispatch, and fail over matching per city.' },
      { label: 'Payment failure', nodes: ['payments'], affected: ['trip'], detail: 'The trip completes but the charge fails.', mitigation: 'Retry idempotently, mark the trip unpaid, and retry before the next ride.' }
    ]
  },

  'core-bank': {
    title: 'Core banking system',
    subtitle: 'ACID core, controlled batch, immutable audit, regulator-ready reporting',
    layers: ['Client', 'Edge', 'Service', 'Async', 'Data', 'Obs'],
    nodes: [
      { id: 'app', label: 'Mobile / branch', sub: 'Channels', layer: 'Client', detail: 'Customer and branch channels.', spec: ['Session + step-up auth.', 'No direct DB access.'] },
      { id: 'regulator', label: 'Regulator', sub: 'Filings + reports', layer: 'Client', detail: 'The external regulator that receives periodic reports.', spec: ['Receives immutable extracts.', 'Every filing is auditable.'] },
      { id: 'api', label: 'Channel API', sub: 'Auth + validation', layer: 'Edge', detail: 'Unified entry point for all channels.', spec: ['Validates and routes.', 'Idempotency per request.'] },
      { id: 'accounts', label: 'Account service', sub: 'Lifecycle + limits', layer: 'Service', detail: 'Opens accounts and enforces product rules.', spec: ['Balances from ledger.', 'Limits before posting.'] },
      { id: 'transfers', label: 'Transfer service', sub: 'Orchestration', layer: 'Service', detail: 'Owns transfer state and external rail calls.', spec: ['Saga for external rails.', 'No partial postings.'] },
      { id: 'ledger', label: 'Core ledger', sub: 'Double-entry', layer: 'Service', detail: 'The bank’s authoritative books.', spec: ['Append-only postings.', 'One ACID transaction.'] },
      { id: 'interest', label: 'Interest / fees', sub: 'Accrual', layer: 'Service', detail: 'Accrues daily and posts at cutoffs.', spec: ['Deterministic formulas.', 'Restartable accrual.'] },
      { id: 'fraud', label: 'Fraud / AML', sub: 'Screening', layer: 'Service', detail: 'Screens high-risk transfers and monitors activity.', spec: ['Pre-post for high risk.', 'Case management queue.'] },
      { id: 'batch', label: 'EOD batch', sub: 'Close + accrual', layer: 'Async', detail: 'Runs end-of-day close and interest posting.', spec: ['Checkpointed.', 'Restartable without duplicates.'] },
      { id: 'reporting', label: 'Reg. reporting', sub: 'Finance + regulator', layer: 'Async', detail: 'Produces regulator and finance extracts.', spec: ['Reads the warehouse.', 'Versioned report runs.'] },
      { id: 'core', label: 'Core ledger DB', sub: 'ACID + HA', layer: 'Data', detail: 'Strongly consistent store for the books.', spec: ['Synchronous replication.', 'Point-in-time recovery.'] },
      { id: 'dw', label: 'Data warehouse', sub: 'CDC', layer: 'Data', detail: 'Historical reporting copy of the ledger.', spec: ['Change data capture.', 'No writes from reports.'] },
      { id: 'obs', label: 'Audit / controls', sub: 'Observability', layer: 'Obs', detail: 'Immutable audit trail and control checks.', spec: ['Who/what/when/before-after.', 'Alert on breaks.'] }
    ],
    edges: [
      { from: 'app', to: 'api', label: 'HTTPS', kind: 'sync', detail: 'Customer and branch requests.' },
      { from: 'api', to: 'accounts', label: 'account', kind: 'sync', detail: 'Open, close, and read accounts.' },
      { from: 'api', to: 'transfers', label: 'transfer', kind: 'sync', detail: 'Create a transfer.' },
      { from: 'transfers', to: 'fraud', label: 'screen', kind: 'sync', detail: 'AML and fraud checks.' },
      { from: 'transfers', to: 'ledger', label: 'post', kind: 'sync', detail: 'Debit and credit atomically.' },
      { from: 'ledger', to: 'accounts', label: 'balances', kind: 'sync', detail: 'The ledger returns balances to the account service.' },
      { from: 'ledger', to: 'transfers', label: 'posted', kind: 'sync', detail: 'The transfer service receives the committed result.' },
      { from: 'ledger', to: 'core', label: 'ACID', kind: 'sync', detail: 'Strongly consistent commit.' },
      { from: 'interest', to: 'ledger', label: 'accrual', kind: 'sync', detail: 'Post interest and fees.' },
      { from: 'batch', to: 'interest', label: 'EOD', kind: 'async', detail: 'Run accrual at cutoff.' },
      { from: 'ledger', to: 'batch', label: 'close', kind: 'async', detail: 'Feed the end-of-day close.' },
      { from: 'ledger', to: 'dw', label: 'CDC', kind: 'async', detail: 'Replicate for reporting.' },
      { from: 'dw', to: 'reporting', label: 'extract', kind: 'async', detail: 'Regulatory and finance reports.' },
      { from: 'transfers', to: 'api', label: 'receipt', kind: 'sync', detail: 'The transfer result returns to the API.' },
      { from: 'accounts', to: 'api', label: 'balance', kind: 'sync', detail: 'The account view returns to the API.' },
      { from: 'api', to: 'app', label: 'receipt / statement', kind: 'sync', detail: 'The customer finally sees the result.' },
      { from: 'reporting', to: 'regulator', label: 'filings', kind: 'async', detail: 'The regulator receives the required reports.' },
      { from: 'api', to: 'obs', label: 'audit', kind: 'obs', detail: 'Every channel call is auditable.' },
      { from: 'ledger', to: 'obs', label: 'controls', kind: 'obs', detail: 'Balance and invariant checks.' }
    ],
    flow: [
      { title: 'Post a transfer', detail: 'Screen, post in one ACID transaction, return the result to the transfer service, and send the receipt to the customer.', nodes: ['app', 'api', 'transfers', 'fraud', 'ledger', 'core'], edges: [['app', 'api'], ['api', 'transfers'], ['transfers', 'fraud'], ['transfers', 'ledger'], ['ledger', 'core'], ['ledger', 'transfers'], ['transfers', 'api'], ['api', 'app']] },
      { title: 'Run end-of-day', detail: 'Close the day, accrue interest, replicate to the warehouse, and file reports with the regulator.', nodes: ['regulator', 'batch', 'interest', 'ledger', 'core', 'dw', 'reporting'], edges: [['batch', 'interest'], ['interest', 'ledger'], ['ledger', 'core'], ['ledger', 'batch'], ['ledger', 'dw'], ['dw', 'reporting'], ['reporting', 'regulator']] },
      { title: 'Serve a statement', detail: 'Read the ledger-backed account projection and history, then return the statement to the app.', nodes: ['app', 'api', 'accounts', 'ledger', 'dw'], edges: [['app', 'api'], ['api', 'accounts'], ['ledger', 'accounts'], ['ledger', 'dw'], ['accounts', 'api'], ['api', 'app']] }
    ],
    why: [
      'Double-entry plus ACID is the correctness contract; a transfer cannot leave one side posted.',
      'The ledger is append-only, so balances are derived and every change is auditable.',
      'Batch work is checkpointed and restartable; a failed close resumes without double posting.',
      'Reporting reads a warehouse fed by CDC, protecting the core from heavy queries.',
      'Idempotency keys and a transfer state machine make retries and rail timeouts safe.',
      'Reconciliation and invariants catch the errors that protocols cannot prevent.',
      'The customer loop closes at api → app; the regulator loop closes at reporting → regulator.'
    ],
    tradeoffs: [
      'Strong consistency and ACID limit throughput; banks accept that for money.',
      'End-of-day batch is simple and auditable but delays some postings; real-time accrual is harder.',
      'A mainframe core is proven but expensive; cloud migration adds distributed-systems risk.',
      'Strict fraud/AML checks reduce losses but increase false positives and manual review.'
    ],
    failures: [
      { label: 'Core DB failover', nodes: ['core'], affected: ['ledger', 'transfers', 'api'], detail: 'Writes pause during failover; reads may continue.', mitigation: 'Synchronous HA, bounded retries, and a maintenance mode for channels.' },
      { label: 'Batch overrun', nodes: ['batch'], affected: ['interest', 'reporting'], detail: 'The close misses its window and downstream reports are late.', mitigation: 'Checkpointing, parallel partitions, and a hard cutoff with alerting.' },
      { label: 'AML false positive', nodes: ['fraud'], affected: ['transfers'], detail: 'A legitimate transfer is blocked and the customer is stranded.', mitigation: 'Risk-tiered review, fast manual override, and clear customer communication.' }
    ]
  },

  'deepseek-inference': {
    title: 'DeepSeek inference platform',
    subtitle: 'Continuous batching, KV cache, and fair multi-tenant GPU serving',
    layers: ['Client', 'Edge', 'Service', 'Async', 'Data', 'Obs'],
    nodes: [
      { id: 'app', label: 'Client / API', sub: 'SDK + apps', layer: 'Client', detail: 'Sends prompts and consumes streamed tokens.', spec: ['Streaming SSE/WebSocket.', 'Retries with request ids.'] },
      { id: 'gateway', label: 'API gateway', sub: 'TLS + routing', layer: 'Edge', detail: 'Terminates requests and routes by model/region.', spec: ['Auth and request ids.', 'Backpressure on overload.'] },
      { id: 'auth', label: 'Auth + quota', sub: 'Tenant limits', layer: 'Service', detail: 'Checks API keys, plan, and token budget.', spec: ['Quota at admission.', 'Fair-share per tenant.'] },
      { id: 'router', label: 'Request router', sub: 'Model + region', layer: 'Service', detail: 'Chooses a model replica and cache shard.', spec: ['Affinity for prefix cache.', 'Drains unhealthy replicas.'] },
      { id: 'scheduler', label: 'Batch scheduler', sub: 'Continuous batching', layer: 'Service', detail: 'Builds batches every decode step and manages prefill.', spec: ['Prefill/decode separation.', 'Priority + fairness.'] },
      { id: 'workers', label: 'GPU workers', sub: 'Model shards', layer: 'Service', detail: 'Runs prefill and decode on GPU shards.', spec: ['Tensor parallel.', 'KV-cache aware.'] },
      { id: 'queue', label: 'Request queue', sub: 'Bounded', layer: 'Async', detail: 'Buffers admitted requests until a slot opens.', spec: ['Deadline-aware.', 'Sheds low priority.'] },
      { id: 'stream', label: 'Token streamer', sub: 'SSE', layer: 'Async', detail: 'Streams tokens back as they are generated.', spec: ['Flush per token.', 'Cancel on disconnect.'] },
      { id: 'billing', label: 'Metering / billing', sub: 'Tokens', layer: 'Async', detail: 'Records input/output tokens for invoices.', spec: ['Per-request usage.', 'Idempotent aggregation.'] },
      { id: 'cache', label: 'KV / prompt cache', sub: 'Prefix cache', layer: 'Data', detail: 'Reuses KV state for repeated prefixes.', spec: ['Keyed by prefix hash.', 'Invalidates on model version.'] },
      { id: 'model', label: 'Model store', sub: 'Weights + versions', layer: 'Data', detail: 'Immutable model versions and tokenizer assets.', spec: ['Versioned releases.', 'Pinned per request.'] },
      { id: 'obs', label: 'Observability', sub: 'Latency + GPU', layer: 'Obs', detail: 'Tracks time-to-first-token, tokens/sec, and GPU health.', spec: ['Per-model SLOs.', 'Queue depth alerts.'] }
    ],
    edges: [
      { from: 'app', to: 'gateway', label: 'prompt', kind: 'sync', detail: 'Request enters the API.' },
      { from: 'gateway', to: 'auth', label: 'auth', kind: 'sync', detail: 'Validate key and remaining quota.' },
      { from: 'auth', to: 'router', label: 'admit', kind: 'sync', detail: 'Admitted request is routed.' },
      { from: 'router', to: 'cache', label: 'prefix', kind: 'sync', detail: 'Look for reusable KV state.' },
      { from: 'cache', to: 'router', label: 'hit', kind: 'sync', detail: 'The cached prefix state returns to the router.' },
      { from: 'router', to: 'queue', label: 'enqueue', kind: 'async', detail: 'Wait for a GPU slot.' },
      { from: 'queue', to: 'scheduler', label: 'batch', kind: 'async', detail: 'Build the next decode batch.' },
      { from: 'scheduler', to: 'workers', label: 'step', kind: 'sync', detail: 'Prefill and decode on GPUs.' },
      { from: 'workers', to: 'cache', label: 'KV write', kind: 'sync', detail: 'Write the new KV state after each step.' },
      { from: 'cache', to: 'workers', label: 'KV read', kind: 'sync', detail: 'Read the cached prefix/KV state for the next decode.' },
      { from: 'model', to: 'workers', label: 'weights', kind: 'sync', detail: 'Load the pinned model version.' },
      { from: 'workers', to: 'stream', label: 'tokens', kind: 'async', detail: 'Stream generated tokens.' },
      { from: 'stream', to: 'app', label: 'SSE', kind: 'async', detail: 'Tokens arrive incrementally.' },
      { from: 'workers', to: 'billing', label: 'usage', kind: 'async', detail: 'Meter input and output tokens.' },
      { from: 'gateway', to: 'obs', label: 'traces', kind: 'obs', detail: 'End-to-end request tracing.' }
    ],
    flow: [
      { title: 'Admit the request', detail: 'Authenticate, check quota, route to a model replica, and look up the prefix cache.', nodes: ['app', 'gateway', 'auth', 'router', 'cache'], edges: [['app', 'gateway'], ['gateway', 'auth'], ['auth', 'router'], ['router', 'cache'], ['cache', 'router']] },
      { title: 'Schedule and decode', detail: 'Queue until a GPU slot opens, load the model and KV state, then continuously batch prefill and decode.', nodes: ['router', 'queue', 'scheduler', 'workers', 'model', 'cache'], edges: [['router', 'queue'], ['queue', 'scheduler'], ['scheduler', 'workers'], ['model', 'workers'], ['cache', 'workers']] },
      { title: 'Stream and meter', detail: 'Stream tokens as they are produced and record usage for billing.', nodes: ['workers', 'stream', 'app', 'billing'], edges: [['workers', 'stream'], ['stream', 'app'], ['workers', 'billing']] }
    ],
    why: [
      'Continuous batching keeps GPUs full without waiting for the slowest request to finish.',
      'Separating prefill from decode lets each phase use the right batch shape and hardware.',
      'One KV cache per sequence is the dominant memory cost; admission must account for it.',
      'Prefix caching turns repeated system prompts into reused compute.',
      'Token streaming improves perceived latency even when total generation time is unchanged.',
      'Quota at admission plus a fair scheduler prevents one tenant from monopolizing the fleet.',
      'Model versions are pinned per request so a rollout cannot change behavior mid-stream.',
      'The user loop closes at stream → app; internal KV reads/writes never substitute for the final token stream.'
    ],
    tradeoffs: [
      'Larger batches improve throughput but increase time-to-first-token and tail latency.',
      'Aggressive prefix caching saves compute but can leak information across tenants if keys are shared.',
      'More replicas improve availability but multiply GPU cost and model-load time.',
      'Strict quotas protect fairness but can strand capacity during off-peak hours.'
    ],
    failures: [
      { label: 'GPU pool exhausted', nodes: ['workers'], affected: ['queue', 'scheduler', 'app'], detail: 'Requests queue past their deadline and time out.', mitigation: 'Admission control, priority shedding, and burst capacity in another region.' },
      { label: 'KV cache stampede', nodes: ['cache'], affected: ['router', 'workers'], detail: 'A popular prefix thrashes the cache and recomputes repeatedly.', mitigation: 'Replicate hot prefixes, cap per-tenant cache, and jitter eviction.' },
      { label: 'Bad model version', nodes: ['model'], affected: ['workers', 'stream'], detail: 'A rollout produces malformed output for new requests.', mitigation: 'Canary, pin versions, and roll back by draining replicas.' }
    ]
  },

  lovable: {
    title: 'Lovable',
    subtitle: 'Prompt to running app: orchestration, sandboxes, previews, and rollback',
    layers: ['Client', 'Edge', 'Service', 'Async', 'Data', 'Obs'],
    nodes: [
      { id: 'app', label: 'Builder UI', sub: 'Chat + editor', layer: 'Client', detail: 'The user chats with the builder and previews the app.', spec: ['Streams generation progress.', 'Embeds a live preview.'] },
      { id: 'gateway', label: 'API gateway', sub: 'Auth + routing', layer: 'Edge', detail: 'Entry point for projects and generations.', spec: ['Auth and quotas.', 'Idempotent generation ids.'] },
      { id: 'preview', label: 'Preview proxy', sub: 'Per-project URL', layer: 'Edge', detail: 'Routes the preview iframe to the sandbox port.', spec: ['Authenticated preview.', 'Stable project URL.'] },
      { id: 'projects', label: 'Project service', sub: 'Files + versions', layer: 'Service', detail: 'Owns project metadata, files, and history.', spec: ['Snapshot per generation.', 'Optimistic concurrency.'] },
      { id: 'orchestrator', label: 'Orchestrator', sub: 'Plan / patch / build', layer: 'Service', detail: 'Turns a prompt into a planned set of file changes.', spec: ['Plan, generate, apply, build.', 'Stops on build failure.'] },
      { id: 'llm', label: 'Codegen model', sub: 'LLM', layer: 'Service', detail: 'Generates code and explanations.', spec: ['Streams tokens.', 'Patch-based output.'] },
      { id: 'sandbox', label: 'Sandbox runners', sub: 'Isolated containers', layer: 'Service', detail: 'Installs dependencies, builds, and serves the app.', spec: ['CPU/mem/time limits.', 'No host access.'] },
      { id: 'storage', label: 'Project files', sub: 'Object storage', layer: 'Data', detail: 'Durable source and assets for each project.', spec: ['Content-addressed blobs.', 'Per-project namespace.'] },
      { id: 'snapshots', label: 'Version snapshots', sub: 'Rollback', layer: 'Data', detail: 'Immutable snapshots before each generation.', spec: ['Diffable.', 'Restore is cheap.'] },
      { id: 'deploy', label: 'Publish / deploy', sub: 'Immutable build', layer: 'Async', detail: 'Promotes a snapshot to production.', spec: ['Separate runtime.', 'Rollback by version.'] },
      { id: 'billing', label: 'Usage metering', sub: 'Tokens + minutes', layer: 'Async', detail: 'Tracks model, build, and preview usage.', spec: ['Metered per project.', 'Quota before work.'] },
      { id: 'obs', label: 'Observability', sub: 'Builds + latency', layer: 'Obs', detail: 'Tracks generation success, build time, and errors.', spec: ['Per-step spans.', 'Cost dashboards.'] }
    ],
    edges: [
      { from: 'app', to: 'gateway', label: 'prompt', kind: 'sync', detail: 'Prompt and project actions.' },
      { from: 'gateway', to: 'projects', label: 'files', kind: 'sync', detail: 'Read and update project files.' },
      { from: 'projects', to: 'orchestrator', label: 'generate', kind: 'sync', detail: 'Start a generation run.' },
      { from: 'orchestrator', to: 'llm', label: 'plan', kind: 'sync', detail: 'Plan and generate patches.' },
      { from: 'llm', to: 'orchestrator', label: 'patches', kind: 'sync', detail: 'The model returns the generated plan and patches.' },
      { from: 'orchestrator', to: 'app', label: 'stream / files', kind: 'sync', detail: 'The builder finally sees progress, files, and the result.' },
      { from: 'orchestrator', to: 'sandbox', label: 'build', kind: 'sync', detail: 'Apply changes and build.' },
      { from: 'orchestrator', to: 'snapshots', label: 'save', kind: 'sync', detail: 'Snapshot before generation.' },
      { from: 'projects', to: 'storage', label: 'persist', kind: 'sync', detail: 'Store files and assets.' },
      { from: 'sandbox', to: 'preview', label: 'serve', kind: 'sync', detail: 'Expose the sandbox port.' },
      { from: 'preview', to: 'app', label: 'iframe', kind: 'sync', detail: 'Live preview in the builder.' },
      { from: 'sandbox', to: 'deploy', label: 'publish', kind: 'async', detail: 'Promote an immutable build.' },
      { from: 'deploy', to: 'app', label: 'live URL', kind: 'async', detail: 'The user receives the published URL.' },
      { from: 'gateway', to: 'billing', label: 'usage', kind: 'async', detail: 'Meter tokens and build minutes.' },
      { from: 'gateway', to: 'obs', label: 'traces', kind: 'obs', detail: 'Generation and build tracing.' }
    ],
    flow: [
      { title: 'Prompt to plan', detail: 'Snapshot, ask the model for patches, stream progress/files back to the builder.', nodes: ['app', 'gateway', 'projects', 'orchestrator', 'llm'], edges: [['app', 'gateway'], ['gateway', 'projects'], ['projects', 'orchestrator'], ['orchestrator', 'llm'], ['llm', 'orchestrator'], ['orchestrator', 'app'], ['orchestrator', 'snapshots']] },
      { title: 'Build and preview', detail: 'Apply changes in an isolated sandbox, build, and serve the preview to the builder.', nodes: ['orchestrator', 'sandbox', 'preview', 'app'], edges: [['orchestrator', 'sandbox'], ['sandbox', 'preview'], ['preview', 'app']] },
      { title: 'Persist and publish', detail: 'Save the files, promote an immutable build, and return the live URL.', nodes: ['projects', 'storage', 'snapshots', 'deploy', 'app'], edges: [['projects', 'storage'], ['orchestrator', 'snapshots'], ['sandbox', 'deploy'], ['deploy', 'app']] }
    ],
    why: [
      'The orchestrator is a state machine (plan → patch → build → preview), so failures are localized and retryable.',
      'Generated code runs only in an isolated sandbox with resource limits, never on the API host.',
      'A snapshot before every generation makes rollback and diffing trivial.',
      'Streaming progress and files keeps a long generation from feeling broken.',
      'Preview is a reverse proxy to a per-project port, so every project gets a stable URL.',
      'Metering happens before expensive work, which keeps unit economics visible.',
      'The loop closes at orchestrator → app for generated files and deploy → app for the published URL.'
    ],
    tradeoffs: [
      'Warm sandboxes cut cold starts but consume idle CPU/memory.',
      'Large context windows improve codegen but increase latency and token cost.',
      'Patch-based edits reduce token use but can fail on complex refactors.',
      'Publishing an immutable build is safer but adds a deploy step and its own latency.'
    ],
    failures: [
      { label: 'Sandbox cold start', nodes: ['sandbox'], affected: ['orchestrator', 'preview'], detail: 'The first build of a project takes minutes and the user churns.', mitigation: 'Warm pools, base-image caches, and progressive preview.' },
      { label: 'LLM timeout', nodes: ['llm'], affected: ['orchestrator', 'projects'], detail: 'A generation stalls and the user has no result.', mitigation: 'Stream partial output, checkpoint the plan, and retry from the last step.' },
      { label: 'Runaway build', nodes: ['sandbox'], affected: ['billing', 'obs'], detail: 'A dependency loop consumes CPU and inflates cost.', mitigation: 'Hard time/CPU limits, build cancellation, and per-project quotas.' }
    ]
  },

  replit: {
    title: 'Replit',
    subtitle: 'Per-workspace isolation, CRDT editing, and fast previews',
    layers: ['Client', 'Edge', 'Service', 'Async', 'Data', 'Obs'],
    nodes: [
      { id: 'app', label: 'Browser IDE', sub: 'Editor + terminal', layer: 'Client', detail: 'The full IDE in the browser.', spec: ['WebSocket collaboration.', 'Optimistic local edits.'] },
      { id: 'gateway', label: 'Gateway', sub: 'Auth + routing', layer: 'Edge', detail: 'Routes API, WebSocket, and preview traffic.', spec: ['Workspace-aware routing.', 'TLS termination.'] },
      { id: 'preview', label: 'Preview proxy', sub: 'Port forward', layer: 'Edge', detail: 'Exposes a port from the workspace.', spec: ['Per-workspace URL.', 'Auth at the edge.'] },
      { id: 'workspace', label: 'Workspace service', sub: 'Lifecycle', layer: 'Service', detail: 'Creates, starts, and stops workspaces.', spec: ['State machine per workspace.', 'Idempotent start.'] },
      { id: 'scheduler', label: 'Scheduler', sub: 'Placement', layer: 'Service', detail: 'Places workspaces on nodes with capacity.', spec: ['Bin packing.', 'Warm pool.'] },
      { id: 'collab', label: 'Collaboration', sub: 'CRDT / OT', layer: 'Service', detail: 'Merges concurrent edits from multiple users.', spec: ['Per-file document.', 'Presence separate.'] },
      { id: 'lsp', label: 'Language servers', sub: 'Completion + diagnostics', layer: 'Service', detail: 'Runs language tooling for the workspace.', spec: ['Pooled per language.', 'Route by workspace.'] },
      { id: 'containers', label: 'Containers', sub: 'MicroVM runtime', layer: 'Service', detail: 'The isolated runtime that executes user code.', spec: ['CPU/mem limits.', 'No host mounts.'] },
      { id: 'files', label: 'Persistent FS', sub: 'Workspace volume', layer: 'Data', detail: 'Durable files that survive restarts.', spec: ['Snapshot/restore.', 'Per-workspace quota.'] },
      { id: 'pkg', label: 'Package cache', sub: 'Proxy + mirror', layer: 'Data', detail: 'Shared cache for language packages.', spec: ['Content-addressed.', 'Private registry support.'] },
      { id: 'deploy', label: 'Deploy', sub: 'Immutable build', layer: 'Async', detail: 'Publishes a workspace build to production.', spec: ['Separate runtime.', 'Rollback by version.'] },
      { id: 'obs', label: 'Observability', sub: 'Cold start + errors', layer: 'Obs', detail: 'Tracks workspace health and startup latency.', spec: ['Per-node capacity.', 'Crash loops.'] }
    ],
    edges: [
      { from: 'app', to: 'gateway', label: 'API + WS', kind: 'sync', detail: 'Editor, terminal, and collaboration traffic.' },
      { from: 'gateway', to: 'workspace', label: 'open', kind: 'sync', detail: 'Open or resume a workspace.' },
      { from: 'workspace', to: 'scheduler', label: 'place', kind: 'sync', detail: 'Find a node with capacity.' },
      { from: 'scheduler', to: 'containers', label: 'start', kind: 'sync', detail: 'Start or restore the runtime.' },
      { from: 'app', to: 'collab', label: 'edits', kind: 'sync', detail: 'Live edits over WebSocket.' },
      { from: 'collab', to: 'files', label: 'merge', kind: 'sync', detail: 'Persist merged document state.' },
      { from: 'collab', to: 'app', label: 'edits / presence', kind: 'sync', detail: 'Merged edits and presence return to every browser.' },
      { from: 'workspace', to: 'files', label: 'mount', kind: 'sync', detail: 'Attach the persistent volume.' },
      { from: 'containers', to: 'files', label: 'read/write', kind: 'sync', detail: 'User code reads and writes files.' },
      { from: 'containers', to: 'pkg', label: 'install', kind: 'sync', detail: 'Fetch dependencies from the cache.' },
      { from: 'gateway', to: 'lsp', label: 'diagnostics', kind: 'sync', detail: 'Completion and errors.' },
      { from: 'lsp', to: 'app', label: 'diagnostics', kind: 'sync', detail: 'Completions and errors return to the editor.' },
      { from: 'containers', to: 'preview', label: 'port', kind: 'sync', detail: 'Expose a running app.' },
      { from: 'containers', to: 'app', label: 'stdout', kind: 'async', detail: 'Terminal output returns to the browser IDE.' },
      { from: 'preview', to: 'app', label: 'iframe', kind: 'sync', detail: 'Preview in the IDE.' },
      { from: 'containers', to: 'deploy', label: 'publish', kind: 'async', detail: 'Promote an immutable build.' },
      { from: 'gateway', to: 'obs', label: 'traces', kind: 'obs', detail: 'Workspace and request tracing.' }
    ],
    flow: [
      { title: 'Open a workspace', detail: 'Place the workspace, start or restore its container, and mount the persistent filesystem.', nodes: ['app', 'gateway', 'workspace', 'scheduler', 'containers', 'files'], edges: [['app', 'gateway'], ['gateway', 'workspace'], ['workspace', 'scheduler'], ['scheduler', 'containers'], ['containers', 'files']] },
      { title: 'Edit together', detail: 'Merge concurrent edits, persist them, and return edits/presence plus diagnostics to the IDE.', nodes: ['app', 'collab', 'files', 'gateway', 'lsp'], edges: [['app', 'collab'], ['collab', 'files'], ['collab', 'app'], ['gateway', 'lsp'], ['lsp', 'app']] },
      { title: 'Run and preview', detail: 'Install packages, run the app, return terminal output, and expose the preview.', nodes: ['containers', 'pkg', 'preview', 'app', 'deploy'], edges: [['containers', 'pkg'], ['containers', 'preview'], ['preview', 'app'], ['containers', 'app'], ['containers', 'deploy']] }
    ],
    why: [
      'Per-workspace isolation is the security boundary; generated or user code never touches the host.',
      'A persistent volume plus snapshots makes a workspace feel local while remaining disposable.',
      'Warm pools and snapshots hide the cold-start cost that would otherwise dominate UX.',
      'CRDT/OT keeps multiplayer edits convergent without a central lock.',
      'A shared package cache removes repeated registry traffic and speeds installs.',
      'The preview proxy gives every workspace an authenticated, stable URL.',
      'Deploys promote immutable builds, so production is not the dev container.',
      'The loop closes at collab → app, lsp → app, containers → app, and preview → app.'
    ],
    tradeoffs: [
      'Strong isolation is safer but heavier than process-level sandboxes.',
      'Warm pools improve latency but waste capacity when idle.',
      'CRDTs are offline-friendly but complex for large files and binary assets.',
      'Persistent disks simplify UX but complicate placement and migration.'
    ],
    failures: [
      { label: 'Workspace crash', nodes: ['containers'], affected: ['files', 'preview', 'app'], detail: 'The IDE loses its runtime and the preview goes down.', mitigation: 'Auto-restart, filesystem snapshot, and a clear reconnect state.' },
      { label: 'Collaboration conflict', nodes: ['collab'], affected: ['files'], detail: 'Concurrent edits produce a surprising merge.', mitigation: 'CRDT convergence tests, presence, and per-file history.' },
      { label: 'Cold-start storm', nodes: ['scheduler'], affected: ['workspace', 'containers'], detail: 'A traffic spike exhausts the warm pool and starts crawl.', mitigation: 'Pre-warm by region, queue admissions, and cap per-user starts.' }
    ]
  },

  gmail: {
    title: 'Gmail',
    subtitle: 'Immutable messages, per-user shards, asynchronous search',
    layers: ['Client', 'Edge', 'Service', 'Async', 'Data', 'Obs'],
    nodes: [
      { id: 'client', label: 'Web / mobile', sub: 'Inbox + compose', layer: 'Client', detail: 'Reads, searches, and sends mail.', spec: ['Offline cache.', 'Optimistic actions.'] },
      { id: 'edge', label: 'Edge / gateway', sub: 'Auth + routing', layer: 'Edge', detail: 'Entry point for web, mobile, and sync.', spec: ['Session auth.', 'Route by mailbox.'] },
      { id: 'smtp', label: 'SMTP ingress', sub: 'Receive mail', layer: 'Service', detail: 'Accepts inbound mail from the internet.', spec: ['Spool before processing.', 'Per-sender limits.'] },
      { id: 'delivery', label: 'Delivery service', sub: 'Store + fan out', layer: 'Service', detail: 'Persists messages and updates the mailbox.', spec: ['Idempotent by Message-ID.', 'Writes blob + metadata.'] },
      { id: 'spam', label: 'Spam / phishing', sub: 'Reputation + models', layer: 'Service', detail: 'Scores and filters inbound messages.', spec: ['Auth checks (SPF/DKIM).', 'User feedback loop.'] },
      { id: 'threads', label: 'Threads + labels', sub: 'Conversation view', layer: 'Service', detail: 'Groups messages into threads and applies labels.', spec: ['Derived from headers.', 'Labels are mutable.'] },
      { id: 'search', label: 'Search', sub: 'Inverted index', layer: 'Service', detail: 'Full-text search over mail.', spec: ['Per-user index.', 'Async updates.'] },
      { id: 'push', label: 'Push / IDLE', sub: 'Realtime', layer: 'Async', detail: 'Notifies clients of new mail.', spec: ['WebSocket / APNs.', 'Resume by history id.'] },
      { id: 'queue', label: 'Delivery queue', sub: 'Retry + backoff', layer: 'Async', detail: 'Decouples ingress from storage and filtering.', spec: ['At-least-once.', 'DLQ for poison.'] },
      { id: 'blob', label: 'Message blob', sub: 'Object store', layer: 'Data', detail: 'Immutable raw message and attachments.', spec: ['Content-addressed.', 'Tiered storage.'] },
      { id: 'index', label: 'Search index', sub: 'Sharded', layer: 'Data', detail: 'Inverted index for fast search.', spec: ['Per-user shard.', 'Rebuildable.'] },
      { id: 'meta', label: 'Mailbox metadata', sub: 'Threads + labels', layer: 'Data', detail: 'Mutable per-user mailbox state.', spec: ['Sharded by user.', 'Strong per-user consistency.'] },
      { id: 'obs', label: 'Observability', sub: 'Delivery + search', layer: 'Obs', detail: 'Tracks delivery delay, spam rate, and search lag.', spec: ['Per-region SLOs.', 'Index lag alerts.'] }
    ],
    edges: [
      { from: 'client', to: 'edge', label: 'HTTPS', kind: 'sync', detail: 'Read, search, and send.' },
      { from: 'edge', to: 'threads', label: 'inbox', kind: 'sync', detail: 'Load threads and labels.' },
      { from: 'edge', to: 'search', label: 'query', kind: 'sync', detail: 'Full-text search.' },
      { from: 'smtp', to: 'spam', label: 'score', kind: 'sync', detail: 'Authenticate and score inbound.' },
      { from: 'spam', to: 'queue', label: 'accept', kind: 'async', detail: 'Spool accepted mail.' },
      { from: 'queue', to: 'delivery', label: 'deliver', kind: 'async', detail: 'Process with retries.' },
      { from: 'delivery', to: 'blob', label: 'store', kind: 'sync', detail: 'Write the immutable message.' },
      { from: 'delivery', to: 'meta', label: 'mailbox', kind: 'sync', detail: 'Update thread and labels.' },
      { from: 'delivery', to: 'index', label: 'index', kind: 'async', detail: 'Feed the search index.' },
      { from: 'delivery', to: 'push', label: 'notify', kind: 'async', detail: 'Push to online clients.' },
      { from: 'push', to: 'client', label: 'IDLE', kind: 'async', detail: 'New mail arrives in real time.' },
      { from: 'threads', to: 'meta', label: 'state', kind: 'sync', detail: 'Read mailbox metadata.' },
      { from: 'threads', to: 'client', label: 'thread view', kind: 'sync', detail: 'The thread and labels return to the client.' },
      { from: 'search', to: 'index', label: 'lookup', kind: 'sync', detail: 'Query the inverted index.' },
      { from: 'search', to: 'client', label: 'results', kind: 'sync', detail: 'Search results return to the client.' },
      { from: 'edge', to: 'obs', label: 'traces', kind: 'obs', detail: 'Request and delivery tracing.' }
    ],
    flow: [
      { title: 'Receive inbound mail', detail: 'SMTP accepts, spam scores, the queue retries, and delivery writes blob + metadata.', nodes: ['smtp', 'spam', 'queue', 'delivery', 'blob', 'meta'], edges: [['smtp', 'spam'], ['spam', 'queue'], ['queue', 'delivery'], ['delivery', 'blob'], ['delivery', 'meta']] },
      { title: 'Read and search', detail: 'Load threads and search the index, then return both result sets to the client.', nodes: ['client', 'edge', 'threads', 'meta', 'search', 'index'], edges: [['client', 'edge'], ['edge', 'threads'], ['threads', 'meta'], ['threads', 'client'], ['edge', 'search'], ['search', 'index'], ['search', 'client']] },
      { title: 'Notify and index', detail: 'Push new mail to online clients and feed the index asynchronously.', nodes: ['delivery', 'push', 'client', 'index'], edges: [['delivery', 'push'], ['push', 'client'], ['delivery', 'index']] }
    ],
    why: [
      'Messages are immutable blobs; labels and read state are small mutable metadata, so the heavy bytes never rewrite.',
      'Per-user sharding makes the inbox the consistency unit and keeps fan-out local.',
      'SMTP ingress spools and returns quickly; spam scoring and storage are asynchronous.',
      'Search is an index, not a scan; accepting index lag is cheaper than synchronous indexing.',
      'Threading is derived from headers, so it works across providers.',
      'Push plus a history cursor gives real-time delivery without polling the mailbox.',
      'Deduplication by Message-ID makes sender retries harmless.',
      'The user loop closes at threads → client and search → client, with push → client for new mail.'
    ],
    tradeoffs: [
      'Async indexing means a just-received message may not be searchable immediately.',
      'Aggressive spam filtering reduces abuse but risks false positives; appeals matter.',
      'Per-user shards simplify isolation but make cross-user admin queries harder.',
      'Hot/cold storage tiering lowers cost but adds retrieval latency for old mail.'
    ],
    failures: [
      { label: 'Spam false positive', nodes: ['spam'], affected: ['queue', 'delivery', 'client'], detail: 'Legitimate mail is quarantined and the user misses it.', mitigation: 'Deliver to spam with a visible digest, user feedback, and a fast allowlist.' },
      { label: 'Index lag', nodes: ['index'], affected: ['search'], detail: 'New messages are missing from search results.', mitigation: 'Show recent mail from metadata and surface index freshness.' },
      { label: 'Delivery queue backlog', nodes: ['queue'], affected: ['delivery', 'push'], detail: 'Inbound mail is delayed and clients see a stale inbox.', mitigation: 'Priority lanes, autoscaled workers, and backpressure at SMTP.' }
    ]
  }
};

DESIGN_QUESTIONS.push(...EXTRA_DESIGN_QUESTIONS);
Object.assign(DESIGN_GRAPHS, EXTRA_DESIGN_GRAPHS);
