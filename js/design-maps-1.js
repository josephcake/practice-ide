/* ============================================================
   Researched architecture maps, part 1
   Each map shows the components that make THIS system work, drawn
   from published engineering write-ups and the problem's reference
   solution. Only infrastructure that genuinely applies is included.

   nodes: [id, label, sub, layer, detail, [spec]]
   edges: [from, to, label, kind, detail]
   flow:  [title, detail, 'a>b, b>c', 'read' | 'write' | 'background']
   ============================================================ */

const DESIGN_MAPS = {};

Object.assign(DESIGN_MAPS, {
  'url-shortener': {
    subtitle: 'Synchronous, unique create; cache-first redirect; clicks counted off the hot path',
    basedOn: 'Bitly (NSQ click fan-out, Z Proxy fallback, Bigtable link store)',
    sources: [
      ['Bitly: lessons building a distributed system', 'https://highscalability.com/bitly-lessons-learned-building-a-distributed-system-that-han/'],
      ['Bitly: Z Proxy', 'https://word.bitly.com/post/62914279559/z-proxy'],
      ['Bitly moves link data to Bigtable', 'https://cloud.google.com/blog/products/databases/bitly-migrates-link-data-from-mysql-to-bigtable-for-scalability'],
      ['System Design School: URL shortener', 'https://systemdesignschool.io/problems/url-shortener/solution']
    ],
    nodes: [
      ['client', 'Browser', 'Creates + clicks', 'Client', 'People creating short links and people clicking them.', ['Clicks outnumber creates ~100:1.']],
      ['gw', 'API gateway', 'Route + rate limit', 'Gateway', 'Sends creates to the shortening service and GETs to the redirect handler.', ['Rate-limits link creation to stop spam.']],
      ['shorten', 'Shorten service', 'POST /shorten', 'Service', 'Validates the URL, gets a unique ID, encodes it, stores the mapping.', ['Must answer synchronously: the user needs the code now.']],
      ['idgen', 'ID generator', 'Machine ID + seq', 'Service', 'Hands out unique numbers without a global lock: a machine prefix plus a local counter.', ['Base62 of the number becomes the code.', 'The prefix doubles as the shard key.']],
      ['redirect', 'Redirect handler', 'GET /:code → 302', 'Service', 'Looks up the long URL and answers with a redirect.', ['Cache first; database only on a miss.']],
      ['cache', 'Redirect cache', 'memcached / Redis', 'Data', 'Hot code → URL pairs in memory.', ['Mappings never change, so invalidation is rare.']],
      ['store', 'Link store', 'Sharded by prefix', 'Data', 'Durable code → URL mapping and metadata.', ['Bigtable at Bitly; DynamoDB/Cassandra also fit.']],
      ['clickq', 'Click queue', 'NSQ topics', 'Async', 'Every click is published here; independent consumers read it.', ['The redirect never waits on analytics.']],
      ['counter', 'Click counters', 'Redis INCR', 'Data', 'Fast per-link counters, flushed periodically to durable storage.', ['Feeds the link dashboard.']],
      ['archive', 'Click archive', 'HDFS / S3', 'Data', 'Raw click log for batch analytics.', ['Replayable.']],
      ['fallback', 'Backup redirect', 'Z Proxy + S3 copy', 'Edge', 'A separate redirect path in a different failure domain that keeps links working if the main stack is down.', ['Reads an S3 mirror of every mapping.', 'Queues clicks to replay later.']]
    ],
    edges: [
      ['client', 'gw', 'HTTPS', 'sync', 'Every request enters through the gateway.'],
      ['gw', 'shorten', 'create', 'sync', 'Write path.'],
      ['shorten', 'idgen', 'next ID', 'sync', 'A unique number from the local range.'],
      ['shorten', 'store', 'put mapping', 'sync', 'Persist before answering.'],
      ['shorten', 'gw', 'short URL', 'sync', 'The new code.'],
      ['gw', 'redirect', 'resolve', 'sync', 'Read path.'],
      ['redirect', 'cache', 'get', 'sync', 'Memory first.'],
      ['cache', 'redirect', 'hit', 'sync', 'Most lookups end here.'],
      ['redirect', 'store', 'miss', 'sync', 'Only misses reach the store.'],
      ['store', 'redirect', 'long URL', 'sync', 'Answer and fill the cache.'],
      ['redirect', 'gw', '302', 'sync', 'Redirect response.'],
      ['gw', 'client', 'response', 'sync', 'Short link or redirect.'],
      ['redirect', 'clickq', 'click event', 'async', 'Fire and forget.'],
      ['clickq', 'counter', 'count', 'async', 'Live counts.'],
      ['clickq', 'archive', 'archive', 'async', 'Raw history.'],
      ['clickq', 'fallback', 'mirror mapping', 'async', 'New links are copied to the fallback store.'],
      ['client', 'fallback', 'GET (outage)', 'sync', 'DNS fails over when the main stack is down.'],
      ['fallback', 'client', '302', 'sync', 'Links keep working.']
    ],
    flow: [
      ['Create a short link', 'Get a unique ID, Base62-encode it, persist the mapping, return the code.', 'client>gw, gw>shorten, shorten>idgen, shorten>store, shorten>gw, gw>client', 'write'],
      ['Open a popular link', 'The code is in the cache; the 302 goes back and the click is queued.', 'client>gw, gw>redirect, redirect>cache, cache>redirect, redirect>clickq, redirect>gw, gw>client', 'read'],
      ['Open a cold link', 'Cache miss: read the store, fill the cache, redirect.', 'client>gw, gw>redirect, redirect>cache, redirect>store, store>redirect, redirect>gw, gw>client', 'read'],
      ['Count clicks', 'Independent consumers count, archive, and mirror from the click queue.', 'clickq>counter, clickq>archive, clickq>fallback', 'write'],
      ['Redirect during an outage', 'The fallback path in another failure domain serves the redirect.', 'client>fallback, fallback>client', 'read']
    ],
    why: [
      'Creation is synchronous because the code must be unique and returned immediately; counting is asynchronous because it must never slow a redirect.',
      'A machine-prefix ID generator gives unique codes with no global counter, and the prefix shards the store.',
      'Immutable mappings make the cache almost free of invalidation.',
      'A fallback redirect path in a separate failure domain protects the one thing users notice: links that stop working.'
    ],
    tradeoffs: [
      '301 lets browsers cache (less load) but hides repeat clicks; 302 counts every click.',
      'Sequential IDs are guessable; shuffle or encrypt them if that matters.',
      'A CDN in front of redirects would be faster but bypasses click counting unless it logs at the edge.'
    ],
    failures: [
      ['Redirect cache down', 'cache', 'redirect store', 'Every redirect hits the link store; latency spikes.', 'Replicated cache, coalesced misses, and the fallback redirect path.']
    ]
  },

  pastebin: {
    subtitle: 'Metadata in a database, text in object storage, reads served by a CDN in front of the domain',
    basedOn: 'Pastebin product behavior and GitHub Gist (Spokes replicated Git storage)',
    sources: [
      ['Pastebin API', 'https://pastebin.com/doc_api'],
      ['GitHub: Spokes / DGit', 'https://github.blog/engineering/architecture-optimization/introducing-dgit/'],
      ['System Design School: Pastebin', 'https://systemdesignschool.io/problems/pastebin/solution']
    ],
    nodes: [
      ['client', 'Browser / curl', 'Create + read', 'Client', 'Creates pastes and opens paste links.', ['Reads ~100× creates.']],
      ['cdn', 'CDN', 'Fronts whole domain', 'Edge', 'Sits in front of the domain: /api/* goes to the app, everything else to object storage.', ['Most reads never reach the app.']],
      ['lb', 'Load balancer', 'App fleet', 'Edge', 'Spreads API calls over stateless app servers.', ['Autoscaling group behind it.']],
      ['app', 'Paste service', 'Stateless', 'Service', 'Generates a random ID, stores the text and the metadata row.', ['Rejects pastes over 1 MB.']],
      ['limiter', 'Rate limiter', '429 on spikes', 'Service', 'Protects the write path during traffic spikes and abuse.', ['Per IP and per account.']],
      ['meta', 'Metadata DB', 'id, expires_at', 'Data', 'One small row per paste with an index on expiry.', ['Relational; small.']],
      ['blobs', 'Object storage', 'Paste text /{id}', 'Data', 'The paste body, and the CDN\'s origin.', ['Cheap, durable.']],
      ['metacache', 'Metadata cache', 'Exists? expired?', 'Data', 'Fast "does this paste exist and is it live?" checks.', ['Metadata only, not full text.']],
      ['cleanup', 'Expiry job', 'Nightly batch', 'Async', 'Deletes expired pastes from DB and storage, then purges the CDN.', ['Batches deletes.']]
    ],
    edges: [
      ['client', 'cdn', 'GET / POST', 'sync', 'All traffic hits the CDN first.'],
      ['cdn', 'lb', '/api/*', 'sync', 'API calls go to the app.'],
      ['lb', 'limiter', 'check', 'sync', 'Throttle abusive creators.'],
      ['lb', 'app', 'create', 'sync', 'Allowed requests.'],
      ['app', 'blobs', 'put /{id}', 'sync', 'Store the text.'],
      ['app', 'meta', 'insert row', 'sync', 'id, size, expires_at.'],
      ['meta', 'metacache', 'fill', 'async', 'Cache metadata.'],
      ['app', 'lb', 'URL + delete token', 'sync', 'The new link.'],
      ['lb', 'cdn', 'response', 'sync', 'Back through the edge.'],
      ['cdn', 'client', 'link / text', 'sync', 'The user gets the result.'],
      ['cdn', 'blobs', 'miss: fetch /{id}', 'sync', 'The CDN pulls paste text from storage and caches it.'],
      ['blobs', 'cdn', 'text', 'sync', 'Cached at the edge.'],
      ['cleanup', 'meta', 'expired rows', 'async', 'Find what to delete.'],
      ['cleanup', 'blobs', 'delete', 'async', 'Remove the text.'],
      ['cleanup', 'cdn', 'purge', 'async', 'Later reads return 404.']
    ],
    flow: [
      ['Create a paste', 'Random ID, text to object storage, metadata row, return the link.', 'client>cdn, cdn>lb, lb>limiter, lb>app, app>blobs, app>meta, app>lb, lb>cdn, cdn>client', 'write'],
      ['Read a paste', 'The CDN serves it; on a miss it fetches the text from object storage once.', 'client>cdn, cdn>blobs, blobs>cdn, cdn>client', 'read'],
      ['Expire old pastes', 'A nightly job deletes expired pastes and purges the CDN.', 'cleanup>meta, cleanup>blobs, cleanup>cdn', 'write']
    ],
    why: [
      'Text is immutable, so a CDN with object storage as origin serves almost every read without touching the app.',
      'Splitting small metadata from the text keeps the database tiny and backups fast.',
      'Random IDs are unguessable, which matters because unlisted pastes are protected only by their URL.',
      'Expiry is a background batch job plus a CDN purge, so reads never pay for cleanup.'
    ],
    tradeoffs: [
      'Random IDs need a collision retry; sequential IDs would be guessable.',
      'CDN caching means a deleted or expired paste can be served until the purge completes.',
      'Burn-after-read and private pastes cannot be cached at the edge.'
    ],
    failures: [
      ['Object storage slow', 'blobs', 'cdn app', 'Uncached pastes load slowly and creates time out.', 'Serve from the CDN, retry with backoff, fail creates fast with a clear error.']
    ]
  },

  webhook: {
    subtitle: 'Persist first, deliver per endpoint with signed retries, never let one dead endpoint block others',
    basedOn: 'Stripe webhooks, Svix, Shopify webhooks',
    sources: [
      ['Svix webhook architecture', 'https://www.svix.com/webhook-architecture/'],
      ['Svix retry schedule', 'https://docs.svix.com/retries'],
      ['Stripe webhooks', 'https://docs.stripe.com/webhooks'],
      ['System Design School: Webhook', 'https://systemdesignschool.io/problems/webhook/solution']
    ],
    nodes: [
      ['producer', 'Producer', 'Payments, orders', 'Client', 'Internal services that emit business events.', ['Never wait on customer endpoints.']],
      ['api', 'Event API', 'Accept + 202', 'Gateway', 'Accepts an event with an idempotency key and returns immediately.', ['Persists before acknowledging.']],
      ['msgs', 'Message store', 'Events + attempts', 'Data', 'Every event and every delivery attempt (request and response).', ['Searchable delivery log.']],
      ['endpoints', 'Endpoints', 'URL, events, secret', 'Data', 'Which endpoints want which event types, and their signing secrets.', ['Cached in workers.']],
      ['router', 'Fan-out router', 'Match endpoints', 'Service', 'Creates one delivery task per matching endpoint.', []],
      ['queue', 'Task queue', 'Per-endpoint lanes', 'Async', 'Delivery tasks, isolated per endpoint, with delayed retries.', ['One slow endpoint cannot block others.']],
      ['worker', 'Dispatch worker', 'Sign + POST', 'Service', 'Signs with HMAC, POSTs with a short timeout; only 2xx counts.', ['New signature on every retry.']],
      ['egress', 'Egress proxy', 'Static IPs, no SSRF', 'Edge', 'Outbound HTTP leaves through fixed IPs and blocks private addresses.', ['Customers can allowlist the IPs.']],
      ['customer', 'Customer server', 'Their server', 'Client', 'The merchant\'s HTTPS endpoint.', ['May be slow, down, or wrong.']],
      ['retry', 'Retry scheduler', 'Backoff ~3 days', 'Async', 'Re-enqueues failed deliveries on an exponential schedule.', ['Then dead-letters and may disable the endpoint.']],
      ['portal', 'Delivery portal', 'Logs + replay', 'Client', 'Customers inspect attempts and replay failed events.', ['"Did you send it?" answered here.']]
    ],
    edges: [
      ['producer', 'api', 'event', 'sync', 'Submit an event.'],
      ['api', 'msgs', 'persist', 'sync', 'Durable before the ack.'],
      ['api', 'producer', '202', 'sync', 'The producer continues.'],
      ['api', 'router', 'fan out', 'async', 'Find subscribers.'],
      ['router', 'endpoints', 'who wants it', 'sync', 'Match event type.'],
      ['router', 'queue', 'one task / endpoint', 'async', 'Isolated lanes.'],
      ['queue', 'worker', 'task', 'async', 'Pull the next delivery.'],
      ['worker', 'egress', 'signed POST', 'sync', 'Through the proxy.'],
      ['egress', 'customer', 'HTTPS', 'sync', 'Deliver with a timeout.'],
      ['customer', 'worker', '2xx / error', 'sync', 'Outcome.'],
      ['worker', 'msgs', 'log attempt', 'async', 'Every attempt recorded.'],
      ['worker', 'retry', 'failed', 'async', 'Schedule a retry.'],
      ['retry', 'queue', 're-enqueue', 'async', 'Later, with backoff.'],
      ['portal', 'msgs', 'read attempts', 'sync', 'Delivery history.'],
      ['msgs', 'portal', 'log', 'sync', 'Status per attempt.'],
      ['portal', 'queue', 'replay', 'async', 'Re-send after a fix.']
    ],
    flow: [
      ['Emit an event', 'Persist, ack, then fan out into one task per endpoint.', 'producer>api, api>msgs, api>producer, api>router, router>endpoints, router>queue', 'write'],
      ['Deliver an event', 'Sign, POST through the egress proxy, log the attempt.', 'queue>worker, worker>egress, egress>customer, customer>worker, worker>msgs', 'background'],
      ['Endpoint is down', 'Failed attempts retry with backoff for days, then dead-letter.', 'queue>worker, worker>egress, egress>customer, customer>worker, worker>retry, retry>queue', 'background'],
      ['View delivery history', 'Customers read attempts and replay failures.', 'portal>msgs, msgs>portal, portal>queue', 'read']
    ],
    why: [
      'Storing the event before acknowledging means nothing is lost even if delivery is down.',
      'Per-endpoint lanes keep one broken customer from delaying everyone else.',
      'HMAC signatures with a timestamp let customers verify authenticity and reject replays.',
      'An egress proxy with fixed IPs and SSRF blocking makes outbound calls safe and allowlistable.'
    ],
    tradeoffs: [
      'At-least-once delivery means customers must dedupe by event id.',
      'Long retry windows maximize delivery but delay noticing a broken integration.',
      'Strict per-endpoint ordering limits parallelism; most providers do not promise order.'
    ],
    failures: [
      ['Large customer endpoint down', 'customer', 'worker retry queue', 'Retries pile up for one endpoint and can eat worker capacity.', 'Per-endpoint concurrency caps, backoff, and auto-disabling endpoints that fail for days.']
    ]
  },

  typeahead: {
    subtitle: 'Range-sharded, immutable in-memory tries with top-K per node, rebuilt offline and swapped atomically',
    basedOn: 'Google autocomplete, LinkedIn Cleo, Twitter Earlybird typeahead',
    sources: [
      ['LinkedIn Cleo', 'https://github.com/linkedin/cleo'],
      ['How Google autocomplete works', 'https://blog.google/products-and-platforms/products/search/how-google-autocomplete-predictions-work/'],
      ['System Design School: Typeahead', 'https://systemdesignschool.io/problems/typeahead/solution']
    ],
    nodes: [
      ['client', 'Search box', 'Debounce + cache', 'Client', 'Waits a few tens of ms after typing, cancels stale requests, caches recent prefixes.', ['Cuts requests several-fold.']],
      ['hot', 'Hot-prefix cache', '1–2 letters pinned', 'Edge', 'Answers the hottest short prefixes without touching the trie.', ['Short prefixes are precomputed, never evicted.']],
      ['router', 'Prefix router', 'Range → shard', 'Gateway', 'Maps a prefix to the shard that owns its range.', ['Ranges split by load, not alphabet.']],
      ['shards', 'Trie shards', 'Top-K per node', 'Data', 'In-memory tries; each node stores its best completions.', ['Lookup = walk to the prefix, read its list.']],
      ['policy', 'Policy filter', 'Remove unsafe', 'Service', 'Drops hateful, dangerous, or disparaging suggestions.', []],
      ['log', 'Query log', 'Pub/sub', 'Async', 'Every completed search is logged.', ['Firehose input.']],
      ['agg', 'Popularity job', 'Decayed counts', 'Async', 'Counts queries with time decay to get a popularity score.', ['Older searches weigh less.']],
      ['builder', 'Trie builder', 'Bottom-up top-K', 'Async', 'Builds a new trie by merging children\'s top-K lists upward.', ['No full subtree scans.']],
      ['trend', 'Trending layer', 'Last hour', 'Data', 'Fast-rising queries blended in at read time.', ['Freshness without rebuilding.']]
    ],
    edges: [
      ['client', 'hot', 'prefix', 'sync', 'After the debounce.'],
      ['hot', 'client', 'cached list', 'sync', 'Short prefixes end here.'],
      ['hot', 'router', 'miss', 'sync', 'Longer prefixes.'],
      ['router', 'shards', 'owning shard', 'sync', 'Single-shard lookup.'],
      ['shards', 'router', 'top-K', 'sync', 'Precomputed list.'],
      ['router', 'trend', 'recent', 'sync', 'Blend trending terms.'],
      ['router', 'policy', 'filter', 'sync', 'Remove unsafe suggestions.'],
      ['router', 'client', 'suggestions', 'sync', 'Before the next keystroke.'],
      ['client', 'log', 'search done', 'async', 'Log completed searches.'],
      ['log', 'agg', 'stream', 'async', 'Count with decay.'],
      ['agg', 'trend', 'rising', 'async', 'Fast path.'],
      ['agg', 'builder', 'scores', 'async', 'Periodic rebuild.'],
      ['builder', 'shards', 'swap pointer', 'async', 'Atomic swap to the new immutable trie.']
    ],
    flow: [
      ['Type a prefix', 'Hot prefixes come from the cache; others from one trie shard, blended and filtered.', 'client>hot, hot>router, router>shards, shards>router, router>trend, router>policy, router>client', 'read'],
      ['Learn from searches', 'Logged searches become decayed scores and a new trie, swapped in atomically.', 'client>log, log>agg, agg>builder, builder>shards', 'write'],
      ['Catch a trend', 'Fast-rising queries reach the trending layer within minutes.', 'log>agg, agg>trend', 'write']
    ],
    why: [
      'Top-K stored on every trie node turns ranking into a single lookup.',
      'Range sharding keeps a prefix on one shard; hash sharding would scatter it.',
      'Immutable tries swapped by pointer make reads lock-free.',
      'Debouncing and a hot-prefix cache remove most of the ~500k requests per second before they reach a shard.'
    ],
    tradeoffs: [
      'Rebuilding periodically is simple but delays new terms; the trending layer patches that.',
      'Storing top-K on every node uses memory but makes reads trivial.',
      'Personalization breaks shared caching; do it as a thin re-rank on top.'
    ],
    failures: [
      ['Bad trie build', 'builder', 'shards', 'A broken build serves empty or unsafe suggestions to everyone.', 'Validate before swapping, keep the previous trie, roll back instantly.']
    ]
  },

  tinder: {
    subtitle: 'Geosharded candidate search, a swipe firehose sharded by swiper, and exactly-once match creation',
    basedOn: 'Tinder engineering (S2 geosharded Elasticsearch, Kafka ordering, Keepalive push)',
    sources: [
      ['Tinder: geosharded recommendations', 'https://medium.com/tinder/geosharded-recommendations-part-1-sharding-approach-d5d54e0ec77a'],
      ['Tinder: delivering matches at scale', 'https://medium.com/tinder/how-tinder-delivers-your-matches-and-messages-at-scale-504049f22ce0'],
      ['Elastic: Tinder', 'https://www.elastic.co/customers/tinder'],
      ['System Design School: Tinder', 'https://systemdesignschool.io/problems/tinder/solution']
    ],
    nodes: [
      ['app', 'Mobile app', 'Swipe deck', 'Client', 'Shows the deck and sends swipes.', ['Prefetches the next batch.']],
      ['photocdn', 'Photo CDN', 'Profile images', 'Edge', 'Serves profile photos.', []],
      ['gw', 'API gateway', 'Auth + bot defense', 'Gateway', 'Entry point for deck and swipe calls.', []],
      ['location', 'Location service', 'Lat/lng → S2 cell', 'Service', 'Maps a user\'s location to a map cell and its geoshard.', ['Shards balanced by load, not area.']],
      ['updates', 'Profile updates', 'Kafka by user', 'Async', 'Ordered stream of profile and location changes.', ['Keeps moves between shards in order.']],
      ['geoindex', 'Geosharded index', 'Elasticsearch', 'Data', 'Profiles indexed per geoshard.', ['A query only hits shards that cover the radius.']],
      ['recs', 'Candidates', 'Geo → filter → rank', 'Service', 'Queries nearby shards, filters by preferences and seen, ranks.', ['Falls back to distance order if ranking fails.']],
      ['seen', 'Seen filter', 'Bloom per user', 'Data', 'Compact set of profiles already swiped.', ['~12 KB per 10k swipes.']],
      ['swipe', 'Swipe service', 'Like / pass', 'Service', 'Records the swipe, then checks for a reverse like.', []],
      ['swipes', 'Swipe store', 'By swiper_id', 'Data', 'Every swipe, keyed (swiper, target).', ['Evenly spread writes.']],
      ['matches', 'Match store', 'Insert-if-absent', 'Data', 'One row per mutual like, id = hash of the sorted pair.', ['Exactly one match even if both swipe at once.']],
      ['push', 'Push nudge', 'WebSocket + APNs', 'Async', 'Nudges both phones; the app then fetches the match.', []]
    ],
    edges: [
      ['app', 'gw', 'HTTPS', 'sync', 'Deck and swipe calls.'],
      ['app', 'photocdn', 'photos', 'sync', 'Images.'],
      ['photocdn', 'app', 'images', 'sync', 'From the edge.'],
      ['gw', 'location', 'location update', 'sync', 'When the user moves.'],
      ['location', 'updates', 'ordered by user', 'async', 'Kafka partition = user id.'],
      ['updates', 'geoindex', 'index / move shard', 'async', 'Reindex in the right shard.'],
      ['gw', 'recs', 'next deck', 'sync', 'Ask for candidates.'],
      ['recs', 'geoindex', 'nearby shards', 'sync', 'Cover the radius with cells.'],
      ['recs', 'seen', 'drop seen', 'sync', 'Bloom filter test.'],
      ['recs', 'gw', 'deck', 'sync', 'Ranked candidates.'],
      ['gw', 'swipe', 'swipe', 'sync', 'Like or pass.'],
      ['swipe', 'swipes', 'write (A,B)', 'sync', 'On A\'s shard.'],
      ['swipe', 'seen', 'add B', 'async', 'Update A\'s filter.'],
      ['swipe', 'swipes', 'read (B,A)', 'sync', 'Did B like A?'],
      ['swipe', 'matches', 'insert if absent', 'sync', 'Exactly one match.'],
      ['swipe', 'push', 'matched', 'async', 'Tell both users.'],
      ['push', 'app', 'It\'s a match', 'async', 'Nudge.'],
      ['swipe', 'gw', 'matched?', 'sync', 'Inline result.'],
      ['gw', 'app', 'response', 'sync', 'Deck or swipe result.']
    ],
    flow: [
      ['Load the deck', 'Query only the geoshards covering the radius, drop already-seen profiles, rank.', 'app>gw, gw>recs, recs>geoindex, recs>seen, recs>gw, gw>app, app>photocdn, photocdn>app', 'read'],
      ['Swipe right and match', 'Write the swipe, check the reverse like, insert the match once, nudge both.', 'app>gw, gw>swipe, swipe>swipes, swipe>seen, swipe>matches, swipe>push, push>app, swipe>gw, gw>app', 'write'],
      ['Move to a new city', 'Location changes stream in order and the profile moves to the new geoshard.', 'app>gw, gw>location, location>updates, updates>geoindex', 'write']
    ],
    why: [
      'Geosharding by load-balanced S2 cells means a deck query touches only a few shards, not the world.',
      'Ordering profile updates through Kafka by user id keeps a moving user from appearing in two shards.',
      'Sharding swipes by swiper spreads billions of writes evenly.',
      'A deterministic match id with insert-if-absent produces exactly one match even under a race.'
    ],
    tradeoffs: [
      'The reverse lookup (did B like A?) concentrates on popular users\' shards; cache their outgoing likes.',
      'Bloom filters occasionally hide a new profile; rebuild them from swipe history.',
      'Finer geo cells help dense cities but mean more shards per query in rural areas.'
    ],
    failures: [
      ['Target shard down', 'swipes', 'swipe matches', 'The reverse-like check fails, so a mutual like could be missed.', 'Record the swipe anyway and retry the match check asynchronously.']
    ]
  },

  leetcode: {
    subtitle: 'Accept fast, judge untrusted code in sandboxes from a fair queue, rank in a sorted set',
    basedOn: 'Judge0, Codeforces (pretests, hacks, system tests)',
    sources: [
      ['Judge0 configuration', 'https://github.com/judge0/judge0/blob/master/judge0.conf'],
      ['Codeforces rules', 'https://codeforces.com/blog/entry/4088'],
      ['System Design School: LeetCode', 'https://systemdesignschool.io/problems/leetcode/solution']
    ],
    nodes: [
      ['user', 'Code editor', 'Submit + poll', 'Client', 'Submits code and waits for the verdict.', []],
      ['cdn', 'CDN', 'Problem pages', 'Edge', 'Static problem pages and editor assets.', []],
      ['api', 'Submit API', '202 + token', 'Gateway', 'Validates, rate-limits per user, returns a submission id. Never runs code.', []],
      ['subs', 'Submission DB', 'Code + verdict', 'Data', 'Every submission and its result.', ['Sharded by submission id.']],
      ['queue', 'Judge queue', 'Durable + DLQ', 'Async', 'Pending submissions with a dead-letter queue.', ['Contest and practice lanes.']],
      ['dispatch', 'Fair dispatcher', 'Per-user caps', 'Service', 'Hands work to sandboxes fairly instead of strict first-in-first-out.', ['One user cannot flood the pool.']],
      ['sandbox', 'Sandbox pool', 'gVisor / microVM', 'Service', 'Runs code with CPU, memory, process, and time limits and no network.', ['Warm pool hides startup cost.', 'Autoscaled on queue age.']],
      ['tests', 'Test case store', 'Blob storage', 'Data', 'Hidden inputs, expected outputs, and checkers.', ['Never sent to clients.']],
      ['board', 'Leaderboard', 'Sorted set', 'Data', 'Live contest ranking by solved count, then penalty.', ['O(log n) updates.']],
      ['rejudge', 'System tests', 'After the contest', 'Async', 'Re-runs final solutions on the full test set.', []]
    ],
    edges: [
      ['user', 'cdn', 'problem page', 'sync', 'Static content.'],
      ['cdn', 'user', 'page', 'sync', 'From the edge.'],
      ['user', 'api', 'submit', 'sync', 'Code + language.'],
      ['api', 'subs', 'pending', 'sync', 'Record it.'],
      ['api', 'queue', 'enqueue', 'async', 'Hand off.'],
      ['api', 'user', '202 + id', 'sync', 'Immediate.'],
      ['queue', 'dispatch', 'next job', 'async', 'Pull fairly.'],
      ['dispatch', 'sandbox', 'run', 'async', 'Into an isolated box.'],
      ['sandbox', 'tests', 'stream tests', 'sync', 'Hidden inputs.'],
      ['sandbox', 'subs', 'verdict', 'sync', 'First write wins.'],
      ['sandbox', 'board', 'accepted', 'sync', 'Atomic score update.'],
      ['user', 'subs', 'poll verdict', 'sync', 'Until done.'],
      ['subs', 'user', 'verdict', 'sync', 'Result.'],
      ['user', 'board', 'standings', 'sync', 'Read the ranking.'],
      ['board', 'user', 'top N', 'sync', 'Live standings.'],
      ['rejudge', 'sandbox', 'full tests', 'async', 'Final judging.']
    ],
    flow: [
      ['Submit code', 'Store the submission, enqueue it, and return an id immediately.', 'user>api, api>subs, api>queue, api>user', 'write'],
      ['Judge it', 'A fair dispatcher hands it to a sandbox, which runs hidden tests and writes the verdict.', 'queue>dispatch, dispatch>sandbox, sandbox>tests, sandbox>subs, sandbox>board', 'background'],
      ['Check the verdict', 'The client polls until the verdict is ready.', 'user>subs, subs>user', 'read'],
      ['View standings', 'The leaderboard is a sorted-set read, never a database aggregation.', 'user>board, board>user', 'read']
    ],
    why: [
      'Untrusted code only ever runs inside a sandbox with hard limits and no network.',
      'An async queue absorbs the 10× contest spike; workers scale on how long jobs have waited, not CPU.',
      'A fair dispatcher keeps one user\'s burst from starving everyone else.',
      'A sorted set keeps live standings instant at contest scale.'
    ],
    tradeoffs: [
      'MicroVMs isolate better but start slower than containers; warm pools close the gap.',
      'Pre-warming before scheduled contests costs money while idle.',
      'Exact timing fairness needs dedicated cores, which lowers density.'
    ],
    failures: [
      ['Contest burst outruns sandboxes', 'sandbox', 'queue user', 'Verdicts take minutes at the contest start.', 'Pre-scale before start, prioritize the contest lane, show queue position.']
    ]
  },

  'rate-limiter': {
    subtitle: 'One atomic check per request in a sharded counter store, with a local bucket and fail-open safety net',
    basedOn: 'Stripe rate limiters, Cloudflare, GitHub API, Envoy global rate limit',
    sources: [
      ['Stripe: rate limiters', 'https://stripe.com/blog/rate-limiters'],
      ['Cloudflare: counting things', 'https://blog.cloudflare.com/counting-things-a-lot-of-different-things/'],
      ['GitHub: sharded rate limiter', 'https://github.blog/engineering/infrastructure/how-we-scaled-github-api-sharded-replicated-rate-limiter-redis/'],
      ['System Design School: Rate limiter', 'https://systemdesignschool.io/problems/rate-limiter/solution']
    ],
    nodes: [
      ['client', 'API client', 'Reads 429 headers', 'Client', 'Calls the API and backs off on 429.', ['Bursts matter more than averages.']],
      ['gw', 'API gateway', 'Enforcement point', 'Gateway', 'Asks for a decision before routing; turns a deny into 429 + Retry-After.', []],
      ['local', 'Local bucket', 'In-process', 'Gateway', 'A small token bucket inside each gateway that absorbs bursts and covers outages.', ['Fail-open safety net.']],
      ['blocked', 'Block cache', 'Blocked until T', 'Gateway', 'Remembers keys already over the limit so attackers cost no lookups.', []],
      ['limiter', 'Limiter service', 'Stateless', 'Service', 'Builds the key and runs one atomic script against the counter store.', ['Multiple windows checked at once.']],
      ['counters', 'Counter store', 'Redis + Lua', 'Data', 'Atomic increment-with-expiry per key, sharded by key hash.', ['Sub-millisecond.']],
      ['rules', 'Rules config', 'Pushed every 30 s', 'Data', 'Limits per plan, route, and tenant.', ['Never read per request.']],
      ['backend', 'Backend API', 'Protected service', 'Service', 'Handles allowed requests.', []],
      ['telemetry', 'Telemetry', 'Allow / deny', 'Obs', 'Decision counts, shadow-mode results, store health.', ['New limits run in shadow first.']]
    ],
    edges: [
      ['client', 'gw', 'request', 'sync', 'Every call.'],
      ['gw', 'blocked', 'blocked?', 'sync', 'Cheap reject.'],
      ['gw', 'local', 'take token', 'sync', 'Absorb bursts.'],
      ['gw', 'limiter', 'check(key)', 'sync', 'Global decision.'],
      ['limiter', 'counters', 'atomic INCR+EXPIRE', 'sync', 'One script.'],
      ['counters', 'limiter', 'count', 'sync', 'New value.'],
      ['limiter', 'gw', 'allow / deny', 'sync', 'Remaining + reset.'],
      ['gw', 'backend', 'allowed', 'sync', 'Forward.'],
      ['backend', 'gw', 'response', 'sync', 'Result.'],
      ['gw', 'client', '200 / 429', 'sync', 'With quota headers.'],
      ['rules', 'limiter', 'limits', 'async', 'Pushed config.'],
      ['limiter', 'telemetry', 'decisions', 'obs', 'Async metrics.']
    ],
    flow: [
      ['Allowed request', 'One atomic increment says yes; the request reaches the backend.', 'client>gw, gw>blocked, gw>local, gw>limiter, limiter>counters, counters>limiter, limiter>gw, gw>backend, backend>gw, gw>client', 'write'],
      ['Over the limit', 'The key is already blocked locally; 429 + Retry-After with no lookup.', 'client>gw, gw>blocked, gw>client', 'read'],
      ['Counter store down', 'The gateway keeps limiting with its local bucket and reports it.', 'client>gw, gw>local, gw>backend, backend>gw, gw>client', 'background']
    ],
    why: [
      'A single atomic script means two servers can never both take the last token.',
      'The counter store is the only state, sharded by key, so the limiter scales out.',
      'A local bucket and block cache keep the hot path fast and protect against store outages.',
      'Rules are pushed, so no config lookup happens per request.'
    ],
    tradeoffs: [
      'Fail-open keeps availability but invites abuse; fail-closed is for billing-critical limits.',
      'Sliding logs are exact but memory heavy; sliding counters are cheap and nearly exact.',
      'Local leasing reduces round trips but allows overshoot of about N × lease size.'
    ],
    failures: [
      ['Counter store outage', 'counters', 'limiter gw', 'Global counts are unavailable.', 'Fail open with local buckets for reads; fail closed for sensitive writes.']
    ]
  },

  'google-calendar': {
    subtitle: 'Store recurrence as a rule in local time, expand per window, fan out projections to attendees',
    basedOn: 'Google Calendar API, RFC 5545 (iCalendar), Cronofy time-zone guidance',
    sources: [
      ['Google Calendar API: sync', 'https://developers.google.com/workspace/calendar/api/guides/sync'],
      ['Google Calendar API: push', 'https://developers.google.com/workspace/calendar/api/guides/push'],
      ['Cronofy: time zones', 'https://docs.cronofy.com/developers/calendars-events/time-zones/'],
      ['System Design School: Google Calendar', 'https://systemdesignschool.io/problems/google-calendar/solution']
    ],
    nodes: [
      ['client', 'Calendar app', 'Week view', 'Client', 'Renders the expanded week in the viewer\'s time zone.', []],
      ['gw', 'API / CalDAV', 'REST + CalDAV', 'Gateway', 'Front door for the app and sync protocols.', []],
      ['events', 'Event service', 'Rules + exceptions', 'Service', 'Writes the master event (RRULE + time zone) and exception rows.', ['Edit one, this-and-following, or all.']],
      ['viewcache', 'Week-view cache', 'Per version', 'Data', 'Expanded weeks keyed by calendar, window, and version.', ['Invalidated by version bump.']],
      ['expand', 'Rule expander', 'Window only', 'Service', 'Expands rules into occurrences for the requested window, applying exceptions.', ['Caps how far a read may expand.']],
      ['tzdb', 'Time-zone DB', 'IANA tzdata', 'Data', 'Converts local wall-clock times to UTC per occurrence.', ['Keeps 9 am at 9 am across DST.']],
      ['store', 'Calendar DB', 'By calendar_id', 'Data', 'Masters, exceptions, attendees, reminders. Never occurrences.', []],
      ['fanout', 'Invite fan-out', 'Projections', 'Async', 'Copies a projection of the event to each attendee\'s calendar shard.', ['RSVPs flow back to the organizer.']],
      ['changes', 'Change log', 'Sync tokens', 'Data', 'Per-calendar change sequence for incremental sync.', ['410 means full resync.']],
      ['reminders', 'Reminders', 'Next fire time', 'Async', 'Holds the next reminder per event and schedules the following one when it fires.', ['Idempotent per occurrence.']],
      ['notify', 'Notifications', 'Push / email', 'Async', 'Delivers reminders and invites.', []]
    ],
    edges: [
      ['client', 'gw', 'HTTPS', 'sync', 'Views and edits.'],
      ['gw', 'events', 'create / edit', 'sync', 'Write a rule or exception.'],
      ['events', 'store', 'master + exceptions', 'sync', 'One row per series.'],
      ['events', 'changes', 'append', 'sync', 'For sync clients.'],
      ['events', 'fanout', 'attendees', 'async', 'Invite projections.'],
      ['fanout', 'store', 'attendee shards', 'async', 'Pending RSVP rows.'],
      ['fanout', 'notify', 'invite', 'async', 'Email / push.'],
      ['events', 'reminders', 'next fire', 'async', 'Schedule.'],
      ['events', 'gw', 'saved', 'sync', 'Result.'],
      ['gw', 'viewcache', 'week view', 'sync', 'Cache first.'],
      ['viewcache', 'gw', 'hit', 'sync', 'Most views end here.'],
      ['viewcache', 'expand', 'miss', 'sync', 'Expand the window.'],
      ['expand', 'store', 'rules in window', 'sync', 'Load masters + exceptions.'],
      ['expand', 'tzdb', 'local → UTC', 'sync', 'Per occurrence.'],
      ['expand', 'viewcache', 'occurrences', 'sync', 'Fill the cache.'],
      ['gw', 'client', 'response', 'sync', 'The week.'],
      ['reminders', 'notify', 'due', 'async', 'Fire.'],
      ['notify', 'client', 'reminder', 'async', 'On the device.']
    ],
    flow: [
      ['Create a weekly meeting', 'Store one rule, log the change, fan out to attendees, schedule reminders.', 'client>gw, gw>events, events>store, events>changes, events>fanout, fanout>store, fanout>notify, events>reminders, events>gw, gw>client', 'write'],
      ['Open my week', 'From the cache, or expand rules for just this window in local time.', 'client>gw, gw>viewcache, viewcache>expand, expand>store, expand>tzdb, expand>viewcache, viewcache>gw, gw>client', 'read'],
      ['Reminder fires', 'The scheduler fires the reminder and schedules the next occurrence.', 'reminders>notify, notify>client', 'background']
    ],
    why: [
      'A recurring event is a rule: "every weekday forever" is one row, not infinite rows.',
      'Expanding only the requested window keeps reads bounded.',
      'Storing local time plus an IANA zone keeps meetings at the right wall-clock time through DST changes.',
      'Per-attendee projections make each person\'s calendar a single-shard read.'
    ],
    tradeoffs: [
      'Expanding at read time costs CPU; caching expanded weeks needs version-based invalidation.',
      'Projections speed reads but make large meetings a fan-out on every edit.',
      'Push notifications are unreliable, so sync clients must also poll with sync tokens.'
    ],
    failures: [
      ['Reminder scheduler lags', 'reminders', 'notify', 'Reminders arrive after meetings start.', 'Partition by time bucket, alert on lag, drop reminders that are already too late.']
    ]
  },

  twitter: {
    subtitle: 'Fan out tweet ids into in-memory timelines on write; merge celebrities on read; hydrate separately',
    basedOn: 'Twitter (Redis timelines, fanout service, Manhattan, Home Mixer)',
    sources: [
      ['High Scalability: Twitter architecture', 'https://highscalability.com/the-architecture-twitter-uses-to-deal-with-150m-active-users/'],
      ['twitter/the-algorithm', 'https://github.com/twitter/the-algorithm'],
      ['System Design School: Twitter', 'https://systemdesignschool.io/problems/twitter/solution']
    ],
    nodes: [
      ['app', 'App', 'Post + read', 'Client', 'Posts tweets and reads the home timeline.', []],
      ['lb', 'Load balancer', 'Front end', 'Edge', 'Spreads traffic across front-end servers.', []],
      ['tfe', 'Front end (TFE)', 'Route + auth', 'Gateway', 'Routes writes and reads to their services.', []],
      ['tweet', 'Tweet service', 'Write + ack', 'Service', 'Stores the tweet and returns quickly; fan-out happens after.', []],
      ['tweets', 'Tweet store', 'Manhattan', 'Data', 'Durable tweets, keyed by tweet id.', ['Written idempotently by id.']],
      ['graph', 'Social graph', 'Follows', 'Service', 'Who follows whom.', ['Flags celebrity accounts.']],
      ['fanout', 'Fanout service', 'Push tweet ids', 'Async', 'Inserts the new tweet id into each active follower\'s timeline.', ['Skips celebrities.', 'Batches of thousands.']],
      ['timelines', 'Timeline cache', 'Redis, ~800 ids', 'Data', 'Per-user list of recent tweet ids, replicated 3 times.', ['Ids only, not tweet text.']],
      ['tlsvc', 'Timeline service', 'Read + merge', 'Service', 'Reads the timeline, merges in followed celebrities\' tweets.', []],
      ['hydrate', 'Hydration', 'Tweets + users', 'Service', 'Fills ids with tweet and user objects.', ['Own caches.']],
      ['ranker', 'Ranking', 'Home Mixer', 'Service', 'Scores candidates and mixes in recommendations.', []]
    ],
    edges: [
      ['app', 'lb', 'HTTPS', 'sync', 'All traffic.'],
      ['lb', 'tfe', 'forward', 'sync', 'Healthy front end.'],
      ['tfe', 'tweet', 'post', 'sync', 'Write path.'],
      ['tweet', 'tweets', 'store', 'sync', 'Durable.'],
      ['tweet', 'fanout', 'new tweet', 'async', 'After the ack.'],
      ['tweet', 'tfe', 'tweet id', 'sync', 'Fast ack.'],
      ['fanout', 'graph', 'followers', 'sync', 'Who receives it.'],
      ['fanout', 'timelines', 'push id', 'async', 'Prepend to each list.'],
      ['tfe', 'tlsvc', 'home', 'sync', 'Read path.'],
      ['tlsvc', 'timelines', 'my ids', 'sync', 'O(1) read.'],
      ['tlsvc', 'tweets', 'celebrity tweets', 'sync', 'Pulled at read time.'],
      ['tlsvc', 'ranker', 'rank', 'sync', 'Score candidates.'],
      ['tlsvc', 'hydrate', 'ids → tweets', 'sync', 'Fill in content.'],
      ['tlsvc', 'tfe', 'timeline', 'sync', 'Ranked tweets.'],
      ['tfe', 'lb', 'response', 'sync', 'Back out.'],
      ['lb', 'app', 'response', 'sync', 'The user sees it.']
    ],
    flow: [
      ['Post a tweet', 'Store it, ack fast, then push its id into followers\' timelines.', 'app>lb, lb>tfe, tfe>tweet, tweet>tweets, tweet>tfe, tfe>lb, lb>app, tweet>fanout, fanout>graph, fanout>timelines', 'write'],
      ['Read the home timeline', 'Read precomputed ids, merge celebrities, rank, hydrate.', 'app>lb, lb>tfe, tfe>tlsvc, tlsvc>timelines, tlsvc>tweets, tlsvc>ranker, tlsvc>hydrate, tlsvc>tfe, tfe>lb, lb>app', 'read']
    ],
    why: [
      'Reads outnumber writes ~50:1, so timelines are precomputed at write time and read in O(1).',
      'Timelines hold ids, so edits and deletes show up at hydration.',
      'Skipping fan-out for celebrities bounds write amplification; their tweets are merged at read time.',
      'Only active users are kept in memory; inactive timelines are rebuilt on return.'
    ],
    tradeoffs: [
      'Fan-out on write wastes work for followers who never read.',
      'Celebrity merges add latency to timelines that follow many celebrities.',
      'Delivery to millions of followers can take seconds to minutes at the tail.'
    ],
    failures: [
      ['Fanout backlog', 'fanout', 'timelines tlsvc', 'New tweets are late in followers\' timelines.', 'Scale fan-out on queue depth; merge very recent tweets at read time.']
    ]
  },

  yelp: {
    subtitle: 'Geo-sharded Elasticsearch with in-index ranking, fed from the database by CDC',
    basedOn: 'Yelp engineering (Elasticsearch geo shards, ranking plugin, data pipeline)',
    sources: [
      ['Yelp: moving search to Elasticsearch', 'https://engineeringblog.yelp.com/2017/06/moving-yelps-core-business-search-to-elasticsearch.html'],
      ['System Design School: Yelp', 'https://systemdesignschool.io/problems/yelp/solution']
    ],
    nodes: [
      ['app', 'App', 'Search + map', 'Client', 'Searches nearby and reads business pages.', []],
      ['cdn', 'Photo CDN', 'Images', 'Edge', 'Business and review photos.', ['Origin: object storage.']],
      ['gw', 'API gateway', 'Auth + routing', 'Gateway', 'Entry point; fans out for business pages.', []],
      ['query', 'Query parser', 'What + where', 'Service', 'Turns "tacos near Mission" into a category and a geo box.', []],
      ['coord', 'Search fan-out', 'Geo shard → fan-out', 'Service', 'Picks the geo shard and queries its micro-shards in parallel.', []],
      ['index', 'Business index', 'Elasticsearch', 'Data', 'Businesses with geo_point, text, attributes, and signals.', ['Sharded by region.']],
      ['rank', 'Ranking plugin', 'In-index scoring', 'Service', 'Custom scoring plus a learning-to-rank rescore inside the index.', ['Hot-reloaded without restarts.']],
      ['biz', 'Business service', 'Details + rating', 'Service', 'Business details with precomputed average rating.', ['Cached.']],
      ['bizdb', 'Business DB', 'PostgreSQL', 'Data', 'Source of truth for businesses.', []],
      ['reviews', 'Review service', 'Write + list', 'Service', 'Accepts reviews and lists them by business.', ['One review per user per business.']],
      ['revdb', 'Review DB', 'By business', 'Data', 'Reviews; relational with read replicas.', []],
      ['cdc', 'CDC pipeline', 'Debezium → Kafka', 'Async', 'Streams database changes into the index within seconds.', []],
      ['workers', 'Rating workers', 'Aggregates', 'Async', 'Update average rating and index signals after a review.', []]
    ],
    edges: [
      ['app', 'gw', 'HTTPS', 'sync', 'All calls.'],
      ['gw', 'query', 'search', 'sync', 'Parse.'],
      ['query', 'coord', 'category + box', 'sync', 'Plan.'],
      ['coord', 'index', 'geo + text', 'sync', 'Micro-shards in parallel.'],
      ['index', 'rank', 'score', 'sync', 'Rank inside the index.'],
      ['rank', 'coord', 'top hits', 'sync', 'Per shard.'],
      ['coord', 'gw', 'results', 'sync', 'Merged top 20.'],
      ['gw', 'biz', 'business page', 'sync', 'Details.'],
      ['biz', 'bizdb', 'read', 'sync', 'Cache miss.'],
      ['gw', 'reviews', 'reviews', 'sync', 'List or write.'],
      ['reviews', 'revdb', 'read / write', 'sync', 'Paginated.'],
      ['reviews', 'workers', 'review_created', 'async', 'Recompute.'],
      ['workers', 'bizdb', 'rating', 'async', 'Average + count.'],
      ['bizdb', 'cdc', 'change log', 'async', 'WAL.'],
      ['cdc', 'index', 'update doc', 'async', 'Seconds behind.'],
      ['gw', 'app', 'response', 'sync', 'Results.'],
      ['app', 'cdn', 'photos', 'sync', 'Images.'],
      ['cdn', 'app', 'images', 'sync', 'From the edge.']
    ],
    flow: [
      ['Search nearby', 'Parse what and where, query the right geo shard, rank inside the index.', 'app>gw, gw>query, query>coord, coord>index, index>rank, rank>coord, coord>gw, gw>app', 'read'],
      ['Open a business', 'Details and rating plus the first page of reviews; photos from the CDN.', 'app>gw, gw>biz, biz>bizdb, gw>reviews, reviews>revdb, gw>app, app>cdn, cdn>app', 'read'],
      ['Write a review', 'Commit the review, then update ratings and the index asynchronously.', 'app>gw, gw>reviews, reviews>revdb, reviews>workers, workers>bizdb, bizdb>cdc, cdc>index, gw>app', 'write']
    ],
    why: [
      'Geo then micro-shard partitioning means a search hits a small slice of the index.',
      'Ranking runs inside the index, so relevance changes ship without touching search infrastructure.',
      'CDC keeps the index within seconds of the database without dual writes.',
      'Ratings are precomputed, so pages never average thousands of reviews per view.'
    ],
    tradeoffs: [
      'Async aggregation means a new review takes a moment to move the stars.',
      'CDC adds operational weight; dual writes are simpler but drift.',
      'Bayesian-smoothed ratings stop one 5-star review from topping the list, but slow new businesses.'
    ],
    failures: [
      ['Search index down', 'index', 'coord', 'Search fails while business pages still load.', 'Replicated shards, cached results for popular areas, degraded geo-only query.']
    ]
  },

  netflix: {
    subtitle: 'A small AWS control plane steering clients to Netflix-owned caches inside ISPs, filled overnight',
    basedOn: 'Netflix Open Connect, Zuul, playback steering, encoding pipeline',
    sources: [
      ['Netflix: how Open Connect works with ISPs', 'https://about.netflix.com/en/news/how-netflix-works-with-isps-around-the-globe-to-deliver-a-great-viewing-experience'],
      ['Netflix tech blog: Netflix and fill', 'https://netflixtechblog.com/netflix-and-fill-c43a32b490c0'],
      ['Open Connect', 'https://openconnect.netflix.com/en/'],
      ['System Design School: Netflix', 'https://systemdesignschool.io/problems/netflix/solution']
    ],
    nodes: [
      ['player', 'Player', 'ABR + DRM', 'Client', 'Picks a bitrate per segment, fails over between cache URLs.', []],
      ['zuul', 'Zuul gateway', 'Control plane', 'Gateway', 'Edge gateway in AWS for browse, auth, and play requests.', ['Never carries video bytes.']],
      ['playback', 'Playback service', 'Entitlement', 'Service', 'Checks the account and licensing, picks files for the device.', []],
      ['steer', 'Steering service', 'Rank caches', 'Service', 'Returns a ranked list of caches by network proximity, health, and which hold the file.', []],
      ['license', 'DRM license', 'Keys', 'Service', 'Issues decryption keys.', []],
      ['progress', 'Resume position', 'Per profile', 'Data', 'Where each profile stopped.', ['Written every few seconds.']],
      ['oca', 'ISP cache (OCA)', 'Inside the ISP', 'Edge', 'Netflix-owned appliance in the ISP that serves video segments.', ['~90% of traffic.']],
      ['ixp', 'IXP cache', 'Fallback', 'Edge', 'Peering-site caches used when the ISP cache misses.', []],
      ['encode', 'Encoder', 'Per-title ladder', 'Async', 'Encodes each title into many bitrates in parallel chunks.', ['Quality-checked.']],
      ['origin', 'Origin (S3)', 'All renditions', 'Data', 'Master copies of every encoded file.', []],
      ['fill', 'Fill planner', 'Nightly push', 'Async', 'Predicts popularity and pushes files to caches during quiet hours.', ['Proactive, not pull-through.']],
      ['health', 'Cache control', 'OCA reports', 'Obs', 'Caches report health, routes, and stored files.', ['Feeds steering.']]
    ],
    edges: [
      ['player', 'zuul', 'browse / play', 'sync', 'Control requests.'],
      ['zuul', 'playback', 'start', 'sync', 'Entitlement.'],
      ['playback', 'steer', 'where?', 'sync', 'Best caches.'],
      ['steer', 'playback', 'ranked URLs', 'sync', 'Ordered list.'],
      ['playback', 'zuul', 'manifest', 'sync', 'Files + URLs.'],
      ['zuul', 'player', 'manifest', 'sync', 'Ready to stream.'],
      ['player', 'license', 'key', 'sync', 'DRM.'],
      ['player', 'oca', 'segments', 'sync', 'Bytes from inside the ISP.'],
      ['oca', 'player', 'video', 'sync', 'Adaptive bitrate.'],
      ['player', 'ixp', 'fallback', 'sync', 'Next URL on failure.'],
      ['player', 'progress', 'position', 'async', 'Resume point.'],
      ['encode', 'origin', 'renditions', 'async', 'Encoded ladder.'],
      ['fill', 'origin', 'read', 'async', 'Popular titles.'],
      ['fill', 'oca', 'pre-position', 'async', 'Overnight.'],
      ['oca', 'health', 'reports', 'obs', 'Health and stored files.'],
      ['health', 'steer', 'cache state', 'async', 'Steer away from bad caches.']
    ],
    flow: [
      ['Press play', 'Entitlement, steering picks the best caches, then segments stream from inside the ISP.', 'player>zuul, zuul>playback, playback>steer, steer>playback, playback>zuul, zuul>player, player>license, player>oca, oca>player', 'read'],
      ['Release a new title', 'Encode the ladder, store it, and push it to caches overnight.', 'encode>origin, fill>origin, fill>oca', 'write'],
      ['Keep watching', 'The player adapts bitrate, fails over if needed, and saves the resume point.', 'player>oca, oca>player, player>ixp, player>progress', 'read']
    ],
    why: [
      'Splitting control (AWS) from data (ISP caches) keeps the API small and the bytes local.',
      'A curated catalog makes demand predictable, so caches are filled before anyone presses play.',
      'Steering uses live cache health and network proximity, so each viewer gets the best nearby copy.',
      'Client-side adaptive bitrate lets the server stay stateless and the segments stay cacheable.'
    ],
    tradeoffs: [
      'Owning caches in ISPs means hardware, partnerships, and operations at global scale.',
      'More renditions match devices better but multiply storage and encoding cost.',
      'Pre-positioning wastes cache space on titles that turn out unpopular.'
    ],
    failures: [
      ['ISP cache fails', 'oca', 'player ixp', 'Viewers on that ISP fall back to peering caches; start times rise.', 'Steering removes it from the list and the player fails over to the next URL.']
    ]
  },

  robinhood: {
    subtitle: 'A lossy, conflated quote broadcast next to an idempotent, reserved, ledgered order path',
    basedOn: 'Robinhood engineering (sharded brokerage, Kafka + Faust market data, self-clearing)',
    sources: [
      ['Robinhood: order routing', 'https://robinhood.com/us/en/support/articles/stock-order-routing/'],
      ['Robinhood: scaling framework', 'https://robinhood.com/newsroom/building-a-thoughtful-scaling-framework-for-engineering/'],
      ['Confluent: Robinhood Kafkaproxy', 'https://www.confluent.io/events/current/2023/robinhoods-kafkaproxy-decoupling-kafka-consumer-logic-from-application/'],
      ['System Design School: Robinhood', 'https://systemdesignschool.io/problems/robinhood/solution']
    ],
    nodes: [
      ['app', 'Trading app', 'Quotes + orders', 'Client', 'Watches live quotes and places orders.', []],
      ['feed', 'Market data feed', 'Exchanges + SIP', 'Client', 'Raw quote ticks for every symbol.', ['Very high rate.']],
      ['pubsub', 'Quote pub/sub', 'Topic per symbol', 'Async', 'Per-symbol topics; hot symbols replicated.', ['Kafka + Faust conflation.']],
      ['stream', 'Quote gateways', 'WebSockets', 'Gateway', 'Hold millions of connections and push the latest quote per symbol at a bounded rate.', ['Dropped ticks are fine.']],
      ['gw', 'API gateway', 'Route to shard', 'Gateway', 'Sends each user to their brokerage shard.', []],
      ['orders', 'Order service', 'Idempotency gate', 'Service', 'Dedups by key, reserves cash or shares atomically, writes the order.', ['Order state machine.']],
      ['ledger', 'Account ledger', 'Sharded by user', 'Data', 'Cash, positions, orders, and double-entry ledger entries.', ['Strongly consistent.']],
      ['router', 'Order router', 'To market makers', 'Service', 'Sends orders over FIX to the venue with the best execution history.', []],
      ['venue', 'Market makers', 'External venues', 'Client', 'Execute orders and send fills asynchronously.', []],
      ['fills', 'Fill handler', 'Dedup by fill_id', 'Service', 'Writes the cash leg, position leg, and status in one transaction.', []],
      ['recon', 'Reconciliation', 'Vs venue reports', 'Async', 'Settles in-doubt orders and corrects drift.', ['Then clearing with NSCC.']]
    ],
    edges: [
      ['feed', 'pubsub', 'ticks', 'async', 'Raw quotes.'],
      ['pubsub', 'stream', 'latest per symbol', 'async', 'Conflated.'],
      ['stream', 'app', 'quotes', 'async', 'Pushed.'],
      ['app', 'gw', 'place order', 'sync', 'With idempotency key.'],
      ['gw', 'orders', 'order', 'sync', 'To the user\'s shard.'],
      ['orders', 'ledger', 'reserve + insert', 'sync', 'One transaction.'],
      ['orders', 'router', 'route', 'sync', 'Send out.'],
      ['router', 'venue', 'FIX', 'sync', 'Best execution.'],
      ['orders', 'gw', 'submitted', 'sync', 'Status.'],
      ['gw', 'app', 'response', 'sync', 'Order placed / history.'],
      ['venue', 'fills', 'fill', 'async', 'Execution.'],
      ['fills', 'ledger', 'cash + position', 'sync', 'One transaction.'],
      ['gw', 'ledger', 'history / holdings', 'sync', 'Reads.'],
      ['ledger', 'gw', 'positions', 'sync', 'Current holdings.'],
      ['recon', 'venue', 'execution reports', 'async', 'Ground truth.'],
      ['recon', 'ledger', 'settle in-doubt', 'async', 'Fix drift.']
    ],
    flow: [
      ['Watch prices', 'Ticks are conflated per symbol and pushed to connected apps.', 'feed>pubsub, pubsub>stream, stream>app', 'read'],
      ['Place an order', 'Dedup, reserve funds atomically, route to a market maker, confirm.', 'app>gw, gw>orders, orders>ledger, orders>router, router>venue, orders>gw, gw>app', 'write'],
      ['Get filled', 'Fills update cash and shares in one transaction.', 'venue>fills, fills>ledger', 'write'],
      ['View my holdings', 'Positions and history come from the user\'s shard.', 'app>gw, gw>ledger, ledger>gw, gw>app', 'read'],
      ['Reconcile', 'Venue reports settle in-doubt orders.', 'recon>venue, recon>ledger', 'background']
    ],
    why: [
      'Quotes tolerate loss, so they are conflated and pushed cheaply; orders do not, so they are idempotent and transactional.',
      'Reserving funds in the same transaction as the order prevents spending the same cash twice.',
      'Sharding the brokerage by user isolates failures and scales the money path.',
      'Reconciliation against venue reports is the backstop for timeouts and cancel-vs-fill races.'
    ],
    tradeoffs: [
      'Routing to market makers (payment for order flow) is cheaper for users but adds disclosure obligations.',
      'Wider conflation windows protect gateways under load but show coarser price movement.',
      'Admission queueing at market open protects the ledger but adds latency.'
    ],
    failures: [
      ['Venue connection drops', 'router', 'orders fills', 'Orders cannot route and fills stop arriving.', 'Mark orders in-doubt, reconnect with FIX sequence recovery, reconcile with the venue.']
    ]
  }
});
