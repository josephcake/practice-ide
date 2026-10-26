/* ============================================================
   Catalog part 2: Hard (1 of 2)
   ============================================================ */

DesignCatalog.add({
  id: 'dropbox', difficulty: 'hard', cat: 'Storage',
  title: 'Design Dropbox',
  prompt: [
    'Design a file-sync service: a folder lives on many devices, and an edit on one device appears on every other device within seconds. Users can also share folders.',
    '',
    'Scale: 500M users, files from bytes to 50 GB, many devices per user, and frequent small edits to large files.'
  ].join('\n'),
  hints: [
    'This is a sync problem before it is a storage problem: the core is detecting changes and propagating them to every device.',
    'Split files into chunks (e.g. 4 MB) identified by their content hash. Only changed chunks are uploaded, and identical chunks are stored once (deduplication).',
    'Metadata (folders, file versions, which chunks make each version) lives in a strongly consistent database; the chunk bytes live in object storage.',
    'Each change bumps a per-namespace version (a journal). Devices remember the last version they saw and ask "what changed since N?".',
    'Notify devices with a long-poll or WebSocket "something changed" signal, then they pull the changes.',
    'Conflicts: two devices edit offline. Keep both versions ("conflicted copy") rather than silently losing one.',
    'Uploads go directly to storage with pre-signed URLs, so app servers never carry the bytes.'
  ],
  topics: ['Content-hash chunks', 'Deduplication', 'Metadata vs blob split', 'Change journal / cursors', 'Change notifications', 'Conflict copies', 'Pre-signed uploads'],
  brief: {
    ask: 'Build the system that keeps the same folder in sync across all of a person\'s devices, within seconds.',
    examples: [
      'Kim edits slides.pptx (200 MB) on her laptop; only the 2 changed 4 MB chunks upload, and her phone shows the new version 5 seconds later.',
      'She uploads a 3 GB video that a colleague already uploaded; it finishes instantly because the chunks already exist.',
      'Her laptop was offline on a plane; when it reconnects, it fetches only what changed since it last synced.',
      'Kim and Joe edit the same doc offline; both versions are kept, one named "conflicted copy".'
    ],
    deliver: ['How files are split, uploaded, and deduplicated', 'Where metadata vs bytes live', 'How devices learn about changes', 'How conflicts are handled']
  },
  map: {
    subtitle: 'Chunked, deduplicated bytes plus a versioned metadata journal',
    nodes: [
      ['device', 'Desktop client', 'Watches folder', 'Client', 'Detects local changes, uploads chunks, applies remote changes.', ['Keeps a sync cursor.']],
      ['gw', 'API gateway', 'Auth + routing', 'Edge', 'Entry point for metadata and notification calls.', ['Long-lived connections.']],
      ['meta', 'Metadata service', 'Files + versions', 'Service', 'Commits new file versions and answers "what changed?".', ['Strongly consistent.']],
      ['blocks', 'Block service', 'Chunk upload', 'Service', 'Checks which chunks exist and issues upload URLs.', ['Content-hash addressed.']],
      ['notify', 'Notifier', 'Change signals', 'Async', 'Tells other devices that a folder changed.', ['Long-poll / WebSocket.']],
      ['metadb', 'Metadata DB', 'Journal per folder', 'Data', 'Folders, files, versions, chunk lists, and a change journal.', ['Sharded by namespace.']],
      ['store', 'Object storage', 'Chunks by hash', 'Data', 'Each unique chunk stored once.', ['Durable, replicated.']],
      ['other', 'Other devices', 'Phone, laptop', 'Client', 'Receive and apply the change.', ['Pull only new versions.']]
    ],
    edges: [
      ['device', 'gw', 'sync calls', 'sync', 'Metadata and chunk checks.'],
      ['gw', 'blocks', 'which chunks?', 'sync', 'Send chunk hashes.'],
      ['blocks', 'store', 'exists?', 'sync', 'Skip chunks already stored.'],
      ['device', 'store', 'upload chunks', 'sync', 'Direct upload with pre-signed URLs.'],
      ['gw', 'meta', 'commit version', 'sync', 'New version = list of chunk hashes.'],
      ['meta', 'metadb', 'write + journal', 'sync', 'One transaction bumps the folder version.'],
      ['meta', 'notify', 'changed', 'async', 'Signal other devices.'],
      ['meta', 'gw', 'version', 'sync', 'Commit result.'],
      ['gw', 'device', 'ok / changes', 'sync', 'Responses back to the device.'],
      ['notify', 'other', 'something changed', 'async', 'Wake up other devices.'],
      ['other', 'gw', 'changes since N', 'sync', 'Pull new versions.'],
      ['gw', 'other', 'new chunk list', 'sync', 'What to download.'],
      ['other', 'store', 'download chunks', 'sync', 'Fetch only missing chunks.']
    ],
    flow: [
      ['Save a file', 'Upload only new chunks, then commit a new version that lists the chunks.', 'device>gw, gw>blocks, blocks>store, device>store, gw>meta, meta>metadb, meta>gw, gw>device'],
      ['Sync another device', 'Other devices get a signal, ask what changed since their cursor, and download missing chunks.', 'meta>notify, notify>other, other>gw, gw>other, other>store']
    ],
    why: [
      'Chunking means a small edit to a big file uploads only a few megabytes.',
      'Content hashes give deduplication and integrity checks for free.',
      'A per-folder journal lets any device catch up from any point in time.',
      'Bytes bypass app servers via pre-signed URLs, so the API stays small.'
    ],
    tradeoffs: [
      'Smaller chunks dedupe better but mean more metadata.',
      'Strongly consistent metadata limits write throughput per folder.',
      'Keeping conflicted copies is safe but annoys users; automatic merges risk losing edits.'
    ],
    failures: [
      ['Metadata DB overloaded', 'metadb', 'meta other', 'Commits stall, so changes stop propagating even though chunks uploaded.', 'Shard by namespace, queue commits with backpressure, and keep clients retrying idempotently.']
    ]
  }
});

DesignCatalog.add({
  id: 'google-docs', difficulty: 'hard', cat: 'Collaboration',
  title: 'Design Google Docs',
  prompt: [
    'Design a collaborative document editor: many people type into the same document at once, every keystroke shows up for others within a moment, and everyone ends with the same text.',
    '',
    'Scale: millions of documents open at once, up to ~100 simultaneous editors in one document, sub-second propagation, no edit ever silently lost.'
  ].join('\n'),
  hints: [
    'The core problem is convergence: two people insert at the same position at the same time. Plain "last write wins" loses edits.',
    'Two families: Operational Transformation (OT) rewrites concurrent operations against each other on a central server; CRDTs give every character a unique, ordered id so merges are automatic.',
    'Route all editors of one document to one collaboration server (consistent hashing by doc id). That server orders operations for the doc.',
    'Clients apply their own edits immediately (optimistic), send operations, and transform incoming ones against their pending edits.',
    'Persist an operation log plus periodic snapshots, so a document can be rebuilt and history browsed.',
    'Presence (cursors, who is here) is ephemeral and can be lossy; keep it separate from the durable operation stream.',
    'Offline edits queue locally and merge on reconnect.'
  ],
  topics: ['OT vs CRDT', 'One server per document', 'Optimistic local edits', 'Operation log + snapshots', 'Presence vs content', 'Offline merge'],
  brief: {
    ask: 'Build the editor backend where many people type in one document at once and everyone ends up with the same text.',
    examples: [
      'Ana and Ben both type at the start of the same line at the same moment; both words appear, in the same order, on both screens.',
      'Each keystroke Ana types shows up on Ben\'s screen within 200 ms.',
      'Ben edits on a train with no signal; when he reconnects, his edits merge without overwriting Ana\'s.',
      'A month later they open version history and see who changed what.'
    ],
    deliver: ['How concurrent edits converge (OT or CRDT)', 'How editors of one document are connected', 'How edits are stored and documents rebuilt', 'How offline edits and presence work']
  },
  map: {
    subtitle: 'One ordering point per document, an operation log, and ephemeral presence',
    nodes: [
      ['editor', 'Editor', 'Browser', 'Client', 'Applies local edits instantly and syncs operations.', ['Keeps pending ops.']],
      ['gw', 'WS gateway', 'Route by doc', 'Edge', 'Keeps live connections and routes by document id.', ['Consistent hashing.']],
      ['collab', 'Collab server', 'Orders ops', 'Service', 'Orders and transforms operations for each open document.', ['One owner per doc.']],
      ['presence', 'Presence', 'Cursors, who\'s here', 'Service', 'Shares cursor positions and avatars.', ['Lossy is fine.']],
      ['oplog', 'Operation log', 'Every edit', 'Data', 'Append-only log of operations per document.', ['Source of truth.']],
      ['snap', 'Snapshots', 'Every N ops', 'Data', 'Periodic full document states.', ['Fast loading.']],
      ['docs', 'Document service', 'Open + history', 'Service', 'Loads a document and serves version history.', ['Snapshot + tail of log.']],
      ['others', 'Other editors', 'Same doc', 'Client', 'Receive transformed operations.', ['Apply in server order.']]
    ],
    edges: [
      ['editor', 'gw', 'operation', 'sync', 'Send an edit with its base version.'],
      ['gw', 'collab', 'route', 'sync', 'To the server that owns this doc.'],
      ['collab', 'oplog', 'append', 'sync', 'Durably record the ordered op.'],
      ['collab', 'gw', 'ack + ops', 'sync', 'Acknowledge and broadcast.'],
      ['gw', 'editor', 'ack', 'sync', 'Confirm the edit\'s position.'],
      ['gw', 'others', 'broadcast', 'async', 'Other editors receive the op.'],
      ['collab', 'snap', 'snapshot', 'async', 'Compact the log periodically.'],
      ['editor', 'docs', 'open doc', 'sync', 'Initial load.'],
      ['docs', 'snap', 'latest snapshot', 'sync', 'Start from a snapshot.'],
      ['docs', 'oplog', 'ops since', 'sync', 'Replay the tail.'],
      ['docs', 'editor', 'document', 'sync', 'Current text.'],
      ['editor', 'presence', 'cursor', 'async', 'Where I am typing.'],
      ['presence', 'others', 'cursors', 'async', 'Show other cursors.']
    ],
    flow: [
      ['Open a document', 'Load the latest snapshot and replay operations since it.', 'editor>docs, docs>snap, docs>oplog, docs>editor'],
      ['Type a character', 'The edit is ordered by the doc\'s server, logged, acknowledged, and broadcast.', 'editor>gw, gw>collab, collab>oplog, collab>gw, gw>editor, gw>others'],
      ['See who is here', 'Cursor positions flow through a separate, lossy presence channel.', 'editor>presence, presence>others']
    ],
    why: [
      'A single ordering point per document makes concurrent edits deterministic.',
      'Optimistic local edits make typing feel instant.',
      'The operation log is durable history; snapshots keep loading fast.',
      'Presence is separate so lossy cursor updates never risk document content.'
    ],
    tradeoffs: [
      'OT needs a central server but keeps documents compact; CRDTs work peer-to-peer but carry metadata.',
      'One server per document is simple but caps editors per document.',
      'Frequent snapshots speed loading but cost storage.'
    ],
    failures: [
      ['Collab server crashes', 'collab', 'gw editor others', 'Editors of the affected documents disconnect mid-typing.', 'Reassign the document to another server, rebuild from snapshot + log, and let clients resend pending ops.']
    ]
  }
});

DesignCatalog.add({
  id: 'ticketmaster', difficulty: 'hard', cat: 'Booking',
  title: 'Design Ticketmaster',
  prompt: [
    'Design a ticket-booking system with assigned seats: browse an event, hold a seat for a few minutes, pay, and get the ticket. The same seat must never sell twice.',
    '',
    'Scale: a popular on-sale brings millions of users in the first minute for 50,000 seats; normal traffic is calm.'
  ].join('\n'),
  hints: [
    'The hard part is inventory correctness under a synchronized stampede, not average traffic.',
    'Seat holds: reserve a seat with a short expiry (e.g. 10 minutes) using a conditional update ("set held if available") or a distributed lock with TTL.',
    'Booking: payment then confirm; if payment fails or the hold expires, release the seat.',
    'Put a virtual waiting room in front of hot on-sales: admit users at a controlled rate so the booking system sees steady load.',
    'Seat maps are read-heavy: cache availability and accept that it can be a few seconds stale; the hold step is the real check.',
    'Idempotency on purchase so a retried payment never books twice.',
    'Bots: rate limits, CAPTCHA, and per-account purchase limits.'
  ],
  topics: ['Seat holds with expiry', 'Conditional updates', 'Virtual waiting room', 'Stale-but-fast seat maps', 'Idempotent purchase', 'Bot protection'],
  brief: {
    ask: 'Build the ticket system that sells assigned seats to a sold-out show without ever selling one seat twice.',
    examples: [
      'At 10:00 am, 2 million fans try to buy 50,000 Taylor Swift seats; most wait in a queue page instead of crashing the site.',
      'Mia picks Section 104, Row F, Seat 7; it is held for her for 10 minutes while she pays.',
      'Leo clicks the same seat a second later and is told it is unavailable.',
      'Mia\'s payment fails; at minute 10 the seat goes back on sale.'
    ],
    deliver: ['How a seat is held and released', 'How a purchase is made exactly once', 'How the on-sale stampede is absorbed', 'How seat maps stay fast']
  },
  map: {
    subtitle: 'Admit at a steady rate, hold seats atomically, confirm exactly once',
    nodes: [
      ['fan', 'Fan', 'Browser / app', 'Client', 'Browses seats and buys tickets.', ['Many arrive at once.']],
      ['wait', 'Waiting room', 'Admission queue', 'Edge', 'Admits users at a controlled rate during on-sales.', ['Issues signed tokens.']],
      ['gw', 'API gateway', 'Auth + bot checks', 'Edge', 'Entry point after admission.', ['Rate limits per account.']],
      ['events', 'Event service', 'Seat maps', 'Service', 'Serves event details and seat availability.', ['Cached, slightly stale.']],
      ['hold', 'Hold service', 'Reserve with TTL', 'Service', 'Atomically marks a seat held for one user.', ['Conditional update.']],
      ['book', 'Booking service', 'Pay + confirm', 'Service', 'Charges and confirms the hold.', ['Idempotency key.']],
      ['pay', 'Payment provider', 'Card charge', 'Client', 'External payment processor.', ['Can time out.']],
      ['inv', 'Seat inventory', 'Per-seat state', 'Data', 'available / held(until) / sold for every seat.', ['Strongly consistent.']],
      ['seatcache', 'Seat map cache', 'Availability', 'Data', 'Fast seat-map reads.', ['Refreshed every few seconds.']],
      ['expire', 'Hold expiry', 'Release seats', 'Async', 'Returns expired holds to available.', ['Runs continuously.']]
    ],
    edges: [
      ['fan', 'wait', 'join', 'sync', 'Enter the queue during an on-sale.'],
      ['wait', 'fan', 'your turn', 'sync', 'Admission token when admitted.'],
      ['fan', 'gw', 'with token', 'sync', 'Admitted requests.'],
      ['gw', 'events', 'seat map', 'sync', 'Show availability.'],
      ['events', 'seatcache', 'read', 'sync', 'Cached availability.'],
      ['gw', 'hold', 'hold seat', 'sync', 'Try to reserve a seat.'],
      ['hold', 'inv', 'if available', 'sync', 'Conditional update with expiry.'],
      ['gw', 'book', 'purchase', 'sync', 'Pay for the held seat.'],
      ['book', 'pay', 'charge', 'sync', 'External payment.'],
      ['book', 'inv', 'mark sold', 'sync', 'Only if still held by this user.'],
      ['book', 'gw', 'ticket', 'sync', 'Confirmation.'],
      ['hold', 'gw', 'held / taken', 'sync', 'Hold result.'],
      ['gw', 'fan', 'response', 'sync', 'Seat map, hold, or ticket.'],
      ['expire', 'inv', 'release', 'async', 'Free expired holds.'],
      ['inv', 'seatcache', 'refresh', 'async', 'Update cached availability.']
    ],
    flow: [
      ['Get in during an on-sale', 'The waiting room admits fans at a rate the booking system can handle.', 'fan>wait, wait>fan, fan>gw, gw>events, events>seatcache, gw>fan'],
      ['Hold a seat', 'A conditional update reserves the seat for 10 minutes, or fails if taken.', 'fan>gw, gw>hold, hold>inv, hold>gw, gw>fan'],
      ['Buy the ticket', 'Charge, then mark sold only if the hold is still yours.', 'fan>gw, gw>book, book>pay, book>inv, book>gw, gw>fan']
    ],
    why: [
      'The waiting room turns a stampede into steady, predictable load.',
      'A conditional update makes "two people hold one seat" impossible.',
      'Holds with expiry free seats automatically when users abandon checkout.',
      'Seat maps can be stale because the hold step is the real check.'
    ],
    tradeoffs: [
      'Short holds free seats faster but rush buyers; long holds lock inventory.',
      'A waiting room feels slow but keeps the site up.',
      'Locking per seat is precise; locking per section is simpler but blocks more users.'
    ],
    failures: [
      ['Payment provider slow', 'pay', 'book inv', 'Checkouts hang while holds tick down; seats may expire mid-payment.', 'Extend the hold while a payment is in flight, retry idempotently, and reconcile charges.']
    ]
  }
});

DesignCatalog.add({
  id: 'live-comments', difficulty: 'hard', cat: 'Real-time',
  title: 'Design Live Comments',
  prompt: [
    'Design live comments for a broadcast (like a live stream or sports game): millions of viewers watch one stream and see new comments appear instantly.',
    '',
    'Scale: 5M concurrent viewers on one event, 50k comments per second at peak, which is far more than anyone can read.'
  ].join('\n'),
  hints: [
    'Fan-out is big (one comment × millions of viewers), but the real insight is that no one can read 50k comments per second.',
    'Sample or rank: each viewer receives a manageable stream (e.g. 10 comments/second), favoring friends, popular, and recent comments.',
    'Viewers hold WebSocket or SSE connections to edge servers; each edge server subscribes once to the event channel and fans out locally.',
    'Write path: accept the comment, store it, publish to the event\'s channel (partitioned pub/sub).',
    'Moderation runs before broadcast for obvious spam and asynchronously for the rest.',
    'Late joiners load the last N comments from storage, then switch to the live stream.',
    'Hot event = hot channel: shard the channel and use a two-level fan-out tree.'
  ],
  topics: ['WebSocket / SSE fan-out', 'Two-level fan-out tree', 'Sampling and ranking', 'Partitioned pub/sub', 'Moderation', 'Catch-up on join'],
  brief: {
    ask: 'Build live comments for a huge broadcast, so millions of viewers see new comments flowing in real time.',
    examples: [
      'During the final, Diego posts "WHAT A GOAL ⚽"; viewers see it appear within a second.',
      '5 million people are watching and 50,000 comments arrive per second; each viewer sees a readable stream of about 10 per second.',
      'Diego\'s friends see his comment even when it is not among the most popular.',
      'A spam bot posts links 100 times; none of them reach viewers.'
    ],
    deliver: ['How comments reach millions of open connections', 'How the stream is kept readable (sampling)', 'How a new viewer catches up', 'Moderation and hot-event scaling']
  },
  map: {
    subtitle: 'Publish once, fan out at the edge, sample what each viewer sees',
    nodes: [
      ['viewer', 'Viewer', 'Watching live', 'Client', 'Reads the live comment stream and posts comments.', ['One WebSocket.']],
      ['edgews', 'Edge servers', 'WebSocket / SSE', 'Edge', 'Hold viewer connections and fan out locally.', ['Each subscribes once.']],
      ['api', 'Comment API', 'Post comment', 'Service', 'Accepts and validates new comments.', ['Rate-limited per user.']],
      ['mod', 'Moderation', 'Spam + safety', 'Service', 'Blocks obvious abuse before broadcast.', ['Async deep checks.']],
      ['bus', 'Event channel', 'Partitioned pub/sub', 'Async', 'One channel per broadcast, sharded when hot.', ['Ordered per shard.']],
      ['sampler', 'Sampler / ranker', 'Readable stream', 'Service', 'Chooses which comments each viewer receives.', ['Friends, popular, recent.']],
      ['store', 'Comment store', 'By event + time', 'Data', 'Durable comments for replay and catch-up.', ['Last N cached.']]
    ],
    edges: [
      ['viewer', 'api', 'post', 'sync', 'Submit a comment.'],
      ['api', 'mod', 'check', 'sync', 'Fast safety check.'],
      ['api', 'store', 'save', 'sync', 'Persist the comment.'],
      ['api', 'bus', 'publish', 'async', 'Broadcast to the event channel.'],
      ['api', 'viewer', 'posted', 'sync', 'The author sees it immediately.'],
      ['bus', 'sampler', 'all comments', 'async', 'Raw comment stream.'],
      ['sampler', 'edgews', 'sampled stream', 'async', 'A readable subset per audience.'],
      ['edgews', 'viewer', 'new comments', 'async', 'Pushed over WebSocket.'],
      ['viewer', 'edgews', 'connect', 'sync', 'Join the broadcast.'],
      ['edgews', 'store', 'last 50', 'sync', 'Catch-up on join.']
    ],
    flow: [
      ['Post a comment', 'Check, store, and publish once to the event channel.', 'viewer>api, api>mod, api>store, api>bus, api>viewer'],
      ['Receive comments', 'The sampler picks a readable subset and edge servers push it to every viewer.', 'bus>sampler, sampler>edgews, edgews>viewer'],
      ['Join late', 'A new viewer loads the last comments, then streams live.', 'viewer>edgews, edgews>store, edgews>viewer']
    ],
    why: [
      'Publishing once and fanning out at the edge keeps the core small.',
      'Sampling keeps each viewer\'s stream readable and caps outbound bandwidth.',
      'Durable storage makes catch-up and replay possible.',
      'Moderation before broadcast stops spam reaching millions.'
    ],
    tradeoffs: [
      'Sampling means most comments are never seen by most viewers.',
      'Strict ordering across shards is expensive; per-shard order is usually enough.',
      'Synchronous moderation adds latency; async moderation risks brief exposure.'
    ],
    failures: [
      ['Edge server crash', 'edgews', 'viewer', 'Thousands of viewers disconnect at once and reconnect in a burst.', 'Reconnect with jitter, spread across edges, and catch up from the store.']
    ]
  }
});

DesignCatalog.add({
  id: 'news-aggregator', difficulty: 'hard', cat: 'Content',
  title: 'Design a News Aggregator',
  prompt: [
    'Design a news aggregator (like Google News): crawl tens of thousands of news sources and show each user a fresh, ranked feed of stories.',
    '',
    'Scale: 50k sources, 2M new articles per day, 100M readers, and breaking news should appear within minutes.'
  ].join('\n'),
  hints: [
    'The trap is a time-sorted list of raw articles. The real problem: twenty articles from twenty outlets are one story.',
    'Ingest: poll RSS/sitemaps per source on a schedule matched to how often it publishes; fetch and extract article text.',
    'Deduplicate near-identical articles (content hashing, SimHash/MinHash) and cluster articles into stories by text similarity and entities.',
    'Rank stories, not articles: freshness, number of sources covering it, source quality, and personalization.',
    'Precompute top stories per topic and region; personalize lightly at read time.',
    'Serve from caches: the front page is the same for millions of people.',
    'Breaking news: a fast path that promotes a fast-growing cluster within minutes.'
  ],
  topics: ['Source polling', 'Article extraction', 'Near-duplicate detection', 'Story clustering', 'Story ranking', 'Precomputed sections', 'Breaking-news fast path'],
  brief: {
    ask: 'Build the system that gathers articles from thousands of news sites and shows readers the important stories, not twenty copies of the same one.',
    examples: [
      'A storm hits Florida; 40 outlets publish articles; readers see one story card "Hurricane makes landfall" with links to several outlets.',
      'Within 5 minutes of the first article, the story is on the front page.',
      'A reader who follows "Technology" sees tech stories higher in their feed.',
      'The front page loads in under 300 ms for 10 million readers in the morning.'
    ],
    deliver: ['How sources are crawled efficiently', 'How duplicate and related articles become one story', 'How stories are ranked', 'How the feed is served fast']
  },
  map: {
    subtitle: 'Crawl, cluster articles into stories, rank stories, serve from cache',
    nodes: [
      ['reader', 'Reader', 'Web / app', 'Client', 'Reads the ranked news feed.', ['Mostly the same front page.']],
      ['cdn', 'Edge cache', 'Front pages', 'Edge', 'Caches section pages per region.', ['Refreshed every minute.']],
      ['feed', 'Feed service', 'Sections + personal', 'Service', 'Builds the page from precomputed stories.', ['Light personalization.']],
      ['sched', 'Crawl scheduler', 'Per source', 'Async', 'Decides when to poll each source.', ['Busy sources more often.']],
      ['fetch', 'Fetchers', 'RSS + pages', 'Service', 'Downloads feeds and articles, extracts text.', ['Polite per domain.']],
      ['cluster', 'Clustering', 'Articles → stories', 'Service', 'Dedupes and groups articles into stories.', ['Similarity + entities.']],
      ['rank', 'Ranker', 'Score stories', 'Service', 'Scores stories by freshness, coverage, and quality.', ['Per section and region.']],
      ['articles', 'Article store', 'Text + metadata', 'Data', 'Every fetched article.', ['Searchable.']],
      ['stories', 'Story store', 'Top per section', 'Data', 'Ranked stories per section and region.', ['Read by the feed.']],
      ['sources', 'Sources', 'News sites', 'Client', 'External publishers.', ['RSS, sitemaps, pages.']]
    ],
    edges: [
      ['reader', 'cdn', 'front page', 'sync', 'Most requests end at the edge.'],
      ['cdn', 'feed', 'miss', 'sync', 'Build the page.'],
      ['feed', 'stories', 'top stories', 'sync', 'Precomputed rankings.'],
      ['feed', 'cdn', 'page', 'sync', 'Rendered page.'],
      ['cdn', 'reader', 'feed', 'sync', 'The reader sees stories.'],
      ['sched', 'fetch', 'poll source', 'async', 'Time to check this source.'],
      ['fetch', 'sources', 'GET', 'sync', 'Fetch feed and articles.'],
      ['sources', 'fetch', 'articles', 'sync', 'New content.'],
      ['fetch', 'articles', 'store', 'sync', 'Save extracted text.'],
      ['fetch', 'cluster', 'new article', 'async', 'Assign to a story.'],
      ['cluster', 'rank', 'story updated', 'async', 'Re-score the story.'],
      ['rank', 'stories', 'ranked list', 'async', 'Update sections.']
    ],
    flow: [
      ['Ingest an article', 'Poll the source, fetch, store, and cluster the article into a story.', 'sched>fetch, fetch>sources, sources>fetch, fetch>articles, fetch>cluster'],
      ['Promote a story', 'A growing cluster is re-scored and moves up its sections.', 'cluster>rank, rank>stories'],
      ['Read the news', 'Front pages come from the edge; misses are built from ranked stories.', 'reader>cdn, cdn>feed, feed>stories, feed>cdn, cdn>reader']
    ],
    why: [
      'Clustering turns many near-identical articles into one readable story.',
      'Ranking stories by coverage surfaces what is actually important.',
      'Per-source scheduling spends crawl budget where news appears.',
      'Shared front pages make edge caching extremely effective.'
    ],
    tradeoffs: [
      'Aggressive clustering can merge distinct stories; loose clustering shows duplicates.',
      'Heavy personalization reduces cache hits.',
      'Polling more often finds news faster but costs bandwidth and politeness.'
    ],
    failures: [
      ['Clustering backlog', 'cluster', 'rank stories', 'New articles are stored but do not reach stories, so breaking news is late.', 'Scale clustering on queue depth and show unclustered fresh articles as a fallback.']
    ]
  }
});

DesignCatalog.add({
  id: 'post-search', difficulty: 'hard', cat: 'Search',
  title: 'Design Post Search (Full-Text Search)',
  prompt: [
    'Design search over social posts: a user types a multi-word query and gets the best-matching posts out of billions, ranked, in milliseconds.',
    '',
    'Scale: 50B posts, 500M new posts per day, 100k queries per second, and new posts should be searchable within a minute.'
  ].join('\n'),
  hints: [
    'Scanning text at query time is impossible. Build an inverted index: term → list of post ids (a posting list).',
    'Tokenize and normalize (lowercase, stemming); store term positions for phrase queries.',
    'Shard the index by document (each shard holds all terms for a subset of posts), query all shards in parallel, and merge top-k.',
    'Replicate shards for read throughput and availability.',
    'Freshness: a small in-memory index for the last few minutes, merged with large immutable segments built in the background.',
    'Ranking: text relevance (BM25) plus recency and engagement; rerank the top few hundred.',
    'Cache popular queries; most traffic is a small set of queries.'
  ],
  topics: ['Inverted index', 'Tokenization', 'Document-sharded index', 'Scatter-gather top-k', 'Real-time + segment indexes', 'BM25 + signals', 'Query cache'],
  brief: {
    ask: 'Build search over billions of posts so a typed query returns the best matches instantly.',
    examples: [
      'A user searches "world cup final tickets" and gets the 20 most relevant recent posts in 150 ms.',
      'A post published 30 seconds ago is already searchable.',
      'Searching the exact phrase "made in Japan" returns posts with those words next to each other.',
      'During a big event, the query "election" is asked 50,000 times a minute and stays fast.'
    ],
    deliver: ['The index structure and how it is built', 'How the index is sharded and queried', 'How new posts become searchable quickly', 'How results are ranked']
  },
  map: {
    subtitle: 'Inverted index shards, scatter-gather queries, real-time plus batch segments',
    nodes: [
      ['user', 'User', 'Search box', 'Client', 'Types queries and reads results.', ['Paginates.']],
      ['gw', 'API gateway', 'Auth + routing', 'Edge', 'Entry point for search.', ['Caches popular queries.']],
      ['broker', 'Query broker', 'Scatter-gather', 'Service', 'Parses the query, fans out to shards, merges top-k.', ['Timeouts per shard.']],
      ['shards', 'Index shards', 'Inverted index', 'Data', 'Term → posting lists for a subset of posts.', ['Replicated.']],
      ['rtindex', 'Real-time index', 'Last minutes', 'Data', 'In-memory index of brand-new posts.', ['Merged into shards.']],
      ['rank', 'Ranker', 'BM25 + signals', 'Service', 'Reranks candidates by relevance, recency, engagement.', ['Top few hundred.']],
      ['posts', 'Post service', 'Source of truth', 'Service', 'Creates posts and hydrates results.', ['Emits new-post events.']],
      ['stream', 'Post stream', 'Kafka', 'Async', 'New posts flow to indexers.', ['Ordered per partition.']],
      ['indexer', 'Indexers', 'Tokenize + build', 'Service', 'Tokenize posts, update real-time index, build segments.', ['Background merges.']]
    ],
    edges: [
      ['user', 'gw', 'query', 'sync', 'Search request.'],
      ['gw', 'broker', 'search', 'sync', 'Parse and plan.'],
      ['broker', 'shards', 'scatter', 'sync', 'Query every shard in parallel.'],
      ['broker', 'rtindex', 'recent', 'sync', 'Include fresh posts.'],
      ['broker', 'rank', 'candidates', 'sync', 'Rerank merged results.'],
      ['rank', 'broker', 'top-k', 'sync', 'Final order.'],
      ['broker', 'posts', 'hydrate', 'sync', 'Fetch post bodies.'],
      ['broker', 'gw', 'results', 'sync', 'Ranked posts.'],
      ['gw', 'user', 'response', 'sync', 'The user sees results.'],
      ['posts', 'stream', 'new post', 'async', 'Publish for indexing.'],
      ['stream', 'indexer', 'consume', 'async', 'Index new posts.'],
      ['indexer', 'rtindex', 'add', 'async', 'Searchable in seconds.'],
      ['indexer', 'shards', 'merge segment', 'async', 'Build immutable segments.']
    ],
    flow: [
      ['Search', 'Fan out to all shards and the real-time index, rerank, hydrate, and return.', 'user>gw, gw>broker, broker>shards, broker>rtindex, broker>rank, rank>broker, broker>posts, broker>gw, gw>user'],
      ['Index a new post', 'New posts stream to indexers, land in the real-time index, and later merge into shards.', 'posts>stream, stream>indexer, indexer>rtindex, indexer>shards']
    ],
    why: [
      'An inverted index makes each query term a lookup, not a scan.',
      'Document sharding lets every shard answer in parallel and spreads load evenly.',
      'A small real-time index gives freshness without rebuilding big segments.',
      'Reranking only the top candidates keeps expensive ranking affordable.'
    ],
    tradeoffs: [
      'Querying every shard costs fan-out; term sharding avoids it but creates hot shards.',
      'Frequent segment merges improve query speed but cost CPU and I/O.',
      'Richer ranking improves results but adds latency.'
    ],
    failures: [
      ['Slow index shard', 'shards', 'broker', 'One slow shard delays every query that waits for it.', 'Per-shard timeouts, hedged requests to replicas, and returning partial results.']
    ]
  }
});

DesignCatalog.add({
  id: 'gopuff', difficulty: 'hard', cat: 'Marketplace',
  title: 'Design Local Delivery (Gopuff)',
  prompt: [
    'Design on-demand local delivery of goods from nearby micro-warehouses: a shopper sees what the nearest store actually has, orders it, and watches a courier bring it in 30 minutes.',
    '',
    'Scale: 500 warehouses, 20k items each, 1M orders per day, and stock changes constantly as orders are picked.'
  ].join('\n'),
  hints: [
    'Live inventory is the hard part, not dispatch: never sell an item that the nearest store does not have.',
    'Map the shopper\'s address to the warehouses that can deliver in time (delivery zones / polygons).',
    'Browse reads cached availability per warehouse; checkout reserves stock with a conditional decrement in the inventory database.',
    'Order state machine: placed → picking → packed → out for delivery → delivered; each step is an event.',
    'Dispatch assigns a nearby courier, tracking courier location in memory (geo index).',
    'Reconcile inventory with physical counts; picked-but-missing items trigger substitutions or refunds.',
    'Peak hours: per-warehouse capacity limits orders so promises stay realistic.'
  ],
  topics: ['Delivery zones', 'Per-warehouse inventory', 'Conditional stock reservation', 'Order state machine', 'Courier dispatch', 'Inventory reconciliation', 'Capacity limits'],
  brief: {
    ask: 'Build 30-minute delivery from nearby warehouses, where shoppers only see what that warehouse really has in stock.',
    examples: [
      'Omar opens the app at home; it picks the warehouse 1.2 miles away and shows 3 bags of his favorite chips left.',
      'He orders 2; the shelf count drops to 1 for the next shopper immediately.',
      'A picker finds one bag damaged; Omar gets a substitution offer and refund within a minute.',
      'He watches the courier\'s dot move on the map until it arrives 24 minutes later.'
    ],
    deliver: ['How a shopper is matched to a warehouse', 'How stock is shown and reserved correctly', 'The order lifecycle and courier dispatch', 'How inventory stays accurate']
  },
  map: {
    subtitle: 'Per-warehouse live inventory, reserved at checkout, then picked and dispatched',
    nodes: [
      ['shopper', 'Shopper app', 'Browse + order', 'Client', 'Browses nearby stock and orders.', ['Live order tracking.']],
      ['gw', 'API gateway', 'Auth + routing', 'Edge', 'Entry point for browse, checkout, tracking.', ['Pushes updates.']],
      ['zones', 'Zone service', 'Address → store', 'Service', 'Finds the warehouse that can deliver in time.', ['Delivery polygons.']],
      ['catalog', 'Catalog', 'Availability', 'Service', 'Shows items and stock for that warehouse.', ['Cached counts.']],
      ['checkout', 'Checkout', 'Reserve + pay', 'Service', 'Reserves stock, charges, creates the order.', ['Idempotent.']],
      ['inv', 'Inventory DB', 'Store × item', 'Data', 'Stock per warehouse and item.', ['Conditional decrement.']],
      ['orders', 'Order service', 'State machine', 'Service', 'Tracks the order through picking and delivery.', ['Emits events.']],
      ['events', 'Order events', 'Kafka', 'Async', 'Every state change.', ['Drives notifications.']],
      ['picker', 'Picker app', 'Warehouse staff', 'Client', 'Picks and packs orders.', ['Reports shortages.']],
      ['dispatch', 'Dispatch', 'Assign courier', 'Service', 'Matches a nearby courier to a packed order.', ['Geo index.']],
      ['courier', 'Courier app', 'Location + tasks', 'Client', 'Streams location and delivers.', ['Every few seconds.']]
    ],
    edges: [
      ['shopper', 'gw', 'HTTPS', 'sync', 'Browse and order.'],
      ['gw', 'zones', 'my address', 'sync', 'Which warehouse serves me?'],
      ['gw', 'catalog', 'browse', 'sync', 'Items in that warehouse.'],
      ['catalog', 'inv', 'stock', 'sync', 'Cached availability.'],
      ['gw', 'checkout', 'place order', 'sync', 'Checkout.'],
      ['checkout', 'inv', 'reserve', 'sync', 'Decrement only if enough stock.'],
      ['checkout', 'orders', 'create', 'sync', 'Start the order.'],
      ['checkout', 'gw', 'confirmed', 'sync', 'Order placed.'],
      ['gw', 'shopper', 'response', 'sync', 'Results and status.'],
      ['orders', 'events', 'state change', 'async', 'Publish status.'],
      ['events', 'picker', 'pick list', 'async', 'Staff start picking.'],
      ['picker', 'orders', 'packed / short', 'sync', 'Report result.'],
      ['events', 'dispatch', 'packed', 'async', 'Ready for a courier.'],
      ['courier', 'dispatch', 'location', 'async', 'Live courier positions.'],
      ['dispatch', 'courier', 'assignment', 'async', 'Pick up this order.'],
      ['events', 'gw', 'status', 'async', 'Tracking updates.']
    ],
    flow: [
      ['Browse nearby stock', 'Map the address to a warehouse and show its available items.', 'shopper>gw, gw>zones, gw>catalog, catalog>inv, gw>shopper'],
      ['Check out', 'Reserve stock with a conditional decrement, create the order, confirm.', 'shopper>gw, gw>checkout, checkout>inv, checkout>orders, checkout>gw, gw>shopper'],
      ['Pick and deliver', 'Staff pick, dispatch assigns a courier, and status flows back to the shopper.', 'orders>events, events>picker, picker>orders, events>dispatch, courier>dispatch, dispatch>courier, events>gw, gw>shopper']
    ],
    why: [
      'Inventory is per warehouse, so each store\'s stock is a small, hot dataset.',
      'Conditional decrements make overselling impossible at checkout.',
      'An event-driven order lifecycle keeps picking, dispatch, and tracking decoupled.',
      'Zones keep promises realistic: only stores that can deliver in time are shown.'
    ],
    tradeoffs: [
      'Cached browse counts can show an item that sells out before checkout.',
      'Reserving at add-to-cart avoids disappointment but locks stock.',
      'Tight delivery zones keep promises but reduce selection.'
    ],
    failures: [
      ['Inventory drift', 'inv', 'checkout picker', 'The database says 3 but the shelf has 0, so orders fail at picking.', 'Frequent cycle counts, shortage reports that correct stock, and automatic substitutions.']
    ]
  }
});

DesignCatalog.add({
  id: 'online-auction', difficulty: 'hard', cat: 'Marketplace',
  title: 'Design an Online Auction',
  prompt: [
    'Design a real-time auction (like eBay live bidding): many bidders compete on an item, the price climbs live in front of thousands of watchers, and the auction closes at a deadline with one clear winner.',
    '',
    'Scale: 1M active auctions, popular items get thousands of bids in the last minute, and every watcher should see the new price within a second.'
  ].join('\n'),
  hints: [
    'One item is both a write hotspot (bids) and a read hotspot (watchers).',
    'Bids for one auction must be serialized: process them through a single owner per auction (partition by auction id) or a conditional update "accept if amount > current".',
    'Every bid gets a sequence number; the current price and leader are derived from the accepted bid log.',
    'Watchers subscribe to the auction channel over WebSocket; the price broadcast can be conflated to the latest.',
    'Closing: a scheduler closes auctions exactly at the deadline; late bids are rejected using the server clock.',
    'Anti-sniping (optional): extend the deadline if a bid arrives in the last seconds.',
    'Payment and notification for the winner happen asynchronously after close.'
  ],
  topics: ['Serialized bids per auction', 'Conditional accept', 'Bid log + sequence', 'Live price broadcast', 'Deadline closing', 'Anti-sniping', 'Winner settlement'],
  brief: {
    ask: 'Build live auctions where people bid against each other in real time and exactly one winner is chosen at the deadline.',
    examples: [
      'A signed jersey is at $410; Ana bids $420 and every watcher sees $420 within a second.',
      'Ana and Ben both bid $450 at the same instant; only one is accepted, the other is told "outbid".',
      'The auction ends at 8:00:00 pm; a bid at 8:00:01 is rejected.',
      'Ana wins; she gets a "You won" message and is charged once.'
    ],
    deliver: ['How concurrent bids are ordered and accepted', 'How the price reaches all watchers', 'How auctions close exactly on time', 'What happens after the auction ends']
  },
  map: {
    subtitle: 'One ordering point per auction, a live price channel, and an exact close',
    nodes: [
      ['bidder', 'Bidder', 'App / web', 'Client', 'Places bids and watches the price.', ['WebSocket for live price.']],
      ['gw', 'API gateway', 'Auth + limits', 'Edge', 'Entry point for bids and watching.', ['Holds live connections.']],
      ['bids', 'Bid service', 'One per auction', 'Service', 'Accepts a bid only if it beats the current price.', ['Single owner per auction.']],
      ['auctions', 'Auction store', 'Price + leader', 'Data', 'Current price, leader, end time per auction.', ['Conditional updates.']],
      ['bidlog', 'Bid log', 'Every bid', 'Data', 'Append-only accepted and rejected bids.', ['Sequence numbers.']],
      ['channel', 'Price channel', 'Pub/sub', 'Async', 'Broadcasts new prices to watchers.', ['Conflated to latest.']],
      ['closer', 'Close scheduler', 'At deadline', 'Async', 'Closes auctions on time and picks the winner.', ['Server clock only.']],
      ['settle', 'Settlement', 'Charge winner', 'Service', 'Charges the winner and notifies everyone.', ['Idempotent.']],
      ['watchers', 'Watchers', 'Thousands', 'Client', 'People following the auction.', ['Read-only.']]
    ],
    edges: [
      ['bidder', 'gw', 'bid', 'sync', 'Bid with an amount.'],
      ['gw', 'bids', 'route', 'sync', 'To the auction\'s owner.'],
      ['bids', 'auctions', 'accept if higher', 'sync', 'Conditional update.'],
      ['bids', 'bidlog', 'append', 'sync', 'Record the bid.'],
      ['bids', 'gw', 'accepted / outbid', 'sync', 'Bid result.'],
      ['gw', 'bidder', 'result', 'sync', 'The bidder sees the outcome.'],
      ['bids', 'channel', 'new price', 'async', 'Broadcast.'],
      ['channel', 'watchers', 'live price', 'async', 'Every watcher updates.'],
      ['channel', 'bidder', 'live price', 'async', 'Bidders too.'],
      ['closer', 'auctions', 'close', 'sync', 'Mark ended and record winner.'],
      ['closer', 'settle', 'winner', 'async', 'Start settlement.'],
      ['settle', 'bidder', 'you won', 'async', 'Notify the winner.']
    ],
    flow: [
      ['Place a bid', 'The auction\'s owner accepts it only if higher, logs it, and replies.', 'bidder>gw, gw>bids, bids>auctions, bids>bidlog, bids>gw, gw>bidder'],
      ['Watch the price', 'Accepted bids are broadcast to every watcher.', 'bids>channel, channel>watchers, channel>bidder'],
      ['Close the auction', 'At the deadline the scheduler closes it and settlement charges the winner.', 'closer>auctions, closer>settle, settle>bidder']
    ],
    why: [
      'A single owner per auction serializes bids without global locks.',
      'Conditional updates make "two winners" impossible.',
      'Conflated broadcasts keep thousands of watchers current cheaply.',
      'Closing on the server clock gives an unambiguous deadline.'
    ],
    tradeoffs: [
      'Single owner per auction caps bid throughput per item.',
      'Anti-sniping extensions are fairer but make end times unpredictable.',
      'Conflation hides intermediate prices from slow watchers.'
    ],
    failures: [
      ['Auction owner crashes near close', 'bids', 'auctions closer', 'Bids in the final seconds are rejected or lost.', 'Fail over to a replica from the bid log, and extend the deadline briefly after recovery.']
    ]
  }
});

DesignCatalog.add({
  id: 'metrics-monitoring', difficulty: 'hard', cat: 'Infrastructure',
  title: 'Design a Metrics Monitoring System',
  prompt: [
    'Design a metrics system (like Datadog or Prometheus at scale): millions of hosts emit numeric measurements every few seconds; engineers graph them and get alerted when something is wrong.',
    '',
    'Scale: 10M hosts × 100 metrics every 10 seconds (about 100M points per second), dashboards over 30 days, alerts within a minute.'
  ].join('\n'),
  hints: [
    'The trap is "one database you insert rows into". The real enemy is cardinality: every unique combination of metric name and tags is a separate time series.',
    'Ingest through agents that batch and compress, into a durable stream (Kafka) that absorbs spikes.',
    'Store in a time-series database: series id → compressed (timestamp, value) blocks; delta and XOR compression shrink data 10×.',
    'Downsample: keep raw 10-second points for days, 1-minute rollups for weeks, 1-hour rollups for months.',
    'An index maps tags to series ids so queries like "cpu where service=api" find the right series.',
    'Alerting evaluates rules on a stream (or frequent queries) and deduplicates notifications.',
    'Guard against cardinality explosions: limit unique tag values per metric and reject or drop high-cardinality tags.'
  ],
  topics: ['Cardinality', 'Agent batching', 'Kafka buffer', 'Time-series compression', 'Downsampling / rollups', 'Tag index', 'Alert evaluation'],
  brief: {
    ask: 'Build the system that collects numbers from millions of servers, graphs them, and alerts people when something breaks.',
    examples: [
      'Every 10 seconds, each server reports cpu, memory, and request latency.',
      'An engineer opens a dashboard "p99 latency for checkout, last 7 days" and it renders in 2 seconds.',
      'Checkout errors jump above 5% for 2 minutes; the on-call engineer is paged within 60 seconds.',
      'Someone accidentally adds user_id as a tag, creating millions of new series; the system rejects it instead of falling over.'
    ],
    deliver: ['The ingestion path for ~100M points/s', 'How points are stored and compressed', 'Downsampling and retention', 'Alerting and cardinality protection']
  },
  map: {
    subtitle: 'Buffer the firehose, compress time series, roll up old data, alert on streams',
    nodes: [
      ['hosts', 'Hosts', 'Agents', 'Client', 'Servers running a metrics agent.', ['Batch + compress.']],
      ['ingest', 'Ingest gateway', 'Validate + limit', 'Edge', 'Accepts batches and enforces cardinality limits.', ['Rejects bad tags.']],
      ['stream', 'Metrics stream', 'Kafka', 'Async', 'Durable buffer for every data point.', ['Partitioned by series.']],
      ['writer', 'TSDB writers', 'Compress blocks', 'Service', 'Group points by series and write compressed blocks.', ['Delta + XOR encoding.']],
      ['tsdb', 'Time-series DB', 'Series → blocks', 'Data', 'Recent raw points and compressed history.', ['Sharded by series.']],
      ['index', 'Tag index', 'Tags → series', 'Data', 'Finds series matching tag filters.', ['Inverted index.']],
      ['rollup', 'Rollup jobs', 'Downsample', 'Async', 'Builds 1-minute and 1-hour aggregates.', ['Old raw data expires.']],
      ['query', 'Query service', 'Dashboards', 'Service', 'Resolves tags, reads blocks, aggregates.', ['Picks raw vs rollups.']],
      ['alerts', 'Alert engine', 'Rules on stream', 'Service', 'Evaluates alert rules continuously.', ['Dedupes pages.']],
      ['eng', 'Engineer', 'Dashboards + pager', 'Client', 'Views graphs and receives alerts.', ['On call.']]
    ],
    edges: [
      ['hosts', 'ingest', 'batches', 'sync', 'Compressed metric batches.'],
      ['ingest', 'stream', 'append', 'async', 'Buffer every point.'],
      ['ingest', 'index', 'new series', 'async', 'Register new tag combos.'],
      ['stream', 'writer', 'consume', 'async', 'Points by series.'],
      ['writer', 'tsdb', 'blocks', 'sync', 'Compressed writes.'],
      ['rollup', 'tsdb', 'downsample', 'async', 'Write aggregates, expire raw.'],
      ['stream', 'alerts', 'evaluate', 'async', 'Rules run on the stream.'],
      ['alerts', 'eng', 'page', 'async', 'Notify on-call.'],
      ['eng', 'query', 'dashboard', 'sync', 'Graph a query.'],
      ['query', 'index', 'which series', 'sync', 'Resolve tag filters.'],
      ['query', 'tsdb', 'read', 'sync', 'Raw or rollup blocks.'],
      ['query', 'eng', 'graph', 'sync', 'The rendered result.']
    ],
    flow: [
      ['Ingest metrics', 'Agents batch points, the gateway checks cardinality, and writers compress them into the TSDB.', 'hosts>ingest, ingest>stream, ingest>index, stream>writer, writer>tsdb'],
      ['Alert on a problem', 'The alert engine evaluates rules on the live stream and pages on-call.', 'stream>alerts, alerts>eng'],
      ['Open a dashboard', 'Resolve tags to series, read raw or rolled-up blocks, and graph them.', 'eng>query, query>index, query>tsdb, query>eng']
    ],
    why: [
      'Kafka absorbs bursts so storage never has to keep up instantly.',
      'Compression per series makes 100M points/s affordable to store.',
      'Rollups make month-long graphs cheap to render.',
      'Cardinality limits protect the system from one bad tag.'
    ],
    tradeoffs: [
      'Downsampling loses detail for old data.',
      'Streaming alerts are fast but complex; query-based alerts are simpler but slower.',
      'Strict cardinality limits protect the system but can drop useful data.'
    ],
    failures: [
      ['Cardinality explosion', 'index', 'ingest writer tsdb', 'One deploy adds a user_id tag, creating millions of series and overwhelming the index.', 'Per-metric series limits at ingest, alerts on new-series rate, and dropping the offending tag.']
    ]
  }
});

DesignCatalog.add({
  id: 'job-scheduler', difficulty: 'hard', cat: 'Infrastructure',
  title: 'Design a Distributed Job Scheduler',
  prompt: [
    'Design a scheduler that runs jobs at specific times or on a recurring schedule ("send this email at 9 am", "run billing every night"), across a fleet of workers.',
    '',
    'Scale: 100M scheduled jobs, 50k jobs due per second at peak, jobs must run close to their due time, and each job should run once even when workers crash.'
  ].join('\n'),
  hints: [
    'Store jobs with their next run time; a cron expression produces the next run after each execution.',
    'Do not scan the whole table every second. Bucket jobs by due minute (time-bucketed partitions) so each tick reads one small bucket.',
    'Dispatcher moves due jobs into a work queue; workers take a lease (lock with expiry) on a job before running it.',
    'If a worker crashes, its lease expires and another worker retries: this is at-least-once, so jobs should be idempotent ("effectively once").',
    'Record each run (start, end, status) for visibility and retries with backoff.',
    'Partition dispatchers by bucket or hash so no single dispatcher is a bottleneck; use leader election per partition.',
    'Late jobs (after downtime) run on recovery or are skipped based on a per-job policy.'
  ],
  topics: ['Next-run time + cron', 'Time-bucketed partitions', 'Leases with expiry', 'At-least-once, effectively-once', 'Run history + retries', 'Partitioned dispatchers', 'Missed-run policy'],
  brief: {
    ask: 'Build the system that runs millions of jobs at the right time, once, even when machines fail.',
    examples: [
      '"Send reminder email to user 42 at 9:00 am" runs at 9:00:01.',
      '"Run nightly billing at 2:00 am" runs every night, even across daylight saving changes.',
      'A worker dies halfway through a job; another worker picks it up 30 seconds later.',
      'At midnight on New Year\'s, 2 million jobs are due at once and all run within a few minutes.'
    ],
    deliver: ['How jobs and schedules are stored', 'How due jobs are found without full scans', 'How a job runs once despite crashes', 'How the scheduler scales and recovers']
  },
  map: {
    subtitle: 'Time buckets, leased execution, and idempotent jobs',
    nodes: [
      ['client', 'Client services', 'Create jobs', 'Client', 'Services that schedule work.', ['Provide idempotency keys.']],
      ['api', 'Scheduler API', 'Create / cancel', 'Service', 'Validates schedules and stores jobs.', ['Computes next run.']],
      ['jobs', 'Job store', 'Jobs + next run', 'Data', 'Job definitions and cron rules.', ['Source of truth.']],
      ['buckets', 'Time buckets', 'Due per minute', 'Data', 'Jobs indexed by the minute they are due.', ['Partitioned.']],
      ['dispatch', 'Dispatchers', 'Per partition', 'Service', 'Each tick, move due jobs to the work queue.', ['Leader per partition.']],
      ['queue', 'Work queue', 'Ready jobs', 'Async', 'Jobs ready to run now.', ['Visibility timeout.']],
      ['workers', 'Workers', 'Run with lease', 'Service', 'Take a lease, run the job, report status.', ['Heartbeat while running.']],
      ['runs', 'Run history', 'Status per run', 'Data', 'Start, end, result, attempts.', ['Retries with backoff.']],
      ['target', 'Job targets', 'Email, billing…', 'Client', 'Systems the jobs act on.', ['Must accept retries.']]
    ],
    edges: [
      ['client', 'api', 'schedule', 'sync', 'Create a one-off or recurring job.'],
      ['api', 'jobs', 'save', 'sync', 'Store the job and rule.'],
      ['api', 'buckets', 'index next run', 'sync', 'Place it in its due bucket.'],
      ['api', 'client', 'job id', 'sync', 'Scheduled.'],
      ['dispatch', 'buckets', 'due now', 'sync', 'Read the current bucket.'],
      ['dispatch', 'queue', 'enqueue', 'async', 'Hand off ready jobs.'],
      ['queue', 'workers', 'lease job', 'async', 'A worker leases a job.'],
      ['workers', 'target', 'execute', 'sync', 'Do the work idempotently.'],
      ['workers', 'runs', 'record', 'sync', 'Save the outcome.'],
      ['workers', 'buckets', 'next run', 'sync', 'Schedule the next occurrence.'],
      ['workers', 'queue', 'retry', 'async', 'Re-enqueue with backoff on failure.']
    ],
    flow: [
      ['Schedule a job', 'Store the job and place its next run in the matching time bucket.', 'client>api, api>jobs, api>buckets, api>client'],
      ['Run a due job', 'A dispatcher moves due jobs to the queue; a worker leases, runs, records, and schedules the next run.', 'dispatch>buckets, dispatch>queue, queue>workers, workers>target, workers>runs, workers>buckets'],
      ['Recover from a crash', 'The lease expires and the job returns to the queue for another worker.', 'workers>queue, queue>workers']
    ],
    why: [
      'Time buckets turn "what is due now?" into reading one small partition.',
      'Leases make crashed work visible again without manual cleanup.',
      'Idempotent jobs make at-least-once execution safe.',
      'Partitioned dispatchers scale horizontally with leader election per partition.'
    ],
    tradeoffs: [
      'Smaller buckets are more precise but mean more partitions to scan.',
      'Short leases recover faster but risk duplicate runs of slow jobs.',
      'Exactly-once needs coordination with the target; idempotency is cheaper.'
    ],
    failures: [
      ['Dispatcher partition down', 'dispatch', 'queue workers', 'Jobs in that partition stop being dispatched and run late.', 'Leader election moves the partition to another dispatcher, which catches up on missed buckets.']
    ]
  }
});

DesignCatalog.add({
  id: 'payment-system', difficulty: 'hard', cat: 'Fintech',
  title: 'Design a Payment System',
  prompt: [
    'Design the system that moves money from a payer to a payee (like Stripe or PayPal checkout): charge a card through an external payment provider, record it, and pay out to the merchant.',
    '',
    'Scale: 10k payments per second at peak, every network call can fail or time out, and the external provider cannot join your database transaction.'
  ].join('\n'),
  hints: [
    'The hard part is correctness across unreliable networks, not throughput.',
    'Every payment request carries an idempotency key; the result is stored with it so retries return the same answer.',
    'Payment state machine: created → authorized → captured → settled (or failed / refunded). Persist each transition before and after calling the provider.',
    'Calls to the provider can time out with an unknown outcome. Never retry blindly; query the provider by your reference id, or wait for its webhook.',
    'Record money movement in a double-entry ledger; balances are derived.',
    'Use a transactional outbox to publish payment events reliably to downstream systems (receipts, payouts).',
    'Reconcile daily against provider settlement files; differences are investigated, not ignored.'
  ],
  topics: ['Idempotency keys', 'Payment state machine', 'Unknown outcomes / timeouts', 'Provider webhooks', 'Double-entry ledger', 'Transactional outbox', 'Reconciliation'],
  brief: {
    ask: 'Build the system that charges a customer and pays a merchant correctly, even when networks fail halfway.',
    examples: [
      'A customer pays $59.99 at checkout; the card is charged once and the shop sees "paid" within 2 seconds.',
      'The checkout page times out and the browser retries; the customer is still charged only once.',
      'The card provider never answers our call; 30 seconds later its webhook says "succeeded" and the order completes.',
      'At the end of the day, our ledger matches the provider\'s settlement report to the cent.'
    ],
    deliver: ['The payment lifecycle and states', 'How retries never double-charge', 'How unknown outcomes from the provider are resolved', 'Ledger, events, and reconciliation']
  },
  map: {
    subtitle: 'Idempotent state machine around an unreliable provider, recorded in a ledger',
    nodes: [
      ['checkout', 'Checkout', 'Merchant site', 'Client', 'Starts a payment with an idempotency key.', ['Retries on timeout.']],
      ['api', 'Payment API', 'POST /payments', 'Edge', 'Authenticates the merchant and validates the request.', ['Idempotency check.']],
      ['payments', 'Payment service', 'State machine', 'Service', 'Drives the payment through its states.', ['Persists every transition.']],
      ['idem', 'Idempotency', 'Key → result', 'Data', 'Returns the original result for repeated keys.', ['Same transaction as state.']],
      ['psp', 'Payment provider', 'Card network', 'Client', 'External processor that charges the card.', ['May time out.']],
      ['hooks', 'Webhook handler', 'Provider events', 'Service', 'Receives the provider\'s final outcome.', ['Verifies signatures.']],
      ['paydb', 'Payment DB', 'Payments + states', 'Data', 'Every payment and its history.', ['Strongly consistent.']],
      ['ledger', 'Ledger', 'Double-entry', 'Data', 'Money movement as balanced entries.', ['Append-only.']],
      ['outbox', 'Outbox', 'Reliable events', 'Async', 'Events written with the state change.', ['Relay to Kafka.']],
      ['recon', 'Reconciliation', 'Daily vs provider', 'Async', 'Compares the ledger with provider reports.', ['Flags mismatches.']]
    ],
    edges: [
      ['checkout', 'api', 'pay', 'sync', 'Amount + idempotency key.'],
      ['api', 'payments', 'create', 'sync', 'Start the payment.'],
      ['payments', 'idem', 'seen key?', 'sync', 'Return the stored result for repeats.'],
      ['payments', 'paydb', 'created', 'sync', 'Persist before calling out.'],
      ['payments', 'psp', 'authorize', 'sync', 'Charge with our reference id.'],
      ['psp', 'payments', 'result / timeout', 'sync', 'Success, decline, or unknown.'],
      ['psp', 'hooks', 'webhook', 'async', 'Final outcome later.'],
      ['hooks', 'payments', 'final state', 'sync', 'Resolve unknown outcomes.'],
      ['payments', 'ledger', 'post entries', 'sync', 'Record money movement.'],
      ['payments', 'outbox', 'event', 'async', 'Same transaction as the state change.'],
      ['payments', 'api', 'status', 'sync', 'Payment result.'],
      ['api', 'checkout', 'paid / failed', 'sync', 'The merchant sees the result.'],
      ['recon', 'ledger', 'compare', 'async', 'Against provider settlement files.']
    ],
    flow: [
      ['Charge a card', 'Check the key, persist, call the provider, post to the ledger, and answer.', 'checkout>api, api>payments, payments>idem, payments>paydb, payments>psp, psp>payments, payments>ledger, payments>outbox, payments>api, api>checkout'],
      ['Resolve a timeout', 'The provider\'s webhook tells us the real outcome.', 'psp>hooks, hooks>payments, payments>ledger'],
      ['Reconcile', 'Daily comparison of the ledger with provider reports.', 'recon>ledger']
    ],
    why: [
      'Idempotency keys turn retries into the same result instead of a second charge.',
      'Persisting state before and after each external call makes every crash recoverable.',
      'Webhooks and status queries resolve "we don\'t know" outcomes safely.',
      'Double-entry and reconciliation catch whatever the protocol misses.'
    ],
    tradeoffs: [
      'Synchronous capture is simpler for merchants; async capture survives provider slowness better.',
      'Multiple providers improve availability but complicate reconciliation.',
      'Strict consistency limits throughput; shard by merchant to scale.'
    ],
    failures: [
      ['Provider timeout', 'psp', 'payments hooks', 'The charge may or may not have happened; retrying blindly risks a double charge.', 'Mark "pending", query the provider by reference id, and wait for the webhook before deciding.']
    ]
  }
});

DesignCatalog.add({
  id: 'web-crawler', difficulty: 'hard', cat: 'Search',
  title: 'Design a Web Crawler',
  prompt: [
    'Design a crawler that starts from seed URLs, fetches pages, extracts links, and keeps going, billions of pages deep, to feed a search index.',
    '',
    'Scale: 5B pages per month (about 2k pages per second), the same URLs and near-identical pages appear constantly, and websites must not be overloaded.'
  ].join('\n'),
  hints: [
    'Dedup and politeness, not raw fetch throughput, are what break a naive queue.',
    'URL frontier: a prioritized queue of URLs to fetch, organized as per-host queues so each host is crawled at a polite rate.',
    'Respect robots.txt and crawl-delay; cache robots rules per host.',
    'URL dedup: normalize URLs, then check a seen-set (Bloom filter or key-value store) before adding to the frontier.',
    'Content dedup: hash page content (and SimHash for near-duplicates) to avoid storing the same page twice.',
    'Fetchers are stateless and distributed; DNS resolution is cached because it is a hidden bottleneck.',
    'Recrawl based on how often a page changes; prioritize important pages.'
  ],
  topics: ['URL frontier', 'Per-host politeness', 'robots.txt', 'URL normalization + Bloom filter', 'Content dedup (SimHash)', 'DNS caching', 'Recrawl priority'],
  brief: {
    ask: 'Build the crawler that downloads billions of web pages to feed a search engine, without hammering any one website.',
    examples: [
      'Starting from 1,000 seed sites, the crawler discovers and fetches 2,000 pages per second.',
      'It never sends more than 1 request per second to a small blog, even if it found 10,000 links to it.',
      'The same article reachable through 5 different URLs is stored once.',
      'A site\'s robots.txt says "Disallow: /private"; those pages are never fetched.'
    ],
    deliver: ['The URL frontier and prioritization', 'How politeness and robots.txt are enforced', 'How duplicate URLs and pages are avoided', 'How fetching scales']
  },
  map: {
    subtitle: 'A polite per-host frontier, distributed fetchers, and two layers of dedup',
    nodes: [
      ['seeds', 'Seed URLs', 'Start points', 'Client', 'The initial list of sites.', ['Plus discovered links.']],
      ['frontier', 'URL frontier', 'Per-host queues', 'Async', 'Prioritized URLs waiting to be fetched.', ['One queue per host.']],
      ['polite', 'Politeness', 'Rate per host', 'Service', 'Releases URLs at each host\'s allowed rate.', ['robots.txt rules.']],
      ['fetch', 'Fetchers', 'HTTP + DNS cache', 'Service', 'Download pages.', ['Stateless, distributed.']],
      ['web', 'Websites', 'The internet', 'Client', 'Pages being crawled.', ['Vary in speed and rules.']],
      ['parse', 'Parser', 'Extract links', 'Service', 'Extracts text and outgoing links.', ['Normalizes URLs.']],
      ['seen', 'URL seen-set', 'Bloom filter', 'Data', 'Skips URLs already queued or fetched.', ['Compact.']],
      ['content', 'Content dedup', 'Hash / SimHash', 'Data', 'Skips duplicate and near-duplicate pages.', ['Per page fingerprint.']],
      ['pages', 'Page store', 'Raw HTML', 'Data', 'Fetched pages for the indexer.', ['Object storage.']]
    ],
    edges: [
      ['seeds', 'frontier', 'enqueue', 'async', 'Start with seeds.'],
      ['frontier', 'polite', 'next per host', 'async', 'Pick hosts that are due.'],
      ['polite', 'fetch', 'URL', 'async', 'Within the host\'s rate.'],
      ['fetch', 'web', 'GET', 'sync', 'Download the page.'],
      ['web', 'fetch', 'HTML', 'sync', 'Page content.'],
      ['fetch', 'content', 'seen this page?', 'sync', 'Fingerprint check.'],
      ['fetch', 'pages', 'store', 'sync', 'Save new content.'],
      ['fetch', 'parse', 'page', 'async', 'Extract links.'],
      ['parse', 'seen', 'new URL?', 'sync', 'Skip known URLs.'],
      ['parse', 'frontier', 'new links', 'async', 'Queue discovered URLs.']
    ],
    flow: [
      ['Fetch a page', 'The politeness layer releases a URL, a fetcher downloads it, dedups content, and stores it.', 'frontier>polite, polite>fetch, fetch>web, web>fetch, fetch>content, fetch>pages'],
      ['Discover links', 'The parser extracts links, drops known URLs, and queues new ones.', 'fetch>parse, parse>seen, parse>frontier'],
      ['Start a crawl', 'Seed URLs enter the frontier.', 'seeds>frontier']
    ],
    why: [
      'Per-host queues make politeness a property of the data structure.',
      'A Bloom filter checks billions of URLs in a few gigabytes of memory.',
      'Content fingerprints stop the same page being stored many times.',
      'Stateless fetchers scale linearly.'
    ],
    tradeoffs: [
      'Bloom filters occasionally skip a URL that was never seen.',
      'Strict politeness slows crawling of large sites.',
      'Frequent recrawls keep freshness but waste fetches on unchanged pages.'
    ],
    failures: [
      ['Spider trap', 'web', 'frontier parse', 'A site generates infinite URLs (calendars, session ids) and fills the frontier.', 'Limit depth and URLs per host, normalize away session parameters, and detect repeating patterns.']
    ]
  }
});
