# Scraped Goldman Sachs SWE questions — provenance

Scraped **2026-10-24** from public candidate reports, level-tagged interview guides, and a
coderpad repository. The questions live in [`js/gs-scraped.js`](js/gs-scraped.js) and are wired
into the app by [`js/app.js`](js/app.js).

23 new questions: **7 junior · 7 mid · 2 senior · 4 N/A · 3 manager**.

## Level mapping

Goldman overlays corporate titles on engineering seniority:

| Label | Goldman band / evidence |
|---|---|
| **Junior** | Analyst, SDE-1, new grad, campus |
| **Mid** | Associate, SDE-2 (approx. 2–5 YOE) |
| **Senior** | VP, Senior SWE, SDE-3 (VP is a senior IC, not management) |
| **Manager** | Hiring-manager round, Engineering Manager |
| **N/A** | Source proves the question is asked, but does not state the candidate's level |

`N/A` is deliberate. Guessing a level to fill the table would pollute the filter, so the
label stays honest.

## Dates

- `added` = **2026-10-24**, the date the question entered this queue. Every row has it.
- `source date` = when the source was published or the reported interview happened, where the
  source states it. LeetCode Discuss posts in this set do not publish a per-post date, so the
  column is “—”.

## Questions

| Level | Question | Added | Source date | Confidence | Source |
|---|---|---|---|---|---|
| Junior | Decode Ways (A=1 ... Z=26) | 2026-10-24 | — | high | [LeetCode Discuss 6928017](https://leetcode.com/discuss/post/6928017/) |
| Junior | Quicksort, in place, no extra array | 2026-10-24 | — | high | [LeetCode Discuss 6928017](https://leetcode.com/discuss/post/6928017/) |
| Junior | Maximal Square (largest all-1s square) | 2026-10-24 | — | high | [LeetCode Discuss 6928017](https://leetcode.com/discuss/post/6928017/) |
| Junior | The Maze II (rolling ball, shortest distance) | 2026-10-24 | — | high | [LeetCode Discuss 6928017](https://leetcode.com/discuss/post/6928017/) |
| Junior | Prime Factorization (product equals x) | 2026-10-24 | — | high | [LeetCode Discuss 6834408](https://leetcode.com/discuss/post/6834408/) |
| Junior | Count unique substrings of length k | 2026-10-24 | — | medium | [InterviewFox](https://interviewfox.ai/interview-questions/goldman-sachs-coderpad-oa-guide/) |
| Junior | Trapping Rain Water | 2026-10-24 | — | high | [LeetCode Discuss 6834408](https://leetcode.com/discuss/post/6834408/)<br>[SWE180](https://www.swe180.com/companies/goldman-sachs?tab=leetcode) |
| Mid | Two Sum II - sorted input, 1-indexed | 2026-10-24 | — | high | [LeetCode Discuss 4878508](https://leetcode.com/discuss/post/4878508/) |
| Mid | Palindromic Substrings (count) | 2026-10-24 | — | high | [LeetCode Discuss 4878508](https://leetcode.com/discuss/post/4878508/) |
| Mid | Meeting Rooms II (minimum rooms) | 2026-10-24 | — | high | [LeetCode Discuss 4878508](https://leetcode.com/discuss/post/4878508/) |
| Mid | Copy List with Random Pointer (O(1) space) | 2026-10-24 | — | high | [LeetCode Discuss 4878508](https://leetcode.com/discuss/post/4878508/) |
| Mid | 132 Pattern | 2026-10-24 | — | high | [LeetCode Discuss 4878508](https://leetcode.com/discuss/post/4878508/) |
| Mid | Prefix occurrences in a document (char indices) | 2026-10-24 | — | high | [LeetCode Discuss 4878508](https://leetcode.com/discuss/post/4878508/) |
| Mid | Remove Duplicates from Sorted Array (in place) | 2026-10-24 | 2026-10-20 | high | [InterviewFox](https://interviewfox.ai/interview-questions/goldman-sachs-coderpad-oa-guide/) |
| Senior | Longest Happy Prefix (longest prefix that is also a suffix) | 2026-10-24 | 2024-10-01 | high | [Taro](https://www.jointaro.com/interviews/companies/goldman-sachs/experiences/senior-software-engineer-bengaluru-october-1-2024-no-offer-neutral-2f116d11/) |
| Senior | Median of Two Sorted Arrays | 2026-10-24 | 2026-09-16 | medium | [InterviewLegend](https://interviewlegend.com/guides/companies/goldman-sachs/overview/process-overview)<br>[Verve AI](https://www.vervecopilot.com/blog/top-30-goldman-sachs-leetcode-interview-questions) |
| Manager | Design a notification service for transaction processing | 2026-10-24 | — | medium | [SWE180](https://www.swe180.com/companies/goldman-sachs?tab=interview&role=engineering-manager)<br>[InterviewLegend](https://interviewlegend.com/guides/companies/goldman-sachs/overview/process-overview) |
| Manager | Behavioral: a payment failure spike (STAR) | 2026-10-24 | — | medium | [SWE180](https://www.swe180.com/companies/goldman-sachs?tab=interview&role=engineering-manager)<br>[LeetCode Discuss 6928017](https://leetcode.com/discuss/post/6928017/) |
| Manager | Behavioral: underperformance, team health, urgency vs quality | 2026-10-24 | — | medium | [SWE180](https://www.swe180.com/companies/goldman-sachs?tab=interview&role=engineering-manager) |
| N/A | Path with Maximum Gold (backtracking) | 2026-10-24 | 2026-10-20 | medium | [InterviewFox](https://interviewfox.ai/interview-questions/goldman-sachs-coderpad-oa-guide/) |
| N/A | Longest subarray with max-min <= limit | 2026-10-24 | 2026-09-16 | medium | [Verve AI](https://www.vervecopilot.com/blog/top-30-goldman-sachs-leetcode-interview-questions) |
| N/A | Open the Lock (shortest combination) | 2026-10-24 | 2026-09-16 | medium | [Verve AI](https://www.vervecopilot.com/blog/top-30-goldman-sachs-leetcode-interview-questions) |
| N/A | All Elements in Two BSTs (sorted) | 2026-10-24 | 2026-09-16 | medium | [Verve AI](https://www.vervecopilot.com/blog/top-30-goldman-sachs-leetcode-interview-questions) |

## How the sources were read

- **LeetCode Discuss 6928017** — first-hand Analyst Software Engineering loop (2 YOE): OA,
  two DSA superday rounds, an SWE-practices round, a design round, and a behavioral HM round.
  Every question in that post is quoted round by round.
- **LeetCode Discuss 4878508** — first-hand Associate / SDE-2 loop ending in an offer: CoderPad
  screen, three Superday rounds, and the HM round.
- **LeetCode Discuss 6834408** — first-hand Analyst (Bengaluru) OA.
- **InterviewFox (20 Oct 2026)** — the author's own associate CoderPad round plus a confirmed bank.
- **Taro (1 Oct 2024)** — Senior Software Engineer, Bengaluru; first-round question and Java
  internals discussion.
- **InterviewLegend (Sep 2026)** — process/level guide: which surface belongs to Analyst vs
  Associate/VP, and the design-round prompts for experienced loops.
- **Verve AI (Sep 2026)** — frequency list. Confirms questions, publishes no candidate levels,
  hence the N/A labels.
- **SWE180 Engineering Manager page** — the only source that publishes manager-band questions.
  Its answers are model answers, so those three entries are marked `medium` confidence.

## Caveats

- Aggregator pages repeat each other. `high` confidence means a first-hand report names the
  question; `medium` means one guide or a bank item without a level.
- `LeetCode 8427722` (the “VP 2026 Bangalore” post) now returns “post not exist”; it was not used.
- Cloudflare returns 403 to plain fetches on some LeetCode posts. The two primary posts used
  here were retrieved through a reader proxy and cross-checked against their own text.
- Every coding question ships a reference solution and tests; all 93 test cases pass in the
  same harness the in-browser runner uses.

## Queue behaviour

The app appends the 23 new ids to the saved queue **once**, tracked by the
`gs.queue.seeded` localStorage key. Removing one from the queue is permanent — it will not be
re-added on the next load. A fresh browser gets them from `DEFAULT_QUEUE_GS` directly.
