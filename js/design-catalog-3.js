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
  },
  map: {
    subtitle: 'Redirect first, count in a stream, dedupe by click id, reconcile in batch',
    nodes: [
      ['user', 'User', 'Clicks an ad', 'Client', 'Clicks an ad in an app or page.', ['Expects instant redirect.']],
      ['click', 'Click handler', 'Redirect + log', 'Edge', 'Redirects immediately and emits a click event.', ['Assigns click id.']],
      ['kafka', 'Click stream', 'Kafka', 'Async', 'Durable, partitioned click events.', ['Partition by ad id.']],
      ['flink', 'Stream processor', 'Dedup + window', 'Service', 'Dedupes by click id and counts per ad per minute.', ['Event-time windows.']],
      ['raw', 'Raw event lake', 'Object storage', 'Data', 'Every raw click for audits and recounts.', ['Cheap, immutable.']],
      ['olap', 'OLAP store', 'Counts per minute', 'Data', 'Aggregates for dashboards.', ['Fast group-by queries.']],
      ['batch', 'Batch recount', 'Nightly', 'Async', 'Recomputes counts from raw events.', ['Corrects drift.']],
      ['dash', 'Dashboards', 'Query service', 'Service', 'Serves charts to advertisers.', ['Reads OLAP.']],
      ['adv', 'Advertiser', 'Web dashboard', 'Client', 'Watches campaign performance.', ['Billed monthly.']],
      ['site', 'Advertiser site', 'Landing page', 'Client', 'Where the click redirects to.', ['External.']]
    ],
    edges: [
      ['user', 'click', 'click', 'sync', 'Tap on an ad.'],
      ['click', 'site', '302 redirect', 'sync', 'Send the user on immediately.'],
      ['click', 'kafka', 'click event', 'async', 'Log the click.'],
      ['kafka', 'flink', 'consume', 'async', 'Stream processing.'],
      ['kafka', 'raw', 'archive', 'async', 'Keep every raw event.'],
      ['flink', 'olap', 'minute counts', 'async', 'Write aggregates.'],
      ['batch', 'raw', 'recount', 'async', 'Read raw events.'],
      ['batch', 'olap', 'corrected', 'async', 'Overwrite with exact counts.'],
      ['adv', 'dash', 'view', 'sync', 'Open a report.'],
      ['dash', 'olap', 'query', 'sync', 'Read aggregates.'],
      ['dash', 'adv', 'charts', 'sync', 'Charts and totals.']
    ],
    flow: [
      ['Click an ad', 'Redirect the user immediately and log the click to the stream.', 'user>click, click>site, click>kafka'],
      ['Count clicks', 'The stream processor dedupes and aggregates per minute; raw events are archived.', 'kafka>flink, flink>olap, kafka>raw'],
      ['View and bill', 'Dashboards read aggregates; a nightly recount corrects them for billing.', 'adv>dash, dash>olap, dash>adv, batch>raw, batch>olap']
    ],
    why: [
      'The redirect never waits on counting, so users never notice the pipeline.',
      'Click ids make duplicate deliveries harmless.',
      'Windowed stream counts give near-real-time dashboards cheaply.',
      'A batch recount from raw events gives billing-grade accuracy.'
    ],
    tradeoffs: [
      'Longer dedup windows catch more duplicates but need more state.',
      'Waiting longer for late events is more accurate but delays dashboards.',
      'Key salting fixes hot ads but adds a merge step.'
    ],
    failures: [
      ['Stream processor lag', 'flink', 'olap dash', 'Dashboards fall minutes behind during a traffic spike.', 'Scale processors, show data freshness on dashboards, and rely on Kafka to buffer.']
    ]
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
  },
  map: {
    subtitle: 'Approximate counts per partition, merged into a top K per window',
    nodes: [
      ['producers', 'Apps', 'View events', 'Client', 'Emit an event per view or search.', ['Pre-aggregate hot items.']],
      ['ingest', 'Ingest API', 'Batch events', 'Edge', 'Accepts batched events.', ['Validates and samples.']],
      ['stream', 'Event stream', 'Kafka', 'Async', 'Partitioned by item id.', ['Durable buffer.']],
      ['counters', 'Counters', 'Sketch + heap', 'Service', 'Count-Min Sketch and local top K per partition.', ['Fixed memory.']],
      ['merger', 'Merger', 'Global top K', 'Service', 'Merges partial top K lists per window.', ['Every few seconds.']],
      ['results', 'Results store', 'Top K per window', 'Data', 'Latest lists for minute, hour, day, region.', ['Tiny and fast.']],
      ['api', 'Trending API', 'GET /trending', 'Service', 'Serves the latest list.', ['Cached at the edge.']],
      ['viewer', 'Viewer', 'Trending page', 'Client', 'Sees what is trending.', ['Refreshes often.']]
    ],
    edges: [
      ['producers', 'ingest', 'events', 'sync', 'Batched view events.'],
      ['ingest', 'stream', 'append', 'async', 'Partition by item.'],
      ['stream', 'counters', 'consume', 'async', 'Count per partition.'],
      ['counters', 'merger', 'local top K', 'async', 'Partial results each window.'],
      ['merger', 'results', 'global top K', 'async', 'Write the merged list.'],
      ['viewer', 'api', 'trending', 'sync', 'Ask for the list.'],
      ['api', 'results', 'read', 'sync', 'Latest list for the window.'],
      ['api', 'viewer', 'list', 'sync', 'Top items.']
    ],
    flow: [
      ['Count views', 'Events stream into partition counters that keep a sketch and a local top K.', 'producers>ingest, ingest>stream, stream>counters'],
      ['Compute trending', 'Partial lists merge into a global top K per window.', 'counters>merger, merger>results'],
      ['Show trending', 'The API reads the latest list.', 'viewer>api, api>results, api>viewer']
    ],
    why: [
      'A sketch counts hundreds of millions of items in fixed memory.',
      'Partitioning by item lets each counter work independently.',
      'Merging small partial lists is cheap compared to merging raw counts.',
      'Readers never compute anything; they read a ready list.'
    ],
    tradeoffs: [
      'Sketches overestimate rare items slightly; fine for trending, not billing.',
      'Shorter windows react faster but are noisier.',
      'Per-region lists multiply storage and merge work.'
    ],
    failures: [
      ['Counter partition lost', 'counters', 'merger results', 'Items in that partition vanish from trending until it recovers.', 'Rebuild from Kafka offsets and keep the last good list while recovering.']
    ]
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
  },
  map: {
    subtitle: 'An in-memory geo index for a location firehose, and a durable trip state machine',
    nodes: [
      ['rider', 'Rider app', 'Request + track', 'Client', 'Requests rides and tracks the driver.', ['Live ETA.']],
      ['driver', 'Driver app', 'Location + offers', 'Client', 'Streams location and accepts offers.', ['Every 4 seconds.']],
      ['gw', 'API gateway', 'Route by city', 'Edge', 'Entry point for riders and drivers.', ['Holds live connections.']],
      ['loc', 'Location service', 'Latest position', 'Service', 'Ingests pings and updates the geo index.', ['No DB row per ping.']],
      ['geo', 'Geo index', 'H3 cells, memory', 'Data', 'Available drivers per cell.', ['Sharded by city.']],
      ['match', 'Matching', 'Offer loop', 'Service', 'Finds nearby drivers, ranks by ETA, offers one at a time.', ['Timeout and retry.']],
      ['trips', 'Trip service', 'State machine', 'Service', 'Owns the trip from request to completion.', ['Idempotent transitions.']],
      ['tripdb', 'Trip store', 'Durable trips', 'Data', 'Trips and their state history.', ['Source of truth.']],
      ['notify', 'Push / live', 'Offers + updates', 'Async', 'Sends offers to drivers and status to riders.', ['WebSocket + push.']]
    ],
    edges: [
      ['driver', 'gw', 'location ping', 'sync', 'Every 4 seconds.'],
      ['gw', 'loc', 'update', 'sync', 'Route to the city shard.'],
      ['loc', 'geo', 'move driver', 'sync', 'Update the driver\'s cell.'],
      ['rider', 'gw', 'request ride', 'sync', 'Pickup location.'],
      ['gw', 'trips', 'create trip', 'sync', 'State: requested.'],
      ['trips', 'tripdb', 'save', 'sync', 'Persist the trip.'],
      ['trips', 'match', 'find driver', 'sync', 'Start matching.'],
      ['match', 'geo', 'nearby available', 'sync', 'Query nearby cells.'],
      ['match', 'notify', 'offer', 'async', 'Offer to one driver.'],
      ['notify', 'driver', 'ride offer', 'async', 'Accept within 15 s.'],
      ['driver', 'trips', 'accept', 'sync', 'Conditional: still requested?'],
      ['trips', 'notify', 'matched', 'async', 'Tell the rider.'],
      ['notify', 'rider', 'driver on the way', 'async', 'Driver details and ETA.'],
      ['trips', 'gw', 'trip id', 'sync', 'Request accepted.'],
      ['gw', 'rider', 'searching…', 'sync', 'Immediate response.']
    ],
    flow: [
      ['Drivers report location', 'Each ping updates the driver\'s cell in the in-memory index.', 'driver>gw, gw>loc, loc>geo'],
      ['Request a ride', 'Create the trip, then search nearby cells and offer to the best driver.', 'rider>gw, gw>trips, trips>tripdb, trips>gw, gw>rider, trips>match, match>geo, match>notify, notify>driver'],
      ['Driver accepts', 'A conditional transition assigns the driver once and tells the rider.', 'driver>trips, trips>notify, notify>rider']
    ],
    why: [
      'Keeping only the latest location in memory turns 250k writes/s into cheap updates.',
      'Geo cells make "nearby" a small set of lookups.',
      'Sharding by city keeps each index small and local.',
      'The trip is the durable unit; location can be lossy, trips cannot.'
    ],
    tradeoffs: [
      'Frequent pings improve accuracy but cost battery and write load.',
      'Offering to one driver at a time is fair but slower than broadcasting.',
      'City sharding struggles with trips that cross region boundaries.'
    ],
    failures: [
      ['Geo index shard down', 'geo', 'match loc', 'Riders in that city cannot be matched even though drivers are online.', 'Replicate shards in memory and rebuild in seconds from the live ping stream.']
    ]
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
  },
  map: {
    subtitle: 'Partitioned, replicated append-only logs with consumer-owned offsets',
    nodes: [
      ['producer', 'Producers', 'Services', 'Client', 'Append messages to topics.', ['Choose partition by key.']],
      ['broker', 'Leader broker', 'Partition leader', 'Service', 'Accepts writes and serves reads for its partitions.', ['Sequential disk writes.']],
      ['follower', 'Follower brokers', 'Replicas', 'Service', 'Copy the leader\'s log.', ['Take over on failure.']],
      ['log', 'Partition log', 'Append-only files', 'Data', 'Ordered messages with offsets.', ['Retention by time/size.']],
      ['coord', 'Controller', 'Metadata + leaders', 'Service', 'Tracks brokers, partitions, and leaders.', ['Consensus (Raft).']],
      ['groups', 'Group offsets', 'Offsets + members', 'Data', 'Committed offsets and partition assignments.', ['Rebalances on change.']],
      ['consumer', 'Consumer groups', 'Billing, email…', 'Client', 'Read at their own pace and commit offsets.', ['Replay by resetting offsets.']]
    ],
    edges: [
      ['producer', 'coord', 'metadata', 'sync', 'Which broker leads this partition?'],
      ['producer', 'broker', 'append', 'sync', 'Write to the partition leader.'],
      ['broker', 'log', 'write', 'sync', 'Append to the segment.'],
      ['broker', 'follower', 'replicate', 'async', 'Followers fetch new messages.'],
      ['broker', 'producer', 'ack', 'sync', 'After in-sync replicas have it.'],
      ['consumer', 'groups', 'join / commit', 'sync', 'Get partitions and record progress.'],
      ['consumer', 'broker', 'fetch from offset', 'sync', 'Read the next batch.'],
      ['broker', 'consumer', 'messages', 'sync', 'Batch of messages.'],
      ['coord', 'follower', 'promote', 'async', 'New leader on failure.']
    ],
    flow: [
      ['Publish a message', 'Find the leader, append, replicate to followers, and acknowledge.', 'producer>coord, producer>broker, broker>log, broker>follower, broker>producer'],
      ['Consume messages', 'Join a group, fetch from the committed offset, process, and commit progress.', 'consumer>groups, consumer>broker, broker>consumer, consumer>groups'],
      ['Survive a broker failure', 'The controller promotes an in-sync follower to leader.', 'coord>follower']
    ],
    why: [
      'An append-only log makes writes sequential and replay trivial.',
      'Partitions give parallelism; keys give per-entity ordering.',
      'Consumers own their offsets, so groups never interfere with each other.',
      'Replication with in-sync acknowledgements survives broker loss.'
    ],
    tradeoffs: [
      'acks=all is durable but slower than acks=1.',
      'More partitions mean more parallelism but more overhead and slower failover.',
      'Ordering is only per partition, never across a whole topic.'
    ],
    failures: [
      ['Leader broker dies', 'broker', 'producer consumer', 'Writes and reads for its partitions pause until a new leader is chosen.', 'The controller promotes an in-sync follower within seconds; clients refresh metadata and retry.']
    ]
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
  },
  map: {
    subtitle: 'Store first, deliver over live connections, catch up by sequence number',
    nodes: [
      ['sender', 'Sender', 'Phone / web', 'Client', 'Sends messages over a WebSocket.', ['Retries until acked.']],
      ['gw', 'Chat gateways', 'WebSockets', 'Edge', 'Hold millions of live connections.', ['Stateless apart from sockets.']],
      ['chat', 'Message service', 'Order + store', 'Service', 'Assigns a sequence number and stores the message.', ['Idempotent by client id.']],
      ['sessions', 'Session registry', 'User → gateway', 'Data', 'Which gateway each device is connected to.', ['TTL heartbeats.']],
      ['msgs', 'Message store', 'Per conversation', 'Data', 'Durable, ordered messages.', ['Wide-column, by conversation.']],
      ['fanout', 'Fan-out workers', 'Groups', 'Async', 'Deliver to every member of a group.', ['Async for big groups.']],
      ['push', 'Push service', 'APNs / FCM', 'Async', 'Wakes offline phones.', ['Shows a notification.']],
      ['presence', 'Presence', 'Online / last seen', 'Service', 'Tracks online status from heartbeats.', ['Lossy by design.']],
      ['recipient', 'Recipient', 'All devices', 'Client', 'Receives messages and sends receipts.', ['Syncs from last sequence.']]
    ],
    edges: [
      ['sender', 'gw', 'send', 'sync', 'Message with a client id.'],
      ['gw', 'chat', 'message', 'sync', 'Order and store.'],
      ['chat', 'msgs', 'append', 'sync', 'Durable write with sequence number.'],
      ['chat', 'gw', 'ack + seq', 'sync', 'Stored.'],
      ['gw', 'sender', 'sent ✓', 'sync', 'The sender sees one check.'],
      ['chat', 'fanout', 'deliver', 'async', 'Find recipients.'],
      ['fanout', 'sessions', 'where are they?', 'sync', 'Look up gateways.'],
      ['fanout', 'gw', 'deliver', 'async', 'To each recipient\'s gateway.'],
      ['gw', 'recipient', 'new message', 'async', 'Pushed over the socket.'],
      ['fanout', 'push', 'offline', 'async', 'No live session.'],
      ['push', 'recipient', 'notification', 'async', 'Wake the phone.'],
      ['recipient', 'chat', 'sync since seq', 'sync', 'Catch up after reconnect.'],
      ['recipient', 'presence', 'heartbeat', 'async', 'I am online.']
    ],
    flow: [
      ['Send a message', 'Store it with a sequence number, then acknowledge the sender.', 'sender>gw, gw>chat, chat>msgs, chat>gw, gw>sender'],
      ['Deliver it', 'Find each recipient\'s gateway and push; wake offline phones.', 'chat>fanout, fanout>sessions, fanout>gw, gw>recipient, fanout>push, push>recipient'],
      ['Come back online', 'The device asks for everything after its last sequence number.', 'recipient>chat, recipient>presence']
    ],
    why: [
      'Storing before delivering means a crash can never lose an acknowledged message.',
      'Per-conversation sequence numbers give ordering and gap detection.',
      'A session registry routes messages to whichever gateway holds the socket.',
      'Presence is lossy on purpose, so it never burdens message delivery.'
    ],
    tradeoffs: [
      'End-to-end encryption protects users but limits server-side features like search.',
      'Synchronous group fan-out is simple but slow for large groups.',
      'Keeping all history server-side helps new devices but costs storage.'
    ],
    failures: [
      ['Gateway server crashes', 'gw', 'recipient sessions', 'Users connected to it disconnect; in-flight deliveries to them fail.', 'Clients reconnect to another gateway and sync from their last sequence number; nothing is lost because messages were stored first.']
    ]
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
  },
  map: {
    subtitle: 'Resumable uploads, parallel transcoding, CDN delivery for a long tail',
    nodes: [
      ['creator', 'Creator', 'Upload app', 'Client', 'Uploads videos.', ['Resumable chunks.']],
      ['viewer', 'Viewer', 'Player', 'Client', 'Watches with adaptive bitrate.', ['Picks quality per segment.']],
      ['cdn', 'CDN', 'Video segments', 'Edge', 'Serves segments near viewers.', ['Fills on demand.']],
      ['api', 'API gateway', 'Upload + watch', 'Edge', 'Entry point for metadata and playback.', ['Signed URLs.']],
      ['upload', 'Upload service', 'Pre-signed URLs', 'Service', 'Creates the video record and upload URLs.', ['Bytes go straight to storage.']],
      ['transcode', 'Transcoders', 'Parallel encode', 'Async', 'Encode segments into many resolutions.', ['Split, encode, stitch.']],
      ['raw', 'Raw uploads', 'Object storage', 'Data', 'Original files.', ['Kept for re-encoding.']],
      ['segments', 'Video segments', 'Object storage', 'Data', 'Encoded segments + manifests.', ['CDN origin.']],
      ['meta', 'Video metadata', 'Title, status', 'Data', 'Video records and processing status.', ['Sharded by video id.']],
      ['views', 'View pipeline', 'Counts + recs', 'Async', 'Aggregates view events.', ['Eventually consistent.']]
    ],
    edges: [
      ['creator', 'api', 'start upload', 'sync', 'Request an upload.'],
      ['api', 'upload', 'create video', 'sync', 'New video record.'],
      ['upload', 'meta', 'status: uploading', 'sync', 'Save the record.'],
      ['upload', 'api', 'upload URLs', 'sync', 'Pre-signed chunk URLs.'],
      ['api', 'creator', 'URLs', 'sync', 'Where to send bytes.'],
      ['creator', 'raw', 'upload chunks', 'sync', 'Direct, resumable.'],
      ['raw', 'transcode', 'new file', 'async', 'Start encoding.'],
      ['transcode', 'segments', 'renditions', 'async', 'Write encoded segments.'],
      ['transcode', 'meta', 'status: ready', 'async', 'Playable.'],
      ['viewer', 'api', 'watch', 'sync', 'Get the manifest.'],
      ['api', 'viewer', 'manifest', 'sync', 'Segment URLs.'],
      ['viewer', 'cdn', 'segments', 'sync', 'Stream chunk by chunk.'],
      ['cdn', 'segments', 'miss', 'sync', 'Fetch from origin.'],
      ['cdn', 'viewer', 'video', 'sync', 'Bytes from the edge.'],
      ['viewer', 'views', 'view event', 'async', 'Count the view.']
    ],
    flow: [
      ['Upload a video', 'Get pre-signed URLs and upload chunks straight to storage.', 'creator>api, api>upload, upload>meta, upload>api, api>creator, creator>raw'],
      ['Process it', 'Transcode workers encode renditions and mark the video ready.', 'raw>transcode, transcode>segments, transcode>meta'],
      ['Watch it', 'Get the manifest, stream segments from the CDN, and log the view.', 'viewer>api, api>viewer, viewer>cdn, cdn>segments, cdn>viewer, viewer>views']
    ],
    why: [
      'Direct uploads keep large bytes off API servers.',
      'Parallel segment encoding makes long videos ready in minutes.',
      'A CDN carries almost all egress; the origin sees only misses.',
      'Views are counted asynchronously, so popularity never slows playback.'
    ],
    tradeoffs: [
      'Encoding every rendition up front costs compute for videos nobody watches.',
      'Long-tail videos miss the CDN, so first plays are slower.',
      'Exact real-time view counts are expensive; approximate counts are fine.'
    ],
    failures: [
      ['Transcode backlog', 'transcode', 'segments meta', 'Uploads succeed but stay "processing" for hours.', 'Autoscale workers on queue depth and encode a low resolution first so videos play sooner.']
    ]
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
  },
  map: {
    subtitle: 'Gather candidates by hybrid fan-out, rank with features, cache per user',
    nodes: [
      ['app', 'App', 'Feed screen', 'Client', 'Loads and scrolls the feed.', ['Cursor pagination.']],
      ['gw', 'API gateway', 'Auth + routing', 'Edge', 'Entry point.', ['Rate limits.']],
      ['feed', 'Feed service', 'Assemble', 'Service', 'Gathers candidates, ranks, and returns a page.', ['Caches results briefly.']],
      ['inbox', 'Inbox store', 'Pushed post ids', 'Data', 'Post ids fanned out to each user.', ['Bounded length.']],
      ['popular', 'Popular sources', 'Pulled at read', 'Data', 'Recent posts from very popular pages.', ['Not fanned out.']],
      ['ranker', 'Ranker', 'ML model', 'Service', 'Scores candidates and returns the best.', ['Thousands per request.']],
      ['features', 'Feature store', 'Affinity, likes', 'Data', 'Precomputed signals for ranking.', ['Updated async.']],
      ['posts', 'Post service', 'Create + hydrate', 'Service', 'Stores posts and emits new-post events.', ['Hydrates ids.']],
      ['fanout', 'Fan-out workers', 'Push to inboxes', 'Async', 'Push new post ids to followers.', ['Skips huge sources.']],
      ['events', 'Engagement', 'Likes, dwell', 'Async', 'User actions flowing back.', ['Update features.']]
    ],
    edges: [
      ['app', 'gw', 'get feed', 'sync', 'Open or scroll.'],
      ['gw', 'feed', 'feed page', 'sync', 'With cursor.'],
      ['feed', 'inbox', 'my candidates', 'sync', 'Pushed post ids.'],
      ['feed', 'popular', 'pull', 'sync', 'Posts from popular sources.'],
      ['feed', 'ranker', 'rank', 'sync', 'Score candidates.'],
      ['ranker', 'features', 'signals', 'sync', 'Read features.'],
      ['ranker', 'feed', 'top posts', 'sync', 'Ranked ids.'],
      ['feed', 'posts', 'hydrate', 'sync', 'Fetch post content.'],
      ['feed', 'gw', 'page', 'sync', 'Ranked page.'],
      ['gw', 'app', 'response', 'sync', 'The user sees posts.'],
      ['posts', 'fanout', 'new post', 'async', 'Start fan-out.'],
      ['fanout', 'inbox', 'push id', 'async', 'Into followers\' inboxes.'],
      ['app', 'events', 'engagement', 'async', 'Likes, comments, dwell time.'],
      ['events', 'features', 'update', 'async', 'Refresh ranking signals.']
    ],
    flow: [
      ['Open the feed', 'Gather pushed and pulled candidates, rank with features, hydrate, and return.', 'app>gw, gw>feed, feed>inbox, feed>popular, feed>ranker, ranker>features, ranker>feed, feed>posts, feed>gw, gw>app'],
      ['A friend posts', 'The new post id is pushed into followers\' inboxes.', 'posts>fanout, fanout>inbox'],
      ['Engage', 'Likes and dwell time update features for future ranking.', 'app>events, events>features']
    ],
    why: [
      'Hybrid fan-out keeps inboxes cheap without exploding writes for huge sources.',
      'Ranking only a few thousand candidates keeps model cost bounded.',
      'Precomputed features make ranking fast at request time.',
      'The engagement loop makes the feed improve as users interact.'
    ],
    tradeoffs: [
      'More candidates improve quality but slow ranking.',
      'Caching ranked feeds saves compute but delays new posts.',
      'Optimizing engagement alone can surface low-quality content.'
    ],
    failures: [
      ['Ranker overloaded', 'ranker', 'feed', 'Feeds load slowly or time out.', 'Fall back to a simple recency order and cache recent ranked feeds.']
    ]
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
  },
  map: {
    subtitle: 'Media bytes at the edge, metadata in shards, feeds in a hybrid fan-out',
    nodes: [
      ['app', 'App', 'iOS / Android', 'Client', 'Uploads photos and reads the feed.', ['Optimistic likes.']],
      ['cdn', 'CDN', 'Image cache', 'Edge', 'Serves images near viewers.', ['Signed URLs.']],
      ['gw', 'API gateway', 'Auth + routing', 'Edge', 'Entry point.', ['Rate limits uploads.']],
      ['upload', 'Post service', 'Create post', 'Service', 'Issues upload URLs and saves post metadata.', ['Returns before processing.']],
      ['media', 'Image processing', 'Sizes + thumbs', 'Async', 'Creates every image size.', ['Idempotent per image.']],
      ['blobs', 'Object storage', 'Originals + sizes', 'Data', 'Durable image files.', ['CDN origin.']],
      ['meta', 'Metadata DB', 'Posts, sharded', 'Data', 'Posts, captions, image keys.', ['Sharded by user.']],
      ['fanout', 'Fan-out workers', 'Push to feeds', 'Async', 'Push post ids to followers.', ['Skips celebrities.']],
      ['feed', 'Feed service', 'Merge + hydrate', 'Service', 'Reads feed ids, merges celebrity posts, hydrates.', ['Cursor pagination.']],
      ['feedcache', 'Feed cache', 'User → post ids', 'Data', 'Precomputed feed ids per user.', ['Bounded.']]
    ],
    edges: [
      ['app', 'gw', 'HTTPS', 'sync', 'Post and read.'],
      ['gw', 'upload', 'new post', 'sync', 'Start a post.'],
      ['upload', 'gw', 'upload URL', 'sync', 'Where to send bytes.'],
      ['gw', 'app', 'response', 'sync', 'URLs, confirmations, feed JSON.'],
      ['app', 'blobs', 'upload image', 'sync', 'Direct to storage.'],
      ['upload', 'meta', 'save post', 'sync', 'Caption + image key.'],
      ['blobs', 'media', 'new image', 'async', 'Make sizes.'],
      ['media', 'blobs', 'sizes', 'async', 'Write thumbnails.'],
      ['upload', 'fanout', 'new post', 'async', 'Start fan-out.'],
      ['fanout', 'feedcache', 'push id', 'async', 'Into followers\' feeds.'],
      ['gw', 'feed', 'home feed', 'sync', 'Read the feed.'],
      ['feed', 'feedcache', 'ids', 'sync', 'Precomputed ids.'],
      ['feed', 'meta', 'hydrate', 'sync', 'Posts and celebrity posts.'],
      ['feed', 'gw', 'feed', 'sync', 'Feed JSON with image URLs.'],
      ['app', 'cdn', 'images', 'sync', 'Load images.'],
      ['cdn', 'blobs', 'miss', 'sync', 'Fetch from origin.'],
      ['cdn', 'app', 'bytes', 'sync', 'Images from the edge.']
    ],
    flow: [
      ['Post a photo', 'Get an upload URL, upload directly, save the post, process sizes, and fan out.', 'app>gw, gw>upload, upload>gw, gw>app, app>blobs, upload>meta, blobs>media, media>blobs, upload>fanout, fanout>feedcache'],
      ['Load the feed', 'Read feed ids, hydrate posts, return JSON, then load images from the CDN.', 'app>gw, gw>feed, feed>feedcache, feed>meta, feed>gw, gw>app, app>cdn, cdn>blobs, cdn>app']
    ],
    why: [
      'Direct uploads keep large images off app servers.',
      'The CDN carries almost every image byte.',
      'Hybrid fan-out keeps normal feeds instant without 200M writes per celebrity post.',
      'Async processing lets the post appear quickly.'
    ],
    tradeoffs: [
      'Generating every size up front costs storage; on-the-fly resizing costs CPU.',
      'Eventual like counts are cheap but can look stale.',
      'Long CDN caching complicates takedowns.'
    ],
    failures: [
      ['CDN origin overload', 'blobs', 'cdn app', 'A viral post\'s images miss the CDN at once and overload storage.', 'Origin shielding, request coalescing, and pre-warming popular images.']
    ]
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
  },
  map: {
    subtitle: 'Consistent-hash shards with replicas, protected misses, and explicit invalidation',
    nodes: [
      ['app', 'App servers', 'Cache client', 'Client', 'Read through the cache, write to the database.', ['Knows the hash ring.']],
      ['ring', 'Cluster config', 'Hash ring', 'Service', 'Current ring and shard owners.', ['Pushed to clients.']],
      ['primary', 'Cache primaries', 'Shards in RAM', 'Data', 'Hold keys for their slice of the ring.', ['LRU + TTL.']],
      ['replica', 'Cache replicas', 'Hot standby', 'Data', 'Copy of each primary.', ['Promoted on failure.']],
      ['loader', 'Single-flight', 'Miss coalescing', 'Service', 'Lets one request load a missing key while others wait.', ['Per key.']],
      ['db', 'Database', 'Source of truth', 'Data', 'Durable data behind the cache.', ['Only sees misses and writes.']],
      ['cdc', 'Invalidation', 'CDC stream', 'Async', 'Deletes cached keys when rows change.', ['Ordered per key.']],
      ['health', 'Health monitor', 'Failure detection', 'Obs', 'Detects dead nodes and triggers failover.', ['Hit ratio alerts.']]
    ],
    edges: [
      ['ring', 'app', 'ring map', 'async', 'Clients learn shard owners.'],
      ['app', 'primary', 'get', 'sync', 'Direct to the owning shard.'],
      ['primary', 'app', 'hit / miss', 'sync', 'Value or miss.'],
      ['app', 'loader', 'on miss', 'sync', 'Coalesce concurrent misses.'],
      ['loader', 'db', 'load once', 'sync', 'One database read.'],
      ['loader', 'primary', 'fill', 'sync', 'Populate the cache.'],
      ['primary', 'replica', 'replicate', 'async', 'Keep the standby current.'],
      ['app', 'db', 'write', 'sync', 'Writes go to the database.'],
      ['db', 'cdc', 'row changed', 'async', 'Change event.'],
      ['cdc', 'primary', 'delete key', 'async', 'Invalidate.'],
      ['health', 'replica', 'promote', 'async', 'On primary failure.'],
      ['health', 'ring', 'update owners', 'async', 'New ring map.']
    ],
    flow: [
      ['Read a hot key', 'The client hashes the key and reads it from the owning shard.', 'ring>app, app>primary, primary>app'],
      ['Miss and fill', 'One coalesced load reads the database and fills the cache.', 'app>primary, primary>app, app>loader, loader>db, loader>primary'],
      ['Write and invalidate', 'Writes go to the database; CDC deletes the cached copy.', 'app>db, db>cdc, cdc>primary'],
      ['Node fails', 'The monitor promotes the replica and updates the ring.', 'health>replica, health>ring, ring>app']
    ],
    why: [
      'Consistent hashing moves only ~1/N of keys when the cluster changes.',
      'Replicas turn a node loss into a fast failover instead of a database flood.',
      'Single-flight caps database load from any one missing key.',
      'CDC invalidation keeps cache freshness independent of application code paths.'
    ],
    tradeoffs: [
      'Replication doubles memory cost.',
      'Delete-on-write has a small race with concurrent readers; versioned keys close it.',
      'Client-side routing is fastest but every client must track ring changes.'
    ],
    failures: [
      ['Primary node dies', 'primary', 'app db', 'Its keys miss until the replica takes over, and the database sees a spike.', 'Promote the replica within seconds and coalesce misses during the switch.']
    ]
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
  },
  map: {
    subtitle: 'Consistent-hash replicas, tunable quorums, and background repair',
    nodes: [
      ['client', 'Client', 'App + SDK', 'Client', 'Reads and writes keys.', ['Chooses consistency level.']],
      ['coord', 'Coordinator', 'Any node', 'Service', 'Receives a request and contacts the replicas.', ['Waits for R or W.']],
      ['replicas', 'Replica nodes', 'N per key', 'Data', 'Hold copies of each key on the ring.', ['Across racks/DCs.']],
      ['engine', 'Storage engine', 'LSM tree', 'Data', 'Memtable, WAL, SSTables, compaction.', ['Fast writes.']],
      ['hints', 'Hinted handoff', 'For down nodes', 'Async', 'Stores writes meant for an unreachable replica.', ['Replays on recovery.']],
      ['repair', 'Anti-entropy', 'Merkle trees', 'Async', 'Finds and fixes divergent replicas.', ['Plus read repair.']],
      ['gossip', 'Gossip', 'Membership', 'Service', 'Spreads node status and the ring.', ['Failure detection.']]
    ],
    edges: [
      ['client', 'coord', 'get / put', 'sync', 'With consistency level.'],
      ['coord', 'replicas', 'to N replicas', 'sync', 'Send to all replicas of the key.'],
      ['replicas', 'engine', 'write / read', 'sync', 'Local storage.'],
      ['replicas', 'coord', 'acks / values', 'sync', 'Wait for W acks or R values.'],
      ['coord', 'client', 'result', 'sync', 'Value or ack.'],
      ['coord', 'hints', 'replica down', 'async', 'Store a hint.'],
      ['hints', 'replicas', 'replay', 'async', 'Deliver when it recovers.'],
      ['repair', 'replicas', 'sync ranges', 'async', 'Compare Merkle trees.'],
      ['gossip', 'coord', 'ring + health', 'async', 'Who is alive and where keys live.']
    ],
    flow: [
      ['Write a key', 'The coordinator sends to N replicas and acknowledges after W succeed.', 'client>coord, coord>replicas, replicas>engine, replicas>coord, coord>client'],
      ['A replica is down', 'A hint is stored and replayed when the replica returns.', 'coord>hints, hints>replicas'],
      ['Background repair', 'Anti-entropy compares replicas and fixes differences.', 'repair>replicas, gossip>coord']
    ],
    why: [
      'Consistent hashing spreads data and limits movement when nodes change.',
      'Quorums let each use case choose between latency and consistency.',
      'Hinted handoff and repair keep the system available without losing writes.',
      'LSM trees turn random writes into sequential ones.'
    ],
    tradeoffs: [
      'Last-write-wins is simple but can silently drop concurrent writes.',
      'Higher R and W are more consistent but slower and less available.',
      'Compaction keeps reads fast but consumes I/O in the background.'
    ],
    failures: [
      ['Network partition', 'replicas', 'coord client', 'Replicas on each side accept different writes for the same key.', 'Stay available with sloppy quorums, then reconcile with vector clocks or last-write-wins and read repair.']
    ]
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
  },
  map: {
    subtitle: 'Pre-rendered tiles at the edge, precomputed road graph, live traffic weights',
    nodes: [
      ['app', 'Maps app', 'Map + navigation', 'Client', 'Shows tiles, searches, and navigates.', ['Sends anonymized speed.']],
      ['cdn', 'CDN', 'Map tiles', 'Edge', 'Serves pre-rendered tiles.', ['Almost all map traffic.']],
      ['gw', 'API gateway', 'Search + routes', 'Edge', 'Entry point for search and routing.', ['Rate limits.']],
      ['tiles', 'Tile storage', 'z / x / y tiles', 'Data', 'Pre-rendered vector tiles for every zoom.', ['CDN origin.']],
      ['render', 'Tile builder', 'Map data → tiles', 'Async', 'Renders tiles when map data changes.', ['Only changed areas.']],
      ['geocode', 'Place search', 'Geocoding', 'Service', 'Turns names and addresses into coordinates.', ['Search index.']],
      ['route', 'Routing', 'Shortcut graph', 'Service', 'Computes the fastest route with current weights.', ['Contraction hierarchies.']],
      ['graph', 'Road graph', 'By region', 'Data', 'Roads as nodes and edges with precomputed shortcuts.', ['Sharded by region.']],
      ['traffic', 'Traffic pipeline', 'Speeds per road', 'Async', 'Aggregates live speeds into edge weights.', ['Updates every minute.']]
    ],
    edges: [
      ['app', 'cdn', 'tiles', 'sync', 'Request tiles for the view.'],
      ['cdn', 'tiles', 'miss', 'sync', 'Fetch from origin.'],
      ['cdn', 'app', 'tile data', 'sync', 'Rendered on the device.'],
      ['render', 'tiles', 'rebuild', 'async', 'Write changed tiles.'],
      ['app', 'gw', 'search / route', 'sync', 'Search and directions.'],
      ['gw', 'geocode', 'find place', 'sync', 'Name → coordinates.'],
      ['geocode', 'gw', 'places', 'sync', 'Matches.'],
      ['gw', 'route', 'directions', 'sync', 'From A to B.'],
      ['route', 'graph', 'shortest path', 'sync', 'Query the shortcut graph.'],
      ['route', 'gw', 'route + ETA', 'sync', 'Path and time.'],
      ['gw', 'app', 'response', 'sync', 'Results on screen.'],
      ['app', 'traffic', 'speed', 'async', 'Anonymized speed reports.'],
      ['traffic', 'graph', 'edge weights', 'async', 'Live travel times.']
    ],
    flow: [
      ['Pan the map', 'Tiles come from the CDN; misses come from pre-rendered storage.', 'app>cdn, cdn>tiles, cdn>app'],
      ['Get directions', 'Find the place, then compute the route on the shortcut graph with live weights.', 'app>gw, gw>geocode, geocode>gw, gw>route, route>graph, route>gw, gw>app'],
      ['Update traffic', 'Phone speeds become live edge weights that change ETAs and routes.', 'app>traffic, traffic>graph']
    ],
    why: [
      'Pre-rendered tiles make the map a static-file problem solved by a CDN.',
      'Shortcuts let a route query touch thousands of nodes instead of millions.',
      'Live speeds turn the same road graph into accurate ETAs.',
      'Regional sharding keeps each graph in memory.'
    ],
    tradeoffs: [
      'Precomputed shortcuts must be rebuilt (partly) when weights change.',
      'Vector tiles are small but need device rendering; raster tiles are simpler but larger.',
      'More frequent traffic updates improve ETAs but cost compute.'
    ],
    failures: [
      ['Traffic pipeline stalls', 'traffic', 'graph route', 'ETAs use stale traffic and routes ignore new jams.', 'Fall back to historical speeds for that time of day and alert on pipeline lag.']
    ]
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
  },
  map: {
    subtitle: 'ACID core ledger, controlled batch, immutable audit, regulator-ready reporting',
    nodes: [
      ['app', 'Banking app', 'Mobile / web', 'Client', 'Customer channels.', ['Session + step-up auth.']],
      ['api', 'Channel API', 'Auth + validation', 'Edge', 'Unified entry point for all channels.', ['Idempotency per request.']],
      ['accounts', 'Account service', 'Balances + limits', 'Service', 'Opens accounts and serves balances.', ['Balances from the ledger.']],
      ['transfers', 'Transfer service', 'Orchestration', 'Service', 'Owns transfer state and external rails.', ['No partial postings.']],
      ['fraud', 'Fraud / AML', 'Screening', 'Service', 'Screens high-risk transfers before posting.', ['Case queue for review.']],
      ['ledger', 'Core ledger', 'Double-entry', 'Service', 'The bank\'s authoritative books.', ['One ACID transaction.']],
      ['core', 'Ledger DB', 'ACID + HA', 'Data', 'Strongly consistent storage for the books.', ['Synchronous replication.']],
      ['batch', 'End-of-day batch', 'Close + interest', 'Async', 'Runs the daily close and interest posting.', ['Checkpointed, restartable.']],
      ['dw', 'Data warehouse', 'CDC copy', 'Data', 'Reporting copy of the ledger.', ['Never written by reports.']],
      ['regulator', 'Regulator', 'Filings', 'Client', 'Receives periodic reports.', ['Immutable extracts.']]
    ],
    edges: [
      ['app', 'api', 'HTTPS', 'sync', 'Customer requests.'],
      ['api', 'accounts', 'balance', 'sync', 'Read account state.'],
      ['accounts', 'core', 'read', 'sync', 'Balances from the ledger.'],
      ['accounts', 'api', 'balance', 'sync', 'Account view.'],
      ['api', 'transfers', 'transfer', 'sync', 'Create a transfer with a key.'],
      ['transfers', 'fraud', 'screen', 'sync', 'Risk check first.'],
      ['transfers', 'ledger', 'post', 'sync', 'Debit and credit together.'],
      ['ledger', 'core', 'ACID commit', 'sync', 'One transaction.'],
      ['ledger', 'transfers', 'posted', 'sync', 'Committed result.'],
      ['transfers', 'api', 'receipt', 'sync', 'Transfer result.'],
      ['api', 'app', 'response', 'sync', 'The customer sees it.'],
      ['batch', 'ledger', 'accrue interest', 'async', 'Daily postings.'],
      ['core', 'dw', 'CDC', 'async', 'Replicate for reporting.'],
      ['dw', 'regulator', 'filings', 'async', 'Regulatory reports.']
    ],
    flow: [
      ['Check a balance', 'Read the balance projection from the ledger.', 'app>api, api>accounts, accounts>core, accounts>api, api>app'],
      ['Transfer money', 'Screen, post debit and credit in one ACID transaction, and return a receipt.', 'app>api, api>transfers, transfers>fraud, transfers>ledger, ledger>core, ledger>transfers, transfers>api, api>app'],
      ['Close the day', 'Accrue interest, replicate to the warehouse, and file reports.', 'batch>ledger, ledger>core, core>dw, dw>regulator']
    ],
    why: [
      'Double-entry plus ACID means a transfer can never leave one side posted.',
      'The append-only ledger makes every balance explainable and auditable.',
      'Checkpointed batches resume without double-paying interest.',
      'Reporting reads a warehouse, protecting the core from heavy queries.'
    ],
    tradeoffs: [
      'Strong consistency limits throughput; banks accept that for money.',
      'End-of-day batch is simple and auditable but delays some postings.',
      'Strict fraud checks reduce losses but block some legitimate transfers.'
    ],
    failures: [
      ['Ledger DB failover', 'core', 'ledger transfers', 'Transfers pause during failover; balances may still be readable.', 'Synchronous HA replicas, idempotent retries, and a read-only mode for balances.']
    ]
  }
});

DesignCatalog.install();
