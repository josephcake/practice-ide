/* Researched architecture maps, part 2 */

Object.assign(DESIGN_MAPS, {
  dropbox: {
    subtitle: 'Files become content-addressed blocks; a metadata journal is the truth; clients long-poll for changes',
    basedOn: 'Dropbox (Magic Pocket block store, Edgestore metadata, Nucleus sync engine)',
    sources: [
      ['Dropbox: Magic Pocket', 'https://dropbox.tech/infrastructure/inside-the-magic-pocket'],
      ['Dropbox: rewriting the sync engine', 'https://dropbox.tech/infrastructure/rewriting-the-heart-of-our-sync-engine'],
      ['Dropbox: Edgestore', 'https://dropbox.tech/infrastructure/reintroducing-edgestore'],
      ['System Design School: Dropbox', 'https://systemdesignschool.io/problems/dropbox/solution']
    ],
    nodes: [
      ['client', 'Desktop client', 'Watch + chunk', 'Client', 'Watches the folder, splits files into 4 MB blocks, hashes each one.', ['Only changed blocks are uploaded.']],
      ['other', 'Other device', 'Long-poll', 'Client', 'Another of the user\'s devices waiting for changes.', []],
      ['lb', 'Load balancer', 'API + block', 'Edge', 'Spreads metadata and block traffic.', []],
      ['meta', 'Metadata service', 'Commit + list', 'Service', 'Asks which blocks are missing, then commits the file as a list of block hashes.', ['Detects conflicts at commit.']],
      ['blocksvc', 'Block service', 'Put / get', 'Service', 'Stores and serves blocks by hash.', ['Same hash = stored once.']],
      ['blocks', 'Block store', 'Magic Pocket', 'Data', 'Immutable blocks keyed by SHA-256, erasure-coded across zones.', ['Exabytes, cheap and durable.']],
      ['journal', 'Metadata DB', 'Edgestore journal', 'Data', 'Per-namespace journal of file versions, each a list of block hashes.', ['The source of truth.']],
      ['notify', 'Change notifier', 'Long-poll', 'Service', 'Holds open connections and wakes devices when their namespace changes.', ['Carries no file data.']],
      ['share', 'Sharing', 'Namespaces + ACL', 'Service', 'Shared folders are separate namespaces mounted into each member\'s tree.', []]
    ],
    edges: [
      ['client', 'lb', 'HTTPS', 'sync', 'All calls.'],
      ['lb', 'meta', 'which blocks?', 'sync', 'Send the hash list.'],
      ['meta', 'journal', 'known hashes', 'sync', 'Dedup check.'],
      ['meta', 'lb', 'need these', 'sync', 'Missing hashes.'],
      ['lb', 'blocksvc', 'upload blocks', 'sync', 'Only the missing ones.'],
      ['blocksvc', 'blocks', 'put by hash', 'sync', 'Immutable.'],
      ['lb', 'meta', 'commit', 'sync', 'Second call.'],
      ['meta', 'journal', 'append version', 'sync', 'New file version.'],
      ['meta', 'share', 'ACL', 'sync', 'Who may write.'],
      ['meta', 'notify', 'namespace changed', 'async', 'Wake devices.'],
      ['lb', 'client', 'committed', 'sync', 'Done.'],
      ['notify', 'other', 'changed', 'async', 'Wake-up.'],
      ['other', 'lb', 'list since cursor', 'sync', 'What changed?'],
      ['lb', 'meta', 'delta', 'sync', 'Journal read.'],
      ['meta', 'journal', 'entries', 'sync', 'Since cursor.'],
      ['lb', 'blocksvc', 'get missing', 'sync', 'Download.'],
      ['blocksvc', 'blocks', 'get by hash', 'sync', 'Read.'],
      ['lb', 'other', 'blocks + metadata', 'sync', 'Reassemble locally.']
    ],
    flow: [
      ['Save a file', 'Send hashes, upload only missing blocks, then commit the new version.', 'client>lb, lb>meta, meta>journal, meta>lb, lb>blocksvc, blocksvc>blocks, meta>share, meta>notify, lb>client', 'write'],
      ['Sync another device', 'The long-poll wakes; the device fetches the delta and missing blocks.', 'notify>other, other>lb, lb>meta, meta>journal, lb>blocksvc, blocksvc>blocks, lb>other', 'read']
    ],
    why: [
      'Content-addressed blocks deduplicate across versions and users and make uploads resumable.',
      'Separating blocks from metadata lets each scale on its own; metadata is small and transactional.',
      'Committing in two steps (missing blocks, then commit) means a version only appears once all its blocks exist.',
      'Long-poll notification carries no data, so it scales to many idle devices.'
    ],
    tradeoffs: [
      'Fixed-size blocks are simple but an insert near the start shifts every block; content-defined chunking avoids that.',
      'Cross-user dedup saves storage but can leak whether a file exists.',
      'Conflicts produce "conflicted copy" files instead of merging content.'
    ],
    failures: [
      ['Metadata DB overloaded', 'journal', 'meta notify other', 'Uploads finish but commits stall; other devices see nothing.', 'Shard by namespace, rate-limit sync storms, keep commits small.']
    ]
  },

  'google-docs': {
    subtitle: 'One session owner per document orders every edit, persists it, then broadcasts',
    basedOn: 'Google Docs (operational transformation, Jupiter protocol), Figma multiplayer',
    sources: [
      ['Google Drive blog: what\'s different about the new Docs', 'https://drive.googleblog.com/2010/09/whats-different-about-new-google-docs.html'],
      ['Figma: how multiplayer works', 'https://www.figma.com/blog/how-figmas-multiplayer-technology-works/'],
      ['System Design School: Google Docs', 'https://systemdesignschool.io/problems/google-docs/solution']
    ],
    nodes: [
      ['editor', 'Editor', 'Local first', 'Client', 'Applies edits instantly and sends them with the version they were based on.', ['Keeps unacknowledged ops locally.']],
      ['gw', 'Socket gateway', 'Connection fleet', 'Gateway', 'Holds sockets and routes each document to its owner.', []],
      ['router', 'Doc router', 'Hash + lease', 'Service', 'Consistent hashing with a lease so exactly one session server owns a document.', []],
      ['session', 'Session server', 'OT, one per doc', 'Service', 'Transforms each op against concurrent ones, assigns the next version, persists, then broadcasts.', ['Single writer per document.']],
      ['oplog', 'Op log', 'Append per doc', 'Data', 'Every operation in order with its version.', ['Persist before ack.']],
      ['snaps', 'Snapshot store', 'Every N ops', 'Data', 'Periodic full copies so loading never replays the whole history.', []],
      ['presence', 'Presence', 'In memory', 'Data', 'Cursors and selections. Ephemeral, never persisted.', []],
      ['docs', 'Docs API', 'Open + list', 'Service', 'Loads a document: latest snapshot plus ops since.', []],
      ['acl', 'Sharing / ACL', 'Who can edit', 'Data', 'Permissions checked on connect.', []],
      ['history', 'Version history', 'Compaction', 'Async', 'Compacts old ops into snapshots and named versions.', []]
    ],
    edges: [
      ['editor', 'docs', 'open', 'sync', 'Load the document.'],
      ['docs', 'acl', 'can view?', 'sync', 'Permission check.'],
      ['docs', 'snaps', 'latest snapshot', 'sync', 'Base copy.'],
      ['docs', 'oplog', 'ops since', 'sync', 'Catch up.'],
      ['docs', 'editor', 'doc + version', 'sync', 'Ready to edit.'],
      ['editor', 'gw', 'op @ version', 'sync', 'Over the socket.'],
      ['gw', 'router', 'owner?', 'sync', 'Find the session.'],
      ['router', 'session', 'route', 'sync', 'To the owner.'],
      ['session', 'oplog', 'append', 'sync', 'Durable first.'],
      ['session', 'gw', 'ack + broadcast', 'async', 'To all editors.'],
      ['gw', 'editor', 'remote ops', 'async', 'Applied live.'],
      ['session', 'presence', 'cursors', 'async', 'Ephemeral.'],
      ['history', 'oplog', 'read old ops', 'async', 'Compact.'],
      ['history', 'snaps', 'write snapshot', 'async', 'Faster loads.']
    ],
    flow: [
      ['Open a document', 'Check access, load the latest snapshot and the ops after it.', 'editor>docs, docs>acl, docs>snaps, docs>oplog, docs>editor', 'read'],
      ['Type a character', 'The owner transforms, versions, and persists the op, then broadcasts it.', 'editor>gw, gw>router, router>session, session>oplog, session>gw, gw>editor', 'write'],
      ['Compact history', 'Old ops are folded into snapshots.', 'history>oplog, history>snaps', 'background']
    ],
    why: [
      'One owner per document gives a single total order of edits, which is what makes OT tractable.',
      'Persisting before acknowledging means an acknowledged keystroke survives a crash.',
      'Snapshots bound load time; presence stays in memory because it is worthless a second later.',
      'Leases plus consistent hashing move ownership cleanly when a server dies.'
    ],
    tradeoffs: [
      'A single owner is simple but caps edits per document; very large documents need sharding by section.',
      'CRDTs remove the central server but carry more metadata and harder intent preservation.',
      'Offline editing for long periods makes transformation and conflict resolution expensive.'
    ],
    failures: [
      ['Session server dies', 'session', 'gw editor', 'Edits to its documents pause.', 'The lease expires, another server takes over and replays the op log; clients resend unacked ops.']
    ]
  },

  ticketmaster: {
    subtitle: 'A waiting room meters the crowd; seats are held with a compare-and-set and a TTL',
    basedOn: 'Ticketmaster (Verified Fan, Smart Queue), Queue-it virtual waiting room',
    sources: [
      ['Ticketmaster: Taylor Swift Eras Tour statement', 'https://business.ticketmaster.com/press-release/taylor-swift-the-eras-tour-onsale-explained/'],
      ['Queue-it: how a virtual waiting room works', 'https://queue-it.com/blog/virtual-waiting-room/'],
      ['System Design School: Ticketmaster', 'https://systemdesignschool.io/problems/ticketmaster/solution']
    ],
    nodes: [
      ['fan', 'Fan', 'Browser / app', 'Client', 'Waits in line, picks seats, pays.', []],
      ['cdn', 'CDN', 'Event pages', 'Edge', 'Serves event pages and the waiting-room page.', ['Absorbs refresh storms.']],
      ['room', 'Waiting room', 'Token + admit rate', 'Edge', 'Puts everyone in line and admits at a rate the booking system can handle.', ['Signed admission token.', 'Bot checks here.']],
      ['booking', 'Booking API', 'Requires token', 'Service', 'Shows the seat map and places holds. Rejects requests without a token.', []],
      ['avail', 'Stock cache', 'Seat map, seconds', 'Data', 'Approximate seat map for display.', ['Never decides who gets a seat.']],
      ['seats', 'Seat DB', 'CAS + hold TTL', 'Data', 'Seat status: available → held (with expiry) → sold, changed only by compare-and-set.', ['The only source of truth.']],
      ['pay', 'Payment', 'Idempotent charge', 'Service', 'Charges the card with an idempotency key.', []],
      ['orders', 'Order DB', 'Tickets', 'Data', 'Confirmed orders and tickets.', []],
      ['sweeper', 'Hold sweeper', 'Release expired', 'Async', 'Returns expired holds to available.', []]
    ],
    edges: [
      ['fan', 'cdn', 'event page', 'sync', 'Static.'],
      ['cdn', 'fan', 'page', 'sync', 'From the edge.'],
      ['fan', 'room', 'join line', 'sync', 'On-sale starts.'],
      ['room', 'fan', 'position / token', 'sync', 'Admitted in turn.'],
      ['fan', 'booking', 'seat map + token', 'sync', 'Admitted users only.'],
      ['booking', 'avail', 'seat map', 'sync', 'Display.'],
      ['avail', 'booking', 'seats', 'sync', 'Approximate.'],
      ['booking', 'seats', 'CAS hold', 'sync', 'available → held.'],
      ['seats', 'avail', 'status change', 'async', 'Refresh display.'],
      ['booking', 'pay', 'charge', 'sync', 'Within the hold.'],
      ['booking', 'seats', 'held → sold', 'sync', 'Guarded.'],
      ['booking', 'orders', 'order', 'sync', 'Tickets issued.'],
      ['booking', 'fan', 'result', 'sync', 'Held / confirmed.'],
      ['sweeper', 'seats', 'expired holds', 'async', 'Back to available.']
    ],
    flow: [
      ['Join the on-sale', 'Fans queue in the waiting room and are admitted at a safe rate.', 'fan>cdn, cdn>fan, fan>room, room>fan', 'read'],
      ['Pick seats', 'See the cached seat map, then hold seats with a compare-and-set.', 'fan>booking, booking>avail, avail>booking, booking>seats, seats>avail, booking>fan', 'write'],
      ['Pay', 'Charge idempotently, mark seats sold, issue the order.', 'fan>booking, booking>pay, booking>seats, booking>orders, booking>fan', 'write'],
      ['Release abandoned seats', 'Expired holds go back on sale.', 'sweeper>seats', 'background']
    ],
    why: [
      'A waiting room turns millions of simultaneous requests into a steady stream the booking system can handle.',
      'Compare-and-set on the seat row guarantees one seat goes to exactly one fan.',
      'Holds with a TTL give the buyer time to pay without locking the seat forever.',
      'The cached seat map is only for display, so it can be a few seconds stale without overselling.'
    ],
    tradeoffs: [
      'A lower admission rate protects the system but lengthens the line.',
      'Short holds free seats faster but rush buyers; long holds lock inventory.',
      'Display staleness means fans sometimes click a seat that was just taken.'
    ],
    failures: [
      ['Bots flood the on-sale', 'room', 'booking seats', 'Bots grab seats and real fans are blocked.', 'Verified-fan pre-registration, bot checks in the waiting room, per-account limits.']
    ]
  },

  'live-comments': {
    subtitle: 'Accept everything, show a sample: per-stream channels, a rate-capped sampler, and a relay tree',
    basedOn: 'Facebook Live comments, Twitch chat, LinkedIn live',
    sources: [
      ['Meta: scaling Facebook Live', 'https://engineering.fb.com/2015/12/03/ios/under-the-hood-broadcasting-live-video-to-millions/'],
      ['Twitch: chat architecture', 'https://blog.twitch.tv/en/2015/12/18/twitch-engineering-an-introduction-and-overview-a23917b71a25/'],
      ['System Design School: Live comments', 'https://systemdesignschool.io/problems/live-comments/solution']
    ],
    nodes: [
      ['viewer', 'Viewer', 'Watching + typing', 'Client', 'Sends comments and sees a live stream of them.', []],
      ['ingest', 'Comment ingest', 'Rate limit + filter', 'Gateway', 'Throttles per user and drops spam and abuse.', []],
      ['store', 'Comment store', 'Short retention', 'Data', 'Append-only log of every comment for replay and moderation.', []],
      ['channel', 'Stream channel', 'Pub/sub per video', 'Async', 'One channel per live broadcast.', []],
      ['sampler', 'Sampler', '~10 per second', 'Service', 'Picks the most relevant comments per time window so viewers can read them.', ['Friends and replies first.']],
      ['relay', 'Relay tree', 'Fan-out tiers', 'Service', 'Repeats the sampled stream down to many gateway servers.', ['Avoids one hot channel.']],
      ['gw', 'Gateway fleet', '~100K sockets each', 'Gateway', 'Holds viewer connections and pushes comments.', []],
      ['mod', 'Moderation', 'Remove + ban', 'Async', 'Takes down comments and bans users.', []]
    ],
    edges: [
      ['viewer', 'ingest', 'comment', 'sync', 'Post.'],
      ['ingest', 'store', 'append', 'sync', 'Durable.'],
      ['ingest', 'channel', 'publish', 'async', 'To this stream.'],
      ['ingest', 'viewer', 'accepted', 'sync', 'Shown to the author immediately.'],
      ['channel', 'sampler', 'all comments', 'async', 'Full firehose.'],
      ['sampler', 'relay', 'sampled', 'async', 'Readable rate.'],
      ['relay', 'gw', 'fan-out', 'async', 'Tree of repeaters.'],
      ['gw', 'viewer', 'push', 'async', 'Over WebSocket.'],
      ['viewer', 'gw', 'subscribe', 'sync', 'Join the stream.'],
      ['mod', 'store', 'remove', 'async', 'Takedown.'],
      ['mod', 'channel', 'retract', 'async', 'Tell viewers.']
    ],
    flow: [
      ['Post a comment', 'Filter, store, publish; the author sees it immediately.', 'viewer>ingest, ingest>store, ingest>channel, ingest>viewer', 'write'],
      ['Watch the comments', 'Subscribe; a sampled stream is relayed down to your gateway.', 'viewer>gw, channel>sampler, sampler>relay, relay>gw, gw>viewer', 'read'],
      ['Moderate', 'Remove a comment and retract it from viewers.', 'mod>store, mod>channel', 'background']
    ],
    why: [
      'No human can read 50,000 comments per second, so a sampler shows a readable slice.',
      'One channel per broadcast keeps a huge stream from affecting small ones.',
      'A relay tree spreads one hot stream to hundreds of gateways without a single overloaded node.',
      'Showing your own comment instantly makes the experience feel live even when it is not sampled for others.'
    ],
    tradeoffs: [
      'Sampling means most comments are never seen by most viewers.',
      'Ordering is approximate across gateways.',
      'Short retention keeps storage cheap but limits replay.'
    ],
    failures: [
      ['Celebrity stream spikes', 'channel', 'sampler relay gw', 'One broadcast floods its channel.', 'Sample harder, add relay tiers, shed comment ingestion per user.']
    ]
  },

  'news-aggregator': {
    layers: ['Client', 'Edge', 'Gateway', 'Async', 'Service', 'Data', 'Obs'],
    subtitle: 'Polite crawling, near-duplicate fingerprinting, story clustering, and per-section ranked feeds',
    basedOn: 'Google News story clustering, Techmeme, Feedly',
    sources: [
      ['Google News personalization paper', 'https://research.google/pubs/google-news-personalization-scalable-online-collaborative-filtering/'],
      ['Detecting near-duplicates for web crawling', 'https://research.google/pubs/detecting-near-duplicates-for-web-crawling/'],
      ['System Design School: News aggregator', 'https://systemdesignschool.io/problems/news-aggregator/solution']
    ],
    nodes: [
      ['reader', 'Reader', 'Sections', 'Client', 'Reads ranked stories by section.', []],
      ['cdn', 'CDN', 'Feed pages', 'Edge', 'Caches section feeds for a minute.', []],
      ['frontier', 'Source frontier', 'Feeds + sites', 'Async', 'Which sources to fetch next, by priority and politeness.', []],
      ['fetch', 'Fetchers', 'Conditional GET', 'Service', 'Fetch RSS and pages politely using ETags.', []],
      ['parse', 'Parser', 'Clean article', 'Service', 'Extracts title, body, time, and source.', []],
      ['articles', 'Article store', 'Raw + clean', 'Data', 'Every article.', []],
      ['finger', 'Fingerprinter', 'SimHash', 'Service', 'Near-duplicate signature for each article.', []],
      ['lsh', 'Similarity index', 'LSH buckets', 'Data', 'Finds candidate matches in constant time.', []],
      ['cluster', 'Story clusterer', 'Incremental', 'Service', 'Joins the article to an existing story or starts a new one.', []],
      ['stories', 'Story store', 'Clusters', 'Data', 'Stories with their articles and a lead article.', []],
      ['rank', 'Ranker', 'Fresh + coverage', 'Async', 'Scores stories by freshness, source diversity, and velocity.', []],
      ['feeds', 'Feed cache', 'Per section', 'Data', 'Precomputed ranked lists per section and region.', []],
      ['api', 'Feed API', 'Read', 'Service', 'Serves feeds from the cache.', []]
    ],
    edges: [
      ['frontier', 'fetch', 'next source', 'async', 'Politeness respected.'],
      ['fetch', 'parse', 'HTML / RSS', 'async', 'Only if changed.'],
      ['parse', 'articles', 'store', 'async', 'Clean article.'],
      ['parse', 'finger', 'fingerprint', 'async', 'SimHash.'],
      ['finger', 'lsh', 'candidates', 'sync', 'Similar articles.'],
      ['finger', 'cluster', 'assign', 'async', 'Join or create.'],
      ['cluster', 'stories', 'update story', 'async', 'Grow the cluster.'],
      ['stories', 'rank', 'changed stories', 'async', 'Re-score.'],
      ['rank', 'feeds', 'ranked lists', 'async', 'Per section.'],
      ['reader', 'cdn', 'section', 'sync', 'Read.'],
      ['cdn', 'api', 'miss', 'sync', 'Once a minute.'],
      ['api', 'feeds', 'read', 'sync', 'Precomputed.'],
      ['api', 'cdn', 'feed', 'sync', 'Cached.'],
      ['cdn', 'reader', 'stories', 'sync', 'Fast.']
    ],
    flow: [
      ['Ingest an article', 'Fetch politely, parse, store, fingerprint, and cluster into a story.', 'frontier>fetch, fetch>parse, parse>articles, parse>finger, finger>lsh, finger>cluster, cluster>stories', 'write'],
      ['Rank stories', 'Changed stories are re-scored and section feeds rebuilt.', 'stories>rank, rank>feeds', 'background'],
      ['Read a section', 'From the CDN, or the precomputed feed cache.', 'reader>cdn, cdn>api, api>feeds, api>cdn, cdn>reader', 'read']
    ],
    why: [
      'Many outlets publish the same story; fingerprints and LSH group them without comparing every pair.',
      'Conditional GETs and per-host politeness keep crawling cheap and welcome.',
      'Precomputed feeds per section make reading a cache lookup.',
      'Ranking by coverage across independent sources surfaces important stories, not just loud ones.'
    ],
    tradeoffs: [
      'Aggressive clustering merges different stories; loose clustering shows duplicates.',
      'Shorter crawl intervals mean fresher news but heavier load on publishers.',
      'Personalized feeds cannot be shared through the CDN.'
    ],
    failures: [
      ['Clusterer falls behind', 'cluster', 'stories rank feeds', 'Breaking news appears late or as duplicates.', 'Partition by time and topic, skip deep matching under load.']
    ]
  },

  'post-search': {
    subtitle: 'Document-partitioned inverted index, near-real-time segments, scatter-gather queries',
    basedOn: 'Twitter Earlybird, Facebook Unicorn',
    sources: [
      ['Earlybird: real-time search at Twitter', 'https://notes.stephenholiday.com/Earlybird.pdf'],
      ['Facebook: Unicorn', 'https://research.facebook.com/publications/unicorn-a-system-for-searching-the-social-graph/'],
      ['System Design School: Post search', 'https://systemdesignschool.io/problems/post-search/solution']
    ],
    nodes: [
      ['user', 'User', 'Search box', 'Client', 'Searches posts by keyword.', []],
      ['api', 'Search API', 'Parse query', 'Gateway', 'Parses terms and filters.', []],
      ['qcache', 'Query cache', 'Hot queries', 'Data', 'Results of popular queries for a few seconds.', []],
      ['coord', 'Query fan-out', 'Scatter-gather', 'Service', 'Sends the query to every shard and merges the top results.', ['Partial results on timeout.']],
      ['shards', 'Index shards', 'By document', 'Data', 'Inverted index; newest posts in an in-memory segment, older ones in immutable segments.', ['Background merges.']],
      ['posts', 'Posts DB', 'Source of truth', 'Data', 'Full post content for hydration.', []],
      ['writer', 'Post service', 'Create', 'Service', 'Stores new posts.', []],
      ['stream', 'Index stream', 'Kafka', 'Async', 'New and edited posts in order.', []],
      ['indexer', 'Indexer', 'Tokenize', 'Async', 'Tokenizes and adds posts to the in-memory segment.', ['Searchable in seconds.']]
    ],
    edges: [
      ['user', 'api', 'query', 'sync', 'Search.'],
      ['api', 'qcache', 'hot?', 'sync', 'Cache first.'],
      ['qcache', 'api', 'hit', 'sync', 'Popular queries.'],
      ['api', 'coord', 'miss', 'sync', 'Run it.'],
      ['coord', 'shards', 'scatter', 'sync', 'Every shard in parallel.'],
      ['shards', 'coord', 'top-K ids', 'sync', 'Gather.'],
      ['coord', 'posts', 'hydrate', 'sync', 'Fetch content.'],
      ['coord', 'api', 'results', 'sync', 'Merged.'],
      ['api', 'user', 'results', 'sync', 'Shown.'],
      ['user', 'writer', 'new post', 'sync', 'Create.'],
      ['writer', 'posts', 'store', 'sync', 'Durable.'],
      ['writer', 'stream', 'publish', 'async', 'Index event.'],
      ['stream', 'indexer', 'consume', 'async', 'In order.'],
      ['indexer', 'shards', 'add to segment', 'async', 'Near real time.']
    ],
    flow: [
      ['Search posts', 'Hot queries from cache; others scatter to every shard and merge.', 'user>api, api>qcache, api>coord, coord>shards, shards>coord, coord>posts, coord>api, api>user', 'read'],
      ['Publish a post', 'Store the post, then stream it into the index.', 'user>writer, writer>posts, writer>stream, stream>indexer, indexer>shards', 'write']
    ],
    why: [
      'Partitioning by document keeps writes to one shard and makes every query a parallel scatter.',
      'An in-memory segment makes new posts searchable within seconds.',
      'Immutable older segments are fast to read and simple to cache; merges keep their count low.',
      'A short query cache absorbs trending searches.'
    ],
    tradeoffs: [
      'Scatter-gather touches every shard, so tail latency grows with shard count.',
      'Term partitioning would hit fewer shards but makes writes and hot terms painful.',
      'Partial results on timeout keep latency low at the cost of completeness.'
    ],
    failures: [
      ['Slow shard', 'shards', 'coord', 'Every query waits for the slowest shard.', 'Replicas with hedged requests; return partial results after a deadline.']
    ]
  },

  gopuff: {
    subtitle: 'Inventory lives in each dark store; checkout reserves stock atomically; couriers are matched by location',
    basedOn: 'Gopuff, Instacart, DoorDash dispatch',
    sources: [
      ['DoorDash: dispatch optimization', 'https://careersatdoordash.com/blog/next-generation-optimization-for-dasher-dispatch-at-doordash/'],
      ['Instacart: real-time availability', 'https://tech.instacart.com/predicting-real-time-availability-of-200-million-grocery-items-in-us-canada-stores-61f43a16eafe'],
      ['System Design School: Local delivery', 'https://systemdesignschool.io/problems/local-delivery/solution']
    ],
    nodes: [
      ['customer', 'Customer app', 'Browse + order', 'Client', 'Sees what is in stock nearby and orders.', []],
      ['courier', 'Courier app', 'Location + accept', 'Client', 'Reports location and accepts deliveries.', []],
      ['gw', 'API gateway', 'Route', 'Gateway', 'Entry point.', []],
      ['browse', 'Browse service', 'Nearby stock', 'Service', 'Finds the serving store, shows in-stock items.', []],
      ['storegeo', 'Store geo index', 'Delivery zones', 'Data', 'Which dark store serves this address.', []],
      ['availcache', 'Stock cache', 'Per store', 'Data', 'Approximate in-stock flags for display.', []],
      ['checkout', 'Checkout', 'Reserve + pay', 'Service', 'Reserves every item atomically, then charges.', []],
      ['inventory', 'Inventory DB', 'Per store, CAS', 'Data', 'Stock counts per store, decremented only if enough remain.', ['Reservations expire.']],
      ['orders', 'Order store', 'Order state', 'Data', 'Orders and their status.', []],
      ['dispatch', 'Dispatch', 'Match courier', 'Service', 'Picks the best nearby courier and assigns with compare-and-set.', []],
      ['couriergeo', 'Courier map', 'Geo index', 'Data', 'Live courier positions.', []],
      ['track', 'Tracking', 'SSE push', 'Service', 'Streams courier location to the customer.', []]
    ],
    edges: [
      ['customer', 'gw', 'HTTPS', 'sync', 'Calls.'],
      ['gw', 'browse', 'what\'s here?', 'sync', 'Browse.'],
      ['browse', 'storegeo', 'serving store', 'sync', 'By address.'],
      ['browse', 'availcache', 'in stock', 'sync', 'Display.'],
      ['browse', 'gw', 'catalog', 'sync', 'Items.'],
      ['gw', 'checkout', 'place order', 'sync', 'Checkout.'],
      ['checkout', 'inventory', 'reserve if ≥ qty', 'sync', 'Atomic.'],
      ['inventory', 'availcache', 'stock change', 'async', 'Refresh.'],
      ['checkout', 'orders', 'create', 'sync', 'Order.'],
      ['checkout', 'dispatch', 'needs courier', 'async', 'Match.'],
      ['checkout', 'gw', 'confirmed', 'sync', 'Order placed.'],
      ['gw', 'customer', 'response', 'sync', 'Result.'],
      ['courier', 'couriergeo', 'location', 'async', 'Every few seconds.'],
      ['dispatch', 'couriergeo', 'nearby', 'sync', 'Candidates.'],
      ['dispatch', 'orders', 'assign (CAS)', 'sync', 'One courier.'],
      ['dispatch', 'courier', 'offer', 'async', 'Accept?'],
      ['track', 'couriergeo', 'position', 'sync', 'Live.'],
      ['track', 'customer', 'SSE', 'async', 'Map updates.']
    ],
    flow: [
      ['Browse nearby', 'Find the serving store and show what it has.', 'customer>gw, gw>browse, browse>storegeo, browse>availcache, browse>gw, gw>customer', 'read'],
      ['Check out', 'Reserve all items atomically, create the order, request a courier.', 'customer>gw, gw>checkout, checkout>inventory, inventory>availcache, checkout>orders, checkout>dispatch, checkout>gw, gw>customer', 'write'],
      ['Assign a courier', 'Match a nearby courier and assign exactly once.', 'courier>couriergeo, dispatch>couriergeo, dispatch>orders, dispatch>courier', 'write'],
      ['Track the order', 'Stream the courier\'s position.', 'track>couriergeo, track>customer', 'read']
    ],
    why: [
      'Inventory is per store, so reservations are local and fast.',
      'A conditional decrement prevents selling the last item twice.',
      'Display availability can be approximate; only checkout must be exact.',
      'Compare-and-set assignment keeps two dispatchers from giving one order to two couriers.'
    ],
    tradeoffs: [
      'Reserving at checkout is safe but can fail late; reserving at add-to-cart locks stock early.',
      'Greedy courier matching is fast; batch optimization yields better routes but adds delay.',
      'Short availability cache TTLs are more accurate but cost more reads.'
    ],
    failures: [
      ['Inventory drift', 'inventory', 'checkout availcache', 'Orders accepted for items not on the shelf.', 'Picker confirmation, substitution flow, and frequent cycle counts.']
    ]
  },

  'online-auction': {
    subtitle: 'Bids accepted by a conditional write per auction, broadcast live, closed by a scheduler',
    basedOn: 'eBay bidding, real-time auction platforms',
    sources: [
      ['eBay: automatic bidding', 'https://www.ebay.com/help/buying/bidding/automatic-bidding?id=4014'],
      ['System Design School: Online auction', 'https://systemdesignschool.io/problems/online-auction/solution']
    ],
    nodes: [
      ['bidder', 'Bidder', 'Watch + bid', 'Client', 'Watches the price and bids.', []],
      ['gw', 'API gateway', 'Auth', 'Gateway', 'Entry point for bids and auction pages.', []],
      ['ws', 'WebSocket fleet', 'Live prices', 'Gateway', 'Pushes price updates to watchers.', []],
      ['bids', 'Bid service', 'Validate + accept', 'Service', 'Accepts a bid only if it beats the current price; extends the end time on late bids.', []],
      ['auctions', 'Auction DB', 'Price + end time', 'Data', 'Current price, leader, version, end time; updated with a conditional write.', []],
      ['bidlog', 'Bid log', 'Append-only', 'Data', 'Every bid, accepted or not, for audit and disputes.', []],
      ['topic', 'Auction topic', 'Pub/sub', 'Async', 'One topic per auction for price changes.', []],
      ['closer', 'Close scheduler', 'At end time', 'Async', 'Closes auctions with a guarded update, then notifies.', []],
      ['notify', 'Notifications', 'Outbid / won', 'Async', 'Push and email.', []],
      ['search', 'Listing search', 'Browse', 'Service', 'Finds auctions to watch.', []]
    ],
    edges: [
      ['bidder', 'gw', 'HTTPS', 'sync', 'Calls.'],
      ['gw', 'search', 'browse', 'sync', 'Find items.'],
      ['gw', 'auctions', 'auction page', 'sync', 'Current state.'],
      ['gw', 'bids', 'place bid', 'sync', 'Write.'],
      ['bids', 'auctions', 'if amount > price', 'sync', 'Conditional write.'],
      ['bids', 'bidlog', 'append', 'sync', 'Audit.'],
      ['bids', 'topic', 'new price', 'async', 'Broadcast.'],
      ['bids', 'notify', 'outbid', 'async', 'Previous leader.'],
      ['bids', 'gw', 'accepted / too low', 'sync', 'Result.'],
      ['gw', 'bidder', 'response', 'sync', 'Shown.'],
      ['topic', 'ws', 'fan out', 'async', 'Watchers.'],
      ['ws', 'bidder', 'price', 'async', 'Live.'],
      ['closer', 'auctions', 'close if ended', 'async', 'Guarded.'],
      ['closer', 'notify', 'winner', 'async', 'Won.']
    ],
    flow: [
      ['Place a bid', 'Conditional write on the auction; log it; broadcast the new price.', 'bidder>gw, gw>bids, bids>auctions, bids>bidlog, bids>topic, bids>notify, bids>gw, gw>bidder', 'write'],
      ['Watch an auction', 'Load the page, then receive live prices.', 'bidder>gw, gw>auctions, topic>ws, ws>bidder', 'read'],
      ['Close the auction', 'At the end time, close with a guarded update and notify the winner.', 'closer>auctions, closer>notify', 'background']
    ],
    why: [
      'A conditional write on one row serializes bids per auction without global locks.',
      'An append-only bid log settles disputes.',
      'Extending the end time on late bids discourages sniping.',
      'Per-auction topics push prices only to people watching that auction.'
    ],
    tradeoffs: [
      'One row per auction caps bids per second on hot items; batch or queue per auction if needed.',
      'Proxy bidding is fairer but harder to explain.',
      'Push updates are best-effort; the authoritative price is always re-checked on bid.'
    ],
    failures: [
      ['Close job late', 'closer', 'auctions notify', 'Bids land after the advertised end.', 'The bid service rejects bids past end time; the close job is idempotent.']
    ]
  },

  'metrics-monitoring': {
    layers: ['Client', 'Edge', 'Gateway', 'Async', 'Service', 'Data', 'Obs'],
    subtitle: 'Agents → partitioned log → TSDB with compressed chunks, rollups, and an alert evaluator',
    basedOn: 'Facebook Gorilla, Prometheus, Uber M3, Datadog',
    sources: [
      ['Gorilla: in-memory TSDB', 'https://www.vldb.org/pvldb/vol8/p1816-teller.pdf'],
      ['Uber: M3', 'https://www.uber.com/blog/m3/'],
      ['System Design School: Metrics monitoring', 'https://systemdesignschool.io/problems/metrics-monitoring/solution']
    ],
    nodes: [
      ['agent', 'Agents', 'On each host', 'Client', 'Collect and batch metrics.', []],
      ['ingest', 'Ingest tier', 'Validate + batch', 'Gateway', 'Accepts batches, rejects bad labels.', []],
      ['log', 'Partitioned log', 'Kafka by series', 'Async', 'Buffers writes and allows replay.', []],
      ['writers', 'TSDB writers', 'Cardinality caps', 'Service', 'Append points to series; refuse runaway label combinations.', []],
      ['tsdb', 'Time-series DB', 'Compressed chunks', 'Data', 'Delta-of-delta timestamps and XOR values, ~1.4 bytes per point.', []],
      ['index', 'Series index', 'Labels → series', 'Data', 'Finds series matching label filters.', []],
      ['rollup', 'Rollup jobs', '1m → 1h', 'Async', 'Downsample older data.', []],
      ['retention', 'Retention', 'Tier + expire', 'Async', 'Moves old data to object storage and expires it.', []],
      ['query', 'Query engine', 'PromQL', 'Service', 'Picks the right resolution and aggregates.', []],
      ['dash', 'Dashboards', 'Grafana', 'Client', 'Charts.', []],
      ['rules', 'Alert rules', 'Thresholds', 'Data', 'What to alert on.', []],
      ['alerts', 'Alert evaluator', 'Every 30 s', 'Service', 'Evaluates rules, dedupes, routes.', []],
      ['pager', 'Notifier', 'Page / Slack', 'Async', 'Delivers alerts.', []]
    ],
    edges: [
      ['agent', 'ingest', 'batch', 'sync', 'Every 10 s.'],
      ['ingest', 'log', 'append', 'async', 'Buffer.'],
      ['log', 'writers', 'consume', 'async', 'By series.'],
      ['writers', 'tsdb', 'append points', 'async', 'Compressed.'],
      ['writers', 'index', 'new series', 'async', 'Label index.'],
      ['rollup', 'tsdb', 'downsample', 'async', 'Coarser tiers.'],
      ['retention', 'tsdb', 'tier / expire', 'async', 'Age out.'],
      ['dash', 'query', 'query', 'sync', 'Chart.'],
      ['query', 'index', 'match labels', 'sync', 'Series ids.'],
      ['query', 'tsdb', 'read range', 'sync', 'Right resolution.'],
      ['query', 'dash', 'series', 'sync', 'Plotted.'],
      ['alerts', 'rules', 'load', 'sync', 'Rules.'],
      ['alerts', 'query', 'evaluate', 'sync', 'Periodic.'],
      ['alerts', 'pager', 'firing', 'async', 'Notify.']
    ],
    flow: [
      ['Report metrics', 'Agents batch to ingest; the log buffers; writers append compressed points.', 'agent>ingest, ingest>log, log>writers, writers>tsdb, writers>index', 'write'],
      ['View a dashboard', 'Match labels, read the right resolution, aggregate.', 'dash>query, query>index, query>tsdb, query>dash', 'read'],
      ['Fire an alert', 'Rules are evaluated periodically and routed to on-call.', 'alerts>rules, alerts>query, alerts>pager', 'background'],
      ['Age out data', 'Rollups and retention keep storage bounded.', 'rollup>tsdb, retention>tsdb', 'background']
    ],
    why: [
      'Time-series compression (Gorilla) fits recent data in memory at ~12× savings.',
      'A log between ingest and storage absorbs bursts and lets writers replay after failures.',
      'Rollups make long-range queries fast and cheap.',
      'Cardinality caps stop one bad label from blowing up the index.'
    ],
    tradeoffs: [
      'Push (agents send) scales well; pull (Prometheus scrapes) makes target health obvious.',
      'Rollups lose detail; old spikes may disappear.',
      'Alert evaluation latency trades against query load.'
    ],
    failures: [
      ['Cardinality explosion', 'writers', 'index tsdb query', 'A label like user_id creates millions of series and the index melts.', 'Per-tenant caps, drop the offending label, alert the owner.']
    ]
  },

  'job-scheduler': {
    subtitle: 'Due jobs found by time bucket, claimed with a lease, run at least once by idempotent workers',
    basedOn: 'Airbnb Chronos, Dropbox ATF, Uber Cadence',
    sources: [
      ['Dropbox: async task framework', 'https://dropbox.tech/infrastructure/asynchronous-task-scheduling-at-dropbox'],
      ['Uber: Cadence', 'https://www.uber.com/blog/open-source-orchestration-tool-cadence-overview/'],
      ['System Design School: Job scheduler', 'https://systemdesignschool.io/problems/job-scheduler/solution']
    ],
    nodes: [
      ['client', 'Client service', 'Submit jobs', 'Client', 'Schedules one-off or recurring jobs.', []],
      ['api', 'Submit API', 'Validate', 'Gateway', 'Accepts a job with an idempotency key.', []],
      ['jobs', 'Job store', 'Definitions + runs', 'Data', 'Job definitions, schedules, and run history.', []],
      ['due', 'Due index', 'Time buckets', 'Data', 'Jobs keyed by the minute they are due.', []],
      ['dispatch', 'Dispatchers', 'Lease claim', 'Service', 'Scan the current bucket and claim jobs with a lease.', ['Jitter spreads thundering herds.']],
      ['queue', 'Work queue', 'Per job type', 'Async', 'Claimed runs waiting for workers.', []],
      ['workers', 'Workers', 'Idempotent', 'Service', 'Run the job, heartbeat, report the result.', []],
      ['dlq', 'Failed jobs', 'After retries', 'Async', 'Runs that failed too many times.', []],
      ['ui', 'Job console', 'Status', 'Client', 'History, failures, and reruns.', []]
    ],
    edges: [
      ['client', 'api', 'schedule', 'sync', 'Submit.'],
      ['api', 'jobs', 'store', 'sync', 'Definition.'],
      ['api', 'due', 'next run', 'sync', 'Bucket it.'],
      ['api', 'client', 'job id', 'sync', 'Accepted.'],
      ['dispatch', 'due', 'scan bucket', 'async', 'Every second.'],
      ['dispatch', 'jobs', 'claim lease', 'sync', 'Compare-and-set.'],
      ['dispatch', 'queue', 'enqueue run', 'async', 'Hand off.'],
      ['queue', 'workers', 'pull', 'async', 'Execute.'],
      ['workers', 'jobs', 'result + next', 'sync', 'Record.'],
      ['workers', 'due', 'reschedule', 'async', 'Recurring.'],
      ['workers', 'dlq', 'give up', 'async', 'After retries.'],
      ['ui', 'jobs', 'history', 'sync', 'Read.'],
      ['jobs', 'ui', 'runs', 'sync', 'Status.']
    ],
    flow: [
      ['Schedule a job', 'Store the definition and put the next run into a time bucket.', 'client>api, api>jobs, api>due, api>client', 'write'],
      ['Run due jobs', 'Dispatchers claim due runs with a lease and enqueue them; workers execute.', 'dispatch>due, dispatch>jobs, dispatch>queue, queue>workers, workers>jobs, workers>due', 'background'],
      ['A job keeps failing', 'Retries with backoff, then the dead-letter queue.', 'queue>workers, workers>dlq', 'background'],
      ['Check job history', 'The console reads run history.', 'ui>jobs, jobs>ui', 'read']
    ],
    why: [
      'Time buckets make "what is due now?" a single small lookup.',
      'A lease lets a crashed dispatcher\'s jobs be re-claimed automatically.',
      'At-least-once execution plus idempotent workers is simpler and safer than exactly-once.',
      'Jitter keeps midnight cron jobs from all firing at the same instant.'
    ],
    tradeoffs: [
      'Shorter leases recover faster but risk duplicate runs during slow GC pauses.',
      'Coarse buckets are cheaper to scan but less precise.',
      'A central store is simple; it eventually needs sharding by job id.'
    ],
    failures: [
      ['Dispatcher crashes mid-claim', 'dispatch', 'queue workers', 'Claimed jobs stall.', 'Leases expire and another dispatcher re-claims; workers dedupe by run id.']
    ]
  },

  'payment-system': {
    subtitle: 'Idempotent payments, a saga with an external provider, a double-entry ledger, and daily reconciliation',
    basedOn: 'Stripe idempotency, Airbnb payments, Uber ledger',
    sources: [
      ['Stripe: idempotent requests', 'https://stripe.com/blog/idempotency'],
      ['Airbnb: avoiding double payments', 'https://medium.com/airbnb-engineering/avoiding-double-payments-in-a-distributed-payments-system-2981f6b070bb'],
      ['System Design School: Payment system', 'https://systemdesignschool.io/problems/payment-system/solution']
    ],
    nodes: [
      ['merchant', 'Checkout', 'Pay button', 'Client', 'Sends a payment with an idempotency key.', []],
      ['gw', 'Payment API', 'Auth + key', 'Gateway', 'Authenticates the merchant and validates the request.', []],
      ['idem', 'Idempotency gate', 'Key → result', 'Data', 'Returns the stored result for a retried key.', []],
      ['payments', 'Payment service', 'State machine', 'Service', 'Creates the payment and its saga state.', ['created → authorized → captured.']],
      ['paydb', 'Payment DB', 'Payments + saga', 'Data', 'Payment rows and saga progress.', []],
      ['queue', 'Payment queue', 'Durable', 'Async', 'Steps for the saga worker.', []],
      ['saga', 'Saga worker', 'Call provider', 'Service', 'Calls the card network, records the outcome, compensates on failure.', ['Unknown outcome = in_doubt.']],
      ['psp', 'Card processor', 'External', 'Client', 'Visa / Mastercard via an acquirer.', []],
      ['ledger', 'Ledger', 'Double entry', 'Data', 'Append-only debit and credit entries that always sum to zero.', []],
      ['recon', 'Reconciliation', 'Daily settlement', 'Async', 'Matches the ledger against the processor\'s settlement file.', []],
      ['webhook', 'Webhooks', 'Status events', 'Async', 'Tells the merchant the outcome.', []]
    ],
    edges: [
      ['merchant', 'gw', 'pay + key', 'sync', 'Request.'],
      ['gw', 'idem', 'seen key?', 'sync', 'Dedup.'],
      ['idem', 'gw', 'stored result', 'sync', 'For retries.'],
      ['gw', 'payments', 'new payment', 'sync', 'First time.'],
      ['payments', 'paydb', 'create', 'sync', 'Saga start.'],
      ['payments', 'queue', 'authorize step', 'async', 'Hand off.'],
      ['payments', 'gw', 'processing', 'sync', 'Status.'],
      ['gw', 'merchant', 'response', 'sync', 'Id + status.'],
      ['queue', 'saga', 'step', 'async', 'Execute.'],
      ['saga', 'psp', 'authorize', 'sync', 'External.'],
      ['psp', 'saga', 'approved / declined', 'sync', 'Outcome.'],
      ['saga', 'paydb', 'state', 'sync', 'Advance.'],
      ['saga', 'ledger', 'entries', 'sync', 'Debit + credit.'],
      ['saga', 'webhook', 'outcome', 'async', 'Notify merchant.'],
      ['merchant', 'paydb', 'get status', 'sync', 'Poll.'],
      ['paydb', 'merchant', 'status', 'sync', 'State.'],
      ['recon', 'psp', 'settlement file', 'async', 'Ground truth.'],
      ['recon', 'ledger', 'match + fix', 'async', 'Find gaps.']
    ],
    flow: [
      ['Charge a card', 'Dedup by key, create the payment, hand the provider call to the saga.', 'merchant>gw, gw>idem, gw>payments, payments>paydb, payments>queue, payments>gw, gw>merchant', 'write'],
      ['Authorize with the network', 'The saga calls the processor, records the outcome and ledger entries.', 'queue>saga, saga>psp, psp>saga, saga>paydb, saga>ledger, saga>webhook', 'write'],
      ['Retry the same payment', 'The idempotency gate returns the stored result.', 'merchant>gw, gw>idem, idem>gw, gw>merchant', 'read'],
      ['Check status', 'Read the payment\'s current state.', 'merchant>paydb, paydb>merchant', 'read'],
      ['Reconcile', 'Match the ledger against the settlement file daily.', 'recon>psp, recon>ledger', 'background']
    ],
    why: [
      'Idempotency keys make retries safe: a network timeout never charges twice.',
      'A saga turns a call to an unreliable external provider into recorded, resumable steps.',
      'Double-entry bookkeeping makes every cent traceable and errors detectable.',
      'Reconciliation catches the cases where we and the network disagree.'
    ],
    tradeoffs: [
      'Async processing scales and survives provider outages but needs status polling or webhooks.',
      'In-doubt payments wait for reconciliation instead of guessing.',
      'Strong consistency on the ledger limits write throughput per account.'
    ],
    failures: [
      ['Provider timeout', 'psp', 'saga paydb', 'We do not know whether the card was charged.', 'Mark in_doubt, query the provider, reconcile; never blindly retry the charge.']
    ]
  },

  'web-crawler': {
    layers: ['Client', 'Edge', 'Gateway', 'Async', 'Service', 'Data', 'Obs'],
    subtitle: 'A two-level frontier for priority and politeness, a fetcher fleet, dedup, and a recrawl scheduler',
    basedOn: 'Mercator frontier design, Googlebot, Common Crawl',
    sources: [
      ['Mercator: a scalable web crawler', 'https://www.cs.cornell.edu/courses/cs685/2002fa/mercator.pdf'],
      ['Google: crawling and indexing', 'https://developers.google.com/search/docs/fundamentals/how-search-works'],
      ['System Design School: Web crawler', 'https://systemdesignschool.io/problems/web-crawler/solution']
    ],
    nodes: [
      ['seeds', 'Seed URLs', 'Start list', 'Client', 'Initial URLs and sitemaps.', []],
      ['front', 'Front queues', 'By priority', 'Async', 'URLs ordered by importance.', []],
      ['back', 'Back queues', 'One per host', 'Async', 'Per-host queues with a next-allowed time.', ['Politeness.']],
      ['robots', 'DNS + robots', 'Per host', 'Data', 'Resolved IPs and robots.txt rules.', []],
      ['fetch', 'Fetcher fleet', 'Async HTTP', 'Service', 'Downloads pages with conditional GET.', []],
      ['web', 'Websites', 'External', 'Client', 'The web.', []],
      ['parse', 'Parser', 'Links + text', 'Service', 'Extracts links and content.', []],
      ['seen', 'URL seen', 'Bloom filter', 'Data', 'Skips URLs already queued.', []],
      ['content', 'Content dedup', 'Fingerprints', 'Data', 'Skips pages with identical content.', []],
      ['pages', 'Page store', 'Object storage', 'Data', 'Raw and parsed pages.', []],
      ['meta', 'URL metadata', 'Last fetch, ETag', 'Data', 'Per-URL state.', []],
      ['recrawl', 'Recrawler', 'Change rate', 'Async', 'Requeues URLs based on how often they change.', []],
      ['indexer', 'Search indexer', 'Downstream reader', 'Client', 'Consumes crawled pages to build a search index.', []]
    ],
    edges: [
      ['seeds', 'front', 'enqueue', 'async', 'Start.'],
      ['front', 'back', 'route by host', 'async', 'Politeness.'],
      ['back', 'fetch', 'next URL', 'async', 'When allowed.'],
      ['fetch', 'robots', 'DNS + rules', 'sync', 'Cached.'],
      ['fetch', 'web', 'GET', 'sync', 'Conditional.'],
      ['web', 'fetch', 'page / 304', 'sync', 'Response.'],
      ['fetch', 'parse', 'HTML', 'async', 'Parse.'],
      ['parse', 'content', 'duplicate?', 'sync', 'Fingerprint.'],
      ['parse', 'pages', 'store', 'async', 'Save.'],
      ['parse', 'meta', 'update', 'async', 'ETag, time.'],
      ['parse', 'seen', 'new links?', 'sync', 'Bloom test.'],
      ['parse', 'front', 'new URLs', 'async', 'Grow the frontier.'],
      ['recrawl', 'meta', 'due URLs', 'async', 'Scan.'],
      ['recrawl', 'front', 'requeue', 'async', 'Refresh.'],
      ['indexer', 'pages', 'read new pages', 'sync', 'Batch scan.'],
      ['pages', 'indexer', 'pages', 'sync', 'Content.']
    ],
    flow: [
      ['Fetch a page', 'Pick a URL whose host is ready, check robots, GET it, store it.', 'back>fetch, fetch>robots, fetch>web, web>fetch, fetch>parse, parse>content, parse>pages, parse>meta', 'write'],
      ['Discover links', 'New links pass the seen filter and enter the frontier by priority.', 'parse>seen, parse>front, front>back', 'write'],
      ['Index crawled pages', 'Downstream systems read fresh pages from the page store.', 'indexer>pages, pages>indexer', 'read'],
      ['Refresh changed pages', 'The recrawl scheduler requeues pages based on how often they change.', 'recrawl>meta, recrawl>front', 'background']
    ],
    why: [
      'Front queues decide what matters; back queues decide when each host may be hit.',
      'A Bloom filter checks billions of URLs in memory.',
      'Conditional GETs make recrawls cheap when nothing changed.',
      'Content fingerprints avoid storing mirrors and duplicates.'
    ],
    tradeoffs: [
      'Bloom filters occasionally skip a new URL.',
      'Stricter politeness is kinder to sites but slows coverage.',
      'Recrawling often keeps the index fresh but costs bandwidth.'
    ],
    failures: [
      ['Spider trap', 'parse', 'front back fetch', 'Infinite generated URLs consume the crawl budget.', 'Depth and per-host page limits, URL normalization, trap detection.']
    ]
  }
});
