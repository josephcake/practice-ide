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
  }
});
