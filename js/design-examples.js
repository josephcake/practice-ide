/* ============================================================
   SYSTEM DESIGN — "what is being asked" briefs
   ask:      the task in one plain sentence
   examples: concrete user-visible interactions the system must support
   deliver:  what the interviewer expects you to produce
   ============================================================ */

const DESIGN_BRIEFS = {
  'url-shortener': {
    ask: 'Build the service behind bit.ly: turn a long link into a short one, and send anyone who opens the short link to the original page fast.',
    examples: [
      'Alice pastes https://news.example.com/2026/10/markets/very-long-article-id?ref=email and gets back https://sho.rt/aB3xK9q.',
      'Bob clicks https://sho.rt/aB3xK9q on his phone and lands on the article in under 50 ms of added latency.',
      'The same link is clicked 2 million times in an hour after going viral. Redirects must stay fast.',
      'Alice opens her dashboard and sees "1,204 clicks today, 63% mobile".'
    ],
    deliver: ['The two APIs (create, redirect) and how codes are generated', 'QPS and storage estimate for 100M links/day', 'Where reads are cached and how a viral link is handled', 'Why analytics never slows a redirect']
  },
  'rate-limiter': {
    ask: 'Build the component that stops any single API key from making more than 100 requests per minute, even though traffic is spread over 50 servers.',
    examples: [
      'Key sk_live_42 sends 100 requests in the first 20 seconds of a minute: all succeed.',
      'Its 101st request gets HTTP 429 with "Retry-After: 40".',
      'Two servers receive the key\'s 100th and 101st requests at the same millisecond: exactly one is allowed.',
      'Redis goes down for 30 seconds: the API keeps serving instead of rejecting everyone.'
    ],
    deliver: ['Which algorithm (token bucket, sliding window, ...) and why', 'Where the counter lives and how the check stays atomic', 'What happens when the shared store is down (fail-open or fail-closed)', 'Latency budget: under 5 ms p99 added']
  },
  cache: {
    ask: 'Put a cache in front of a database that receives 200k reads per second, so most reads never touch the database.',
    examples: [
      'GET /product/123 is requested 5,000 times a second: the database sees it about once per TTL.',
      'A price is updated in the database: readers see the new price within a second or two, not an hour later.',
      'A popular key expires and 10,000 requests miss at once: the database gets one load, not 10,000.',
      'The whole cache cluster restarts: the site gets slower but does not fall over.'
    ],
    deliver: ['What to cache and the read/write pattern (cache-aside, write-through, ...)', 'Eviction and TTL choice', 'How writes invalidate stale data', 'Stampede and hot-key protection, and behaviour when the cache dies']
  },
  'market-data': {
    ask: 'Build the service that pushes live stock prices from one feed to 10,000 screens and trading programs, even when some of them are slow.',
    examples: [
      'AAPL ticks 189.10 → 189.12 → 189.15 in 30 ms; a trader\'s screen shows 189.15 within a second.',
      'An algo needs every single tick in order with no gaps; a dashboard only needs the latest price.',
      'One consumer on bad Wi-Fi falls 20 seconds behind: other consumers are unaffected.',
      'A UI reconnects after a laptop sleep and immediately shows correct current prices.'
    ],
    deliver: ['Snapshot + delta model and sequence numbers', 'What you do with a slow consumer (drop, conflate, disconnect)', 'How a reconnecting client catches up without a gap', 'How you fan out to 10k connections']
  },
  'order-book': {
    ask: 'Build a stock exchange\'s matching engine: accept buy and sell orders, match them fairly by price then time, and publish trades within microseconds.',
    examples: [
      'Book for AAPL: best bid 100.00 (500 shares), best ask 100.05 (300 shares).',
      'A buy for 400 @ 100.05 arrives: it fills 300 at 100.05, and the remaining 100 rest as the new best bid.',
      'Two sells at 100.05 arrived at 09:30:00.001 and 09:30:00.002: the earlier one fills first.',
      'The engine crashes and restarts: the book is rebuilt exactly, and no order is filled twice.'
    ],
    deliver: ['Order book data structure and price-time priority', 'Threading model (why a single writer per symbol)', 'Journal, sequence numbers, and crash recovery', 'Latency budget and how trades fan out']
  },
  ledger: {
    ask: 'Build the system of record that tracks every money movement in a payments product, so money is never created or lost and every balance can be explained.',
    examples: [
      'Alice sends Bob $25.00: Alice\'s account is debited 2500 cents and Bob\'s is credited 2500 cents in one transaction.',
      'The phone app times out and retries the same transfer: Bob still receives $25, not $50.',
      'An auditor asks "why is Alice\'s balance $74.13?": you can list every entry that sums to it.',
      'A refund of the transfer is a new reversing entry, never an edit of the old one.'
    ],
    deliver: ['The double-entry data model (accounts, transactions, entries)', 'How a transfer stays atomic and idempotent', 'How balances are derived and reconciled', 'Cross-shard transfers and the consistency trade-off']
  },
  risk: {
    ask: 'Build the service that continuously computes each trading desk\'s exposure and profit/loss as prices move, and blocks new orders that would breach a limit.',
    examples: [
      'Desk A holds 10,000 AAPL bought at $180; AAPL ticks to $185: unrealized P&L updates to +$50,000 within a second.',
      'Desk A has a $2M exposure limit and is at $1.95M: a new $100k order is rejected before it reaches the market.',
      'The price feed for one bond goes stale for 2 minutes: the dashboard flags it instead of showing a confident number.',
      'Risk managers run "what if rates rise 1%?" across 1M positions in minutes, not hours.'
    ],
    deliver: ['Pipeline from trades + prices to positions, P&L, and limits', 'Incremental computation instead of full recompute per tick', 'Sync (pre-trade block) vs async (monitoring) paths', 'What happens when inputs are stale or the service is down']
  },
  'fintech-platform': {
    ask: 'Design the backend of an app like Cash App or Revolut: sign up, verify identity, hold money, send it to friends, and pay by card.',
    examples: [
      'Maya downloads the app, uploads her ID, and is approved in 3 minutes (or told "under review" if the vendor is slow).',
      'Maya sends Leo $40: both see the transfer instantly, and a retry never sends $80.',
      'Maya taps her card for a $6.50 coffee: the authorization answers in under 1 second; the charge settles later.',
      'A stolen card is used 8 times in 2 minutes: the 3rd attempt is declined by fraud rules.'
    ],
    deliver: ['The money path end to end (app → API → payments/cards → ledger)', 'KYC as a state machine', 'Card authorization vs capture', 'Fraud checks, reconciliation, and failure handling']
  },
  instagram: {
    ask: 'Design Instagram: people post photos and videos, follow each other, and scroll a home feed that loads in under a second.',
    examples: [
      'Sam posts a 4 MB photo: it uploads, shows "Posted", and appears in followers\' feeds within seconds.',
      'Sam\'s 300 followers open the app and see the post near the top of their feed.',
      'A celebrity with 100M followers posts: the system does not write 100M feed entries synchronously.',
      'Someone in Tokyo views the photo and it loads from a nearby edge server, not from Virginia.'
    ],
    deliver: ['Media storage and CDN delivery', 'Feed generation: fan-out on write vs read, and the celebrity case', 'Data model for posts, follows, likes', 'Pagination, caching, and what is eventually consistent']
  },
  uber: {
    ask: 'Design Uber: riders request a trip, nearby drivers are found in seconds, the trip is tracked live, and the rider is charged at the end.',
    examples: [
      'A rider in downtown SF taps "Request": within 10 seconds a driver 0.6 miles away gets the offer.',
      'The first driver ignores the offer for 15 seconds: it goes to the next closest driver.',
      'During a concert letting out, requests triple in one neighbourhood and surge pricing kicks in.',
      'The trip ends: the rider is charged $18.40 once, and both get a receipt.'
    ],
    deliver: ['How 1M drivers\' locations are ingested and indexed (geohash / H3)', 'The dispatch / matching loop and trip state machine', 'Sharding by city and surge pricing inputs', 'What breaks during a surge and how it degrades']
  },
  'core-bank': {
    ask: 'Design the core system of a retail bank: accounts, transfers, interest, statements, fraud checks, and regulator reports, with strict correctness.',
    examples: [
      'A customer moves $500 from checking to savings at a branch: both balances change together or neither does.',
      'At midnight, the end-of-day job accrues 4.1% APY interest on 2M savings accounts; if it crashes at 60%, it resumes without double-paying.',
      'A $9,900 cash deposit pattern triggers an AML review.',
      'The regulator\'s monthly report is generated without slowing down customer transfers.'
    ],
    deliver: ['Double-entry core ledger and ACID transfers', 'End-of-day batch that is restartable', 'Audit trail and reconciliation', 'Reporting off a separate warehouse, fraud/AML placement']
  },
  'deepseek-inference': {
    ask: 'Design the serving platform behind an LLM API like DeepSeek or OpenAI: accept prompts from millions of users and stream answers back from a GPU fleet.',
    examples: [
      'A developer sends a 2,000-token prompt and the first answer token appears in under 800 ms, then streams.',
      'A free-tier user and an enterprise user hit the API at the same time: the free user cannot starve the enterprise one.',
      '10,000 requests share the same long system prompt: it is computed once and reused from cache.',
      'A new model version rolls out; requests already streaming keep using the old version.'
    ],
    deliver: ['Admission control and per-tenant quota', 'Batching (continuous batching) and the KV cache', 'Routing across GPU replicas and model versions', 'Streaming, metering/billing, and failure isolation']
  },
  lovable: {
    ask: 'Design Lovable: a user describes an app in plain English, AI writes the code, and the user sees it running in a live preview and keeps iterating.',
    examples: [
      'User types "a habit tracker with streaks and a dark theme": 60 seconds later a working app appears in the preview.',
      'User says "make the button green": only that file changes and the preview updates in seconds.',
      'Generated code contains an infinite loop: it is killed in its sandbox without affecting anyone else.',
      'User clicks "Undo" to return to the version from 3 prompts ago, then "Publish" to get a live URL.'
    ],
    deliver: ['The generation loop (plan → patch → build → preview)', 'Sandbox isolation and resource limits', 'Preview routing and versioning / rollback', 'Cost controls and publishing']
  },
  replit: {
    ask: 'Design Replit: a full coding environment in the browser where people edit together, run code, and preview apps.',
    examples: [
      'A student opens last week\'s Python project: it is ready to run in under 3 seconds with all files intact.',
      'Two friends type in the same file at once: both see each other\'s edits merge cleanly.',
      'The student runs a Flask server on port 5000 and opens it at a public preview URL.',
      'Someone runs "rm -rf /" in their workspace: only their own sandbox is affected.'
    ],
    deliver: ['Workspace runtime (containers / microVMs) and scheduling', 'Persistence and fast cold starts', 'Real-time collaboration (CRDT / OT)', 'Preview routing and isolation']
  },
  gmail: {
    ask: 'Design Gmail: receive and send email for over a billion users, organise it into threads and labels, filter spam, and search it instantly.',
    examples: [
      'An email from a bank arrives via SMTP and shows up in the user\'s inbox within 2 seconds with a push notification.',
      'The user searches "invoice march" and sees results from 6 years of mail in under 300 ms.',
      'A phishing email impersonating PayPal lands in Spam, not the inbox.',
      'The sender\'s server retries the same message 3 times: the user sees it once.'
    ],
    deliver: ['Inbound path: SMTP ingress → spam → storage', 'Storage model: immutable message blobs vs mutable labels/threads', 'Search indexing and freshness', 'Sharding per user, dedupe, and push delivery']
  },
  'gsr-notification-service': {
    ask: 'Design the service that sends emails, SMS, and push alerts when something happens to a customer\'s transaction (payment sent, trade filled, fraud alert).',
    examples: [
      'A $5,000 wire completes: the customer gets a push in 2 seconds and an email in under a minute.',
      'The upstream system delivers the same "wire completed" event twice: the customer gets one SMS, not two.',
      'The SMS vendor is down for 10 minutes: messages queue and send after recovery, or fail over to a second vendor.',
      'A marketing blast of 5M emails does not delay a fraud alert.'
    ],
    deliver: ['Ingest → queue → per-channel workers → providers', 'Idempotency / dedupe and retry policy (DLQ)', 'Priority lanes and provider failover', 'Rollout plan and how you would measure success']
  },
  'gsr-payment-failure-spike': {
    ask: 'Tell a real story (STAR format) about a time payments or a critical system started failing and you led the response.',
    examples: [
      'Situation: "At 9:40 on a Monday, card payment failures jumped from 0.3% to 18% for our 2M-user wallet."',
      'Task: "I was the on-call lead and owned getting payments back to normal."',
      'Action: "I rolled back the 9:15 deploy, confirmed recovery on the dashboard, then posted updates every 15 minutes."',
      'Result: "Failures back to baseline in 22 minutes; we added a canary check so that deploy pattern cannot reach 100% again."'
    ],
    deliver: ['A 2-minute story with a clear Situation, Task, Action, Result', 'Your personal ownership ("I"), not just "we"', 'Numbers: impact, time to mitigate, recovery', 'The systemic fix and what you would do differently']
  },
  'gsr-team-health': {
    ask: 'Answer three manager questions with concrete examples: handling an underperforming engineer, measuring team health, and balancing product urgency against quality.',
    examples: [
      'Underperformance: "Priya\'s PRs slowed from 6 a week to 1. In a 1:1 I learned she was unclear on the new service\'s ownership..."',
      'Team health: "I track on-call pages per week, sprint spillover, and review turnaround, and pair them with 1:1 signals."',
      'Urgency vs quality: "Product wanted the launch Friday. We shipped behind a flag to 5% with tests on the payment path only."'
    ],
    deliver: ['A specific example for each question, not hypotheticals', 'A fair, documented process with a timeline', 'Metrics plus human signals', 'An explicit trade-off with the options you considered']
  }
};

const DESIGN_BRIEF_FALLBACK = {
  ask: 'Design the system described in the question. Start with what users do, then how the system handles it at scale.',
  examples: [],
  deliver: ['Requirements and non-goals', 'A rough estimate of scale', 'A high-level diagram with the main components', 'One deep dive and the main failure modes']
};
