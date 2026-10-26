/* Researched architecture maps, part 3 */

Object.assign(DESIGN_MAPS, {
  'ad-click-aggregator': {
    layers: ['Client', 'Edge', 'Gateway', 'Async', 'Service', 'Data', 'Obs'],
    subtitle: 'Redirect fast, log every click durably, aggregate in event-time windows, reconcile with batch',
    basedOn: 'Google Photon, Uber/Yelp ad pipelines (Flink + Kafka), lambda architecture',
    sources: [
      ['Photon: joining continuous data streams', 'https://research.google/pubs/photon-fault-tolerant-and-scalable-joining-of-continuous-data-streams/'],
      ['Uber: real-time exactly-once ad events', 'https://www.uber.com/blog/real-time-exactly-once-ad-event-processing/'],
      ['System Design School: Ad click aggregator', 'https://systemdesignschool.io/problems/ad-click-aggregator/solution']
    ],
    nodes: [
      ['user', 'User', 'Clicks an ad', 'Client', 'Clicks an ad and lands on the advertiser site.', []],
      ['redirect', 'Click redirect', 'Log + 302', 'Gateway', 'Records the click with a unique id and redirects.', ['Never waits on aggregation.']],
      ['log', 'Click log', 'Kafka, durable', 'Async', 'Every raw click, partitioned by ad id.', ['Hot ads salted across partitions.']],
      ['stream', 'Stream processor', 'Event-time windows', 'Service', 'Dedups by click id and counts per ad per minute using event time.', ['Watermarks handle late clicks.']],
      ['agg', 'Aggregate store', 'ad × minute', 'Data', 'Pre-aggregated counts, OLAP friendly.', []],
      ['raw', 'Raw archive', 'Object storage', 'Data', 'Every click for replay and audit.', []],
      ['batch', 'Batch recount', 'Hourly / daily', 'Async', 'Recounts from raw data and overwrites the streaming numbers.', ['The billing source of truth.']],
      ['query', 'Query API', 'Dashboards', 'Service', 'Serves counts by ad, campaign, and time range.', []],
      ['advertiser', 'Advertiser', 'Dashboard', 'Client', 'Watches spend and clicks.', []],
      ['fraud', 'Fraud filter', 'Bots + repeats', 'Service', 'Removes invalid clicks before billing.', []]
    ],
    edges: [
      ['user', 'redirect', 'click', 'sync', 'Ad click.'],
      ['redirect', 'log', 'click event', 'async', 'Durable.'],
      ['redirect', 'user', '302', 'sync', 'To the advertiser.'],
      ['log', 'stream', 'consume', 'async', 'Real time.'],
      ['stream', 'fraud', 'filter', 'sync', 'Invalid clicks.'],
      ['stream', 'agg', 'window counts', 'async', 'Per minute.'],
      ['log', 'raw', 'archive', 'async', 'Everything.'],
      ['batch', 'raw', 'recount', 'async', 'Exact.'],
      ['batch', 'agg', 'overwrite', 'async', 'Final numbers.'],
      ['advertiser', 'query', 'report', 'sync', 'Dashboard.'],
      ['query', 'agg', 'read', 'sync', 'Pre-aggregated.'],
      ['query', 'advertiser', 'counts', 'sync', 'Charts.']
    ],
    flow: [
      ['Click an ad', 'Log the click durably and redirect immediately.', 'user>redirect, redirect>log, redirect>user', 'write'],
      ['Count clicks live', 'Dedup, filter fraud, count per minute by event time.', 'log>stream, stream>fraud, stream>agg', 'background'],
      ['Recount for billing', 'Batch recounts raw clicks and overwrites the live numbers.', 'log>raw, batch>raw, batch>agg', 'background'],
      ['View a report', 'Advertisers read pre-aggregated counts.', 'advertiser>query, query>agg, query>advertiser', 'read']
    ],
    why: [
      'The redirect only logs; it never waits for counting, so users never feel it.',
      'A durable log lets the stream processor and batch job both replay the same truth.',
      'Event-time windows count a click in the minute it happened, even if it arrives late.',
      'Batch recount gives exact billing numbers; streaming gives fast dashboards.'
    ],
    tradeoffs: [
      'Lambda (stream + batch) is accurate but runs two pipelines.',
      'Longer watermarks catch more late clicks but delay results.',
      'Salting hot ad keys spreads load but needs a merge step.'
    ],
    failures: [
      ['Stream processor restarts', 'stream', 'agg', 'Counts pause or could double.', 'Checkpointed state, dedup by click id, and the batch recount as the backstop.']
    ]
  },

  'top-k': {
    layers: ['Client', 'Edge', 'Gateway', 'Async', 'Service', 'Data', 'Obs'],
    subtitle: 'Approximate counts with a count-min sketch per shard, merged into a cached top-K',
    basedOn: 'Count-min sketch, Twitter trending, Kafka Streams top-K',
    sources: [
      ['Count-min sketch', 'https://en.wikipedia.org/wiki/Count%E2%80%93min_sketch'],
      ['System Design School: Top K', 'https://systemdesignschool.io/problems/topk/solution']
    ],
    nodes: [
      ['events', 'Event sources', 'Views, plays', 'Client', 'Every view or play.', []],
      ['ingest', 'Ingest API', 'Batch', 'Gateway', 'Accepts events.', []],
      ['log', 'Partitioned log', 'By item id', 'Async', 'Events partitioned so one item goes to one shard.', []],
      ['shards', 'Counting shards', 'Sketch + heap', 'Service', 'Count-min sketch plus a min-heap of the top items per minute bucket.', ['Tiny memory.']],
      ['merge', 'Coordinator', 'K-way merge', 'Service', 'Merges shard heaps into a global top K per window.', []],
      ['topcache', 'Top-K cache', '1h, 1d, all', 'Data', 'Precomputed lists per window.', []],
      ['api', 'Query API', 'Top K', 'Service', 'Serves the lists.', []],
      ['viewer', 'Viewer', 'Trending page', 'Client', 'Reads the trending list.', []],
      ['raw', 'Raw events', 'Object storage', 'Data', 'Every event for exact counts.', []],
      ['exact', 'Exact batch job', 'Daily', 'Async', 'Exact counts to correct the approximation.', []]
    ],
    edges: [
      ['events', 'ingest', 'event', 'async', 'Fire and forget.'],
      ['ingest', 'log', 'append', 'async', 'Partition by item.'],
      ['log', 'shards', 'consume', 'async', 'Count.'],
      ['shards', 'merge', 'local top', 'async', 'Each minute.'],
      ['merge', 'topcache', 'global top K', 'async', 'Per window.'],
      ['log', 'raw', 'archive', 'async', 'Everything.'],
      ['exact', 'raw', 'count', 'async', 'Exact.'],
      ['exact', 'topcache', 'correct', 'async', 'Daily list.'],
      ['viewer', 'api', 'trending', 'sync', 'Read.'],
      ['api', 'topcache', 'get', 'sync', 'Precomputed.'],
      ['api', 'viewer', 'top K', 'sync', 'List.']
    ],
    flow: [
      ['Record a view', 'Events land in a log partitioned by item.', 'events>ingest, ingest>log', 'write'],
      ['Update the ranking', 'Shards count with a sketch and heap; the coordinator merges.', 'log>shards, shards>merge, merge>topcache', 'background'],
      ['See what\'s trending', 'Read the precomputed list.', 'viewer>api, api>topcache, api>viewer', 'read'],
      ['Correct with exact counts', 'A daily batch replaces the approximate list.', 'log>raw, exact>raw, exact>topcache', 'background']
    ],
    why: [
      'A count-min sketch counts millions of items in kilobytes with a small, bounded error.',
      'Partitioning by item means a shard\'s local top is accurate for its items, so merging is simple.',
      'Precomputed lists per window make reads instant.',
      'An exact batch job fixes the approximation for anything that needs precision.'
    ],
    tradeoffs: [
      'Sketches overestimate, never underestimate.',
      'Shorter buckets are fresher but more work to merge.',
      'Hot items concentrate on one partition.'
    ],
    failures: [
      ['Shard lag', 'shards', 'merge topcache', 'Trending list goes stale.', 'Scale consumers; serve the last good list.']
    ]
  },

  uber: {
    subtitle: 'Driver locations in an in-memory geo index by cell; matching reserves a driver with compare-and-set',
    basedOn: 'Uber (H3 hexagons, Ringpop sharding, DISCO dispatch)',
    sources: [
      ['Uber: H3', 'https://www.uber.com/blog/h3/'],
      ['Uber: Ringpop', 'https://www.uber.com/blog/ringpop-open-source-nodejs-library/'],
      ['System Design School: Uber', 'https://systemdesignschool.io/problems/uber/solution']
    ],
    nodes: [
      ['rider', 'Rider app', 'Request', 'Client', 'Requests a ride and watches the driver arrive.', []],
      ['driver', 'Driver app', 'GPS every 4 s', 'Client', 'Sends location and accepts trips.', []],
      ['locgw', 'Location gateway', 'Batch + shed', 'Gateway', 'Absorbs millions of GPS updates per second.', []],
      ['geo', 'Geo index', 'H3 cells, in memory', 'Data', 'Available drivers per hexagonal cell, sharded by cell.', ['Ringpop-style consistent hashing.']],
      ['api', 'Rider API', 'Requests', 'Gateway', 'Ride requests and trip status.', []],
      ['match', 'Matching', 'k-ring + ETA', 'Service', 'Searches nearby cells, ranks by ETA, offers to the best driver.', []],
      ['eta', 'ETA service', 'Road graph', 'Service', 'Travel time on the road network.', []],
      ['trips', 'Trip store', 'CAS reserve', 'Data', 'Trips; a driver is reserved with compare-and-set.', []],
      ['pubsub', 'Location stream', 'Per trip', 'Async', 'The assigned driver\'s position.', []],
      ['push', 'Push', 'Offer + updates', 'Async', 'Sends offers to drivers and updates to riders.', []],
      ['pricing', 'Surge pricing', 'Supply vs demand', 'Service', 'Price multiplier per cell.', []]
    ],
    edges: [
      ['driver', 'locgw', 'GPS', 'async', 'Every few seconds.'],
      ['locgw', 'geo', 'update cell', 'async', 'In memory.'],
      ['locgw', 'pubsub', 'on-trip position', 'async', 'For the rider.'],
      ['rider', 'api', 'request ride', 'sync', 'Pickup + destination.'],
      ['api', 'pricing', 'fare', 'sync', 'Quote.'],
      ['api', 'match', 'find driver', 'sync', 'Dispatch.'],
      ['match', 'geo', 'nearby cells', 'sync', 'k-ring search.'],
      ['match', 'eta', 'rank by ETA', 'sync', 'Road time.'],
      ['match', 'trips', 'reserve driver', 'sync', 'Compare-and-set.'],
      ['match', 'push', 'offer', 'async', 'To the driver.'],
      ['push', 'driver', 'offer', 'async', 'Accept?'],
      ['driver', 'api', 'accept', 'sync', 'Confirm.'],
      ['api', 'trips', 'assign', 'sync', 'Trip starts.'],
      ['api', 'rider', 'driver assigned', 'sync', 'Response.'],
      ['pubsub', 'push', 'position', 'async', 'Updates.'],
      ['push', 'rider', 'car on map', 'async', 'Live.']
    ],
    flow: [
      ['Drivers report location', 'GPS updates move drivers between cells in memory.', 'driver>locgw, locgw>geo', 'write'],
      ['Request a ride', 'Search nearby cells, rank by ETA, reserve one driver, send the offer.', 'rider>api, api>pricing, api>match, match>geo, match>eta, match>trips, match>push, push>driver', 'write'],
      ['Driver accepts', 'The trip is assigned and the rider is told.', 'driver>api, api>trips, api>rider', 'write'],
      ['Watch the car arrive', 'The driver\'s position streams to the rider.', 'driver>locgw, locgw>pubsub, pubsub>push, push>rider', 'read']
    ],
    why: [
      'Locations change every few seconds and only the latest matters, so they live in memory, not a database.',
      'Hexagonal cells make "nearby" a fixed ring of neighbors at every distance.',
      'Compare-and-set reservation stops two riders from getting the same driver.',
      'Sharding by cell keeps a city\'s matching local.'
    ],
    tradeoffs: [
      'In-memory locations are lost on a crash, but refill within seconds.',
      'Straight-line distance is cheap; ETA on the road graph is accurate but costly, so it ranks only the shortlist.',
      'Dense downtown cells become hot shards.'
    ],
    failures: [
      ['Geo shard dies', 'geo', 'match', 'Drivers in those cells cannot be matched.', 'Replicate shards; drivers repopulate within one update interval.']
    ]
  },

  'pub-sub': {
    subtitle: 'Partitioned append-only logs, replicated to followers, read by consumer groups at their own offsets',
    basedOn: 'Apache Kafka (partitions, ISR, consumer groups, KRaft, tiered storage)',
    sources: [
      ['Kafka documentation: design', 'https://kafka.apache.org/documentation/#design'],
      ['KIP-405: tiered storage', 'https://cwiki.apache.org/confluence/display/KAFKA/KIP-405%3A+Kafka+Tiered+Storage'],
      ['System Design School: Message queue', 'https://systemdesignschool.io/problems/message-queue/solution']
    ],
    nodes: [
      ['producer', 'Producers', 'Batch + key', 'Client', 'Send messages; the key picks the partition.', []],
      ['followers', 'Followers (ISR)', 'Replicas', 'Service', 'In-sync replicas copy the leader\'s log.', ['Ack after the ISR has it.']],
      ['leader', 'Partition leader', 'Broker', 'Service', 'Appends to the log and serves reads for its partition.', []],
      ['log', 'Partition log', 'Segments on disk', 'Data', 'Append-only segment files read sequentially.', []],
      ['tiered', 'Tiered storage', 'Object storage', 'Data', 'Older segments offloaded to cheap storage.', []],
      ['controller', 'Controller', 'KRaft quorum', 'Service', 'Tracks brokers, elects leaders, stores metadata.', []],
      ['groups', 'Group manager', 'Assign partitions', 'Service', 'Assigns partitions to consumers in a group.', []],
      ['offsets', 'Offsets', 'Per group', 'Data', 'Where each group has read to.', []],
      ['consumer', 'Consumers', 'Pull', 'Client', 'Pull batches and commit offsets.', []]
    ],
    edges: [
      ['producer', 'leader', 'produce', 'sync', 'To the partition leader.'],
      ['leader', 'log', 'append', 'sync', 'Sequential write.'],
      ['leader', 'followers', 'replicate', 'async', 'Followers copy each append.'],
      ['leader', 'producer', 'ack', 'sync', 'After ISR.'],
      ['log', 'tiered', 'offload', 'async', 'Old segments.'],
      ['controller', 'leader', 'leadership', 'async', 'Elect on failure.'],
      ['consumer', 'groups', 'join group', 'sync', 'Get partitions.'],
      ['consumer', 'leader', 'fetch from offset', 'sync', 'Pull.'],
      ['leader', 'consumer', 'batch', 'sync', 'Messages.'],
      ['consumer', 'offsets', 'commit', 'async', 'Progress.']
    ],
    flow: [
      ['Publish a message', 'Append to the partition leader; ack once in-sync replicas have it.', 'producer>leader, leader>log, leader>followers, leader>producer', 'write'],
      ['Consume messages', 'Join a group, pull from your partitions, commit offsets.', 'consumer>groups, consumer>leader, leader>consumer, consumer>offsets', 'read'],
      ['Broker fails', 'The controller elects a new leader from the in-sync replicas.', 'controller>leader', 'background'],
      ['Age out data', 'Old segments move to object storage.', 'log>tiered', 'background']
    ],
    why: [
      'An append-only log on disk is fast because reads and writes are sequential.',
      'Partitions are the unit of parallelism and ordering.',
      'Consumers track their own offsets, so many groups can read the same data independently and replay.',
      'Acknowledging after the in-sync replicas have the message makes it survive a broker failure.'
    ],
    tradeoffs: [
      'Ordering holds only within a partition.',
      'acks=all is durable but slower than acks=1.',
      'More partitions mean more parallelism and more metadata.'
    ],
    failures: [
      ['Leader broker dies', 'leader', 'producer consumer', 'Its partitions are unavailable for a moment.', 'Controller elects an ISR follower; clients refresh metadata and retry.']
    ]
  },

  'chat-app': {
    subtitle: 'Persistent connections on gateways, a per-conversation sequence, and offline sync by last seen',
    basedOn: 'WhatsApp (Erlang gateways), Discord (Cassandra/ScyllaDB messages), Slack',
    sources: [
      ['Discord: how we store trillions of messages', 'https://discord.com/blog/how-discord-stores-trillions-of-messages'],
      ['Slack: real-time messaging', 'https://slack.engineering/real-time-messaging/'],
      ['System Design School: Chat app', 'https://systemdesignschool.io/problems/chatapp/solution']
    ],
    nodes: [
      ['sender', 'Sender', 'Phone', 'Client', 'Sends a message over a WebSocket.', []],
      ['recipient', 'Recipient', 'Phone', 'Client', 'Online or offline.', []],
      ['gw', 'Chat gateways', 'WebSockets', 'Gateway', 'Hold millions of open connections.', []],
      ['registry', 'Who is where', 'user → gateway', 'Data', 'Which gateway each online user is on.', ['TTL heartbeat.']],
      ['msgsvc', 'Message service', 'Persist + seq', 'Service', 'Assigns the next sequence in the conversation and stores it.', []],
      ['msgs', 'Message store', 'By conversation', 'Data', 'Messages partitioned by conversation and time bucket.', []],
      ['bus', 'Delivery bus', 'Topic per gateway', 'Async', 'Routes a message to the gateway holding the recipient.', []],
      ['push', 'Push service', 'APNs / FCM', 'Async', 'Wakes offline phones.', []],
      ['presence', 'Presence', 'TTL', 'Data', 'Online and last seen.', []],
      ['media', 'Media store', 'Blobs + CDN', 'Data', 'Photos and voice notes.', []]
    ],
    edges: [
      ['sender', 'gw', 'message', 'sync', 'Over WebSocket.'],
      ['gw', 'msgsvc', 'send', 'sync', 'Persist.'],
      ['msgsvc', 'msgs', 'append + seq', 'sync', 'Durable.'],
      ['msgsvc', 'gw', 'sent ✓', 'sync', 'Ack.'],
      ['gw', 'sender', 'sent ✓', 'sync', 'Single tick.'],
      ['msgsvc', 'registry', 'where is B?', 'sync', 'Lookup.'],
      ['msgsvc', 'bus', 'route', 'async', 'To B\'s gateway.'],
      ['bus', 'gw', 'deliver', 'async', 'Gateway pushes.'],
      ['gw', 'recipient', 'message', 'async', 'Delivered ✓✓.'],
      ['msgsvc', 'push', 'offline', 'async', 'Wake phone.'],
      ['push', 'recipient', 'notification', 'async', 'Tap to open.'],
      ['recipient', 'gw', 'sync since seq', 'sync', 'Reconnect.'],
      ['gw', 'msgs', 'messages after seq', 'sync', 'Catch up.'],
      ['gw', 'registry', 'register', 'async', 'Online.'],
      ['gw', 'presence', 'heartbeat', 'async', 'Online.'],
      ['sender', 'media', 'upload', 'sync', 'Attachments.']
    ],
    flow: [
      ['Send a message', 'Persist with the next sequence, ack, then route to the recipient\'s gateway.', 'sender>gw, gw>msgsvc, msgsvc>msgs, msgsvc>gw, gw>sender, msgsvc>registry, msgsvc>bus, bus>gw, gw>recipient', 'write'],
      ['Recipient is offline', 'Push wakes the phone.', 'msgsvc>registry, msgsvc>push, push>recipient', 'write'],
      ['Come back online', 'Register and sync every message after the last seen sequence.', 'recipient>gw, gw>registry, gw>presence, gw>msgs', 'read']
    ],
    why: [
      'Persisting before delivering means a sent message is never lost.',
      'A per-conversation sequence gives a clear order and makes sync "everything after N".',
      'A registry plus a bus routes messages to the one gateway holding the recipient.',
      'Partitioning messages by conversation makes loading a chat a single-partition read.'
    ],
    tradeoffs: [
      'Large groups multiply fan-out; very large channels switch to pull.',
      'Presence updates are chatty; batch and throttle them.',
      'End-to-end encryption limits server-side search.'
    ],
    failures: [
      ['Gateway crashes', 'gw', 'registry recipient', 'Its users disconnect.', 'Clients reconnect elsewhere and sync since their last sequence; registry entries expire.']
    ]
  },

  youtube: {
    subtitle: 'Resumable upload, parallel transcoding into a ladder, and adaptive streaming from a CDN',
    basedOn: 'YouTube (Vitess metadata, transcoding at scale), Netflix-style ABR',
    sources: [
      ['Vitess (born at YouTube)', 'https://vitess.io/docs/overview/history/'],
      ['YouTube: resumable uploads', 'https://developers.google.com/youtube/data/guides/using_resumable_upload_protocol'],
      ['System Design School: YouTube', 'https://systemdesignschool.io/problems/youtube/solution']
    ],
    nodes: [
      ['creator', 'Creator', 'Uploads', 'Client', 'Uploads a video.', []],
      ['viewer', 'Viewer', 'Player + ABR', 'Client', 'Streams with adaptive bitrate.', []],
      ['api', 'Upload API', 'Pre-signed URL', 'Gateway', 'Creates the video record and a resumable upload URL.', []],
      ['source', 'Source storage', 'Original file', 'Data', 'The raw upload.', []],
      ['queue', 'Transcode queue', 'Chunks', 'Async', 'Chunks waiting for transcoding.', []],
      ['transcode', 'Transcode fleet', 'Parallel chunks', 'Service', 'Encodes each chunk into every resolution and bitrate.', []],
      ['renditions', 'Renditions', 'Segments', 'Data', 'Segmented outputs plus manifests; the CDN\'s origin.', []],
      ['meta', 'Video metadata', 'Sharded MySQL', 'Data', 'Title, status, counts.', []],
      ['watch', 'Watch API', 'Page + manifest', 'Service', 'Metadata and the manifest URL.', []],
      ['shield', 'Origin shield', 'Mid-tier cache', 'Edge', 'Collapses CDN misses.', []],
      ['cdn', 'CDN edge', 'Segments', 'Edge', 'Serves video segments near viewers.', []]
    ],
    edges: [
      ['creator', 'api', 'start upload', 'sync', 'Record + URL.'],
      ['api', 'meta', 'video: processing', 'sync', 'Status.'],
      ['api', 'creator', 'upload URL', 'sync', 'Resumable.'],
      ['creator', 'source', 'upload chunks', 'sync', 'Direct to storage.'],
      ['source', 'queue', 'uploaded', 'async', 'Split into chunks.'],
      ['queue', 'transcode', 'chunk', 'async', 'Parallel.'],
      ['transcode', 'renditions', 'segments', 'async', 'Ladder.'],
      ['transcode', 'meta', 'ready', 'async', 'Publish.'],
      ['viewer', 'watch', 'watch page', 'sync', 'Open.'],
      ['watch', 'meta', 'metadata', 'sync', 'Title, manifest.'],
      ['watch', 'viewer', 'manifest', 'sync', 'Ready.'],
      ['viewer', 'cdn', 'segments', 'sync', 'Stream.'],
      ['cdn', 'shield', 'miss', 'sync', 'Mid tier.'],
      ['shield', 'renditions', 'miss', 'sync', 'Origin.'],
      ['cdn', 'viewer', 'video', 'sync', 'Adaptive.']
    ],
    flow: [
      ['Upload a video', 'Get a resumable URL, upload straight to storage, mark it processing.', 'creator>api, api>meta, api>creator, creator>source', 'write'],
      ['Transcode', 'Split into chunks, encode in parallel, publish when ready.', 'source>queue, queue>transcode, transcode>renditions, transcode>meta', 'background'],
      ['Watch a video', 'Load the manifest, stream segments from the CDN.', 'viewer>watch, watch>meta, watch>viewer, viewer>cdn, cdn>shield, shield>renditions, cdn>viewer', 'read']
    ],
    why: [
      'Uploading directly to storage keeps large files off the API servers.',
      'Chunked parallel transcoding turns hours of work into minutes.',
      'A ladder of bitrates lets each viewer\'s player adapt to their bandwidth.',
      'An origin shield stops many edge misses from hammering storage.'
    ],
    tradeoffs: [
      'More renditions mean better quality matching but more storage and compute.',
      'Long-tail videos rarely hit the CDN cache.',
      'Encoding popular videos with expensive codecs pays off; rarely watched ones do not.'
    ],
    failures: [
      ['Transcode backlog', 'transcode', 'renditions meta', 'New videos stay "processing" for hours.', 'Autoscale on queue depth; publish a low resolution first.']
    ]
  },

  'news-feed': {
    subtitle: 'Hybrid fan-out: push post ids to most followers, pull celebrity posts at read time, then rank',
    basedOn: 'Facebook News Feed (Multifeed, TAO), Instagram feed ranking',
    sources: [
      ['Meta: TAO', 'https://engineering.fb.com/2013/06/25/core-infra/tao-the-power-of-the-graph/'],
      ['Meta: news feed ranking', 'https://engineering.fb.com/2021/01/26/core-infra/news-feed-ranking/'],
      ['System Design School: News feed', 'https://systemdesignschool.io/problems/news-feed/solution']
    ],
    nodes: [
      ['user', 'User', 'Post + scroll', 'Client', 'Posts and scrolls the feed.', []],
      ['api', 'Feed API', 'Front door', 'Gateway', 'Posts and feed reads.', []],
      ['posts', 'Post service', 'Write', 'Service', 'Stores posts.', []],
      ['postdb', 'Post store', 'By post id', 'Data', 'Post content.', []],
      ['graph', 'Social graph', 'TAO', 'Data', 'Friends and follows, cached.', []],
      ['queue', 'Fan-out queue', 'New posts', 'Async', 'Posts awaiting fan-out.', []],
      ['fanout', 'Fan-out workers', '< 100K followers', 'Async', 'Push post ids into followers\' feeds; skip celebrities.', []],
      ['timeline', 'Feed cache', 'Sorted sets', 'Data', 'Recent post ids per user.', []],
      ['celeb', 'Celebrity posts', 'Pulled on read', 'Data', 'Recent posts from huge accounts.', []],
      ['rank', 'Ranking', 'Two-stage', 'Service', 'Cheap filter, then an ML model on the top candidates.', []],
      ['engage', 'Engagement', 'Likes, views', 'Data', 'Signals the ranker uses.', []]
    ],
    edges: [
      ['user', 'api', 'post', 'sync', 'Write.'],
      ['api', 'posts', 'create', 'sync', 'Store.'],
      ['posts', 'postdb', 'insert', 'sync', 'Durable.'],
      ['posts', 'queue', 'new post', 'async', 'Fan out later.'],
      ['posts', 'celeb', 'if celebrity', 'async', 'Pull path.'],
      ['queue', 'fanout', 'post', 'async', 'Workers.'],
      ['fanout', 'graph', 'followers', 'sync', 'Who gets it.'],
      ['fanout', 'timeline', 'push id', 'async', 'Each feed.'],
      ['user', 'api', 'open feed', 'sync', 'Read.'],
      ['api', 'timeline', 'my ids', 'sync', 'Precomputed.'],
      ['api', 'celeb', 'followed celebs', 'sync', 'Merge.'],
      ['api', 'rank', 'score', 'sync', 'Order.'],
      ['rank', 'engage', 'signals', 'sync', 'Features.'],
      ['api', 'postdb', 'hydrate', 'sync', 'Content.'],
      ['api', 'user', 'feed', 'sync', 'Ranked.'],
      ['user', 'engage', 'like / view', 'async', 'Signals.']
    ],
    flow: [
      ['Publish a post', 'Store it, then fan out ids to followers (celebrities skip fan-out).', 'user>api, api>posts, posts>postdb, posts>queue, posts>celeb, queue>fanout, fanout>graph, fanout>timeline', 'write'],
      ['Open the feed', 'Read precomputed ids, merge celebrity posts, rank, hydrate.', 'user>api, api>timeline, api>celeb, api>rank, rank>engage, api>postdb, api>user', 'read'],
      ['Engage', 'Likes and views feed ranking.', 'user>engage', 'write']
    ],
    why: [
      'Push for normal accounts makes reads cheap; pull for celebrities avoids writing to millions of feeds.',
      'Feeds store ids, not content, so edits and deletes are instant.',
      'Two-stage ranking keeps the expensive model to a few hundred candidates.',
      'A cached social graph makes fan-out lookups fast.'
    ],
    tradeoffs: [
      'The celebrity threshold trades write cost against read-time merge cost.',
      'Fan-out to inactive users is wasted work.',
      'Ranking makes the feed engaging but non-chronological.'
    ],
    failures: [
      ['Fan-out backlog', 'fanout', 'timeline', 'Posts show up late.', 'Prioritize active users; merge very recent posts at read time.']
    ]
  },

  instagram: {
    subtitle: 'Pre-signed uploads to object storage, async processing into variants, immutable URLs on a CDN',
    basedOn: 'Instagram (sharded PostgreSQL ids, Cassandra feeds, Django at scale)',
    sources: [
      ['Instagram: sharding & IDs', 'https://medium.com/instagram-engineering/sharding-ids-at-instagram-1cf5a71e5a5c'],
      ['Instagram: what powers Instagram', 'https://medium.com/instagram-engineering/what-powers-instagram-hundreds-of-instances-dozens-of-technologies-adf2e22da2ad'],
      ['System Design School: Instagram', 'https://systemdesignschool.io/problems/instagram/solution']
    ],
    nodes: [
      ['app', 'App', 'Post + scroll', 'Client', 'Uploads photos and scrolls the feed.', []],
      ['lb', 'Load balancer', 'App fleet', 'Edge', 'Spreads API calls.', []],
      ['api', 'App server', 'Stateless', 'Service', 'Issues pre-signed upload URLs and creates posts.', []],
      ['objects', 'Object storage', 'Originals + sizes', 'Data', 'Photos and videos, erasure-coded.', []],
      ['queue', 'Media queue', 'Uploaded', 'Async', 'New uploads to process.', []],
      ['process', 'Media workers', 'Resize + transcode', 'Service', 'Create sizes and formats, then mark the post visible.', []],
      ['meta', 'Metadata DB', 'Sharded by user', 'Data', 'Posts, likes, follows; ids embed time and shard.', []],
      ['cdn', 'CDN', 'Immutable URLs', 'Edge', 'Serves media; URLs never change, so caching is forever.', []],
      ['feed', 'Feed service', 'Ranked feed', 'Service', 'Builds the feed from followed accounts.', []],
      ['feedcache', 'Feed cache', 'Per user', 'Data', 'Precomputed feed ids.', []]
    ],
    edges: [
      ['app', 'lb', 'new post', 'sync', 'Start.'],
      ['lb', 'api', 'forward', 'sync', 'App server.'],
      ['api', 'app', 'upload URL', 'sync', 'Pre-signed.'],
      ['app', 'objects', 'upload', 'sync', 'Direct.'],
      ['objects', 'queue', 'uploaded', 'async', 'Process.'],
      ['queue', 'process', 'job', 'async', 'Workers.'],
      ['process', 'objects', 'variants', 'async', 'Sizes.'],
      ['process', 'meta', 'visible', 'async', 'Publish.'],
      ['meta', 'feed', 'new post', 'async', 'Fan out.'],
      ['feed', 'feedcache', 'push id', 'async', 'Followers.'],
      ['app', 'lb', 'open feed', 'sync', 'Read.'],
      ['lb', 'feed', 'feed', 'sync', 'Feed service.'],
      ['feed', 'feedcache', 'ids', 'sync', 'Precomputed.'],
      ['feed', 'meta', 'hydrate', 'sync', 'Captions, likes.'],
      ['feed', 'app', 'posts + URLs', 'sync', 'Feed.'],
      ['app', 'cdn', 'images', 'sync', 'Media.'],
      ['cdn', 'objects', 'miss', 'sync', 'Origin.'],
      ['cdn', 'app', 'photos', 'sync', 'From the edge.']
    ],
    flow: [
      ['Post a photo', 'Get a pre-signed URL, upload directly, process into variants, publish.', 'app>lb, lb>api, api>app, app>objects, objects>queue, queue>process, process>objects, process>meta', 'write'],
      ['Fan out the post', 'Followers\' feeds get the new post id.', 'meta>feed, feed>feedcache', 'background'],
      ['Scroll the feed', 'Read feed ids, hydrate, load images from the CDN.', 'app>lb, lb>feed, feed>feedcache, feed>meta, feed>app, app>cdn, cdn>objects, cdn>app', 'read']
    ],
    why: [
      'Uploading straight to object storage keeps media bytes off app servers.',
      'Processing asynchronously means the app responds immediately.',
      'Immutable media URLs make CDN caching trivial: they never need invalidation.',
      'Ids that embed time and shard sort chronologically and route without a lookup.'
    ],
    tradeoffs: [
      'A post appears a moment after upload while variants are made.',
      'Many variants per photo cost storage.',
      'Sharding by user makes cross-user queries harder.'
    ],
    failures: [
      ['Media workers fall behind', 'process', 'meta feed', 'Posts stay pending.', 'Autoscale workers; publish the first variant early.']
    ]
  },

  'distributed-cache': {
    subtitle: 'Consistent-hash ring of in-memory shards, cache-aside clients, and hot-key protection',
    basedOn: 'Facebook memcache (leases, mcrouter), Twitter Twemcache, Redis Cluster',
    sources: [
      ['Scaling Memcache at Facebook', 'https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final170_update.pdf'],
      ['Redis Cluster specification', 'https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/'],
      ['System Design School: Distributed cache', 'https://systemdesignschool.io/problems/distributed-cache/solution']
    ],
    nodes: [
      ['app', 'App server', 'Cache-aside', 'Client', 'Reads the cache first, the database on a miss.', []],
      ['l1', 'Local L1 cache', 'In process', 'Client', 'Tiny cache for the hottest keys.', []],
      ['router', 'Routing layer', 'mcrouter', 'Gateway', 'Hashes the key onto the ring and forwards.', []],
      ['ring', 'Cache shards', 'Hash ring + vnodes', 'Data', 'In-memory key-value nodes; virtual nodes spread keys evenly.', []],
      ['replicas', 'Replicas', 'Async copy', 'Data', 'Copies for failover.', []],
      ['membership', 'Membership', 'Ring config', 'Service', 'Tracks which nodes are on the ring.', []],
      ['db', 'Database', 'Source of truth', 'Data', 'Authoritative data.', []],
      ['invalidate', 'Invalidator', 'CDC deletes', 'Async', 'Deletes cache keys when rows change.', []],
      ['hotkeys', 'Hot-key detector', 'Top-K', 'Obs', 'Finds keys hammering one shard.', []]
    ],
    edges: [
      ['app', 'l1', 'get', 'sync', 'Local first.'],
      ['app', 'router', 'get', 'sync', 'Remote.'],
      ['router', 'ring', 'owner node', 'sync', 'Hash.'],
      ['ring', 'router', 'value / miss', 'sync', 'Result.'],
      ['router', 'app', 'value / miss', 'sync', 'Back.'],
      ['app', 'db', 'miss: read', 'sync', 'Load.'],
      ['app', 'router', 'set (lease)', 'sync', 'Fill.'],
      ['ring', 'replicas', 'replicate', 'async', 'Copy.'],
      ['membership', 'router', 'ring config', 'async', 'Nodes.'],
      ['app', 'db', 'write', 'sync', 'Update.'],
      ['db', 'invalidate', 'change', 'async', 'CDC.'],
      ['invalidate', 'router', 'delete key', 'async', 'Invalidate.'],
      ['ring', 'hotkeys', 'access stats', 'obs', 'Sample.'],
      ['hotkeys', 'l1', 'pin hot keys', 'async', 'Local copies.']
    ],
    flow: [
      ['Read a hot key', 'Local cache or the owning shard answers.', 'app>l1, app>router, router>ring, ring>router, router>app', 'read'],
      ['Miss and fill', 'Read the database, fill the cache with a lease to avoid stampedes.', 'app>router, router>ring, ring>router, router>app, app>db, app>router', 'read'],
      ['Write data', 'Write the database; CDC deletes the cached copy.', 'app>db, db>invalidate, invalidate>router, router>ring', 'write'],
      ['Node leaves', 'Membership updates the ring; only that node\'s keys move.', 'membership>router', 'background']
    ],
    why: [
      'Consistent hashing moves only ~1/N of keys when a node joins or leaves.',
      'Cache-aside keeps the database the source of truth.',
      'Leases stop a thundering herd from all refilling the same missing key.',
      'Deleting on write (not updating) avoids races that leave stale values.'
    ],
    tradeoffs: [
      'Async replicas can lose recent writes on failover; acceptable for a cache.',
      'L1 caches are fast but harder to invalidate.',
      'More virtual nodes balance better but enlarge the ring metadata.'
    ],
    failures: [
      ['Hot key melts a shard', 'ring', 'router app', 'One node is overwhelmed by a single key.', 'Detect hot keys, replicate them to L1, or spread with key suffixes.']
    ]
  },

  'kv-store': {
    subtitle: 'Dynamo-style: any node coordinates, data on a hash ring, quorum reads and writes, repair in the background',
    basedOn: 'Amazon Dynamo, Apache Cassandra, Riak',
    sources: [
      ['Dynamo: Amazon\'s key-value store', 'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf'],
      ['Cassandra architecture', 'https://cassandra.apache.org/doc/latest/cassandra/architecture/overview.html'],
      ['System Design School: Distributed KV store', 'https://systemdesignschool.io/problems/distributed-kv-store/solution']
    ],
    nodes: [
      ['client', 'Client', 'get / put', 'Client', 'Reads and writes keys.', []],
      ['coord', 'Coordinator', 'Any node', 'Service', 'Finds the N replicas for a key and waits for W or R of them.', []],
      ['ring', 'Hash ring', 'vnodes', 'Data', 'Maps keys to nodes; virtual nodes balance load.', []],
      ['replicas', 'Replica nodes', 'N = 3', 'Data', 'Each stores its key ranges.', []],
      ['lsm', 'Storage engine', 'LSM tree', 'Data', 'Commit log, memtable, SSTables, compaction.', ['Fast writes.']],
      ['gossip', 'Gossip', 'Membership', 'Service', 'Nodes share who is alive.', []],
      ['hints', 'Hinted handoff', 'Down replica', 'Async', 'Holds writes for a down node and replays them later.', []],
      ['repair', 'Anti-entropy', 'Merkle trees', 'Async', 'Finds and fixes differences between replicas.', []]
    ],
    edges: [
      ['client', 'coord', 'put(k, v)', 'sync', 'Write.'],
      ['coord', 'ring', 'replicas for k', 'sync', 'Preference list.'],
      ['coord', 'replicas', 'write to N', 'sync', 'Wait for W.'],
      ['replicas', 'lsm', 'log + memtable', 'sync', 'Durable.'],
      ['coord', 'client', 'ok', 'sync', 'After W acks.'],
      ['client', 'coord', 'get(k)', 'sync', 'Read.'],
      ['coord', 'replicas', 'read from R', 'sync', 'Compare versions.'],
      ['replicas', 'coord', 'versions', 'sync', 'Vector clocks.'],
      ['coord', 'client', 'value', 'sync', 'Latest / siblings.'],
      ['coord', 'hints', 'replica down', 'async', 'Store hint.'],
      ['hints', 'replicas', 'replay', 'async', 'When back.'],
      ['gossip', 'ring', 'membership', 'async', 'Alive nodes.'],
      ['repair', 'replicas', 'compare + fix', 'async', 'Merkle trees.']
    ],
    flow: [
      ['Write a key', 'Write to N replicas; acknowledge after W confirm.', 'client>coord, coord>ring, coord>replicas, replicas>lsm, coord>client', 'write'],
      ['Read a key', 'Read R replicas; return the newest and repair stale ones.', 'client>coord, coord>ring, coord>replicas, replicas>coord, coord>client', 'read'],
      ['A replica is down', 'Another node holds a hint and replays it later.', 'coord>hints, hints>replicas', 'background'],
      ['Repair drift', 'Merkle trees find mismatches between replicas.', 'repair>replicas, gossip>ring', 'background']
    ],
    why: [
      'Tunable quorums (R + W > N) choose between consistency and latency per request.',
      'Consistent hashing with virtual nodes spreads data and makes adding nodes cheap.',
      'LSM trees turn random writes into sequential disk writes.',
      'Hinted handoff and Merkle repair keep writes available during failures and converge afterward.'
    ],
    tradeoffs: [
      'Eventual consistency can surface conflicting versions that clients must resolve.',
      'Compaction costs background I/O.',
      'No multi-key transactions.'
    ],
    failures: [
      ['Network partition', 'replicas', 'coord client', 'Replicas on each side accept different writes.', 'Vector clocks detect conflicts; read repair and anti-entropy converge them.']
    ]
  },

  'google-maps': {
    subtitle: 'Pre-rendered tiles on a CDN, a road graph with precomputed shortcuts, and live traffic from phones',
    basedOn: 'Google Maps (vector tiles, contraction hierarchies, crowdsourced traffic)',
    sources: [
      ['Google: how Maps predicts traffic', 'https://blog.google/products/maps/google-maps-101-how-ai-helps-predict-traffic-and-determine-routes/'],
      ['Contraction hierarchies', 'https://en.wikipedia.org/wiki/Contraction_hierarchies'],
      ['System Design School: Google Maps', 'https://systemdesignschool.io/problems/google-map/solution']
    ],
    nodes: [
      ['app', 'Maps app', 'Pan + navigate', 'Client', 'Views maps, searches, navigates, reports location.', []],
      ['cdn', 'Tile CDN', 'Vector tiles', 'Edge', 'Pre-rendered tiles by zoom, x, y.', ['Almost all map views end here.']],
      ['tiles', 'Tile store', 'Object storage', 'Data', 'Rendered tiles; origin for the CDN.', []],
      ['api', 'Maps API', 'Search + route', 'Gateway', 'Search, directions, and location updates.', []],
      ['search', 'Place search', 'Geohash index', 'Service', 'Finds places by name near a location.', []],
      ['places', 'Places DB', 'POIs', 'Data', 'Businesses and addresses.', []],
      ['routing', 'Routing', 'Shortcuts + traffic', 'Service', 'Shortest path on a road graph with precomputed shortcuts, weighted by live traffic.', []],
      ['graph', 'Road graph', 'Partitioned', 'Data', 'Roads as nodes and edges, plus shortcuts.', []],
      ['probes', 'Location stream', 'Phone GPS', 'Async', 'Anonymous speed samples from phones.', []],
      ['traffic', 'Traffic service', 'Speeds per road', 'Service', 'Turns GPS samples into current speeds.', []],
      ['speeds', 'Live speeds', 'Per segment', 'Data', 'Current travel times per road segment.', []]
    ],
    edges: [
      ['app', 'cdn', 'tiles z/x/y', 'sync', 'Pan and zoom.'],
      ['cdn', 'tiles', 'miss', 'sync', 'Origin.'],
      ['cdn', 'app', 'tiles', 'sync', 'Drawn on device.'],
      ['app', 'api', 'search / route', 'sync', 'Queries.'],
      ['api', 'search', 'search', 'sync', 'Places.'],
      ['search', 'places', 'nearby matches', 'sync', 'Geohash prefix.'],
      ['api', 'routing', 'directions', 'sync', 'A to B.'],
      ['routing', 'graph', 'shortcuts', 'sync', 'Fast search.'],
      ['routing', 'speeds', 'live weights', 'sync', 'Traffic.'],
      ['api', 'app', 'results / route', 'sync', 'Shown.'],
      ['app', 'probes', 'GPS while driving', 'async', 'Anonymous.'],
      ['probes', 'traffic', 'samples', 'async', 'Aggregate.'],
      ['traffic', 'speeds', 'update', 'async', 'Per segment.']
    ],
    flow: [
      ['Pan the map', 'Tiles come from the CDN.', 'app>cdn, cdn>tiles, cdn>app', 'read'],
      ['Search for a place', 'Geohash lookup near the viewport.', 'app>api, api>search, search>places, api>app', 'read'],
      ['Get directions', 'Shortcut search on the road graph with live traffic weights.', 'app>api, api>routing, routing>graph, routing>speeds, api>app', 'read'],
      ['Update traffic', 'Phone GPS samples become current road speeds.', 'app>probes, probes>traffic, traffic>speeds', 'write']
    ],
    why: [
      'Tiles are the same for everyone, so they are rendered once and served from a CDN.',
      'Precomputed shortcuts make continental routes answer in milliseconds.',
      'Crowdsourced GPS from phones gives live traffic without road sensors.',
      'Geohash prefixes make "near me" a range scan.'
    ],
    tradeoffs: [
      'Vector tiles are small and restylable but need device rendering.',
      'Shortcuts must be refreshed when roads change; live traffic is applied as weights.',
      'Location data is privacy sensitive; aggregate and anonymize.'
    ],
    failures: [
      ['Traffic pipeline lags', 'traffic', 'speeds routing', 'Routes ignore a new jam.', 'Fall back to historical speeds for that time of day.']
    ]
  },

  'core-bank': {
    subtitle: 'An immutable double-entry ledger at the core, idempotent postings, and payment rails at the edge',
    basedOn: 'Thought Machine Vault, Monzo, ISO 20022 payment hubs',
    sources: [
      ['Monzo: building a modern bank backend', 'https://monzo.com/blog/2016/09/19/building-a-modern-bank-backend'],
      ['Thought Machine: Vault Core', 'https://www.thoughtmachine.net/vault-core'],
      ['FedNow: ISO 20022', 'https://www.frbservices.org/financial-services/fednow-service/iso-20022-why-does-it-matter/']
    ],
    nodes: [
      ['customer', 'Banking app', 'Balance + pay', 'Client', 'Checks balances and sends money.', []],
      ['gw', 'API gateway', 'Auth + MFA', 'Gateway', 'Strong authentication and open-banking APIs.', []],
      ['accounts', 'Account service', 'Balances', 'Service', 'Reads balances and history.', []],
      ['payments', 'Payments hub', 'ISO 20022', 'Service', 'Validates transfers and picks the rail.', []],
      ['fraud', 'Fraud + AML', 'Score + hold', 'Service', 'Scores transfers; holds suspicious ones.', []],
      ['posting', 'Posting API', 'Idempotent', 'Service', 'Turns a transfer into balanced ledger postings.', []],
      ['products', 'Product engine', 'Rules per account', 'Service', 'Overdraft, interest, and fee rules for each product.', []],
      ['ledger', 'Core ledger', 'Double entry', 'Data', 'Immutable postings that always balance; the source of truth.', []],
      ['balances', 'Balance view', 'Projection', 'Data', 'Current balances derived from the ledger.', []],
      ['rails', 'Rail gateway', 'FedNow / ACH', 'Edge', 'Connects to external payment networks.', []],
      ['events', 'Event stream', 'Ledger events', 'Async', 'Every posting as an event.', []],
      ['eod', 'End-of-day batch', 'Interest + GL', 'Async', 'Interest accrual, statements, general ledger.', []]
    ],
    edges: [
      ['customer', 'gw', 'HTTPS', 'sync', 'Calls.'],
      ['gw', 'accounts', 'balance', 'sync', 'Read.'],
      ['accounts', 'balances', 'read', 'sync', 'Projection.'],
      ['gw', 'payments', 'send money', 'sync', 'Transfer.'],
      ['payments', 'fraud', 'score', 'sync', 'Risk.'],
      ['payments', 'posting', 'post', 'sync', 'Idempotent.'],
      ['posting', 'products', 'rules', 'sync', 'Allowed?'],
      ['posting', 'ledger', 'debit + credit', 'sync', 'Atomic.'],
      ['ledger', 'balances', 'update', 'async', 'Projection.'],
      ['ledger', 'events', 'posted', 'async', 'Stream.'],
      ['payments', 'rails', 'send', 'async', 'External.'],
      ['rails', 'payments', 'settled / returned', 'async', 'Outcome.'],
      ['payments', 'gw', 'status', 'sync', 'Pending / sent.'],
      ['accounts', 'gw', 'balance', 'sync', 'Shown.'],
      ['gw', 'customer', 'response', 'sync', 'Result.'],
      ['events', 'eod', 'daily', 'async', 'Batch.'],
      ['eod', 'ledger', 'interest postings', 'async', 'Accrual.']
    ],
    flow: [
      ['Check my balance', 'Read the balance projection.', 'customer>gw, gw>accounts, accounts>balances, accounts>gw, gw>customer', 'read'],
      ['Send money', 'Score fraud, post balanced entries idempotently, send on the rail.', 'customer>gw, gw>payments, payments>fraud, payments>posting, posting>products, posting>ledger, ledger>balances, ledger>events, payments>rails, payments>gw, gw>customer', 'write'],
      ['Payment settles', 'The rail confirms or returns the transfer.', 'rails>payments, payments>posting, posting>ledger', 'write'],
      ['Close the day', 'Interest, statements, and the general ledger.', 'events>eod, eod>ledger', 'background']
    ],
    why: [
      'An immutable double-entry ledger means money is never created or lost, only moved.',
      'Idempotent postings make retries safe.',
      'Balances are a projection of the ledger, so they can always be rebuilt.',
      'Product rules are separate from the ledger, so new account types do not touch core code.'
    ],
    tradeoffs: [
      'Strong consistency on the ledger limits throughput per account.',
      'Real-time rails settle instantly but cannot be reversed easily.',
      'Fraud holds protect customers but delay legitimate payments.'
    ],
    failures: [
      ['Rail outage', 'rails', 'payments', 'Outgoing transfers cannot be sent.', 'Queue and retry, fall back to another rail, show "pending" honestly.']
    ]
  }
});
