/* ============================================================
   Catalog part 3: Hard (2 of 2) + Online banking
   ============================================================ */

DesignCatalog.add({
  id: 'ad-click-aggregator', difficulty: 'hard', cat: 'Data',
  title: 'Design an Ad Click Aggregator',
  prompt: [
    'Design a pipeline that counts ad clicks accurately for billing and shows advertisers near-real-time click totals per ad, per minute.',
    '',
    'Scale: 10B clicks per day (about 100k/s, peaks 500k/s), click events can be delivered more than once, and a few ads receive a huge share of clicks.'
  ].join('\n'),
  hints: [
    'Duplicate deliveries and hot keys, not raw volume, are what break a naive counter.',
    'Click handler redirects the user immediately and writes the click event to Kafka; billing never blocks the redirect.',
    'Every click gets a unique click id; dedupe within a time window (keyed state in the stream processor) so retries count once.',
    'Stream processing (e.g. Flink) aggregates counts per ad per minute using event time and watermarks for late events.',
    'Hot ads: pre-aggregate locally or salt the key (ad#1..ad#8) and combine later.',
    'Write aggregates to an OLAP store for dashboards; keep raw events in cheap storage.',
    'Lambda/kappa idea: a nightly batch recount from raw events reconciles the real-time numbers before billing.'
  ],
  topics: ['Kafka ingestion', 'Click-id dedup', 'Windowed stream aggregation', 'Event time + watermarks', 'Hot-key salting', 'OLAP store', 'Batch reconciliation'],
  brief: {
    ask: 'Build the system that counts every ad click once, fast enough for live dashboards and accurately enough to bill on.',
    examples: [
      'A shopper clicks a shoe ad and lands on the shoe store instantly; the click is counted in the background.',
      'The advertiser\'s dashboard shows "1,284 clicks in the last 5 minutes", updated every minute.',
      'A phone on bad signal sends the same click 3 times; it is counted once.',
      'At month end, the invoice matches a full recount of raw clicks.'
    ],
    deliver: ['The click ingestion path', 'How duplicates are removed', 'How per-minute counts are computed and stored', 'How hot ads and billing accuracy are handled']
  }
});

DesignCatalog.add({
  id: 'top-k', difficulty: 'hard', cat: 'Data',
  title: 'Design Top K (Trending)',
  prompt: [
    'Design a system that shows the top K trending items (videos, songs, search queries) over the last minute, hour, and day, from a firehose of view events.',
    '',
    'Scale: 1M events per second, hundreds of millions of distinct items, and results refreshed every few seconds.'
  ].join('\n'),
  hints: [
    'Unbounded distinct items against bounded memory, not raw event volume, is what breaks a naive counter.',
    'Exact counting of every item needs a huge hash map. Approximate with a Count-Min Sketch (fixed memory) plus a min-heap of the current top K.',
    'Partition the stream by item, compute local top K per partition, and merge partial results (merge of heaps).',
    'Windows: tumbling minute windows, combined into hour and day views; or sliding windows with buckets.',
    'Store results per window in a fast store; readers just read the latest list.',
    'For billing-grade accuracy, a batch job computes exact counts from raw logs; trending does not need that.',
    'Hot items: pre-aggregate on the producer side to cut events.'
  ],
  topics: ['Count-Min Sketch', 'Min-heap of top K', 'Partitioned partial results', 'Merge step', 'Time windows', 'Approximate vs exact'],
  brief: {
    ask: 'Build the "trending now" list: the top items people are watching or searching, updated every few seconds.',
    examples: [
      'A music video drops; within 30 seconds it appears in "Trending now" in the US.',
      'The "Top 10 this hour" list updates every 10 seconds.',
      'There are 300 million different songs, but the system uses a fixed, small amount of memory.',
      'Yesterday\'s #1 slides down the list as views slow.'
    ],
    deliver: ['How items are counted with bounded memory', 'How top K is computed and merged across machines', 'How minute, hour, and day windows work', 'How results are served']
  }
});

DesignCatalog.add({
  id: 'uber', difficulty: 'hard', cat: 'Marketplace',
  title: 'Design Uber / Nearby Drivers',
  prompt: [
    'Design the core of ride-hailing: drivers stream their location, riders request a ride, and the system finds and matches a nearby available driver in seconds.',
    '',
    'Scale: 1M active drivers sending location every 4 seconds (250k writes/s), 10M rides per day, matching within ~10 seconds.'
  ].join('\n'),
  hints: [
    'The twist: it is write-heavy. The location index takes a firehose of updates, far more than rider requests.',
    'Keep only the latest location per driver, in memory, indexed by geo cell (geohash / H3). Do not write every ping to a database row.',
    'Shard by city/region; nearby queries rarely cross regions.',
    'Matching: query nearby cells for available drivers, rank by ETA, offer to one driver with a timeout, then the next.',
    'Trip is a state machine (requested → matched → arriving → on trip → completed) persisted durably; location is ephemeral.',
    'Prevent double assignment: a driver can be offered to one rider at a time (lock or conditional state change).',
    'Surge pricing and payments are downstream of the trip state.'
  ],
  topics: ['Write-heavy location stream', 'In-memory geo index (H3)', 'City sharding', 'Offer loop with timeouts', 'Trip state machine', 'No double assignment'],
  brief: {
    ask: 'Build ride-hailing matching: know where a million drivers are right now and connect a rider to a close one in seconds.',
    examples: [
      'A rider in downtown SF taps "Request"; within 8 seconds a driver 0.4 miles away gets the offer.',
      'Every driver\'s app sends its location every 4 seconds; the system keeps up.',
      'The first driver ignores the offer for 15 seconds; it goes to the next closest driver.',
      'Two riders request at once next to the same driver; the driver is offered only one of them.'
    ],
    deliver: ['How driver locations are ingested and indexed', 'How a nearby driver is found and offered', 'How trips are tracked durably', 'How double assignment is prevented']
  }
});

DesignCatalog.add({
  id: 'pub-sub', difficulty: 'hard', cat: 'Infrastructure',
  title: 'Design a Pub-Sub / Message Queue',
  prompt: [
    'Design a durable, high-throughput message system like Kafka: producers append events to topics, and many independent consumer groups read at their own pace, replay history, and survive failures.',
    '',
    'Scale: 1M messages per second per cluster, retention of 7 days, hundreds of consumer groups.'
  ].join('\n'),
  hints: [
    'Model it as a partitioned, append-only log, not a transient queue. Messages are not deleted when read.',
    'A topic has partitions; each partition is an ordered log on one leader broker with follower replicas.',
    'Producers choose a partition by key (same key → same partition → ordered).',
    'Consumers track their own offset per partition; a consumer group splits partitions among its members.',
    'Durability: a write is acknowledged when in-sync replicas have it (acks=all); followers take over if the leader dies.',
    'Sequential disk writes and zero-copy reads give high throughput.',
    'Retention by time or size; compacted topics keep the latest value per key.'
  ],
  topics: ['Append-only log', 'Partitions + keys', 'Leader / follower replication', 'Consumer offsets', 'Consumer groups', 'Retention / compaction'],
  brief: {
    ask: 'Build a message log that many services write events to and many others read from, each at its own pace.',
    examples: [
      'The orders service publishes "order 81 placed"; billing, email, and analytics each receive it independently.',
      'The analytics team deploys a bug, fixes it, and replays the last 3 days of events.',
      'A broker machine dies; producers and consumers keep working within seconds.',
      'All events for order 81 arrive in the order they were produced.'
    ],
    deliver: ['How topics, partitions, and ordering work', 'How messages are replicated and acknowledged', 'How consumers track progress and share work', 'Retention and replay']
  }
});

DesignCatalog.add({
  id: 'chat-app', difficulty: 'hard', cat: 'Communication',
  title: 'Design a Chat App (WhatsApp / Messenger)',
  prompt: [
    'Design a chat app: one-on-one and group messages delivered in real time, in order, to all of a user\'s devices, with offline delivery, read receipts, and online presence.',
    '',
    'Scale: 1B users, 100B messages per day, groups up to 1,000 members, and messages must never be lost.'
  ].join('\n'),
  hints: [
    'Clients keep a persistent WebSocket to a gateway; a session registry maps user → gateway server(s).',
    'Send path: store the message durably first (per-conversation log with a sequence number), then deliver.',
    'Ordering: sequence numbers per conversation; clients reorder and detect gaps.',
    'Offline users: messages wait in the store; on reconnect the client asks for everything after its last sequence number. Push notifications wake the phone.',
    'Groups: fan out to each member\'s gateway; large groups fan out asynchronously.',
    'Delivery and read receipts are just small messages flowing back.',
    'Presence is ephemeral and lossy: heartbeats with TTL, not a durable write per change.'
  ],
  topics: ['WebSocket gateways', 'Session registry', 'Per-conversation sequence', 'Store then deliver', 'Offline sync', 'Group fan-out', 'Presence via heartbeats'],
  brief: {
    ask: 'Build a chat app that delivers messages instantly and in order to every device, even ones that were offline.',
    examples: [
      'Nadia sends "On my way!" to Tom; it appears on his phone and laptop within 300 ms.',
      'Tom\'s phone was off for 2 hours; when it turns on, all 37 messages arrive in order.',
      'In a 200-person family group, a photo message reaches everyone within a few seconds.',
      'Nadia sees "Delivered" and then "Read" under her message.'
    ],
    deliver: ['How clients stay connected and are found', 'The send path and how ordering works', 'Offline delivery and multiple devices', 'Groups, receipts, and presence']
  }
});

DesignCatalog.add({
  id: 'youtube', difficulty: 'hard', cat: 'Media',
  title: 'Design YouTube',
  prompt: [
    'Design a video platform where anyone can upload videos and a global audience streams them.',
    '',
    'Scale: 500 hours of video uploaded per minute, 1B hours watched per day, and a long tail of rarely watched videos alongside viral hits.'
  ].join('\n'),
  hints: [
    'Two hard parts: the transcode pipeline (every upload becomes many renditions) and delivery economics (egress measured in exabytes).',
    'Upload: resumable, chunked uploads directly to object storage via pre-signed URLs.',
    'Transcode asynchronously: split the video into segments, encode in parallel into many resolutions and codecs, package for adaptive streaming.',
    'Metadata (title, owner, status, view counts) in a database; video segments in object storage.',
    'Serve through a CDN; unlike Netflix, the catalog is user-generated and unpredictable, so the CDN fills on demand and the long tail often misses.',
    'Adaptive bitrate in the player prevents buffering.',
    'View counts and recommendations are async pipelines off the view event stream.'
  ],
  topics: ['Resumable uploads', 'Parallel transcoding', 'Adaptive bitrate', 'Metadata vs segments', 'CDN with long tail', 'View-count pipeline'],
  brief: {
    ask: 'Build a video site where anyone can upload a video and anyone in the world can watch it smoothly.',
    examples: [
      'A creator uploads a 2 GB, 20-minute video from a café; the upload resumes after the Wi-Fi drops.',
      'Ten minutes later it is playable in 240p to 4K.',
      'A viewer in Brazil watches it with no buffering, served from a nearby CDN server.',
      'The view counter climbs from 0 to 1M over a day.'
    ],
    deliver: ['The upload path for large files', 'The transcode pipeline', 'How video is delivered globally', 'How views and metadata are handled']
  }
});

DesignCatalog.add({
  id: 'news-feed', difficulty: 'hard', cat: 'Social',
  title: 'Design a News Feed',
  prompt: [
    'Design the home feed for a social product (like Facebook): a ranked, near-real-time stream of posts from friends, pages, and groups a user follows.',
    '',
    'Scale: 1B daily users, each follows hundreds of sources, the feed must load in under 500 ms, and ranking uses many signals.'
  ].join('\n'),
  hints: [
    'Fan-out and ranking are coupled: what you precompute determines what you can rank.',
    'Candidate generation: a hybrid of precomputed inboxes (fan-out on write for normal sources) and pull at read time for very popular sources.',
    'Ranking: score a few thousand candidates with a model using affinity, recency, engagement, and content type; return the top ~50.',
    'Feature store: precomputed features (affinity between users, post engagement) read at ranking time.',
    'Cache the ranked feed per user briefly and paginate with cursors.',
    'Engagement events (likes, comments, dwell time) flow back into features asynchronously.',
    'Freshness vs stability: new posts can be inserted at the top, but the rest of the feed should not jump around.'
  ],
  topics: ['Hybrid fan-out', 'Candidate generation', 'Ranking model', 'Feature store', 'Feed cache + cursors', 'Engagement feedback loop'],
  brief: {
    ask: 'Build the home feed that picks the most interesting recent posts from everyone you follow, in under half a second.',
    examples: [
      'Lucia opens the app and sees her sister\'s new baby photo first, above a page she rarely interacts with.',
      'Her friend posts while she is scrolling; it appears when she pulls to refresh.',
      'She scrolls down and the next 20 posts load without duplicates.',
      'She likes three cooking videos; tomorrow her feed shows more cooking.'
    ],
    deliver: ['How candidate posts are gathered', 'How they are ranked', 'How the feed is cached and paginated', 'How engagement feeds back into ranking']
  }
});

DesignCatalog.add({
  id: 'instagram', difficulty: 'hard', cat: 'Social',
  title: 'Design Instagram',
  prompt: [
    'Design a photo-sharing service: upload images, follow accounts, and see a timeline of recent posts.',
    '',
    'Scale: 500M daily users, 100M photos uploaded per day, images served worldwide, and a few accounts with 100M+ followers.'
  ].join('\n'),
  hints: [
    'The read path is a news-feed variant; the new problem is the media write path: upload, process, store durably, deliver via CDN.',
    'Upload directly to object storage with pre-signed URLs; never stream large bytes through app servers.',
    'Generate thumbnails and sizes asynchronously; the post can appear once the smallest size is ready.',
    'Metadata (post, caption, owner, image keys) in a sharded database; images in object storage behind a CDN.',
    'Timeline: hybrid fan-out (push for most accounts, pull for celebrities), storing post ids per user.',
    'Likes and comments are high-write counters, eventually consistent.',
    'Signed CDN URLs for private accounts; invalidate only on delete.'
  ],
  topics: ['Pre-signed uploads', 'Async image processing', 'Object storage + CDN', 'Sharded metadata', 'Hybrid fan-out timeline', 'Eventually consistent counters'],
  brief: {
    ask: 'Build photo sharing: post a picture, and everyone who follows you sees it in their feed, loading fast anywhere in the world.',
    examples: [
      'Sam posts a 4 MB photo from his phone; it shows "Posted" in 2 seconds.',
      'His 300 followers see it near the top of their feeds within seconds.',
      'A follower in Tokyo opens it and the image loads from a nearby CDN server.',
      'A celebrity with 200M followers posts, and the system does not write 200M timelines synchronously.'
    ],
    deliver: ['The photo upload and processing path', 'Where images and metadata live', 'How the timeline is built', 'How images are delivered fast']
  }
});

DesignCatalog.add({
  id: 'distributed-cache', difficulty: 'hard', cat: 'Infrastructure',
  title: 'Design a Distributed Cache',
  prompt: [
    'Design an in-memory caching layer (like Memcached or Redis Cluster) that serves reads in under a millisecond for tens of millions of requests per second, shards across many nodes, and survives node loss without taking the database down.',
    '',
    'Scale: 50M requests per second, 100 TB of cached data, hundreds of nodes.'
  ].join('\n'),
  hints: [
    'Shard keys across nodes with consistent hashing (with virtual nodes) so adding or removing a node moves only a fraction of keys.',
    'Clients (or a proxy layer) know the ring and talk to the right node directly.',
    'Eviction: LRU or LFU per node, plus TTLs as a safety net.',
    'Replication: each shard has a replica; promote it when the primary fails.',
    'Stale data: cache-aside with delete-on-write, versioned keys, or CDC-driven invalidation. Say which and why.',
    'Stampede protection: single-flight loading and jittered TTLs so a popular expiring key does not hit the database 10,000 times.',
    'Hot keys: replicate them to several nodes or keep a tiny local cache in the client.'
  ],
  topics: ['Consistent hashing', 'Client-side routing', 'LRU / LFU + TTL', 'Replication + failover', 'Invalidation strategy', 'Stampede protection', 'Hot keys'],
  brief: {
    ask: 'Build the memory layer in front of a database that answers most reads in under a millisecond and survives machines dying.',
    examples: [
      'A product page reads product:123 50,000 times a second; the database sees it a few times a minute.',
      'A cache node dies at 3 am; reads move to its replica and the database load barely changes.',
      'A price changes in the database; readers see the new price within a second.',
      'A popular key expires and 20,000 requests miss at once; only one reaches the database.'
    ],
    deliver: ['How keys are distributed across nodes', 'Eviction, TTL, and invalidation', 'Replication and failover', 'Stampede and hot-key protection']
  }
});

DesignCatalog.add({
  id: 'kv-store', difficulty: 'hard', cat: 'Infrastructure',
  title: 'Design a Distributed Key-Value Store',
  prompt: [
    'Design a horizontally scalable key-value store (like Dynamo or Cassandra) that stays available and fast across hundreds of nodes and several datacenters, and survives node and network failures.',
    '',
    'Scale: 10 PB of data, 5M operations per second, single-digit millisecond latency, and a clear answer for what a read returns after a write that raced a network partition.'
  ].join('\n'),
  hints: [
    'Partition with consistent hashing; replicate each key to N nodes (e.g. N=3) on the ring.',
    'Tunable quorums: write to W replicas, read from R; R + W > N gives read-your-writes for a single key.',
    'Choose AP or CP per use case: Dynamo-style stores stay available during partitions and reconcile later.',
    'Conflicts: last-write-wins with timestamps (simple, can lose writes) or vector clocks with client merge.',
    'Hinted handoff stores writes for a down replica on another node; read repair and anti-entropy (Merkle trees) fix divergence.',
    'Storage engine: an LSM tree (memtable + write-ahead log + sorted SSTables + compaction) gives fast writes.',
    'Membership and failure detection via gossip.'
  ],
  topics: ['Consistent hashing + replication', 'Quorums (R, W, N)', 'AP vs CP', 'Conflict resolution', 'Hinted handoff + read repair', 'LSM tree storage', 'Gossip membership'],
  brief: {
    ask: 'Build a database that stores data as key → value across hundreds of machines and keeps working when some of them fail.',
    examples: [
      'An app writes cart:alice = [shoes, hat]; the write is stored on 3 machines.',
      'One of those machines dies; reads and writes for cart:alice keep working.',
      'A network split separates two datacenters for 5 minutes; both keep accepting writes, and they reconcile afterward.',
      'With R=2, W=2, N=3, Alice always reads her own latest write.'
    ],
    deliver: ['Partitioning and replication', 'Quorum reads and writes', 'What happens during a partition and how conflicts resolve', 'The storage engine on each node']
  }
});

DesignCatalog.add({
  id: 'google-maps', difficulty: 'hard', cat: 'Maps',
  title: 'Design Google Maps',
  prompt: [
    'Design a mapping service: show map tiles at any zoom level, search places, compute driving directions, and estimate arrival times using live traffic.',
    '',
    'Scale: 1B monthly users, tiles for the whole planet at 20 zoom levels, millions of route requests per minute, and traffic that changes by the minute.'
  ].join('\n'),
  hints: [
    'Split into map display (tiles), search (geocoding and places), and routing (directions + ETA).',
    'Tiles: pre-render vector tiles per zoom level and tile coordinate, store them in object storage, and serve through a CDN. Most tiles never change.',
    'Routing on a road graph: plain Dijkstra on a continent is too slow. Precompute shortcuts (contraction hierarchies) so queries touch few nodes.',
    'Live traffic: aggregate anonymized phone speeds per road segment into current edge weights; recompute ETAs with them.',
    'Shard the road graph by region; long routes stitch regional results.',
    'Geocoding: turn "1600 Amphitheatre Pkwy" into coordinates using a search index.',
    'Navigation: the client re-requests routes when off-route or when traffic changes significantly.'
  ],
  topics: ['Map tiles + CDN', 'Zoom levels', 'Road graph', 'Contraction hierarchies', 'Live traffic weights', 'Geocoding', 'Re-routing'],
  brief: {
    ask: 'Build a map app: show the map anywhere, find places, and give the fastest driving route with live traffic.',
    examples: [
      'A user pans across Paris and zooms in; the map tiles appear instantly.',
      'She searches "Eiffel Tower" and the pin appears in 200 ms.',
      'She asks for driving directions to Lyon; a route and "4 h 12 min" appear in under a second.',
      'An accident blocks the highway; her app suggests a faster route 2 minutes later.'
    ],
    deliver: ['How map tiles are stored and served', 'How routes are computed fast', 'How live traffic changes ETAs', 'How place search works']
  }
});

/* ---------------- kept from the original set ---------------- */

DesignCatalog.add({
  id: 'core-bank', difficulty: 'hard', cat: 'Banking',
  title: 'Design an Online Banking System',
  prompt: [
    'Design the core of an online bank: customers open accounts, see balances and statements, and transfer money; the bank accrues interest, screens for fraud, and reports to regulators.',
    '',
    'Strong consistency, full auditability, and an end-of-day batch matter as much as throughput. Money must never be created or lost.'
  ].join('\n'),
  hints: [
    'The core ledger is double-entry and append-only; account balances are projections with periodic snapshots.',
    'A transfer is one ACID transaction across both accounts; idempotency keys and a state machine prevent double posting.',
    'Interest and fees accrue daily and post at cutoffs; the end-of-day batch is a controlled, restartable job.',
    'Regulatory reporting reads a warehouse fed by change data capture, never the hot core database.',
    'Fraud/AML checks run before posting for high-risk transfers and asynchronously for monitoring.',
    'Every change is auditable: who, what, when, before/after, and the originating channel.',
    'Reconciliation compares the core ledger with external payment rails; breaks are investigated, never silently adjusted.'
  ],
  topics: ['Double-entry ledger', 'ACID transfers', 'Idempotency', 'End-of-day batch', 'Interest accrual', 'Audit trail', 'Fraud / AML', 'Reconciliation'],
  brief: {
    ask: 'Build an online bank where customers move money and check balances, and every cent is always correct and explainable.',
    examples: [
      'A customer moves $500 from checking to savings in the app; both balances change together or neither does.',
      'The app retries the transfer after a timeout; only one $500 transfer happens.',
      'At midnight, interest is added to 2M savings accounts; if the job crashes at 60%, it resumes without paying anyone twice.',
      'A suspicious $9,900 transfer is held for review before it posts.'
    ],
    deliver: ['The ledger model and how a transfer posts', 'How retries never double-post', 'End-of-day batch and interest', 'Fraud checks, audit, and reporting']
  }
});

DesignCatalog.install();
