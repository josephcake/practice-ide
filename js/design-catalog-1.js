/* ============================================================
   Catalog part 1: Easy and Medium
   ============================================================ */

/* ---------------- EASY ---------------- */

DesignCatalog.add({
  id: 'url-shortener', difficulty: 'easy', cat: 'Web',
  title: 'Design a URL Shortener',
  prompt: [
    'Design a service like bit.ly. Users submit a long URL and get back a short alias; anyone who opens the alias is redirected to the original page.',
    '',
    'Scale: 100M new links per day, reads outnumber writes about 100:1, links live for years, and redirects must add only a few milliseconds.'
  ].join('\n'),
  hints: [
    'Requirements first: create a short link, redirect, optional custom alias and expiry, basic click counts. Non-functional: very fast redirects, links never collide, high availability on the read path.',
    'Do the arithmetic aloud: 100M/day is about 1.2k writes/s and 120k reads/s. 62^7 is about 3.5 trillion codes, so 7 base62 characters last decades.',
    'High level: client → gateway → shorten service (write path) and redirect service (read path), both over one key-value mapping store with a cache in front.',
    'Code generation is the deep dive: hashing needs collision handling; a global counter is a hot spot; pre-allocated counter ranges per server give unique codes with no coordination per request.',
    'Reads dominate, so cache code → URL aggressively. Mappings never change, so invalidation is only needed for deletes and abuse takedowns.',
    'Pick 301 vs 302 deliberately: 301 is cached by browsers (less load, no analytics); 302 keeps every click visible.',
    'Failure: if the cache dies every redirect becomes a database read. Coalesce identical requests and keep database headroom.'
  ],
  topics: ['Back-of-envelope math', 'Base62 codes', 'Counter ranges', 'Read-heavy caching', '301 vs 302', 'Async click analytics', 'Hot links'],
  brief: {
    ask: 'Build the service behind bit.ly: turn a long link into a short one, and send anyone who opens the short link to the original page fast.',
    examples: [
      'Alice pastes https://news.example.com/2026/10/markets/very-long-article-id?ref=email and gets back https://sho.rt/aB3xK9q.',
      'Bob clicks https://sho.rt/aB3xK9q on his phone and lands on the article with under 20 ms of added latency.',
      'The same link is clicked 2 million times in an hour after going viral. Redirects must stay fast.',
      'Alice opens her dashboard and sees "1,204 clicks today".'
    ],
    deliver: ['The two APIs (create, redirect) and how codes are generated', 'QPS and storage estimate for 100M links/day', 'Where reads are cached and how a viral link is handled', 'Why counting clicks never slows a redirect']
  },
  map: {
    subtitle: 'Write once, redirect forever: cache-first reads over an immutable mapping',
    nodes: [
      ['client', 'Client', 'Browser / app', 'Client', 'Creates short links and follows redirects.', ['Reads outnumber writes ~100:1.']],
      ['api', 'API gateway', 'TLS, auth, quota', 'Edge', 'Single entry point for create and redirect calls.', ['Rate-limits abusive creators.']],
      ['shorten', 'Shorten service', 'POST /links', 'Service', 'Validates the URL, gets a code, stores the mapping.', ['Idempotent per owner + URL.', 'Rejects blocklisted targets.']],
      ['ids', 'Code allocator', 'Ranges + base62', 'Service', 'Hands each server a block of numbers to turn into codes.', ['No network call per code.', 'Codes never collide.']],
      ['redirect', 'Redirect service', 'GET /:code', 'Service', 'Looks up the code and answers with a redirect.', ['Cache first, store on miss.']],
      ['clicks', 'Click stream', 'Kafka', 'Async', 'Receives click events off the hot path.', ['Fire-and-forget from redirects.']],
      ['cache', 'Link cache', 'Redis', 'Data', 'Hot code → URL pairs in memory.', ['~99% hit ratio.', 'Mappings never change.']],
      ['db', 'Link store', 'Sharded key-value', 'Data', 'Durable source of truth for every link.', ['Sharded by code: one shard per lookup.']],
      ['metrics', 'Metrics', 'Latency, hit ratio', 'Obs', 'Tracks redirect p99 and cache hit ratio.', ['Alert when hit ratio drops.']]
    ],
    edges: [
      ['client', 'api', 'HTTPS', 'sync', 'Every request enters through the gateway.'],
      ['api', 'shorten', 'create', 'sync', 'Write path: create a short link.'],
      ['shorten', 'ids', 'next code', 'sync', 'Take the next number from the local range.'],
      ['shorten', 'db', 'put', 'sync', 'Persist code → URL before answering.'],
      ['shorten', 'api', 'short URL', 'sync', 'The new link goes back through the gateway.'],
      ['api', 'client', 'response', 'sync', 'The creator receives the short link, or the visitor the redirect.'],
      ['api', 'redirect', 'resolve', 'sync', 'Read path: resolve a code.'],
      ['redirect', 'cache', 'get', 'sync', 'Check memory first.'],
      ['cache', 'redirect', 'URL', 'sync', 'A hit returns the long URL.'],
      ['redirect', 'db', 'miss', 'sync', 'Only misses reach the store.'],
      ['db', 'redirect', 'URL', 'sync', 'The store answers the miss; the cache is filled.'],
      ['redirect', 'api', '302', 'sync', 'Redirect response heads back to the visitor.'],
      ['redirect', 'clicks', 'click', 'async', 'Record the click without waiting.'],
      ['redirect', 'metrics', 'latency', 'obs', 'Per-request timing and hit/miss.']
    ],
    flow: [
      ['Create a short link', 'Validate, take a code from the local range, persist, and return the short URL.', 'client>api, api>shorten, shorten>ids, shorten>db, shorten>api, api>client'],
      ['Open a popular link', 'The code is in the cache, so the redirect is answered from memory.', 'client>api, api>redirect, redirect>cache, cache>redirect, redirect>api, api>client'],
      ['Open a cold link', 'Cache miss: read the store, fill the cache, redirect, and log the click asynchronously.', 'client>api, api>redirect, redirect>cache, redirect>db, db>redirect, redirect>clicks, redirect>api, api>client']
    ],
    why: [
      'Reads are served from memory, so the database only sees writes and misses.',
      'Counter ranges give unique codes without a global lock or collision checks.',
      'Mappings are immutable, which makes caching almost free of invalidation.',
      'Click logging is asynchronous, so analytics can never slow a redirect.'
    ],
    tradeoffs: [
      '301 lets browsers cache (less load) but hides repeat clicks; 302 keeps analytics.',
      'Sequential codes are guessable; shuffle or encrypt the number if that matters.',
      'One viral link concentrates on one cache shard; replicate hot keys or use a CDN.'
    ],
    failures: [
      ['Cache cluster down', 'cache', 'redirect db', 'Every redirect becomes a database read; p99 spikes and the store becomes the bottleneck.', 'Replicate the cache, coalesce identical misses, and shed load with a circuit breaker.'],
      ['Code allocator down', 'ids', 'shorten', 'New links cannot get a code, but existing redirects keep working.', 'Servers keep a buffer of pre-fetched ranges; fall back to time-based IDs.']
    ]
  }
});

DesignCatalog.add({
  id: 'pastebin', difficulty: 'easy', cat: 'Web',
  title: 'Design Pastebin',
  prompt: [
    'Design a service where users paste plain text (code snippets, logs, config) and get a unique link to share it. Pastes can be public or unlisted, and can expire.',
    '',
    'Scale: 5M new pastes per day, average size 10 KB (max 10 MB), reads about 10× writes, and pastes are viewed mostly in the first few days.'
  ].join('\n'),
  hints: [
    'Requirements: create paste, read paste by link, optional expiry and syntax highlighting. Non-functional: links never collide, reads fast, storage grows forever unless expired.',
    'Estimate: 5M × 10 KB = 50 GB/day, about 18 TB/year. That is too much for a database row per paste, so store the text in object storage.',
    'Split metadata from content: a small row (id, owner, expiry, size, object key) in a database, the text itself in object storage.',
    'Reuse the URL shortener idea for IDs: pre-allocated ranges or random 8-character keys with a uniqueness check.',
    'Popular pastes are read many times right after creation: cache recent content, and put a CDN in front for public pastes.',
    'Expiry is a background job: a cleanup worker deletes expired metadata and objects in batches, rather than checking on every read.',
    'Abuse matters: size limits, rate limits per IP, and scanning for leaked secrets.'
  ],
  topics: ['Metadata vs content split', 'Object storage', 'Unique IDs', 'CDN for public reads', 'Expiry cleanup', 'Size limits'],
  brief: {
    ask: 'Build a site where someone pastes text, gets a link, and anyone with the link can read that text later.',
    examples: [
      'A developer pastes a 400-line stack trace and gets https://paste.ly/Qx7m2Lp9 to share in a bug report.',
      'A teammate opens the link and sees the text with syntax highlighting in under 200 ms.',
      'A paste set to "expire in 1 day" returns "Not found" 25 hours later.',
      'Someone tries to upload a 2 GB file and is rejected with a clear size-limit error.'
    ],
    deliver: ['Create and read APIs', 'Where metadata and paste text are stored, and why separately', 'How IDs are generated', 'How expiry and abuse are handled']
  },
  map: {
    subtitle: 'Small metadata rows, large text in object storage, popular pastes at the edge',
    nodes: [
      ['client', 'Client', 'Browser / CLI', 'Client', 'Creates and reads pastes.', ['Mostly reads shortly after creation.']],
      ['cdn', 'CDN', 'Public pastes', 'Edge', 'Serves popular public pastes from the edge.', ['Respects expiry with short TTLs.']],
      ['api', 'API gateway', 'Auth + limits', 'Edge', 'Entry point for create and read.', ['Per-IP rate and size limits.']],
      ['write', 'Paste service', 'Create + read', 'Service', 'Validates input, assigns an ID, stores metadata and text.', ['Rejects oversized pastes.']],
      ['ids', 'ID generator', 'Ranges / random', 'Service', 'Produces unique 8-character keys.', ['No collisions.']],
      ['cleanup', 'Expiry worker', 'Batch deletes', 'Async', 'Deletes expired metadata and objects in the background.', ['Runs on a schedule.']],
      ['meta', 'Metadata DB', 'id, owner, expiry', 'Data', 'One small row per paste.', ['Indexed by id and expiry.']],
      ['blobs', 'Object storage', 'Paste text', 'Data', 'The paste content itself.', ['Cheap and durable.']],
      ['cache', 'Content cache', 'Recent pastes', 'Data', 'Keeps recently read pastes in memory.', ['LRU with TTL.']]
    ],
    edges: [
      ['client', 'api', 'POST / GET', 'sync', 'Create or read a paste.'],
      ['client', 'cdn', 'public read', 'sync', 'Public pastes can be served from the edge.'],
      ['api', 'write', 'route', 'sync', 'Requests go to the paste service.'],
      ['write', 'ids', 'new id', 'sync', 'Get a unique key.'],
      ['write', 'blobs', 'put text', 'sync', 'Store the content.'],
      ['write', 'meta', 'put row', 'sync', 'Store id, owner, expiry, object key.'],
      ['write', 'cache', 'get', 'sync', 'Read path checks the cache first.'],
      ['write', 'api', 'link / text', 'sync', 'The link or the text goes back to the gateway.'],
      ['api', 'client', 'response', 'sync', 'The user gets the link or the paste.'],
      ['cdn', 'client', 'cached text', 'sync', 'Edge-served paste content.'],
      ['cdn', 'api', 'origin', 'sync', 'Edge misses fetch from the origin.'],
      ['cleanup', 'meta', 'expired rows', 'async', 'Find and delete expired pastes.'],
      ['cleanup', 'blobs', 'delete', 'async', 'Remove their content.']
    ],
    flow: [
      ['Create a paste', 'Check size, assign an ID, write the text to object storage and the metadata row, return the link.', 'client>api, api>write, write>ids, write>blobs, write>meta, write>api, api>client'],
      ['Read a paste', 'Serve from the edge or cache when possible; otherwise read the metadata and the object.', 'client>cdn, cdn>api, api>write, write>cache, write>meta, write>blobs, write>api, api>client'],
      ['Expire old pastes', 'A scheduled worker deletes expired rows and their objects in batches.', 'cleanup>meta, cleanup>blobs']
    ],
    why: [
      'Separating small metadata from large content keeps the database small and fast.',
      'Object storage holds terabytes of text cheaply and durably.',
      'Recent pastes get most reads, so a cache and CDN absorb the spike after sharing.',
      'Expiry runs in the background, so reads never pay for cleanup.'
    ],
    tradeoffs: [
      'Random IDs need a uniqueness check; counter ranges avoid it but are guessable.',
      'Long CDN TTLs save load but can serve a paste briefly after it expires.',
      'Compressing text saves storage but costs CPU on every read.'
    ],
    failures: [
      ['Object storage slow', 'blobs', 'write', 'Reads of uncached pastes hang and creates time out.', 'Serve from cache/CDN, retry with backoff, and fail creates fast with a clear error.']
    ]
  }
});

DesignCatalog.add({
  id: 'webhook', difficulty: 'easy', cat: 'Integration',
  title: 'Design a Webhook Service',
  prompt: [
    'Design a service that delivers event notifications (for example "payment succeeded") to customers\' HTTP endpoints, like Stripe or Shopify webhooks.',
    '',
    'Scale: 50k events per second at peak, thousands of customer endpoints of varying reliability, and customers expect each event at least once, signed so they can trust it.'
  ].join('\n'),
  hints: [
    'Requirements: customers register endpoint URLs and choose event types; every matching event is delivered at least once; deliveries are signed; customers can see delivery history and replay.',
    'Never call customer endpoints inline with the business action. Write the event to a durable queue and return.',
    'Delivery workers POST to the endpoint with a timeout, an HMAC signature, and an event id the customer can use to dedupe.',
    'Retries with exponential backoff and jitter, for hours or days. After the last retry, park the event in a dead-letter store and show it in the dashboard.',
    'Isolate slow customers: per-endpoint queues or concurrency limits, so one endpoint timing out does not block everyone else.',
    'Record every attempt (status code, latency) so support can answer "did you send it?".',
    'Security: sign payloads, rotate secrets, and block private IP ranges to prevent server-side request forgery.'
  ],
  topics: ['Durable event queue', 'At-least-once delivery', 'Retries with backoff', 'HMAC signatures', 'Per-endpoint isolation', 'Dead-letter + replay', 'SSRF protection'],
  brief: {
    ask: 'Build the system that tells your customers\' servers, by HTTP, whenever something happens in your product.',
    examples: [
      'A payment succeeds; within 2 seconds the shop\'s server at https://shop.example/hooks receives POST {"type":"payment.succeeded","id":"evt_81"}.',
      'The shop\'s server is down for 40 minutes; every event is delivered after it comes back, in order of retries.',
      'The shop receives evt_81 twice after a retry and safely ignores the duplicate using the event id.',
      'A merchant opens the dashboard and sees "evt_81 — 3 attempts — 200 OK at 10:42".'
    ],
    deliver: ['How events get from the product into a durable queue', 'Delivery workers: timeouts, signatures, retries', 'How one slow endpoint is kept from slowing everyone', 'Delivery log, dead letters, and replay']
  },
  map: {
    subtitle: 'Accept fast, deliver at least once, isolate slow endpoints',
    nodes: [
      ['product', 'Product services', 'Payments, orders', 'Client', 'Internal services that emit business events.', ['Never wait on customer endpoints.']],
      ['ingest', 'Event intake', 'Validate + fan out', 'Service', 'Accepts events and finds subscribed endpoints.', ['Returns immediately.']],
      ['subs', 'Subscriptions', 'URL, events, secret', 'Data', 'Which endpoint wants which event types.', ['Cached in memory.']],
      ['queue', 'Delivery queue', 'Per-endpoint lanes', 'Async', 'Durable jobs, one per event × endpoint.', ['Lanes isolate slow endpoints.']],
      ['workers', 'Delivery workers', 'HTTP POST', 'Service', 'Sign and send each event with a timeout.', ['HMAC signature header.', 'Blocks private IP ranges.']],
      ['retry', 'Retry scheduler', 'Backoff + jitter', 'Async', 'Re-enqueues failed deliveries later.', ['Up to ~3 days of retries.']],
      ['dlq', 'Dead letters', 'Gave up', 'Data', 'Events that exhausted retries, available for replay.', ['Shown in the dashboard.']],
      ['log', 'Delivery log', 'Every attempt', 'Data', 'Status code, latency, and payload per attempt.', ['Answers "did you send it?".']],
      ['customer', 'Customer server', 'Their endpoint', 'Client', 'The merchant\'s HTTPS endpoint receiving events.', ['May be slow, down, or wrong.']]
    ],
    edges: [
      ['product', 'ingest', 'event', 'sync', 'A business event is submitted.'],
      ['ingest', 'subs', 'who wants it', 'sync', 'Look up matching endpoints.'],
      ['ingest', 'queue', 'enqueue', 'async', 'One delivery job per endpoint.'],
      ['ingest', 'product', 'accepted', 'sync', 'The product continues immediately.'],
      ['queue', 'workers', 'job', 'async', 'Workers pull jobs per lane.'],
      ['workers', 'customer', 'POST signed', 'sync', 'Deliver with a timeout.'],
      ['customer', 'workers', '2xx / error', 'sync', 'Response or timeout.'],
      ['workers', 'log', 'attempt', 'async', 'Record the outcome.'],
      ['workers', 'retry', 'failed', 'async', 'Schedule a retry with backoff.'],
      ['retry', 'queue', 're-enqueue', 'async', 'The job returns to its lane later.'],
      ['retry', 'dlq', 'give up', 'async', 'After the last attempt.']
    ],
    flow: [
      ['Emit an event', 'The product submits an event; intake finds subscribers and enqueues one job per endpoint.', 'product>ingest, ingest>subs, ingest>queue, ingest>product'],
      ['Deliver successfully', 'A worker signs and POSTs the event, gets 200, and logs the attempt.', 'queue>workers, workers>customer, customer>workers, workers>log'],
      ['Endpoint is down', 'The POST fails; the retry scheduler backs off and re-enqueues, eventually parking it in dead letters.', 'queue>workers, workers>customer, customer>workers, workers>retry, retry>queue, retry>dlq']
    ],
    why: [
      'A durable queue decouples the product from customer endpoints entirely.',
      'At-least-once plus an event id lets customers dedupe safely.',
      'Per-endpoint lanes stop one broken customer from delaying everyone else.',
      'The delivery log and dead letters make every event traceable and replayable.'
    ],
    tradeoffs: [
      'Strict per-endpoint ordering limits parallelism; most providers do not guarantee order.',
      'Long retry windows improve delivery but delay surfacing a broken integration.',
      'Large payloads are simple for customers; thin "something changed, fetch it" events are safer.'
    ],
    failures: [
      ['Big customer endpoint down', 'customer', 'workers retry queue', 'Retries pile up for one endpoint and can consume worker capacity.', 'Per-endpoint concurrency caps, backoff, and pausing endpoints that fail for hours.']
    ]
  }
});

DesignCatalog.add({
  id: 'typeahead', difficulty: 'easy', cat: 'Search',
  title: 'Design Typeahead / Autocomplete',
  prompt: [
    'Design the suggestion service behind a search box: as the user types each character, return the top 5–10 completions for that prefix.',
    '',
    'Scale: 10B searches per day, each search triggers several keystroke requests, suggestions must return in under 100 ms (ideally < 20 ms server time), and popular terms change daily.'
  ].join('\n'),
  hints: [
    'Requirements: top-k suggestions for a prefix, ranked by popularity, refreshed regularly. Non-functional: extremely low latency and very high read QPS.',
    'Estimate: 10B searches × ~5 keystrokes = 50B requests/day, about 600k QPS. This must be answered from memory.',
    'Core structure: a trie (prefix tree) where each node stores its precomputed top-k completions, so a lookup is O(length of prefix).',
    'Build offline: aggregate search logs (e.g. hourly/daily), compute counts, rebuild the trie, and swap it in. Do not update the trie on every search.',
    'Shard by prefix (e.g. first character or two) and replicate each shard; cache the hottest prefixes at the edge and in the browser.',
    'Reduce requests: debounce in the client and skip calls for very short prefixes.',
    'Freshness for trending terms: a small real-time layer merges recent counts with the daily trie.'
  ],
  topics: ['Trie with top-k per node', 'Offline aggregation', 'Prefix sharding', 'Edge and browser caching', 'Debouncing', 'Trending freshness'],
  brief: {
    ask: 'Build the service that suggests completions in a search box while the user is still typing.',
    examples: [
      'A user types "how to" and sees "how to tie a tie", "how to screenshot", "how to boil eggs" within 50 ms.',
      'They type one more letter, "how to b", and the list updates before the next keystroke.',
      'A new movie releases on Friday; by Saturday its title appears when people type the first 4 letters.',
      'Typing an offensive phrase never shows it as a suggestion.'
    ],
    deliver: ['The data structure that makes prefix lookups fast', 'How suggestions are built from search logs', 'How you serve ~600k requests per second', 'How trending terms get in quickly']
  },
  map: {
    subtitle: 'A precomputed top-k trie in memory, rebuilt offline from search logs',
    nodes: [
      ['client', 'Search box', 'Debounced input', 'Client', 'Sends the current prefix after each pause in typing.', ['Caches recent prefixes.']],
      ['cdn', 'Edge cache', 'Hot prefixes', 'Edge', 'Short prefixes like "a" or "ho" are served from the edge.', ['TTL of minutes.']],
      ['api', 'Suggest API', 'GET /suggest?q=', 'Service', 'Routes the prefix to the right trie shard.', ['p99 < 20 ms.']],
      ['trie', 'Trie shards', 'Top-k per node', 'Data', 'In-memory prefix tree; each node holds its best completions.', ['Sharded by prefix, replicated.']],
      ['logs', 'Search log', 'Every query', 'Async', 'Records completed searches.', ['Firehose into the pipeline.']],
      ['agg', 'Aggregator', 'Counts per term', 'Service', 'Counts searches per term over a time window.', ['Filters unsafe terms.']],
      ['builder', 'Trie builder', 'Hourly rebuild', 'Service', 'Builds new trie snapshots from the counts.', ['Swapped in atomically.']],
      ['trend', 'Trending layer', 'Last hour', 'Data', 'Recent fast-rising terms merged into results.', ['Small and fast to update.']]
    ],
    edges: [
      ['client', 'cdn', 'prefix', 'sync', 'Each pause sends the prefix.'],
      ['cdn', 'api', 'miss', 'sync', 'Uncached prefixes go to the API.'],
      ['api', 'trie', 'lookup', 'sync', 'Walk to the prefix node, read its top-k.'],
      ['api', 'trend', 'recent', 'sync', 'Merge in trending terms.'],
      ['trie', 'api', 'top-k', 'sync', 'Precomputed completions.'],
      ['api', 'cdn', 'suggestions', 'sync', 'Results go back through the edge.'],
      ['cdn', 'client', 'list', 'sync', 'The user sees suggestions.'],
      ['client', 'logs', 'search done', 'async', 'Completed searches are logged.'],
      ['logs', 'agg', 'stream', 'async', 'Counts accumulate.'],
      ['agg', 'trend', 'rising terms', 'async', 'Fast path for trends.'],
      ['agg', 'builder', 'counts', 'async', 'Periodic full rebuild input.'],
      ['builder', 'trie', 'new snapshot', 'async', 'Swap in the rebuilt trie.']
    ],
    flow: [
      ['Type a prefix', 'The edge or the trie answers with precomputed completions in milliseconds.', 'client>cdn, cdn>api, api>trie, trie>api, api>trend, api>cdn, cdn>client'],
      ['Learn from searches', 'Completed searches are counted and a new trie is built and swapped in.', 'client>logs, logs>agg, agg>builder, builder>trie'],
      ['Catch a trend', 'Fast-rising terms reach the trending layer within minutes.', 'logs>agg, agg>trend']
    ],
    why: [
      'Top-k stored at every trie node turns a ranking problem into a single lookup.',
      'Building offline keeps the read path simple and fast.',
      'Short prefixes are the hottest and cacheable at the edge.',
      'A tiny trending layer gives freshness without rebuilding the whole trie.'
    ],
    tradeoffs: [
      'Rebuilding hourly is simple but delays new terms; the trending layer patches that.',
      'Storing top-k everywhere uses more memory but makes reads trivial.',
      'Personalized suggestions improve relevance but defeat shared caching.'
    ],
    failures: [
      ['Bad trie snapshot', 'builder', 'trie api', 'A broken build serves empty or offensive suggestions to everyone.', 'Validate snapshots before swapping, keep the previous one, and roll back instantly.']
    ]
  }
});

/* ---------------- MEDIUM ---------------- */

DesignCatalog.add({
  id: 'tinder', difficulty: 'medium', cat: 'Social',
  title: 'Design Tinder',
  prompt: [
    'Design the core of a location-based dating app: show each user a stack of nearby profiles, let them swipe left or right, and notify both people instantly when two right-swipes match.',
    '',
    'Scale: 50M daily users, about 2B swipes per day, profiles filtered by distance, age, and preferences.'
  ].join('\n'),
  hints: [
    'Requirements: candidate feed, swipe, mutual-match detection and notification. Non-functional: swipes must feel instant; a match must never be missed.',
    'Estimate: 2B swipes/day is about 25k writes/s average and much more at evening peaks. The swipe firehose, not the feed, shapes the design.',
    'Candidate feed: query a geospatial index (geohash/S2 cells) filtered by preferences, then precompute a batch of candidates per user so swiping does not query every time.',
    'Swipes: append to a swipe store keyed by (swiper, target). On a right swipe, check whether the target already right-swiped the swiper.',
    'Match detection must be atomic for the pair: the second right-swipe creates the match exactly once, even if both swipe at the same moment.',
    'Notify via push and a live connection; store matches durably so chats can start.',
    'Never show someone you already swiped on: track seen sets (a Bloom filter per user is a compact option).'
  ],
  topics: ['Geospatial candidate search', 'Precomputed candidate batches', 'Swipe write firehose', 'Atomic match detection', 'Seen-set / Bloom filter', 'Push notifications'],
  brief: {
    ask: 'Build the system that shows people nearby profiles to swipe on and tells two people the moment they both swipe right.',
    examples: [
      'Maya in Austin opens the app and sees a stack of profiles within 10 miles, aged 27–35, as she set.',
      'She swipes right on Leo. Leo had already swiped right on her yesterday: both phones show "It\'s a match!" within a second.',
      'Maya never sees Leo\'s profile again in her stack after swiping on him.',
      'At 9 pm on Sunday, swipes triple, and swiping still feels instant.'
    ],
    deliver: ['How the candidate stack is built (location + preferences)', 'How swipes are stored at ~25k+/s', 'How a mutual match is detected exactly once', 'How users avoid seeing the same profile twice']
  },
  map: {
    subtitle: 'Precomputed nearby candidates, a swipe firehose, and atomic pair matching',
    nodes: [
      ['app', 'Mobile app', 'Swipe UI', 'Client', 'Shows the profile stack and sends swipes.', ['Prefetches the next batch.']],
      ['gw', 'API gateway', 'Auth + routing', 'Edge', 'Entry point for feed and swipe calls.', ['Keeps WebSocket for match alerts.']],
      ['feed', 'Candidates', 'Build the stack', 'Service', 'Returns the next batch of candidates for a user.', ['Reads precomputed batches.']],
      ['geo', 'Geo index', 'S2 / geohash', 'Data', 'Finds users in nearby cells.', ['Updated when users move.']],
      ['swipe', 'Swipe service', 'Record swipes', 'Service', 'Stores swipes and checks for mutual likes.', ['Idempotent per pair.']],
      ['swipes', 'Swipe store', '(from, to) → like', 'Data', 'Every swipe, keyed by swiper and target.', ['Sharded by user.']],
      ['match', 'Match service', 'Exactly once', 'Service', 'Creates the match when both sides liked.', ['Pair key = sorted ids.']],
      ['matches', 'Match store', 'Pairs', 'Data', 'Durable list of matches per user.', ['Starts the chat.']],
      ['notify', 'Notifier', 'Push + live', 'Async', 'Tells both users about a new match.', ['APNs / FCM.']],
      ['precompute', 'Batch builder', 'Next 100', 'Async', 'Precomputes candidate batches in the background.', ['Filters already-seen profiles.']]
    ],
    edges: [
      ['app', 'gw', 'HTTPS', 'sync', 'Feed and swipe requests.'],
      ['gw', 'feed', 'next batch', 'sync', 'Ask for more candidates.'],
      ['feed', 'gw', 'profiles', 'sync', 'A batch of candidates.'],
      ['gw', 'app', 'response', 'sync', 'Profiles or swipe result.'],
      ['precompute', 'geo', 'nearby', 'sync', 'Find users in nearby cells.'],
      ['precompute', 'swipes', 'seen?', 'sync', 'Drop profiles already swiped.'],
      ['precompute', 'feed', 'batch', 'async', 'Store the next batch for the user.'],
      ['gw', 'swipe', 'swipe', 'sync', 'Record a left or right swipe.'],
      ['swipe', 'swipes', 'append', 'sync', 'Persist the swipe.'],
      ['swipe', 'match', 'right swipe', 'sync', 'Check for a mutual like.'],
      ['match', 'swipes', 'did they like me?', 'sync', 'Look up the reverse swipe.'],
      ['match', 'matches', 'create pair', 'sync', 'Atomic insert keyed by the pair.'],
      ['match', 'notify', 'new match', 'async', 'Tell both people.'],
      ['notify', 'app', 'It\'s a match', 'async', 'Push to both phones.'],
      ['swipe', 'gw', 'ok', 'sync', 'The swipe is acknowledged.']
    ],
    flow: [
      ['Load the stack', 'The app gets a precomputed batch of nearby, unseen candidates.', 'app>gw, gw>feed, feed>gw, gw>app'],
      ['Swipe right and match', 'Record the swipe, find the reverse like, create the match once, notify both.', 'app>gw, gw>swipe, swipe>swipes, swipe>match, match>swipes, match>matches, match>notify, notify>app, swipe>gw, gw>app'],
      ['Prepare the next batch', 'In the background, find nearby users and filter those already seen.', 'precompute>geo, precompute>swipes, precompute>feed']
    ],
    why: [
      'Precomputed batches make the feed a cheap read while the hard query runs in the background.',
      'Swipes are append-only writes sharded by user, which scales horizontally.',
      'Keying a match by the sorted pair makes creation idempotent even under simultaneous swipes.',
      'Notifications are asynchronous so a slow push provider never slows swiping.'
    ],
    tradeoffs: [
      'Precomputing batches costs storage and can show a profile that moved away.',
      'A Bloom filter for seen profiles is compact but occasionally hides a new profile.',
      'Fresher location improves relevance but multiplies geo-index writes.'
    ],
    failures: [
      ['Swipe store overloaded', 'swipes', 'swipe match', 'Swipes fail or lag at peak, and matches are missed.', 'Shard by user, buffer swipes in a queue, and make the match check idempotent on replay.']
    ]
  }
});

DesignCatalog.add({
  id: 'leetcode', difficulty: 'medium', cat: 'Dev tools',
  title: 'Design LeetCode (Online Judge)',
  prompt: [
    'Design an online judge: users submit code for a problem, the system runs it safely against hidden test cases under time and memory limits, and returns a verdict. During contests, show a live leaderboard.',
    '',
    'Scale: 10k submissions per minute normally, 10× during a contest; untrusted code in many languages; verdicts within a few seconds.'
  ].join('\n'),
  hints: [
    'Requirements: submit, judge, verdict (Accepted, Wrong Answer, Time Limit, Runtime Error), contest leaderboard. Non-functional: isolation is non-negotiable, fair timing, burst capacity for contests.',
    'Submissions are asynchronous: accept, enqueue, return a submission id; the client polls or listens for the verdict.',
    'Execute in sandboxes (containers or microVMs) with CPU, memory, time, and network limits. Never on API servers.',
    'Workers pull jobs from a queue, compile, run against test cases, compare output, and write the verdict.',
    'Contests create a burst at the start and end: autoscale workers on queue depth and pre-warm language images.',
    'Leaderboard: a sorted set keyed by score and penalty time, updated when a verdict is Accepted.',
    'Fairness: run each submission on comparable hardware and measure CPU time, not wall time.'
  ],
  topics: ['Async judging queue', 'Sandbox isolation', 'Resource limits', 'Autoscaling for contests', 'Sorted-set leaderboard', 'Fair timing'],
  brief: {
    ask: 'Build the system that runs strangers\' code safely against hidden tests and tells them if it passed.',
    examples: [
      'Priya submits a Python solution to "Two Sum"; 3 seconds later she sees "Accepted — 52 ms, beats 81%".',
      'Someone submits code with an infinite loop; it is stopped after 2 seconds with "Time Limit Exceeded" and nothing else is affected.',
      'Someone submits code that tries to read /etc/passwd or call the internet; it fails inside its sandbox.',
      'At the start of a contest, 50,000 people submit within 10 minutes and the leaderboard updates live.'
    ],
    deliver: ['The submission flow (sync accept, async judge)', 'How untrusted code is isolated and limited', 'How you handle contest bursts', 'How the live leaderboard works']
  },
  map: {
    subtitle: 'Accept fast, judge in sandboxes, rank in a sorted set',
    nodes: [
      ['user', 'Browser', 'Editor + verdict', 'Client', 'Submits code and waits for the verdict.', ['Polls or listens over WebSocket.']],
      ['api', 'API gateway', 'Auth + limits', 'Edge', 'Accepts submissions and status checks.', ['Per-user submit rate limit.']],
      ['submit', 'Submissions', 'Accept + track', 'Service', 'Stores the submission and enqueues a judge job.', ['Returns a submission id.']],
      ['queue', 'Judge queue', 'Per language', 'Async', 'Pending submissions waiting for a worker.', ['Depth drives autoscaling.']],
      ['judge', 'Judge workers', 'Compile + run', 'Service', 'Run code in a sandbox against hidden tests.', ['CPU time, memory, no network.']],
      ['tests', 'Test cases', 'Hidden inputs', 'Data', 'Inputs and expected outputs per problem.', ['Never sent to the client.']],
      ['subs', 'Submission DB', 'Code + verdict', 'Data', 'Every submission and its result.', ['Indexed by user and problem.']],
      ['board', 'Leaderboard', 'Sorted set', 'Data', 'Contest ranking by score, then penalty time.', ['Redis ZSET.']],
      ['events', 'Verdict events', 'Pub/sub', 'Async', 'Pushes verdicts to waiting browsers.', ['Fan-out per contest.']]
    ],
    edges: [
      ['user', 'api', 'submit', 'sync', 'Code + problem + language.'],
      ['api', 'submit', 'create', 'sync', 'Store and enqueue.'],
      ['submit', 'subs', 'pending', 'sync', 'Record the submission.'],
      ['submit', 'queue', 'job', 'async', 'Hand off for judging.'],
      ['submit', 'api', 'submission id', 'sync', 'Returned immediately.'],
      ['api', 'user', 'id / verdict', 'sync', 'The user gets an id, later the verdict.'],
      ['queue', 'judge', 'next job', 'async', 'A worker pulls a job.'],
      ['judge', 'tests', 'load tests', 'sync', 'Fetch hidden inputs.'],
      ['judge', 'subs', 'verdict', 'sync', 'Write the result.'],
      ['judge', 'board', 'accepted', 'sync', 'Update the contest score.'],
      ['judge', 'events', 'verdict', 'async', 'Announce the result.'],
      ['events', 'user', 'live verdict', 'async', 'The browser updates.']
    ],
    flow: [
      ['Submit code', 'Store the submission, enqueue a job, and return an id right away.', 'user>api, api>submit, submit>subs, submit>queue, submit>api, api>user'],
      ['Judge it', 'A worker runs the code in a sandbox against hidden tests and writes the verdict.', 'queue>judge, judge>tests, judge>subs, judge>events, events>user'],
      ['Update the contest', 'An accepted verdict updates the sorted-set leaderboard.', 'judge>board']
    ],
    why: [
      'Asynchronous judging absorbs bursts without timing out submissions.',
      'Sandboxes with hard limits make untrusted code safe to run.',
      'The queue depth is a clean signal for autoscaling workers before a contest.',
      'A sorted set gives O(log n) rank updates and instant top-N reads.'
    ],
    tradeoffs: [
      'MicroVMs isolate better than containers but start slower.',
      'Pre-warming capacity for contests costs money while idle.',
      'Exact timing fairness requires dedicated cores, which lowers density.'
    ],
    failures: [
      ['Contest burst exceeds workers', 'judge', 'queue user', 'Verdicts take minutes instead of seconds during the contest start.', 'Pre-scale before start, prioritize contest submissions, and show queue position.']
    ]
  }
});

DesignCatalog.add({
  id: 'rate-limiter', difficulty: 'medium', cat: 'Platform',
  title: 'Design a Distributed Rate Limiter',
  prompt: [
    'Design a rate limiter that enforces limits such as "100 requests per minute per API key" across a fleet of 50 stateless API servers.',
    '',
    'It must add under 5 ms p99, stay correct when two servers see the same key at the same moment, and behave sensibly when its own storage is down.'
  ].join('\n'),
  hints: [
    'Know the algorithms: fixed window (bursts at boundaries), sliding log (accurate, memory heavy), sliding window counter (cheap approximation), token bucket (bursts plus a steady rate).',
    'Token bucket is a strong default for APIs: O(1) state per key, allows short bursts, enforces a long-run rate.',
    'Central state in Redis with an atomic Lua script (refill by elapsed time, then decrement) avoids races between servers.',
    'Return 429 with Retry-After and remaining-quota headers so well-behaved clients back off.',
    'Keep rules (limits per plan/route) in config pushed to limiters, not fetched per request.',
    'Decide fail-open vs fail-closed when Redis is down, per route: usually open for reads with a local fallback, closed for sensitive writes.',
    'Very high QPS: local token buckets with a slice of the global budget, synced periodically, trading exactness for latency.'
  ],
  topics: ['Token bucket', 'Sliding window', 'Atomic Lua script', '429 + Retry-After', 'Fail-open vs fail-closed', 'Local vs global counters'],
  brief: {
    ask: 'Build the component that stops any single API key from making more than its allowed number of requests, even across many servers.',
    examples: [
      'Key sk_42 sends 100 requests in the first 20 seconds of a minute: all are allowed.',
      'Its 101st request gets HTTP 429 with "Retry-After: 40".',
      'Two servers handle the 100th and 101st request at the same millisecond: exactly one is allowed.',
      'Redis is down for 30 seconds: the API keeps serving reads instead of rejecting everyone.'
    ],
    deliver: ['Which algorithm and why', 'Where counters live and how the check stays atomic', 'What clients see when limited', 'Behavior when the counter store is down']
  },
  map: {
    subtitle: 'One atomic decision per request, with a local safety net',
    nodes: [
      ['client', 'Client', 'API key holder', 'Client', 'Calls the API with an identity.', ['Bursts matter more than averages.']],
      ['gateway', 'API gateway', 'Enforcement', 'Edge', 'Asks the limiter before routing the request.', ['Rejects with 429.']],
      ['limiter', 'Limiter', 'Token bucket', 'Service', 'Builds the key and asks the counter store for a decision.', ['Key: tenant + route.']],
      ['redis', 'Counter store', 'Redis + Lua', 'Data', 'Atomic refill-and-decrement per key.', ['Keys expire when idle.']],
      ['rules', 'Rules config', 'Limits per plan', 'Data', 'Limits per plan, route, and override.', ['Pushed, not fetched.']],
      ['local', 'Local fallback', 'In-process bucket', 'Service', 'Approximate limiting when Redis is unreachable.', ['Fail-open or closed per route.']],
      ['backend', 'Backend services', 'The real API', 'Service', 'Handles allowed requests.', ['Protected from overload.']],
      ['metrics', 'Metrics', 'Allow / deny', 'Obs', 'Deny rates, latency, fallback usage.', ['Alert on fallback.']]
    ],
    edges: [
      ['client', 'gateway', 'request', 'sync', 'Every call passes the gateway.'],
      ['gateway', 'limiter', 'check', 'sync', 'Decision before routing.'],
      ['limiter', 'redis', 'atomic script', 'sync', 'Refill + decrement in one step.'],
      ['redis', 'limiter', 'allow / deny', 'sync', 'Includes remaining tokens.'],
      ['rules', 'limiter', 'limits', 'async', 'Config pushed to limiters.'],
      ['limiter', 'local', 'on error', 'sync', 'Fallback when Redis fails.'],
      ['limiter', 'gateway', 'decision', 'sync', 'Allow, or 429 + Retry-After.'],
      ['gateway', 'backend', 'allowed', 'sync', 'Route allowed requests.'],
      ['backend', 'gateway', 'response', 'sync', 'The API answer.'],
      ['gateway', 'client', '200 / 429', 'sync', 'The caller gets the result.'],
      ['limiter', 'metrics', 'decisions', 'obs', 'Counts and latency.']
    ],
    flow: [
      ['Allowed request', 'One atomic check passes, the request reaches the backend, and the response returns.', 'client>gateway, gateway>limiter, limiter>redis, redis>limiter, limiter>gateway, gateway>backend, backend>gateway, gateway>client'],
      ['Over the limit', 'The bucket is empty, so the gateway answers 429 with Retry-After.', 'client>gateway, gateway>limiter, limiter>redis, redis>limiter, limiter>gateway, gateway>client'],
      ['Counter store down', 'The limiter falls back to a local bucket and reports it.', 'gateway>limiter, limiter>local, limiter>metrics, limiter>gateway']
    ],
    why: [
      'One atomic operation means two servers can never both take the last token.',
      'Token buckets allow natural bursts while enforcing a long-run rate.',
      'Rules are pushed, keeping config lookups off the hot path.',
      'A local fallback keeps the API available when shared state is not.'
    ],
    tradeoffs: [
      'Fail-open keeps availability but invites abuse; fail-closed protects but can cause an outage.',
      'Exact sliding windows cost memory; approximations are cheap and usually fine.',
      'A Redis round trip per request is ~1 ms; extreme QPS needs local pre-checks.'
    ],
    failures: [
      ['Redis outage', 'redis', 'limiter gateway', 'Shared counters are unreachable; each server is on its own.', 'Local buckets per server, fail open for reads and closed for sensitive writes.']
    ]
  }
});

DesignCatalog.add({
  id: 'google-calendar', difficulty: 'medium', cat: 'Productivity',
  title: 'Design Google Calendar',
  prompt: [
    'Design a calendar service: users create events (one-off or recurring), invite attendees, see their week in their own timezone, and get reminders.',
    '',
    'Scale: 500M users, an average of 50 events per user including recurring series, week view must load in under 300 ms, and reminders must fire on time.'
  ].join('\n'),
  hints: [
    'Requirements: create/edit events, recurrence (RRULE), invites with RSVP, free/busy, reminders. Non-functional: correct across timezones and DST, fast range queries.',
    'Key insight: a recurring event is a rule, not a list. Store the rule (RRULE + timezone) and expand occurrences only for the window being viewed.',
    'Exceptions to a series ("this Tuesday is moved") are stored as overrides keyed by the original occurrence time.',
    'Store times as an instant plus the event\'s original timezone, so "9 am every Monday in New York" stays 9 am after DST changes.',
    'Attendees: one canonical event owned by the organizer; each attendee has an entry pointing to it with their RSVP. Edits fan out as updates.',
    'Range query: index events by owner and time; for recurring series, index by series start and end, then expand in the service.',
    'Reminders: a scheduler with time-bucketed queues fires notifications; recompute when an event changes.'
  ],
  topics: ['Recurrence rules (RRULE)', 'Expand per query window', 'Timezones and DST', 'Exceptions / overrides', 'Attendee fan-out', 'Reminder scheduling'],
  brief: {
    ask: 'Build the calendar backend: events that repeat, cross timezones, have many attendees, and remind people on time.',
    examples: [
      'Sam creates "Team standup, every weekday 9:30 am New York" and it shows up correctly for a teammate in London at 2:30 pm.',
      'After daylight saving time changes, the standup is still 9:30 am in New York.',
      'Sam moves only next Tuesday\'s standup to 10 am; every other day stays at 9:30.',
      'Ten minutes before the meeting, all 8 attendees get a reminder on their phones.'
    ],
    deliver: ['How recurring events are stored and expanded', 'How timezones and DST are handled', 'How invites and RSVPs work', 'How reminders fire on time']
  },
  map: {
    subtitle: 'Store recurrence as a rule, expand it per window, remind on schedule',
    nodes: [
      ['client', 'Calendar app', 'Week view', 'Client', 'Shows events in the user\'s timezone.', ['Caches visible weeks.']],
      ['api', 'API gateway', 'Auth + routing', 'Edge', 'Entry point for event and view calls.', ['Sync for mobile clients.']],
      ['events', 'Event service', 'Create + edit', 'Service', 'Owns events, series, and exceptions.', ['Validates RRULE + timezone.']],
      ['expand', 'Expander', 'Rule → occurrences', 'Service', 'Turns series rules into occurrences for a time window.', ['Applies exceptions.']],
      ['invites', 'Invite service', 'RSVP + fan-out', 'Service', 'Adds the event to attendees and tracks responses.', ['Sends email invites.']],
      ['store', 'Event store', 'Events + series', 'Data', 'Canonical events, series rules, and overrides.', ['Indexed by owner and time.']],
      ['attend', 'Attendee index', 'User → events', 'Data', 'Which events each user is invited to.', ['Holds RSVP status.']],
      ['sched', 'Reminders', 'Time buckets', 'Async', 'Queues reminders by the minute they fire.', ['Recomputed on edits.']],
      ['push', 'Notifier', 'Push / email', 'Async', 'Delivers reminders and invites.', ['Deduplicated.']]
    ],
    edges: [
      ['client', 'api', 'HTTPS', 'sync', 'Views and edits.'],
      ['api', 'events', 'create / edit', 'sync', 'Write an event or series.'],
      ['events', 'store', 'save', 'sync', 'Persist the event or rule.'],
      ['events', 'invites', 'attendees', 'sync', 'Fan out to invitees.'],
      ['invites', 'attend', 'add entries', 'sync', 'One entry per attendee.'],
      ['invites', 'push', 'invite', 'async', 'Email and push invites.'],
      ['events', 'sched', 'reminders', 'async', 'Schedule reminders.'],
      ['api', 'expand', 'week view', 'sync', 'Ask for a time window.'],
      ['expand', 'store', 'series in range', 'sync', 'Load rules and overrides.'],
      ['expand', 'attend', 'my invites', 'sync', 'Include events I was invited to.'],
      ['expand', 'api', 'occurrences', 'sync', 'Concrete events for the window.'],
      ['events', 'api', 'saved', 'sync', 'The edit result.'],
      ['api', 'client', 'response', 'sync', 'The user sees their week.'],
      ['sched', 'push', 'due now', 'async', 'Fire reminders.'],
      ['push', 'client', 'reminder', 'async', 'Notification on the device.']
    ],
    flow: [
      ['Create a recurring meeting', 'Save the rule, add attendees, send invites, and schedule reminders.', 'client>api, api>events, events>store, events>invites, invites>attend, invites>push, events>sched, events>api, api>client'],
      ['Open my week', 'Expand every relevant series into occurrences for this week, with exceptions applied.', 'client>api, api>expand, expand>store, expand>attend, expand>api, api>client'],
      ['Reminder fires', 'The scheduler fires due reminders through the notifier.', 'sched>push, push>client']
    ],
    why: [
      'Storing the rule keeps "every weekday forever" to one row instead of infinite rows.',
      'Expanding only the requested window keeps reads bounded and fast.',
      'Keeping the event\'s own timezone makes DST changes behave the way people expect.',
      'Time-bucketed reminders turn "fire at 9:20" into a cheap scan of one bucket.'
    ],
    tradeoffs: [
      'Expanding at read time costs CPU; caching expanded weeks helps but needs invalidation on edits.',
      'One canonical event simplifies edits but makes huge meetings a fan-out problem.',
      'Materializing occurrences simplifies queries but breaks for "forever" series.'
    ],
    failures: [
      ['Reminder scheduler lags', 'sched', 'push', 'Reminders arrive late, after the meeting starts.', 'Partition buckets across workers, alert on lag, and drop reminders that are already too late.']
    ]
  }
});

DesignCatalog.add({
  id: 'twitter', difficulty: 'medium', cat: 'Social',
  title: 'Design Twitter',
  prompt: [
    'Design a simplified Twitter: users post short tweets, follow other users, and see a home timeline of recent tweets from the people they follow.',
    '',
    'Scale: 300M daily users, 500M tweets per day, timeline reads far outnumber writes, and some accounts have 100M+ followers.'
  ].join('\n'),
  hints: [
    'Start from verbs: post a tweet, follow/unfollow, read the home timeline. Nouns become entities: User, Tweet, Follow. Adjectives become constraints: fast timeline, huge follower counts.',
    'Estimate: 500M tweets/day ≈ 6k writes/s; timeline reads are ~100× more, so the read path drives the design.',
    'Fan-out on write: when a user tweets, push the tweet id into each follower\'s timeline cache. Reads become a single cache read.',
    'The celebrity problem: pushing to 100M followers per tweet is too expensive. Pull celebrity tweets at read time and merge them in (hybrid fan-out).',
    'Store tweets in a sharded store by tweet id; the timeline cache holds only ids, hydrated at read time.',
    'Engagement (likes, retweets) is a separate high-write counter store, eventually consistent.',
    'Search and trends are separate pipelines fed by the tweet stream, not queries on the main database.'
  ],
  topics: ['Verbs → nouns → adjectives', 'Fan-out on write', 'Celebrity problem / hybrid fan-out', 'Timeline cache of ids', 'Sharded tweet store', 'Eventually consistent counters'],
  brief: {
    ask: 'Build a simplified Twitter: post short messages, follow people, and read a fast timeline of what they posted.',
    examples: [
      'Ana posts "Shipping v2 today 🚀"; her 300 followers see it at the top of their timelines within seconds.',
      'Ben opens the app and his home timeline of the latest 50 tweets loads in under 200 ms.',
      'A pop star with 100M followers tweets, and the system does not try to write 100M timelines synchronously.',
      'Ben unfollows Ana and her tweets stop appearing in his timeline.'
    ],
    deliver: ['APIs for post, follow, and timeline', 'Fan-out strategy and the celebrity case', 'Where tweets, follows, and timelines are stored', 'How likes and counts are handled']
  },
  map: {
    subtitle: 'Fan out on write for most users, pull at read time for celebrities',
    nodes: [
      ['app', 'App', 'iOS / Android / web', 'Client', 'Posts tweets and reads the timeline.', ['Cursor pagination.']],
      ['gw', 'API gateway', 'Auth + routing', 'Edge', 'Entry point for every call.', ['Rate-limits posting.']],
      ['tweet', 'Tweet service', 'Post + read', 'Service', 'Stores tweets and emits a new-tweet event.', ['Snowflake-style ids.']],
      ['graph', 'Follow graph', 'Who follows whom', 'Service', 'Follow/unfollow and follower lists.', ['Cached follower lists.']],
      ['fanout', 'Fan-out workers', 'Push to timelines', 'Async', 'Write new tweet ids into followers\' timelines.', ['Skips celebrities.']],
      ['timeline', 'Timeline service', 'Read + merge', 'Service', 'Reads the cached timeline and merges celebrity tweets.', ['Hydrates ids into tweets.']],
      ['tlcache', 'Timeline cache', 'User → tweet ids', 'Data', 'Recent tweet ids per user, newest first.', ['Bounded to ~800 ids.']],
      ['tweets', 'Tweet store', 'Sharded by id', 'Data', 'Durable tweets.', ['Read by id.']],
      ['likes', 'Engagement', 'Likes + counts', 'Data', 'Likes and retweet counters.', ['Eventually consistent.']]
    ],
    edges: [
      ['app', 'gw', 'HTTPS', 'sync', 'Post, follow, and read.'],
      ['gw', 'tweet', 'post', 'sync', 'Create a tweet.'],
      ['tweet', 'tweets', 'save', 'sync', 'Persist the tweet.'],
      ['tweet', 'fanout', 'new tweet', 'async', 'Start fan-out.'],
      ['fanout', 'graph', 'followers', 'sync', 'Who should receive it.'],
      ['fanout', 'tlcache', 'push id', 'async', 'Prepend to each follower timeline.'],
      ['tweet', 'gw', 'tweet id', 'sync', 'Posting returns immediately.'],
      ['gw', 'timeline', 'home', 'sync', 'Read the home timeline.'],
      ['timeline', 'tlcache', 'my ids', 'sync', 'Precomputed ids.'],
      ['timeline', 'graph', 'celebs I follow', 'sync', 'Find accounts to pull.'],
      ['timeline', 'tweets', 'hydrate', 'sync', 'Fetch tweet bodies and celebrity tweets.'],
      ['timeline', 'likes', 'counts', 'sync', 'Attach like counts.'],
      ['timeline', 'gw', 'tweets', 'sync', 'The merged timeline.'],
      ['gw', 'app', 'response', 'sync', 'The user sees the result.']
    ],
    flow: [
      ['Post a tweet', 'Save the tweet, return its id, and fan out to followers in the background.', 'app>gw, gw>tweet, tweet>tweets, tweet>gw, gw>app, tweet>fanout, fanout>graph, fanout>tlcache'],
      ['Read the home timeline', 'Read precomputed ids, merge in celebrity tweets, hydrate, and attach counts.', 'app>gw, gw>timeline, timeline>tlcache, timeline>graph, timeline>tweets, timeline>likes, timeline>gw, gw>app']
    ],
    why: [
      'Precomputed timelines make the dominant read a single cache lookup.',
      'Skipping fan-out for celebrities bounds write amplification.',
      'Timelines store ids, so edits and deletes show up on hydration.',
      'Engagement counters are separate, so like storms never slow timelines.'
    ],
    tradeoffs: [
      'Fan-out on write wastes work for inactive followers.',
      'Pulling celebrities at read time adds latency to every timeline that follows them.',
      'Eventually consistent counts can briefly look wrong.'
    ],
    failures: [
      ['Fan-out backlog', 'fanout', 'tlcache timeline', 'New tweets take minutes to appear in followers\' timelines.', 'Scale workers on queue depth and merge very recent tweets at read time.']
    ]
  }
});

DesignCatalog.add({
  id: 'yelp', difficulty: 'medium', cat: 'Local',
  title: 'Design Yelp',
  prompt: [
    'Design a local business discovery app: users search for places near them (for example "coffee open now within 1 mile"), view business pages, and write reviews with ratings and photos.',
    '',
    'Scale: 200M businesses worldwide, 100M monthly users, search is the hot path (~50k QPS at peak), and reviews are written far less often than read.'
  ].join('\n'),
  hints: [
    'Requirements: nearby search with filters, business details, reviews and ratings. Non-functional: fast search, ratings reasonably fresh.',
    'Geospatial indexing: geohash, quadtree, or S2 cells turn "within 1 mile" into a lookup of a few cells.',
    'Combine geo with text and filters in a search index (e.g. Elasticsearch with geo_point), fed asynchronously from the business database.',
    'Business data changes rarely, so cache business pages and search results for popular areas.',
    'Reviews are writes to a review store; the average rating is a precomputed aggregate updated asynchronously.',
    'Ranking: distance, rating, number of reviews, and relevance; keep it simple and explain the knobs.',
    'Photos go to object storage behind a CDN.'
  ],
  topics: ['Geohash / quadtree', 'Search index with geo filters', 'Read-heavy caching', 'Precomputed rating aggregates', 'Ranking signals', 'Photos via CDN'],
  brief: {
    ask: 'Build the search and review system behind Yelp: find good places near you and read what others thought.',
    examples: [
      'Lena in Chicago searches "ramen open now" and sees 20 places within 2 miles, sorted by rating and distance, in 300 ms.',
      'She opens a restaurant page and sees 4.6 stars from 2,431 reviews, hours, and photos.',
      'She writes a 5-star review with two photos; within a minute it appears on the page.',
      'A new café opens and appears in nearby searches the same day.'
    ],
    deliver: ['How "near me" search works', 'How text, filters, and location combine', 'How reviews and ratings are stored and updated', 'What you cache and why']
  },
  map: {
    subtitle: 'Geo + text search over a read-heavy catalog with async rating aggregates',
    nodes: [
      ['app', 'App', 'Search + map', 'Client', 'Searches nearby and reads business pages.', ['Sends location.']],
      ['cdn', 'CDN', 'Photos', 'Edge', 'Serves review and business photos.', ['Origin is object storage.']],
      ['gw', 'API gateway', 'Auth + routing', 'Edge', 'Entry point for search, pages, and reviews.', ['Caches popular queries.']],
      ['search', 'Search service', 'Geo + text', 'Service', 'Runs nearby queries with filters and ranking.', ['Distance, rating, relevance.']],
      ['index', 'Search index', 'geo_point + text', 'Data', 'Businesses indexed by location, text, and attributes.', ['Fed by CDC.']],
      ['biz', 'Business service', 'Pages', 'Service', 'Business details, hours, and aggregates.', ['Heavily cached.']],
      ['reviews', 'Review service', 'Write + list', 'Service', 'Accepts and lists reviews.', ['Spam filtering.']],
      ['bizdb', 'Business DB', 'Source of truth', 'Data', 'Business records.', ['Changes rarely.']],
      ['revdb', 'Review store', 'By business', 'Data', 'Reviews sharded by business id.', ['Paged by time.']],
      ['agg', 'Rating rollup', 'Avg + count', 'Async', 'Recomputes average ratings after new reviews.', ['Writes back to the business.']],
      ['photos', 'Object storage', 'Photos', 'Data', 'Uploaded images.', ['Multiple sizes.']]
    ],
    edges: [
      ['app', 'gw', 'HTTPS', 'sync', 'Search, page, and review calls.'],
      ['gw', 'search', 'near me', 'sync', 'Search with location and filters.'],
      ['search', 'index', 'geo query', 'sync', 'Cells + text + filters.'],
      ['search', 'gw', 'results', 'sync', 'Ranked list.'],
      ['gw', 'biz', 'page', 'sync', 'Business details.'],
      ['biz', 'bizdb', 'read', 'sync', 'Details and rating.'],
      ['biz', 'reviews', 'top reviews', 'sync', 'First page of reviews.'],
      ['biz', 'gw', 'page', 'sync', 'Details + reviews.'],
      ['gw', 'reviews', 'write review', 'sync', 'Post a review.'],
      ['reviews', 'revdb', 'save', 'sync', 'Store the review.'],
      ['reviews', 'photos', 'upload', 'sync', 'Store photos.'],
      ['reviews', 'agg', 'new review', 'async', 'Trigger re-aggregation.'],
      ['agg', 'bizdb', 'new average', 'async', 'Update rating and count.'],
      ['bizdb', 'index', 'CDC', 'async', 'Keep the index in sync.'],
      ['photos', 'cdn', 'origin', 'sync', 'CDN pulls on a miss.'],
      ['cdn', 'app', 'images', 'sync', 'Photos load from the edge.'],
      ['gw', 'app', 'response', 'sync', 'Results, pages, confirmations.']
    ],
    flow: [
      ['Search nearby', 'Query the index by nearby cells, text, and filters; rank and return.', 'app>gw, gw>search, search>index, search>gw, gw>app'],
      ['Open a business', 'Read details and the first page of reviews; photos come from the CDN.', 'app>gw, gw>biz, biz>bizdb, biz>reviews, biz>gw, gw>app, photos>cdn, cdn>app'],
      ['Write a review', 'Store the review and photos; the average rating updates asynchronously.', 'app>gw, gw>reviews, reviews>revdb, reviews>photos, reviews>agg, agg>bizdb, bizdb>index, gw>app']
    ],
    why: [
      'Geo cells make "near me" a small, bounded lookup.',
      'A search index handles text, filters, and location in one query.',
      'Ratings are precomputed, so pages never average thousands of reviews per view.',
      'Business data changes rarely, which makes caching very effective.'
    ],
    tradeoffs: [
      'Async aggregation means a new review takes a moment to change the stars.',
      'Fixed-size geohash cells are simple but uneven in dense cities; quadtrees adapt.',
      'Caching search results speeds popular areas but serves slightly stale data.'
    ],
    failures: [
      ['Search index down', 'index', 'search', 'Nearby search fails even though business pages still work.', 'Replicate the index, serve cached results for popular areas, and degrade to a simple geo query.']
    ]
  }
});

DesignCatalog.add({
  id: 'netflix', difficulty: 'medium', cat: 'Media',
  title: 'Design Netflix',
  prompt: [
    'Design a video streaming service that plays a curated catalog to tens of millions of concurrent viewers with fast start and no buffering.',
    '',
    'Scale: 30M concurrent streams at peak, an average of 5 Mbps each (about 150 Tbps of egress), a catalog of tens of thousands of titles, and new releases every week.'
  ].join('\n'),
  hints: [
    'Requirements: browse, play, resume where you left off. Non-functional: fast start (< 2 s), no rebuffering, global reach, cost-efficient delivery.',
    'The hard part is delivery economics: 150 Tbps cannot come from a central origin. Video must come from edge caches close to viewers, ideally inside ISPs.',
    'Encode each title once into many bitrate/resolution renditions, split into small segments, and package for adaptive streaming (HLS/DASH).',
    'Adaptive bitrate: the player measures bandwidth and picks the next segment\'s quality, which prevents buffering.',
    'Pre-position popular titles on edge caches overnight, before demand, because the catalog is curated and predictable.',
    'Control plane vs data plane: the API (browse, auth, playback URLs) is small; the bytes are almost all edge traffic.',
    'Playback session service hands out signed URLs pointing at the best edge for that viewer.'
  ],
  topics: ['Edge caches inside ISPs', 'Transcoding renditions', 'Adaptive bitrate streaming', 'Pre-positioning content', 'Control vs data plane', 'Signed playback URLs'],
  brief: {
    ask: 'Build the system that lets millions of people press play at the same time and watch without buffering.',
    examples: [
      'Jo presses play on a new series in Toronto; video starts in 1.5 seconds.',
      'Her Wi-Fi drops to 3 Mbps; the picture drops from 1080p to 720p without stopping.',
      'On release night, 8 million people start the same episode and most bytes come from servers inside their ISP.',
      'Jo stops on her laptop and resumes on her TV at the same second.'
    ],
    deliver: ['How video is prepared (encoding, segments, renditions)', 'How bytes reach viewers at 150 Tbps', 'How the player avoids buffering', 'What the control plane does vs the data plane']
  },
  map: {
    subtitle: 'A small control plane and a massive edge data plane',
    nodes: [
      ['player', 'Player', 'TV / phone / web', 'Client', 'Requests manifests and video segments.', ['Adaptive bitrate.']],
      ['edge', 'Edge caches', 'Inside ISPs', 'Edge', 'Serve video segments close to viewers.', ['Pre-filled overnight.']],
      ['api', 'API gateway', 'Control plane', 'Edge', 'Browse, auth, and playback requests.', ['Small traffic.']],
      ['catalog', 'Catalog', 'Titles + art', 'Service', 'What is available to watch.', ['Heavily cached.']],
      ['playback', 'Playback service', 'Signed URLs', 'Service', 'Chooses the best edge and returns a manifest.', ['DRM license.']],
      ['progress', 'Watch progress', 'Resume point', 'Service', 'Records where each profile stopped.', ['Written every few seconds.']],
      ['encode', 'Encoder', 'Renditions', 'Async', 'Encodes each title into many bitrates and segments.', ['Parallel per chunk.']],
      ['origin', 'Origin storage', 'Masters + segments', 'Data', 'Source of every rendition.', ['Rarely hit by viewers.']],
      ['fill', 'Edge fill', 'Pre-position', 'Async', 'Copies predicted-popular titles to edges off-peak.', ['Uses quiet hours.']],
      ['qoe', 'Playback metrics', 'Start, rebuffering', 'Obs', 'Quality of experience from every player.', ['Drives edge steering.']]
    ],
    edges: [
      ['player', 'api', 'browse / play', 'sync', 'Control requests.'],
      ['api', 'catalog', 'titles', 'sync', 'Browse rows.'],
      ['api', 'playback', 'start', 'sync', 'Begin a session.'],
      ['playback', 'api', 'manifest + edge', 'sync', 'Signed URLs to the best edge.'],
      ['api', 'player', 'response', 'sync', 'Catalog or manifest.'],
      ['player', 'edge', 'segments', 'sync', 'Fetch video chunk by chunk.'],
      ['edge', 'player', 'video', 'sync', 'Bytes from nearby.'],
      ['edge', 'origin', 'miss', 'sync', 'Rare cache misses.'],
      ['player', 'progress', 'position', 'async', 'Periodic resume point.'],
      ['encode', 'origin', 'renditions', 'async', 'Write encoded segments.'],
      ['fill', 'origin', 'read', 'async', 'Pull popular titles.'],
      ['fill', 'edge', 'pre-position', 'async', 'Fill edges before demand.'],
      ['player', 'qoe', 'stats', 'obs', 'Start time and rebuffers.']
    ],
    flow: [
      ['Press play', 'Get a manifest pointing to the best edge, then stream segments from it.', 'player>api, api>playback, playback>api, api>player, player>edge, edge>player'],
      ['Prepare a new release', 'Encode renditions, store them, and pre-position them on edges overnight.', 'encode>origin, fill>origin, fill>edge'],
      ['Keep watching', 'The player adapts quality per segment and saves the resume point.', 'player>edge, edge>player, player>progress, player>qoe']
    ],
    why: [
      'Edge caches near viewers make 150 Tbps affordable and fast.',
      'Pre-positioning works because the catalog is curated and demand is predictable.',
      'Small segments in many bitrates let the player adapt without stopping.',
      'Separating control from data keeps the API small and the bytes local.'
    ],
    tradeoffs: [
      'More renditions improve quality matching but multiply storage and encoding cost.',
      'Placing caches in ISPs requires partnerships and hardware operations.',
      'Long segments improve compression; short segments start faster and adapt quicker.'
    ],
    failures: [
      ['Regional edge outage', 'edge', 'player origin', 'Players fall back to farther caches or the origin, and start times climb.', 'Steer to the next-best edge using QoE data, and keep origin capacity for spillover.']
    ]
  }
});

DesignCatalog.add({
  id: 'robinhood', difficulty: 'medium', cat: 'Fintech',
  title: 'Design Robinhood (Stock Trading)',
  prompt: [
    'Design a retail stock trading app: users watch live prices, place buy and sell orders, and see their positions and balance update.',
    '',
    'Scale: 10M daily users, 50k orders per second at market open, live prices for 10k symbols, and the ledger of money and shares must never be wrong.'
  ].join('\n'),
  hints: [
    'Two systems with opposite needs: a lossy, high-fan-out price broadcast and an exactly-once order and ledger path.',
    'Prices: consume the market data feed, conflate to the latest price per symbol, and push to clients over WebSocket. A dropped tick is fine.',
    'Orders: validate buying power, reserve funds, and send to an exchange or market maker through a broker gateway (FIX).',
    'Idempotency key per order so retries never place two orders.',
    'Order state machine: new → sent → partially filled → filled / cancelled / rejected. Fills arrive asynchronously from the exchange.',
    'Ledger: double-entry records for cash and shares, updated in one transaction per fill; balances are derived.',
    'Market open is a thundering herd: queue orders, scale gateways ahead of 9:30, and protect the ledger with backpressure.'
  ],
  topics: ['Lossy price fan-out', 'Conflation', 'Order state machine', 'Idempotent orders', 'Buying-power reservation', 'Double-entry ledger', 'Market-open spike'],
  brief: {
    ask: 'Build the app where people watch stock prices move and buy or sell shares, without ever losing track of their money.',
    examples: [
      'Raj watches AAPL tick from 189.10 to 189.15 on his phone in real time.',
      'He taps "Buy 10 shares"; his buying power drops by about $1,892 immediately and the order is sent.',
      'The exchange fills 6 shares, then 4 more; his position shows 10 shares and his cash is exactly right.',
      'His app retries the order after a timeout, and only one order is placed.'
    ],
    deliver: ['How live prices reach millions of screens', 'The order lifecycle from tap to fill', 'How money and shares are recorded correctly', 'How you survive the 9:30 am spike']
  },
  map: {
    subtitle: 'A lossy price broadcast next to an exactly-once order ledger',
    nodes: [
      ['app', 'Trading app', 'Prices + orders', 'Client', 'Shows live prices and places orders.', ['WebSocket for prices.']],
      ['gw', 'API gateway', 'Auth + limits', 'Edge', 'Entry point for orders and account data.', ['Holds live connections.']],
      ['prices', 'Price fan-out', 'Latest per symbol', 'Service', 'Pushes conflated prices to subscribers.', ['Drops stale ticks.']],
      ['feed', 'Market data', 'Exchange feed', 'Client', 'Incoming quotes for every symbol.', ['Very high rate.']],
      ['orders', 'Order service', 'State machine', 'Service', 'Validates, reserves funds, and tracks order state.', ['Idempotency key per order.']],
      ['risk', 'Buying power', 'Reserve funds', 'Service', 'Checks and holds cash before sending.', ['Fail closed.']],
      ['broker', 'Broker gateway', 'FIX to exchange', 'Service', 'Sends orders out and receives fills.', ['Sequence numbers.']],
      ['fills', 'Fill events', 'From exchange', 'Async', 'Partial and full fills arrive asynchronously.', ['Ordered per order.']],
      ['ledger', 'Ledger', 'Cash + shares', 'Data', 'Double-entry records; balances derived.', ['One transaction per fill.']],
      ['orderdb', 'Order store', 'Orders + states', 'Data', 'Durable order records.', ['Audit trail.']]
    ],
    edges: [
      ['feed', 'prices', 'quotes', 'async', 'Raw ticks from the exchange.'],
      ['prices', 'gw', 'latest price', 'async', 'Conflated per symbol.'],
      ['gw', 'app', 'live price / result', 'sync', 'Prices and responses reach the app.'],
      ['app', 'gw', 'place order', 'sync', 'Buy or sell with an idempotency key.'],
      ['gw', 'orders', 'order', 'sync', 'Create the order.'],
      ['orders', 'risk', 'reserve', 'sync', 'Hold buying power.'],
      ['orders', 'orderdb', 'new', 'sync', 'Persist the order.'],
      ['orders', 'broker', 'send', 'sync', 'Route to the exchange.'],
      ['orders', 'gw', 'accepted', 'sync', 'The user sees "order placed".'],
      ['broker', 'fills', 'fill', 'async', 'Exchange reports executions.'],
      ['fills', 'orders', 'update state', 'async', 'Partial or full fill.'],
      ['orders', 'ledger', 'post fill', 'sync', 'Move cash and shares atomically.']
    ],
    flow: [
      ['Watch prices', 'Ticks are conflated to the latest price per symbol and pushed to open apps.', 'feed>prices, prices>gw, gw>app'],
      ['Place an order', 'Reserve buying power, persist, send to the exchange, and confirm to the user.', 'app>gw, gw>orders, orders>risk, orders>orderdb, orders>broker, orders>gw, gw>app'],
      ['Get filled', 'Fills update the order state and post cash and shares to the ledger.', 'broker>fills, fills>orders, orders>ledger']
    ],
    why: [
      'Prices tolerate loss, so conflation keeps the broadcast cheap and current.',
      'Orders and money do not, so they go through an idempotent, durable path.',
      'Reserving funds first prevents spending the same cash twice.',
      'Double-entry postings per fill keep cash and shares always explainable.'
    ],
    tradeoffs: [
      'Reserving funds can block a second order briefly; it is the safe choice.',
      'Conflation means some intermediate prices are never shown.',
      'Queuing orders at open protects the ledger but adds a little latency.'
    ],
    failures: [
      ['Broker gateway disconnects', 'broker', 'orders fills', 'Orders cannot reach the exchange, and fills for open orders stop arriving.', 'Reconnect with sequence-number recovery, mark orders "pending", and reconcile with the exchange.']
    ]
  }
});
