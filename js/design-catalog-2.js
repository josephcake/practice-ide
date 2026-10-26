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
  topics: ['WebSocket / SSE fan-out', 'Two-level fan-out tree', 'Sampling and ranking', 'Sharded pub/sub', 'Moderation', 'Catch-up on join'],
  brief: {
    ask: 'Build live comments for a huge broadcast, so millions of viewers see new comments flowing in real time.',
    examples: [
      'During the final, Diego posts "WHAT A GOAL ⚽"; viewers see it appear within a second.',
      '5 million people are watching and 50,000 comments arrive per second; each viewer sees a readable stream of about 10 per second.',
      'Diego\'s friends see his comment even when it is not among the most popular.',
      'A spam bot posts links 100 times; none of them reach viewers.'
    ],
    deliver: ['How comments reach millions of open connections', 'How the stream is kept readable (sampling)', 'How a new viewer catches up', 'Moderation and hot-event scaling']
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
  }
});
