# Graph Report - gs-interview-ide  (2026-10-24)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 148 nodes · 285 edges · 15 communities (10 shown, 5 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14

## God Nodes (most connected - your core abstractions)
1. `renderResults()` - 15 edges
2. `esc()` - 13 edges
3. `open()` - 12 edges
4. `runTests()` - 11 edges
5. `setAIPane()` - 11 edges
6. `renderAIHint()` - 10 edges
7. `renderDoc()` - 10 edges
8. `Handler` - 9 edges
9. `requestAIReview()` - 8 edges
10. `renderQueue()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `toggleDone()` --indirect_call--> `maybeReviewAfterPass()`  [INFERRED]
  js/app.js → js/app.js  _Bridges community 3 → community 4_
- `persistQueue()` --calls--> `renderQueue()`  [EXTRACTED]
  js/app.js → js/app.js  _Bridges community 10 → community 4_
- `consoleLine()` --calls--> `esc()`  [EXTRACTED]
  js/app.js → js/app.js  _Bridges community 2 → community 5_
- `renderResults()` --calls--> `offerNext()`  [EXTRACTED]
  js/app.js → js/app.js  _Bridges community 2 → community 4_
- `renderResults()` --calls--> `requestAIReview()`  [EXTRACTED]
  js/app.js → js/app.js  _Bridges community 2 → community 3_

## Import Cycles
- None detected.

## Communities (15 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (16): brief(), build_review_prompt(), build_user_prompt(), clean_list(), clip(), decode_json_text(), deepseek_call(), graph_status() (+8 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (21): AI_VERDICT, aiClose, ALL_CODING, CAT_LABEL, codeLayer, DEFAULT_QUEUE, DEFAULT_QUEUE_GS, ed (+13 more)

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (17): appendLog(), appendRunHistory(), bindConsole(), buildRunSnapshot(), consoleEmpty(), consoleHTML(), consoleLine(), fmt() (+9 more)

### Community 3 - "Community 3"
Cohesion: 0.21
Nodes (17): applyLayout(), briefValue(), buildAIContext(), clamp(), cleanPseudo(), isNarrowAI(), lastRunPassed(), makeResizer() (+9 more)

### Community 4 - "Community 4"
Cohesion: 0.28
Nodes (9): allItems(), boot(), byId(), matches(), nextQueuedId(), offerNext(), renderQueue(), renderSidebar() (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (9): esc(), formatBody(), frameworkHTML(), highlight(), itemRow(), openPlan(), openRounds(), renderDoc() (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.47
Nodes (6): loadCode(), open(), paintEditor(), renderTabs(), restoreRun(), syncGutter()

### Community 8 - "Community 8"
Cohesion: 0.40
Nodes (4): DESIGN_QUESTIONS, QUESTIONS, ROUND_PLAN, RUBRIC

### Community 9 - "Community 9"
Cohesion: 0.50
Nodes (4): graphClock(), openGraph(), rebuildGraph(), setGraphStatus()

### Community 10 - "Community 10"
Cohesion: 0.50
Nodes (4): persistQueue(), queueAdd(), queueMove(), queueRemove()

## Knowledge Gaps
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `renderResults()` connect `Community 2` to `Community 1`, `Community 3`, `Community 4`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0945945945945946 - nodes in this community are weakly interconnected._
- **Why does `esc()` connect `Community 5` to `Community 1`, `Community 2`, `Community 3`, `Community 4`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._