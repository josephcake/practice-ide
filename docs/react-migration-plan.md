# React migration plan

This plan moves the practice IDE from hand-written DOM code (23 global scripts, ~16,000 lines) to a React + TypeScript app built with Vite. It is written so an implementer with no prior context can follow it step by step. Every phase ends with checks that must pass before the next phase starts.

**Read sections 1 and 2 completely before writing any code.**

---

## 0. Summary

| | Today | After migration |
|---|---|---|
| UI code | 23 `<script>` files sharing globals, HTML built with template strings and `innerHTML` | React components in TypeScript, ES modules, no globals |
| Build | none, files served as-is | Vite (dev server + production build to `web/dist/`) |
| State | module-level variables plus `localStorage` | Zustand stores that read and write the **same** `localStorage` keys |
| Styling | `css/style.css` (2,960 lines) | the same file, imported once, unchanged class names (optional later cleanup) |
| Canvas | `DesignGraph` imperative SVG engine | the same engine moved into a module, wrapped by a React component |
| Server | `server.py` serves files and the AI proxy | unchanged API; serves `web/dist/` after cutover |

**Why migrate:** maintainability (state lives in one place, components replace 51 `innerHTML` writers), type safety for a large data set, and easier feature work. It is **not** expected to make the app faster: the app already starts in about 0.4 s, and the expensive part (SVG animation) is the same in React. Do not regress the performance work already done (see 2.9).

**Non-goals (do not do these during the migration):**
- No visual redesign, no copy changes, no new features.
- No server API changes, no change to request or response shapes.
- No change to `localStorage` key names or value formats. Existing users must keep their progress, drafts, notes, chat history, and settings.
- No CSS framework (Tailwind, MUI, etc.). Keep `css/style.css`.

---

## 1. Ground rules for the implementer

1. **Parity first.** The React app must look and behave exactly like the current app at three sizes: 1440×900 desktop, 390×844 phone portrait, 844×390 phone landscape. When unsure, open the old app side by side and copy its behavior.
2. **Never rename a `localStorage` key or change its JSON shape.** The full list is in 2.5. Use the shared `storage` helper (Appendix B) for every read and write.
3. **Never change API request bodies or response handling.** The list is in 2.6. Copy the request-building functions verbatim, then type them.
4. **Keep every CSS class name and element `id` that `css/style.css` targets.** The stylesheet is reused as-is. If a component renders `<div class="study-pane">` today, the React version renders `className="study-pane"`. Body classes (`mode-design`, `mode-aws`, `chat-open`, `sidebar-hidden`, `sidebar-drawer`, `arch-expanded`, `modal-open`, `map-wide`, `ai-hint-open`, `resizing`) must still be set on `document.body` because the CSS depends on them.
5. **Keep all text identical**, including punctuation, arrows (→, ↓), and the `⚙` / `✦` symbols.
6. **One phase per commit** (or a few commits per phase). Commit message format: `React migration phase N: <what>`. Do not mix phases.
7. **The old app keeps working until cutover (phase 12).** Build the new app in a new `web/` folder. Do not edit or delete anything in `js/`, `css/`, or `index.html` before phase 12, except for bug fixes you also port.
8. **Run checks after every task:** `npm run typecheck`, `npm run lint`, `npm test`. Run `npm run e2e` at the end of each phase.
9. **Do not use `dangerouslySetInnerHTML`** except in the three places listed in 3.7 (markdown chat replies, linkified concept/service text, and syntax-highlighted code). Everything else is JSX.
10. **No new runtime dependencies** beyond the list in 3.1 without a written reason in the commit message.
11. If any instruction here conflicts with what the old code actually does, **the old code wins**. Write down the difference in `docs/react-migration-notes.md`.

---

## 2. What exists today (inventory)

### 2.1 Run the current app

```bash
cd "practice-ide"
python3 server.py 8765          # http://127.0.0.1:8765
# optional: AI_HINT_MODEL=deepseek-v4-pro python3 server.py 8765
```

The AI features need a DeepSeek key (`DEEPSEEK_API_KEY` env var or `~/.dsh/.credentials.yaml`). Without a key, AI buttons show an error message; everything else works.

### 2.2 Script load order (from `index.html`)

Order matters today because files read each other's globals at load time. In React this becomes explicit `import`s, but the **data registration order** must be preserved (see 4.3).

| # | File | Lines | Defines (globals) | Reads at load time |
|---|---|---|---|---|
| 1 | `js/questions.js` | 1,275 | `QUESTIONS` (20), `DESIGN_QUESTIONS` (empty, filled later), `ROUND_PLAN` (5), `RUBRIC` | — |
| 2 | `js/gs-questions.js` | 1,239 | `GS_QUESTIONS` (15), `GS_ROUNDS` (6) | — |
| 3 | `js/gs-scraped.js` | 1,424 | `GS_SCRAPED` (20) | — |
| 4 | `js/design-graphs.js` | 1,611 | `DESIGN_GRAPHS` (filled later), `DesignGraph` (canvas engine) | DOM ids `arch-*` |
| 5 | `js/design-examples.js` | 15 | `DESIGN_BRIEFS` (filled later), `DESIGN_BRIEF_FALLBACK` | — |
| 6–8 | `js/design-maps-1/2/3.js` | 743 / 711 / 701 | `DESIGN_MAPS` (36 total, via `Object.assign`) | — |
| 9 | `js/design-catalog.js` | 87 | `DIFFICULTY`, `DesignInfra`, `DesignCatalog` | `DESIGN_QUESTIONS`, `DESIGN_GRAPHS`, `DESIGN_BRIEFS`, `DESIGN_MAPS` |
| 10–12 | `js/design-catalog-1/2/3.js` | 367 / 363 / 367 | calls `DesignCatalog.add(...)` 36 times; **part 3 ends with `DesignCatalog.install()`** | `DesignCatalog` |
| 13 | `js/concepts.js` | 831 | `CONCEPTS` (71, contain `RegExp`), `SHAPE_INFO`, `ConceptLib` | — |
| 14 | `js/ai-chat.js` | 394 | `AIChat` | DOM ids `chat-*` |
| 15 | `js/design-practice.js` | 341 | `DesignPractice` | `ConceptLib`, `DesignGraph`, `AIChat` |
| 16 | `js/design-study.js` | 683 | `DesignStudy` | `DesignGraph`, `DesignPractice`, `ConceptLib`, `DESIGN_BRIEFS`, `AIChat` |
| 17 | `js/aws-services.js` | 598 | `AWS_CATEGORIES` (object, 11 keys), `AWS_SERVICES` (52) | — |
| 18 | `js/aws-lessons-1.js` | 852 | `AWS_LESSONS` (first part) | — |
| 19 | `js/aws-lessons-2.js` | 472 | pushes more onto `AWS_LESSONS` (14 total) | `AWS_LESSONS` |
| 20 | `js/aws-guide.js` | 617 | `AwsGuide`; **adds 14 AWS maps into `DESIGN_GRAPHS` at load** | `AWS_*`, `DESIGN_GRAPHS`, `DesignGraph` |
| 21 | `js/panel-sheet.js` | 122 | `PanelSheet` (phone bottom sheet) | `DesignGraph` |
| 22 | `js/runner.js` | 203 | `Runner` (Web Worker test runner) | — |
| 23 | `js/app.js` | 2,723 | everything else: page switching, coding page, sidebar, queue, editor, AI hint/review/explain/solve, modals, layout resizers, keyboard shortcuts, `boot()` | everything above |

Other files: `css/style.css` (2,960 lines), `index.html` (~375 lines of static markup), `server.py` (static server + AI proxy), `graphify-out/` and `graphify-vendor/` (code graph viewer, opened in an iframe), `tools/` (graph build scripts).

### 2.3 Data counts (use these as test assertions)

| Data | Count | Notes |
|---|---|---|
| `QUESTIONS` | 20 | coding, fields below |
| `GS_QUESTIONS` | 15 | coding + `confidence`, `tag`, `reportCount`, `sources` |
| `GS_SCRAPED` | 20 | coding + `seniority`, `added`, `sourceDate`, `levelWhy` |
| All coding questions | 55 | the progress bar shows `x/55`; order defined by `ALL_CODING` in `app.js` |
| `DESIGN_QUESTIONS` | 36 | built by `DesignCatalog.install()`, sorted easy → medium → hard |
| `DESIGN_GRAPHS` | 36 design + 14 AWS = 50 | AWS ones added by `aws-guide.js` |
| `DESIGN_BRIEFS` | 36 | `{ ask, examples[], deliver[] }` |
| `DESIGN_MAPS` | 36 | raw tuple format, expanded into `DESIGN_GRAPHS` |
| `CONCEPTS` | 71 | `match` is a `RegExp` (so data cannot become JSON) |
| `AWS_CATEGORIES` | 11 keys | `compute, storage, database, network, integration, security, ops, analytics, genai, aiapi, other` |
| `AWS_SERVICES` | 52 | |
| `AWS_LESSONS` | 14 | groups `start`, `core`, `genai` |
| `GS_ROUNDS` | 6 | `{ stage, detail, ask }` |
| `ROUND_PLAN` | 5 | |

Field lists (exact, verified by loading the files in Node):

- Coding question: `id, cat, level, title, prompt, signature, starter, hints[], solution, complexity, tests[], anyOf?` plus GS fields `confidence, tag, reportCount, sources[{label,url}]` and scraped fields `seniority, added, sourceDate, levelWhy`.
- Test case: `input, expected, custom?, note?` (`custom` is a JS expression string evaluated in the worker).
- Design catalog entry (input to `DesignCatalog.add`): `id, difficulty, cat, title, prompt, hints[], topics[], brief`.
- Design question (output): `id, level, difficulty, cat, title, prompt, hints, topics`.
- Expanded graph: `title, subtitle, layers[], nodes[], edges[], flow[], why[], tradeoffs[], failures[], basedOn, sources[]`, and for AWS maps also `aws: true, colw: 280`. AWS nodes also carry `svc, shape, color, badge`.
- Concept: `id, name, kind, shape, plain, match (RegExp), what, why, tradeoffs[], usedBy[], alt, aliases?[], without?, breaks?, protect?`.
- AWS service: `id, cat, name, short, shape, nonAws?, plain, popular?, analogy, use[], avoid[[reason, altId|null]], pay, limits[], ai, who[], tip, url, aliases[], aiKey?`.
- AWS lesson: `id, group, title, question, summary, services[], decide[[when, ids[], why]], examples[[scenario, ids[], why, whyNot]], quiz[[q, options[], answerIndex, why]], map{...}, compare?{title, cols[], rows[]}`.

### 2.4 Module public APIs (what other code calls)

These become hooks, store actions, or engine methods in React.

- `DesignGraph` (canvas engine): `open(id, {inline})`, `close()`, `toggleInspector()`, `selectNode(id)`, `selectEdge(i)`, `startFlowAt(i)`, `clearFocus()`, `spotlight(ids)`, `getFocus()`, `getGraph()`, `setLayout('layers'|'paths')`, `setRoute('curved'|'ortho')`, `relayout()`, `setExpanded(bool?)`, `conceptCard(c)`, `shapeIcon(shape)`, `shapeOf(node)`, `layout()`, `currentId()`, `isInline()`, `onChange(fn)`, `has(id)`.
- `DesignStudy`: `open(q)`, `close()`, `showMap()`, `showInspect()`, `notifyInspect()`, `setView('brief'|'map')`, `view()`, `appendToStage(key, text)`, `chatContext()`, `toggleTimer()`, `focusAnswer()`, `isMapShown()`, `linkTerms(html)`.
- `DesignPractice`: `renderLearn(el, item, graph)`, `renderPractice(el, item, graph)`, `renderToolkit(el, item, opts)`, `numbersHTML()`, `conceptsFor(item, graph)`.
- `AwsGuide`: `open(id)`, `close()`, `reset(id)`, `renderSidebar()`, `serviceCard(id, opts)`, `notifyInspect()`, `chatContext()`, `focusService(id, anchor)`, `bind({isDone, onOpen})`, `get(id)`, `all()`, `current()`, `nextId()`, `isOpen()`.
- `AIChat`: `init()`, `md(src)`, `ask(text)`, `toggle()`, `open()`, `close()`, `isOpen()`, `forget(key)`, `refresh()`, `setContextProvider(fn)`.
- `ConceptLib`: `all`, `get(id)`, `forNode(node)`, `shapeFor(node)`, `linkTerms(html)`.
- `DesignCatalog`: `add(q)`, `install()`, `all()`; `DesignInfra.kindOf(id, title)`.
- `Runner`: `run(question, code, {names, harness}, {onLog, onClear})` → `Promise<{results, fatal}>`, `recycle()`.
- `PanelSheet`: `isPhone()`.

### 2.5 `localStorage` keys (do not change)

All values are `JSON.stringify`-ed. Read with a default; ignore parse errors (same as `store.get` in `app.js`).

| Key | Owner today | Value |
|---|---|---|
| `gs.page` | app.js | `'coding' \| 'design' \| 'aws'` |
| `gs.last` | app.js | last opened question id (any page) |
| `gs.last.coding` / `gs.last.design` / `gs.last.aws` | app.js | last id per page |
| `gs.done` | app.js | `string[]` of completed ids (coding, design, and AWS lesson ids together) |
| `gs.notes` | app.js, design-study.js | `{ [questionId]: string }` |
| `gs.draft.<id>` | app.js | editor code string |
| `gs.queue` | app.js | `string[]` question ids |
| `gs.queue.seeded` | app.js | `string[]` scraped ids already appended to the queue once |
| `gs.queue.design` | app.js | `string[]` design ids already appended once |
| `gs.run.<id>` | app.js | last run snapshot for a question |
| `gs.runs` | app.js | run history array |
| `gs.ai.<id>` | app.js | AI hint record |
| `gs.review.<id>` | app.js | AI review record |
| `gs.solve.<id>` | app.js | AI solve record (includes `baseCode`, `solution`) |
| `gs.layout` | app.js | panel sizes `{ sidebar, doc, ai, queue, aiOpen, ... }` |
| `gs.sidebar.hidden` | app.js | boolean |
| `gs.help.seen` | app.js | boolean (first-run help modal) |
| `gs.chat.<contextKey>` | ai-chat.js | chat message history per context (`aws:<id>`, design and coding keys) |
| `gs.chat.w` / `gs.chat.open` | ai-chat.js | chat width, open state |
| `gs.study.<id>` | design-study.js | Brief state: `{ view, tab, open, answers, revealed, mapSeen }` |
| `gs.study.collapsed` | design-study.js | boolean (Map side panel collapsed) |
| `gs.design.eval.<id>` | design-study.js | AI evaluation record |
| `gs.brief.taskHidden` | design-study.js | boolean |
| `gs.terms.open` | design-study.js | boolean |
| `gs.quiz.<id>` | design-practice.js | practice quiz state |
| `gs.aws.<lessonId>` | aws-guide.js | `{ answers: { [q]: optionIndex } }` |
| `gs.aws.w` / `gs.aws.collapsed` | aws-guide.js | AWS panel width, collapsed |
| `gs.arch.layout` | design-graphs.js | `'layers' \| 'paths'` |
| `gs.arch.route` | design-graphs.js | `'curved' \| 'ortho'` |
| `gs.arch.dir` | design-graphs.js | `'auto' \| 'lr' \| 'td'` |
| `gs.arch.legend` | design-graphs.js | `'on' \| 'off'` or absent (absent = auto) |

Before starting phase 3, run `rg -o "'gs\.[^']+'" js | sort -u` against the old code and confirm nothing is missing from this table.

### 2.6 Server API (do not change)

| Method | Path | Request body | Response | Client code to copy |
|---|---|---|---|---|
| POST | `/api/ai-hint` | `{ context }` from `buildHintContext(item, 'next'\|'reevaluate')` | JSON `{ next_step, why, model, at }` | `requestAIHint` in app.js |
| POST | `/api/ai-review` | `{ context }` from `buildAIContext(item)` | JSON `{ review, ... }` | `requestAIReview` |
| POST | `/api/ai-explain` | `{ context: { question, code, pseudocode, ... } }` | JSON | `explainSelection` |
| POST | `/api/ai-solve` | `{ context }` from `buildSolveContext(item)` | JSON `{ solution, ... }` | `solveIt` |
| POST | `/api/ai-design-eval` | `{ context: { question, reference, answer, rubric } }` | JSON `{ evaluation, model, at }` | `design-study.js` evaluate handler |
| POST | `/api/ai-chat` | `{ context, messages: [{role, content}] }` | **streamed plain text** (read with `res.body.getReader()`) | `ai-chat.js` send |
| GET | `/api/graph/status` | — | JSON status | `openGraph` |
| POST | `/api/graph/build` | `'{}'` | JSON `{ status }` | `rebuildGraph` |
| GET | `/graphify-out/graph.html` | — | HTML (shown in an `<iframe>`) | graph modal |

Every AI call uses an `AbortController` with a timeout (75 s hint/explain, 90 s review, 120 s solve/chat). Keep the same timeouts and error messages, including `'Could not reach the AI server. Start it with: python3 server.py'`.

### 2.7 Keyboard shortcuts (all must keep working)

| Keys | Where | Action |
|---|---|---|
| ⌘/Ctrl+Enter | editor | run tests |
| ⌘/Ctrl+H | editor | toggle AI hint |
| Tab / Shift+Tab | editor | indent / outdent (2 spaces, block-aware) |
| Enter | editor | auto-indent, extra indent after `{ ( [` |
| `}` `)` `]` | editor | dedent when line is only whitespace |
| ⌘/Ctrl+J | anywhere | toggle Ask AI |
| `/` | not typing | open Ask AI |
| `?` | not typing | open 5-day study plan |
| Escape | anywhere | close plan/graph modal → close brief drawer → close inspector → close settings menu → exit full screen → close sidebar drawer → close popovers (see each module) |
| `j` / `k` | coding page | next / previous coding question |
| `j` / `k` | AWS page | next / previous lesson |
| `p` | map visible | toggle Components / User actions |
| `e` | map visible | toggle full-screen canvas |
| Arrow keys | focused resizer | resize that panel |
| Enter (Shift+Enter = newline) | chat input | send |

### 2.8 Pages and their regions

- **Global nav** (`.global-nav`): ☰ (sidebar), brand, page tabs `Algorithm | System Design | AWS` (short labels `Algo | Design | AWS` under 430 px), "How it works", "✦ Ask AI ⌘J".
- **Sidebar** (`.sidebar`): progress bar; then one of three lists: coding (queue + library with search and level/seniority/category chips), system design (search, grouped by difficulty), AWS (search, grouped lessons, service search hits). Becomes a slide-over drawer under 980 px.
- **Top bar** (`.topbar`): page title + signature, Brief/Map switch (design), More menu (Interview rounds, 5-day plan, Code graph, Reset on phones), Notes, AI hint, Reset, Mark done, Run tests.
- **Coding page** (`.workspace`): left pane (tabs Question/Notes, `#doc`), right pane (editor with gutter and highlight layer, editor bar with Run, results/console panel), optional AI hint pane.
- **System design page** (`.design-stage`): Brief view (task column + step-by-step answer boxes, timer, evaluation card) or Map view (canvas + study pane with tabs Inspect / Your answer / Learn / Practice, terms strip).
- **AWS page** (`.aws-stage`): canvas + guide pane with tabs Guide / Inspect / Services / Quiz, service popover, wide compare table modal.
- **Ask AI chat** (`.chat-pane`): docked column on desktop, full screen on phones.
- **Modals**: help (first run), plan / rounds / compare (`#plan-modal`), code graph (`#graph-modal`), canvas settings sheet (`#arch-menu`).

### 2.9 Behaviors that are easy to lose (preserve all)

Canvas (`design-graphs.js`):
- Labels are placed with `getBBox()`, which returns 0 while hidden. The canvas must be **visible before** it renders (`open()` shows the modal first, `relayout()` re-places labels when the Map view becomes visible).
- Pan and zoom write the SVG `viewBox` directly in an animation loop (`animateView`). **Never** put the view box in React state; it would re-render 60 times a second.
- Switching Curved ↔ Right-angle keeps the current pan and zoom exactly (`setRoute` + `render({preserveView: true})`).
- Direction setting: Auto / Left → right / Top → down. Auto = top → down when the screen is portrait and narrower than 900 px, or the canvas is narrower than 560 px. Re-renders on rotation and when the number of components per row changes (`ResizeObserver` + `onCanvasResize`).
- Top → down layout fits the canvas width; components per row and user-action columns are computed from the canvas width.
- Pinch to zoom, drag from anywhere (6 px threshold before a drag starts, so taps still select), wheel zoom.
- Selecting something off-screen pans to it (`revealBox`).
- The moving packets cost a layout every frame; they run only for 12 s after the map is used and pause in hidden tabs and with reduced motion (`wake()` / `setMotion()`, CSS `.motion-off`).
- Settings menu: drop-down on desktop, bottom sheet on phones, moved to `document.body`-level markup.

Layout and mobile:
- Phone portrait (≤1024 px wide, portrait): Map panel and AWS guide become a bottom sheet with three heights (tabs only, half, full), draggable grab bar (`panel-sheet.js`); the sheet scrolls as one page; selecting a component opens the sheet and scrolls to details.
- Phone landscape (≤520 px tall): canvas and panel side by side, slim bars, editor and question side by side.
- 16 px inputs on small screens (stops iOS zoom), `100dvh` heights, 40–44 px tap targets.

Other:
- The queue seeds new scraped and design ids exactly once (`seedScrapedQueue`, `seedDesignQueue`).
- Drafts save on every keystroke; run results and AI records persist per question.
- Help modal opens automatically on first visit only.
- Chat history is per context key and survives reloads.

---

## 3. Target architecture

### 3.1 Stack

| Purpose | Choice | Version |
|---|---|---|
| Build / dev server | Vite | ^5 |
| UI | React + ReactDOM | ^18.3 |
| Language | TypeScript (`strict: true`) | ^5.5 |
| State | Zustand (with a custom persist helper, not the built-in middleware, to keep key formats) | ^4.5 |
| Unit tests | Vitest + @testing-library/react + jsdom | latest |
| End-to-end | Playwright | latest |
| Lint | ESLint (typescript-eslint, react-hooks plugin) | latest |

No router library in v1. The page is chosen by `gs.page`, exactly like today.

### 3.2 Folder layout

```
practice-ide/
  server.py                 # unchanged until phase 12
  index.html, js/, css/     # old app, untouched until phase 12
  web/
    index.html              # Vite entry
    package.json
    vite.config.ts
    tsconfig.json
    playwright.config.ts
    src/
      main.tsx              # createRoot, imports ../../css/style.css
      App.tsx               # top-level layout, body classes, keyboard shortcuts
      types/                # data types (Appendix A)
      data/                 # converted data files (phase 2)
        questions.ts  gsQuestions.ts  gsScraped.ts
        designMaps.ts  designCatalog.ts  designBriefs.ts
        concepts.ts  awsServices.ts  awsLessons.ts
        index.ts            # builds derived collections once (ALL_CODING, DESIGN_QUESTIONS, GRAPHS ...)
      lib/
        storage.ts          # get/set/remove with the same JSON format
        escape.ts           # esc() for the few HTML strings left
        highlight.ts        # JS syntax highlighter (from app.js highlight())
        diff.ts             # diffSolutionLines
        markdown.ts         # AIChat.md
        api.ts              # fetch helpers with timeouts
        runner.ts           # Web Worker runner (from runner.js)
        catalog.ts          # expandMap, install (pure functions)
        awsMaps.ts          # AWS expandMap
        concepts.ts         # ConceptLib (forNode, shapeFor, linkTerms)
        useMediaQuery.ts
      canvas/
        engine.ts           # DesignGraph engine, DOM passed in, no globals
        layout.ts           # layout(), layoutTD(), routes (pure, unit tested)
        ArchCanvas.tsx      # React wrapper (ref + effects)
        CanvasToolbar.tsx   # zoom, Fit, expand, gear
        CanvasSettings.tsx  # settings sheet
        Inspector.tsx       # Details / Why it works / Trade-offs panel
      stores/
        appStore.ts         # page, active ids, done, queue, notes, layout, sidebar
        codingStore.ts      # editor, runs, AI hint/review/explain/solve
        chatStore.ts        # chat open/width/messages per key
        designStore.ts      # brief/map view, study state, timer, eval
        awsStore.ts         # current lesson, tab, answers, panel width
        canvasStore.ts      # layout, route, dir, legend, focus (mirrors engine)
      components/
        shell/              # GlobalNav, Sidebar*, Topbar, MoreMenu, Toast, Resizer, Modal
        coding/             # QuestionDoc, NotesTab, Editor, Gutter, Results, Console, AIHintPane
        chat/               # ChatPane, ChatMessage, ChatSuggestions
        design/             # DesignStage, BriefView, StageCard, EvalCard, StudyPane, AnswerTab, LearnTab, PracticeTab, TermsStrip, ConceptPopover
        aws/                # AwsStage, GuideTab, ServicesTab, QuizTab, ServiceCard, ServicePopover, CompareTable
        modals/             # HelpModal, PlanModal, RoundsModal, GraphModal
        mobile/             # BottomSheet (from panel-sheet.js)
    tests/
      unit/                 # *.test.ts
      e2e/                  # *.spec.ts
```

### 3.3 Component tree

```
<App>                                   sets body classes, global shortcuts, toast
  <GlobalNav/>
  <div className="app">                 grid columns driven by appStore.layout
    <Sidebar>                           <CodingSidebar/> | <DesignSidebar/> | <AwsSidebar/>
    <Resizer id="resize-sidebar"/>
    <main className="main">
      <Topbar/>                          title, <DesignViews/>, <MoreMenu/>, action buttons
      {page === 'coding' && <CodingWorkspace/>}   QuestionPane | Resizer | EditorPane | AIHintPane
      {page === 'design' && <DesignStage/>}       BriefView | (ArchCanvas + StudyPane)
      {page === 'aws'    && <AwsStage/>}          ArchCanvas + AwsPane
    </main>
    <Resizer id="resize-chat"/>
    <ChatPane/>
  </div>
  <PlanModal/> <GraphModal/> <HelpModal/>
  <CanvasSettings/>                     body-level sheet (was #arch-menu)
  <ServicePopover/> <ConceptPopover/>
  <Toast/>
```

**One canvas instance.** Today a single `#arch-modal` element is moved between the design stage and the AWS stage (`mount()` in aws-guide.js). In React, render `<ArchCanvas>` inside whichever stage is active. The engine instance lives in a module-level singleton (`canvas/engine.ts` exports `getEngine()`), so selection subscriptions and settings survive page switches. Only one stage is mounted at a time.

### 3.4 State design

Rules:
- Each store owns specific `localStorage` keys (table 2.5) and writes them through `storage.set` inside its actions.
- Components read with selectors (`useAppStore((s) => s.page)`), never the whole store.
- Derived data (question lists, graphs) comes from `data/index.ts`, not stores.

`appStore` (owns `gs.page`, `gs.last*`, `gs.done`, `gs.notes`, `gs.queue*`, `gs.layout`, `gs.sidebar.hidden`, `gs.help.seen`):

```ts
type Page = 'coding' | 'design' | 'aws';
interface AppState {
  page: Page;
  activeId: string | null;          // coding or design question id
  awsLessonId: string | null;
  done: Set<string>;
  notes: Record<string, string>;
  queue: string[];
  search: string; designSearch: string; awsSearch: string;
  level: 'all' | '1' | '2' | '3';
  sen: 'all' | 'junior' | 'mid' | 'senior' | 'manager' | 'N/A';
  cat: string;                       // 'all' | category
  layout: Layout;                    // from gs.layout, same shape
  sidebarHidden: boolean; sidebarDrawer: boolean;
  toast: string | null;
  // actions
  switchPage(page: Page): void;      // port of switchPage()
  open(id: string): void;            // port of open()
  openAws(id: string | null): void;  // port of openAws()
  toggleDone(): void; resetProblem(): void;
  queueAdd(id: string): void; queueRemove(id: string): void; queueMove(id: string, dir: -1 | 1): void;
  setNote(id: string, text: string): void;
  showToast(msg: string): void;
}
```

`codingStore` (owns `gs.draft.*`, `gs.run.*`, `gs.runs`, `gs.ai.*`, `gs.review.*`, `gs.solve.*`): mirrors the coding fields of `state` in app.js lines 56–96 (`lastResults, logs, running, viewingSavedRun, runStartedAt, runCode, savedRun, ai, aiLoading, aiLoadingMode, aiLastMode, aiError, hintSelection, explainTerm, aiExplaining, aiExplainError, solve, solveLoading, solveError, review, reviewLoading, reviewError, showSolution, tab`) plus actions `runTests, requestAIHint, requestAIReview, explainSelection, solveIt, applySolution, restoreSolution`.

`chatStore` (owns `gs.chat.*`): `open, width, key, messages, busy, error, controller`; actions `send, retry, clear, setOpen, toggle, ask`. The context comes from a selector function `getChatContext()` in `lib/chatContext.ts` (port of `chatContextProvider` in app.js plus `DesignStudy.chatContext` and `AwsGuide.chatContext`).

`designStore` (owns `gs.study.*`, `gs.study.collapsed`, `gs.design.eval.*`, `gs.brief.taskHidden`, `gs.terms.open`, `gs.quiz.*`).

`awsStore` (owns `gs.aws.*`): `tab, answers, scrollPos, width, collapsed, popover: { serviceId, anchorRect } | null`.

`canvasStore` (owns `gs.arch.*`): `layout, route, dir, legend, focus` where `focus` is the engine's `getFocus()` result. The engine pushes changes in (`engine.onChange((f) => canvasStore.setState({ focus: f }))`); components call engine methods to change things. **The view box is never stored.**

### 3.5 Canvas strategy (most important)

The canvas engine is the riskiest part. Port it in two steps and stop after step 1 unless there is a reason to continue.

**Step 1 (required): wrap.** Move `design-graphs.js` into `canvas/engine.ts` with these changes only:
1. Replace `byId('arch-…')` lookups with elements passed to `mount(refs)`: `{ modal, svg, canvas, legend, toolbar, menu, menuButton, scrim, panel }`.
2. Replace `typeof AwsGuide !== 'undefined' && AwsGuide.serviceCard(...)` and `DesignStudy.notifyInspect()` calls with callbacks passed in options: `{ serviceCard(svcId): string, onInspect(): void }`.
3. Keep all rendering (SVG strings, `declutterLabels`, `animateView`, `layoutTD`, `tdRoute`, `renderPathViewTD`, `revealBox`, `wake/setMotion`) exactly as is.
4. Export `createEngine()` and a singleton `getEngine()`.
5. Move pure functions (`layout`, `layoutTD`, `columnsThatFit`, `pathColumnsThatFit`, `layerRoute`, `tdRoute`, `centeredBox`, `flowOrders`) into `canvas/layout.ts` and unit test them with fixed inputs.

`ArchCanvas.tsx` renders the same markup as `#arch-modal` in `index.html` (head, `.arch-main`, `#arch-canvas`, `<svg id="arch-svg">`, toolbar, legend), calls `engine.mount(refs)` once in `useEffect`, and calls `engine.open(graphId, { inline: true })` whenever the graph id changes. Use `useLayoutEffect` for `open` so the canvas is in the DOM and visible before labels are measured.

**Inspector:** today the engine writes the inspector HTML into `#arch-panel`. In step 1 keep that (the engine renders into a `div` ref that the React `StudyPane`/`AwsPane` provides). In step 2 (optional), replace `renderInspector()` with a React `Inspector` component that reads `canvasStore.focus`.

**Step 2 (optional, later): reactify the SVG.** Render nodes and edges as JSX from the layout functions. Keep `viewBox` writes imperative via a ref. Only do this after the app has shipped on step 1 and e2e tests are green.

React StrictMode mounts effects twice in development. `engine.mount` must be idempotent (keep a `mounted` flag) and must remove its listeners in an `unmount()` cleanup.

### 3.6 Styling

- `src/main.tsx` imports `../../css/style.css` once. At cutover, move the file to `web/src/styles/style.css` and update the import.
- Keep markup structure close to the old HTML so selectors like `.study-pane > .study-top`, `#arch-modal.inline .arch-head`, `.design-stage.view-map .study-pane` still match.
- Body classes are set in one place: a `useBodyClasses()` hook in `App.tsx` that toggles them from store state.

### 3.7 HTML strings that stay as HTML

Only these may use `dangerouslySetInnerHTML`, and each input must be escaped first exactly like today:
1. Chat replies: `markdown.ts` (port of `AIChat.md`, which escapes before formatting).
2. Linkified text: `ConceptLib.linkTerms(esc(text))` and `AwsGuide.linkSvc(esc(text))`. Prefer converting these to a `<LinkedText text="…"/>` component that splits text into strings and `<button className="term">` / `<button className="svc-link">` elements. If that is too risky, keep the HTML and attach click handlers by delegation (as today).
3. Highlighted code in the editor overlay: `highlight.ts` output (it escapes).

---

## 4. Old → new file mapping

| Old | New | How |
|---|---|---|
| `js/questions.js` | `web/src/data/questions.ts` | mechanical (Appendix C) |
| `js/gs-questions.js` | `web/src/data/gsQuestions.ts` | mechanical |
| `js/gs-scraped.js` | `web/src/data/gsScraped.ts` | mechanical |
| `js/design-maps-1/2/3.js` | `web/src/data/designMaps.ts` | merge the three `Object.assign` blocks in order |
| `js/design-catalog-1/2/3.js` | `web/src/data/designCatalog.ts` | turn `DesignCatalog.add({...})` calls into an array literal, in file order |
| `js/design-examples.js` | `web/src/data/designBriefs.ts` | keep `DESIGN_BRIEF_FALLBACK` |
| `js/design-catalog.js` | `web/src/lib/catalog.ts` | pure `expandMap`, `buildDesign(catalog, maps)` returning `{ questions, graphs, briefs }` |
| `js/concepts.js` | `web/src/data/concepts.ts` + `web/src/lib/concepts.ts` | data vs logic split |
| `js/aws-services.js`, `js/aws-lessons-1/2.js` | `web/src/data/awsServices.ts`, `web/src/data/awsLessons.ts` | mechanical; lessons-2 `push` becomes part of one array |
| `js/aws-guide.js` | `web/src/lib/awsMaps.ts`, `components/aws/*`, `stores/awsStore.ts` | split logic / UI |
| `js/design-graphs.js` | `web/src/canvas/*` | see 3.5 |
| `js/design-study.js` | `components/design/*`, `stores/designStore.ts` | |
| `js/design-practice.js` | `components/design/LearnTab.tsx`, `PracticeTab.tsx`, `Toolkit.tsx`, `lib/numbers.ts` | |
| `js/ai-chat.js` | `components/chat/*`, `stores/chatStore.ts`, `lib/markdown.ts` | |
| `js/panel-sheet.js` | `components/mobile/BottomSheet.tsx` + `useBottomSheet` hook | |
| `js/runner.js` | `web/src/lib/runner.ts` | copy; keep `WORKER_SRC` string and Blob worker |
| `js/app.js` | `stores/appStore.ts`, `stores/codingStore.ts`, `components/shell/*`, `components/coding/*`, `components/modals/*`, `App.tsx` | largest split, see phase 5 |
| `index.html` | `web/index.html` (just `<div id="root">`) + JSX | static markup moves into components |
| `css/style.css` | imported as-is | |

### 4.1 `app.js` function → destination

| Function(s) in app.js | Destination |
|---|---|
| `store`, `KEYS` | `lib/storage.ts`, `lib/keys.ts` |
| `DEFAULT_QUEUE_GS`, `DEFAULT_QUEUE`, `seedScrapedQueue`, `seedDesignQueue`, `codingQueue`, `nextQueuedId`, `queueAdd/Remove/Move`, `persistQueue`, `renderQueue` | `stores/appStore.ts` (logic) + `components/shell/QueueList.tsx` |
| `SEN_LABEL`, `SEN_ABBR`, `senClass`, `CAT_LABEL`, `DIFF_LABEL` | `lib/labels.ts` |
| `GS`, `ROUNDS`, `ALL_CODING`, `allItems`, `byId`, `designQuestions` | `data/index.ts` |
| `KEYWORD_RE`, `highlight` | `lib/highlight.ts` |
| `toast` | `appStore.showToast` + `components/shell/Toast.tsx` |
| `matches`, `renderSidebar`, `itemRow` | `components/shell/CodingSidebar.tsx` (+ `lib/filter.ts` for `matches`) |
| `designRow`, `renderDesignSidebar`, `nextDesignId` | `components/shell/DesignSidebar.tsx` |
| `updateProgress` | `components/shell/Progress.tsx` (computed from store) |
| `setPageChrome`, `switchPage` | `appStore.switchPage` + `useBodyClasses` |
| `diffSolutionLines`, `paintEditor`, `loadCode`, `syncGutter`, editor `keydown`/`input`/`scroll` handlers | `components/coding/Editor.tsx`, `lib/diff.ts`, `lib/editorKeys.ts` |
| `setStatus` | `codingStore.status` |
| `setDesignMode`, `openBrief`, `openDesignStage`, `bindDesignChrome` | `components/design/DesignStage.tsx` |
| `setAwsMode`, `openAws` | `appStore.openAws`, `components/aws/AwsStage.tsx` |
| `chatSuggestions`, `chatContextProvider` | `lib/chatContext.ts` |
| `openHelp` | `components/modals/HelpModal.tsx` |
| `open` | `appStore.open` |
| `renderTabs`, `renderDoc`, `cleanPseudo`, `briefValue`, `frameworkHTML`, `formatBody` | `components/coding/QuestionDoc.tsx`, `NotesTab.tsx` |
| `buildHintContext`, `buildAIContext`, `buildSolveContext` | `lib/aiContext.ts` (copy verbatim, add types) |
| `renderExplainBlock`, `renderAIHint`, `renderAIHintPreserveScroll`, `requestAIHint`, `explainSelection` | `components/coding/AIHintPane.tsx` + `codingStore` |
| `lastRunPassed`, `maybeReviewAfterPass`, `requestAIReview`, `reviewHTML` | `codingStore` + `components/coding/ReviewCard.tsx` |
| `solveIt`, `solveHTML`, `applySolution`, `restoreSolution` | `codingStore` + `components/coding/SolveCard.tsx` |
| `namesFor`, `arrToLL`, `llToArr`, `T`, `runTests` | `lib/testHarness.ts` + `codingStore.runTests` |
| `consoleEmpty`, `consoleLine`, `consoleHTML`, `bindConsole`, `renderConsole`, `appendLog` | `components/coding/Console.tsx` |
| `buildRunSnapshot`, `writeRunSnapshot`, `appendRunHistory`, `scheduleRunPersist`, `restoreRun` | `codingStore` |
| `markHintStale`, `markRunStale`, `showRunning`, `renderResults`, `offerNext`, `fmt` | `components/coding/Results.tsx` + `codingStore` |
| `toggleDone`, `resetProblem` | `appStore`. Reset asks with the same `confirm()` text. For an AWS lesson it clears `gs.aws.<id>`, the chat `aws:<id>`, and the done mark. For a coding or design question it removes `gs.draft.<id>`, `gs.run.<id>`, `gs.ai.<id>`, `gs.review.<id>`, `gs.solve.<id>`, `gs.chat.<id>`, `gs.study.<id>`, `gs.design.eval.<id>`, `gs.quiz.<id>`, drops the question from `gs.runs`, deletes its note from `gs.notes`, clears the done mark, then reopens it and shows the toast `Problem reset` (`Lesson reset` for AWS) |
| `setSidebarHidden`, `setSidebarDrawer`, more-menu code | `appStore` + `components/shell/Sidebar.tsx`, `MoreMenu.tsx` |
| `openPlan`, `openRounds` | `components/modals/PlanModal.tsx`, `RoundsModal.tsx` |
| `graphClock`, `setGraphStatus`, `openGraph`, `rebuildGraph` | `components/modals/GraphModal.tsx` |
| `isNarrowAI`, `clamp`, `applyLayout`, `saveLayout`, `makeResizer`, `setAIPane`, `toggleAIPane` | `stores/appStore.ts` (layout) + `components/shell/Resizer.tsx` + `lib/layout.ts` |
| keyboard `keydown` listener | `App.tsx` `useGlobalShortcuts()` |
| `boot` | `App.tsx` first-mount effect |

### 4.2 Static markup in `index.html` → component

| `index.html` region | Component |
|---|---|
| `<nav class="global-nav">` | `GlobalNav` |
| `<aside class="sidebar">` (progress, `#side-code`, `#side-design`, `#side-aws`) | `Sidebar` + `Progress` + three list components |
| `<header class="topbar">` | `Topbar`, `DesignViews`, `MoreMenu` |
| `.workspace` (`pane left`, `#resize-panes`, `pane right`, `#resize-ai`, `#ai-pane`) | `CodingWorkspace` |
| `#design-stage` | `DesignStage` |
| `#aws-stage` | `AwsStage` |
| `#resize-chat`, `#chat-pane` | `Resizer`, `ChatPane` |
| `#plan-modal`, `#graph-modal` | `PlanModal`, `GraphModal` |
| `#arch-modal` | `ArchCanvas` |
| `#arch-menu-scrim`, `#arch-menu` | `CanvasSettings` |
| `#toast` | `Toast` |

### 4.3 Data registration order (must not change)

1. Coding: `ALL_CODING = [...GS_QUESTIONS, ...GS_SCRAPED, ...QUESTIONS]` (app.js lines 137–140). Queue defaults `DEFAULT_QUEUE_GS` stay identical.
2. Design: the catalog array must be in the original call order (part 1 → part 2 → part 3, top to bottom). `install()` then sorts by difficulty, keeping call order within a difficulty (it uses `q.order = i` as a tie-breaker). Port that sort exactly.
3. Duplicate edges in `expandMap` merge labels with ` · ` and append details. Keep it.
4. AWS maps are added to the graph collection after design graphs (keys are lesson ids like `aws-overview`).

---

## 5. Phases

Each phase lists tasks, then **Done when** (all must be true). Time estimates assume one focused implementer.

### Phase 0: Baseline (½ day)

Goal: capture how the current app behaves so the new one can be compared against it.

1. Create `docs/react-migration-notes.md` (empty log of decisions and differences).
2. In a scratch folder outside `web/`, install Playwright: `npm init -y && npm i -D @playwright/test && npx playwright install chromium`.
3. Write `baseline.spec.ts` that, against `http://127.0.0.1:8765`, for each viewport (1440×900, 390×844 portrait, 844×390 landscape):
   - clears `localStorage`, loads the page, dismisses the help modal;
   - screenshots: coding page; system design Brief; system design Map; AWS page (Guide tab); AWS with a component selected (Inspect tab); canvas settings open; Ask AI open; sidebar drawer open (phone).
4. Save screenshots to `docs/baseline/<viewport>/<name>.png` and commit them.
5. Record data counts (2.3) by running the Node snippet in Appendix D. Save output to `docs/baseline/counts.txt`.

**Done when:** baseline screenshots and counts are committed.

### Phase 1: Scaffold (½ day)

1. `cd practice-ide && npm create vite@latest web -- --template react-ts`.
2. `cd web && npm i zustand && npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test eslint typescript-eslint eslint-plugin-react-hooks`.
3. `package.json` scripts:
   ```json
   {
     "dev": "vite",
     "build": "tsc -b && vite build",
     "preview": "vite preview",
     "typecheck": "tsc -b --noEmit",
     "lint": "eslint src tests",
     "test": "vitest run",
     "e2e": "playwright test"
   }
   ```
4. `vite.config.ts` (Appendix E): dev port 5173, proxy `/api` and `/graphify-out` and `/graphify-vendor` to `http://127.0.0.1:8765`, `build.outDir = 'dist'`, Vitest `environment: 'jsdom'`.
5. `tsconfig.json`: `"strict": true`, `"noUncheckedIndexedAccess": false` (data is large; keep friction low), `"target": "ES2020"`, `"jsx": "react-jsx"`.
6. `web/index.html`: copy the `<head>` from the old `index.html` (title, viewport meta), body is `<div id="root"></div>`.
7. `src/main.tsx`: `import '../../css/style.css'`; render `<App/>` inside `React.StrictMode`.
8. `src/App.tsx`: render the static global nav markup only (copied from old `index.html`, converted to JSX: `class` → `className`, `for` → `htmlFor`, `aria-*` unchanged, self-close void tags).
9. Add `.gitignore` entries: `web/node_modules`, `web/dist`, `web/test-results`, `web/playwright-report`.

**Done when:** `npm run dev` shows the global nav styled exactly like the old app; `npm run build`, `typecheck`, `lint`, `test` all pass (add one trivial test).

### Phase 2: Data (1 day)

Goal: every data file is an ES module with types, and derived collections match the old counts.

1. Write the types in `src/types/` (Appendix A).
2. Convert data files with the script in Appendix C, then fix by hand:
   - `questions.ts`: `export const QUESTIONS: CodingQuestion[] = [...]`, `export const ROUND_PLAN`, `export const RUBRIC`. **Drop** `DESIGN_QUESTIONS = []` from here; it is built in `data/index.ts`.
   - `gsQuestions.ts`: `GS_QUESTIONS`, `GS_ROUNDS`.
   - `gsScraped.ts`: `GS_SCRAPED`.
   - `designMaps.ts`: `export const DESIGN_MAPS: Record<string, RawDesignMap> = { ...part1, ...part2, ...part3 }` in the original order.
   - `designCatalog.ts`: `export const DESIGN_CATALOG: CatalogEntry[] = [ ... ]` (each former `DesignCatalog.add({...})` argument, same order). Remove the final `DesignCatalog.install()` call.
   - `designBriefs.ts`: `DESIGN_BRIEF_FALLBACK` only (the briefs come from catalog entries).
   - `concepts.ts`: `CONCEPTS`, `SHAPE_INFO`. Keep `match` regexes literally.
   - `awsServices.ts`: `AWS_CATEGORIES`, `AWS_SERVICES`.
   - `awsLessons.ts`: one `AWS_LESSONS` array = lessons-1 array followed by every object pushed in lessons-2, same order.
3. `lib/catalog.ts`: port `DesignInfra.kindOf`, `expandMap`, and `install` as pure functions:
   ```ts
   export function buildDesign(catalog: CatalogEntry[], maps: Record<string, RawDesignMap>) {
     // returns { questions: DesignQuestion[], graphs: Record<string, Graph>, briefs: Record<string, Brief> }
   }
   ```
   Do not mutate the input array (copy before sorting).
4. `lib/awsMaps.ts`: port `expandMap(L)` from aws-guide.js lines 36–65 (`aws: true`, `colw: 280`, `basedOn` text, badge logic).
5. `data/index.ts`: build once and export `ALL_CODING`, `DESIGN_QUESTIONS`, `DESIGN_BRIEFS`, `GRAPHS` (design + AWS), `byId(id)`, `allItems()`.
6. Unit tests `tests/unit/data.test.ts`: assert every count in 2.3; assert the first and last id of `ALL_CODING`, `DESIGN_QUESTIONS`, `AWS_LESSONS` equal the old app's (from `docs/baseline/counts.txt`); assert `GRAPHS['url-shortener']` deep-equals the old `DESIGN_GRAPHS['url-shortener']` (dump it to JSON from the old app with Appendix D and commit as a fixture); same for `GRAPHS['aws-overview']`.

**Done when:** all data tests pass; no `any` in data files.

### Phase 3: Storage and stores (1 day)

1. `lib/storage.ts` (Appendix B) and `lib/keys.ts` with every key from 2.5 as a constant or function.
2. Create the six stores (3.4). Initial state is read from `localStorage` in the store creator, with the same defaults as the old code. Port these exactly:
   - queue initial value (app.js `state.queue`), then `seedScrapedQueue()` and `seedDesignQueue()` once at startup;
   - the `boot()` queue filter (only coding ids that exist);
   - `done` as a `Set` in memory, saved as an array.
3. Unit tests with a fake `localStorage` (jsdom provides one):
   - pre-populate keys in the old format, create the store, check values load;
   - call actions, check the exact JSON written;
   - seeding runs once (second init does not duplicate).

**Done when:** store tests pass and cover every key in 2.5.

### Phase 4: App shell (1–2 days)

Build the frame with real data but placeholder page bodies.

1. `useBodyClasses()` in `App.tsx`: toggles `mode-design`, `mode-aws`, `chat-open`, `sidebar-hidden`, `sidebar-drawer`, `arch-expanded`, `modal-open`, `map-wide`, `ai-hint-open` from store state.
2. `GlobalNav`: page tabs call `appStore.switchPage`; ☰ calls the sidebar toggle logic (port the click handler at app.js ~2262: drawer when the sidebar column is hidden by CSS, otherwise hide/show).
3. `Sidebar` with `Progress` and the three list components:
   - `CodingSidebar`: queue (`QueueList` with up/remove buttons, Next, Clear), library search, chips (level, seniority, category), grouped list (`itemRow` markup).
   - `DesignSidebar`: count, Next, search, grouped by difficulty (`designRow`).
   - `AwsSidebar`: port `AwsGuide.renderSidebar` (groups, counts, service search hits when the query is 2+ characters).
   - Tapping an item in drawer mode closes the drawer (including service hits).
4. `Topbar`: title + signature, `DesignViews` (Brief/Map, Map disabled when no graph), `MoreMenu` (port `setMore`, close on outside click and on item click; `Reset this problem` item shown by CSS on phones), Notes, AI hint, Reset, Mark done, Run tests.
5. `Resizer` component: port `makeResizer` (pointer drag, keyboard arrows, double-click reset, `body.resizing`). Grid template columns come from `appStore.layout` and the same clamping as `applyLayout`.
6. `Toast`, `HelpModal` (auto-open once via `gs.help.seen`), `PlanModal` (`openPlan`), `RoundsModal` (`openRounds`), `GraphModal` (`openGraph`, `rebuildGraph`, iframe `/graphify-out/graph.html`).
7. `useGlobalShortcuts()` with every shortcut in 2.7 except editor-only ones. Ignore keys while typing in inputs (copy the `typing` check).

**Done when:** switching pages, sidebar lists, search and chips, queue edits, drawer on phones, More menu, modals and toast all behave like the old app; e2e: page switching and sidebar tests pass at all three viewports.

### Phase 5: Coding page (2–3 days)

1. `CodingWorkspace` grid (`.workspace`, `ai-open` class when the hint pane is open on wide screens).
2. `QuestionPane`: tabs (`renderTabs`), `QuestionDoc` (port `renderDoc` to JSX: prompt formatting via `formatBody`, tags, sources, signature, hints reveal, solution toggle, framework block), `NotesTab` (textarea saving to `gs.notes`).
3. `Editor`:
   - uncontrolled `<textarea id="editor">` (keep it uncontrolled for performance; store the value in a ref and write drafts to `gs.draft.<id>` on input);
   - `<pre id="highlight">` overlay updated with `highlight()` (and the diff tint when a Solve-it solution is applied: `paintEditor`);
   - `<div id="gutter">` line numbers with error lines;
   - scroll sync between textarea, overlay, and gutter;
   - key handling from `ed.addEventListener('keydown', ...)` moved to `lib/editorKeys.ts` as a pure function `(event, value, selStart, selEnd) => edit | null`, unit tested for Tab, Shift+Tab, block indent, Enter auto-indent, closing bracket dedent.
4. `codingStore.runTests`: port `runTests` exactly (uses `Runner.run`, names from `namesFor`, harness with `arrToLL/llToArr/T`), streaming logs into the console, result snapshot persistence (`writeRunSnapshot`, `appendRunHistory`, `scheduleRunPersist`), `restoreRun` on open, stale markers.
5. `Results` and `Console` components (port `renderResults`, `consoleHTML`, `offerNext`).
6. `AIHintPane` (desktop ≥1280 px as a column; narrower screens follow `toggleAIPane` behavior): hint, re-evaluate, explain selection, review after pass, Solve it (apply / restore), loading and error states. Requests via `lib/api.ts` with the same timeouts.
7. Editor shortcuts ⌘/Ctrl+Enter and ⌘/Ctrl+H.

**Done when:** for 3 questions (one per source), you can type, see highlighting and line numbers, run tests (pass and fail cases, console logs, infinite loop timeout message), reload and see the draft and last run restored, and (with an API key) request a hint, review, explanation, and solution. Unit tests for `highlight`, `diffSolutionLines`, `editorKeys`, `testHarness`.

### Phase 6: Ask AI chat (1 day)

1. `lib/markdown.ts`: copy `inline()` and `md()` from ai-chat.js unchanged; unit test with headings, lists, code fences, tables, and HTML injection attempts (must be escaped).
2. `chatStore`: per-context key (`syncKey` logic), history load/save to `gs.chat.<key>` (max 40 kept, last 14 sent), `send` with streaming reader, abort on context switch, retry, clear (`forget`).
3. `ChatPane`: header with context label, Clear, ✕; log with rAF-batched streaming render; suggestions (`chatSuggestions`); textarea auto-grow; Enter sends, Shift+Enter newline, Escape closes; width resizer (`gs.chat.w`); docked vs full-screen handled by existing CSS and body class `chat-open`.
4. `lib/chatContext.ts`: port `chatContextProvider` and the design/AWS `chatContext()` functions. The chat refreshes its context when the page, question, lesson, or canvas focus changes (subscribe to the relevant store slices).

**Done when:** chat opens with ⌘J and `/`, history differs per question and per AWS lesson and survives reload, streaming renders smoothly, errors show the same messages.

### Phase 7: Canvas (2–3 days)

Follow 3.5 step 1.

1. Create `canvas/engine.ts` from `design-graphs.js`. Mechanical edits only (listed in 3.5). Keep comments.
2. Create `canvas/layout.ts` with the pure functions and unit tests:
   - `columnsThatFit(374) === 2`, `columnsThatFit(352) === 2`, `columnsThatFit(312) === 1`, `columnsThatFit(760) === 4` (verify these numbers against the old code first and use whatever it returns);
   - `layoutTD` for `GRAPHS['url-shortener']` returns positions inside `[0, W]`;
   - `tdRoute` returns a lane route for an upward edge.
3. `ArchCanvas.tsx` renders the `#arch-modal` markup (as JSX) with refs, mounts the engine, opens the graph in `useLayoutEffect` on graph id change, and calls `engine.relayout()` when it becomes visible (Map view shown, sheet expanded, page switched).
4. `CanvasToolbar` and `CanvasSettings` can stay engine-driven (the engine binds click handlers by `data-*` attributes through delegation, as today). Render the same markup; the settings sheet sits at body level (render it in `App` via a portal).
5. Subscribe the engine to `canvasStore` (focus changes) and wire callbacks: `onInspect` → design or AWS store switches its tab to Inspect; `serviceCard(svcId)` → `renderServiceCardHTML` from the AWS module.
6. Keyboard: `p` and `e` call `engine.setLayout` and `engine.setExpanded`.

**Done when:** every canvas behavior in 2.9 works in the React app (use the parity checklist 6.3); e2e tests: open map, select node, switch User actions, switch Right-angle (view box unchanged), set direction Top → down, open settings sheet on phone, packets pause after 12 s (`svg.animationsPaused()`).

### Phase 8: System design page (2–3 days)

1. `DesignStage` layout with classes `view-brief` / `view-map`, `study-collapsed`, `brief-open`, `sheet-full`.
2. `BriefView`: port `briefViewHTML`, `briefHTML`, `stepsHTML`, `stageHTML`, `evalHTML` to components: task column (hide/show via `gs.brief.taskHidden`), full prompt drawer, step cards (open one at a time, textarea auto-size, per-step hints and Feedback button), timer (45:00, play/pause/reset), evaluation card (`/api/ai-design-eval`, minimum characters, score ring, rubric, follow-ups).
3. `StudyPane` (Map view): tabs Inspect / Your answer / Learn / Practice, ✕ collapse and "Show panel" reopen, `TermsStrip` (open state `gs.terms.open`, clicking a term spotlights nodes via `engine.spotlight`), Inspect hosts the canvas inspector.
4. `AnswerTab`: port `answerTabHTML` and `compare()` / `spotMissing()`.
5. `LearnTab`, `PracticeTab`, `Toolkit`: port design-practice.js (`renderLearn`, `deckFor`, `renderPractice` incl. quiz state `gs.quiz.<id>`, numbers presets, latency and capacity tables).
6. `ConceptPopover`: port `showConcept` (click a `.term` button; bottom sheet on phones by CSS).
7. Behavioral questions (no map): `design-empty` placeholder and the behavioral stages/rubric.

**Done when:** for one easy, one hard, and one behavioral question: write answers, reload, see them restored; switch to Map, inspect components, use Learn/Practice; evaluation works with an API key.

### Phase 9: AWS page (1–2 days)

1. `AwsStage`: canvas + resizer + `AwsPane` (width `gs.aws.w` clamped by `applyWidth`, collapsed `gs.aws.collapsed`, reopen button).
2. `GuideTab`: hero, decision steps, compare table (+ wide compare modal), worked examples, user-action buttons (start flow on canvas), service index on the overview lesson.
3. `ServicesTab`: accordion of `ServiceCard`s.
4. `QuizTab`: score, options (2 columns, 1 on narrow), explanations, reset, saved to `gs.aws.<id>`.
5. `ServiceCard` (port `serviceCard`), `ServicePopover` (port `showPop`/`hidePop`/`focusService`: select on canvas if present, otherwise popover; bottom sheet on phones), linkified service names (`linkSvc`).
6. `j` / `k` lesson navigation; Mark done and Reset for lessons.

**Done when:** all 14 lessons open; inspecting a node shows the AWS card; quiz answers persist; popover opens for services not on the canvas.

### Phase 10: Mobile behaviors (1 day)

1. `useMediaQuery(query)` hook (subscribe with `matchMedia(...).addEventListener('change')`).
2. `BottomSheet` / `useBottomSheet(stageRef, paneRef)`: port panel-sheet.js (grab bar tap cycles tabs-only → half → full, drag with 6 px threshold and snap: < 140 px collapses, > 70 % goes full; tabs tap expands when collapsed; ✕ collapses on phones and expands when collapsed; canvas selection expands and scrolls the details into view).
3. Verify CSS-driven behaviors at 390×844, 360×740, 844×390, 768×1024: no horizontal scroll on any page, short nav labels, More sheet, chat full screen, modals as bottom sheets, 16 px inputs, landscape split.

**Done when:** e2e mobile suite passes (6.2 and 6.4); compare screenshots with `docs/baseline`.

### Phase 11: Hardening (1 day)

1. Remove every `console.log` and any `any` types added during porting.
2. Performance checks (Chrome DevTools or Playwright + CDP `Performance.getMetrics`):
   - idle on the AWS map for 20 s after 12 s of no input: `LayoutCount` must not increase;
   - typing in the editor stays smooth (no React re-render of the whole page per keystroke: verify with React DevTools Profiler that only `Editor` updates);
   - production bundle: report `vite build` output size in `docs/react-migration-notes.md` (expect JS ≲ 450 KB gzipped including data; data dominates).
3. Accessibility: tab order and `aria-*` attributes match the old markup; focus returns to a sensible element when modals close.
4. Error boundary around each page body that shows a reset button instead of a blank screen.

**Done when:** full e2e suite green at all viewports; numbers recorded.

### Phase 12: Cutover (½ day)

1. `server.py`: add a `WEB_ROOT` that points to `web/dist` when it exists (env `PRACTICE_WEB_ROOT` can override). In `serve_static` and `do_GET`, resolve `/graphify-out/*` and `/graphify-vendor/*` from the repo root, everything else from `WEB_ROOT`. Keep gzip and ETag behavior. Keep API routes unchanged.
2. Build: `cd web && npm ci && npm run build`. Start `python3 server.py 8765` and run the e2e suite against port 8765.
3. Move the old app into `legacy/` (`git mv index.html js css legacy/`) and update the CSS import path (or move `style.css` into `web/src/styles/`).
4. Update the top of `server.py` docstring and add a short README section: `npm run dev` (with `python3 server.py` running for the API) and `npm run build`.
5. After one week of use without issues, delete `legacy/` in a separate commit.

**Done when:** `python3 server.py` serves the React build, all features work, and a returning user's `localStorage` (copy one from the old app) loads with progress, drafts, notes, chat history, and settings intact.

Total estimate: about 15–20 working days.

---

## 6. Parity checklist (e2e test list)

Write these as Playwright tests in `web/tests/e2e/`. Each starts from cleared `localStorage` unless it says otherwise. Run at 1440×900 unless marked (P) phone portrait 390×844, (L) landscape 844×390.

### 6.1 Shell
- [ ] First visit opens the help modal once; second visit does not.
- [ ] Page tabs switch pages; the last page is restored after reload.
- [ ] Progress label and counts: `Completed x/55`, `Design completed x/36`, `AWS lessons done x/14`.
- [ ] Sidebar search, chips, queue add/remove/move/Next/Clear work and persist.
- [ ] (P) ☰ opens the drawer with a dimmed page; tapping an item closes it.
- [ ] More menu opens and closes; (P) it is a bottom sheet with "Reset this problem".
- [ ] Resizers drag, respond to arrow keys, reset on double-click, and sizes persist.
- [ ] ⌘J, `/`, `?`, Escape behave as in 2.7.

### 6.2 Coding
- [ ] Draft persists per question; Reset restores the starter and clears exactly the keys listed for `resetProblem` in 4.1, and nothing for other questions.
- [ ] Run tests: pass, fail, thrown error, console output with types, infinite loop → timeout message after 5 s.
- [ ] Results restored after reload.
- [ ] Editor keys: Tab, Shift+Tab, block indent, Enter auto-indent, bracket dedent.
- [ ] `j`/`k` move between coding questions when not typing.
- [ ] (L) question and editor side by side.

### 6.3 Canvas
- [ ] Opens with the whole map readable (desktop) / filling the width (P, top → down).
- [ ] Select node → inspector shows details; off-screen node picked from the panel pans into view.
- [ ] Components ↔ User actions (`p`), full screen (`e`, Escape exits).
- [ ] Curved ↔ Right-angle keeps the exact view box after zooming.
- [ ] Settings: Direction Auto/Left → right/Top → down; Lines; Legend Show/Hide (persisted).
- [ ] (P) Settings opens as a bottom sheet; gear is 50 px; only zoom and gear in the toolbar.
- [ ] Top → down at 768 px wide shows 4 components per row and 2 user-action columns.
- [ ] Packets pause after 12 s idle and resume on touch; paused when the tab is hidden.
- [ ] Rotating (L ↔ P) re-renders in the right direction.

### 6.4 System design
- [ ] Brief answers, timer, task hide, and evaluation card work and persist.
- [ ] Map view: tabs, terms strip spotlight, collapse/reopen panel.
- [ ] (P) Bottom sheet: grab tap cycles heights, drag snaps, tab tap expands when collapsed, selecting a node opens the sheet on details.
- [ ] Behavioral question shows the no-map placeholder.

### 6.5 AWS
- [ ] All 14 lessons open; sidebar search finds lessons and services.
- [ ] Guide sections render; flow buttons highlight paths on the canvas.
- [ ] Inspect shows the AWS service card for a selected node.
- [ ] Services accordion; quiz answers persist and score updates.
- [ ] Service popover for a service not on the canvas; (P) as a bottom sheet.
- [ ] Wide compare modal opens on lessons that have a comparison.
- [ ] `j`/`k` move between lessons.

### 6.6 AI (needs an API key; mark tests `@ai` and skip in CI without a key)
- [ ] Hint, re-evaluate, explain selection, review, solve/apply/restore.
- [ ] Chat streams; history per context; clear works; abort on context switch.
- [ ] Design evaluation.

### 6.7 Persistence compatibility
- [ ] Copy a `localStorage` dump from the old app (export with Appendix D's snippet), import it into the new app, and verify progress, queue, drafts, notes, runs, chat histories, study answers, AWS quiz answers, and canvas settings all appear.

---

## 7. Risks and how to avoid them

| Risk | What goes wrong | Prevention |
|---|---|---|
| Rendering the canvas while hidden | All labels pile up or vanish (`getBBox` = 0) | Open the graph in `useLayoutEffect` after the container is visible; call `relayout()` when the Map view or sheet becomes visible |
| View box in React state | 60 re-renders per second, janky pan | Keep `animateView` writing `svg.setAttribute('viewBox', …)` directly |
| StrictMode double effects | Duplicate listeners, double fetches, double queue seeding | Make `engine.mount` idempotent with cleanup; seed queue in store creation, not in an effect; guard fetches with AbortController |
| Losing user data | Users lose progress | Never change keys or shapes; test 6.7 with a real dump |
| Data conversion typos | Missing questions, broken maps | Script the conversion (Appendix C), assert counts and deep-equal fixtures (phase 2) |
| `RegExp` in concepts | JSON conversion breaks matching | Keep data as `.ts` modules, not JSON |
| Rewriting HTML strings by hand | Lost classes break CSS | Convert one function at a time; compare DOM with the old app (class names, structure) |
| `dangerouslySetInnerHTML` misuse | XSS from AI replies | Only for the cases in 3.7; inputs escaped first; markdown tests include injection |
| Editor as a controlled input | Cursor jumps, lag on large files | Keep the textarea uncontrolled; update overlay and gutter from the input event |
| Worker in Vite | Blob worker blocked or source changed | Copy `WORKER_SRC` string and Blob approach exactly; do not switch to `new Worker(new URL(...))` |
| Streaming chat | Partial UTF-8 characters, lost text on switch | Keep `TextDecoder` with `{ stream: true }` and the context-key check per chunk |
| Mobile CSS depends on structure | Sheet, sticky headers, toolbars break | Keep markup structure and classes; run the mobile e2e suite every phase |
| Animation cost returns | 40 % CPU idle again | Keep `wake/setMotion` and `.motion-off`; perf check in phase 11 |

---

## Appendix A. TypeScript types

```ts
// src/types/coding.ts
export interface TestCase { input?: string; expected: unknown; custom?: string; note?: string }
export interface Source { label: string; url: string }
export interface CodingQuestion {
  id: string; cat: string; level: 1 | 2 | 3; title: string; prompt: string;
  signature?: string; starter?: string; hints: string[]; solution?: string; complexity?: string;
  tests: TestCase[]; anyOf?: boolean;
  confidence?: 'high' | 'medium'; tag?: string; reportCount?: string; sources?: Source[];
  seniority?: 'junior' | 'mid' | 'senior' | 'manager' | 'N/A'; added?: string; sourceDate?: string; levelWhy?: string;
}
export interface Round { stage: string; detail: string; ask: string }

// src/types/design.ts
export type Difficulty = 'easy' | 'medium' | 'hard';
export interface Brief { ask: string; examples: string[]; deliver: string[] }
export interface CatalogEntry {
  id: string; difficulty: Difficulty; cat: string; title: string; prompt: string;
  hints: string[]; topics: string[]; brief?: Brief;
}
export interface DesignQuestion {
  id: string; level: 1 | 2 | 3; difficulty: Difficulty; cat: string; title: string;
  prompt: string; hints: string[]; topics: string[];
}
export type RawNode = [id: string, label: string, sub: string, layer: string, detail: string, spec?: string[]];
export type RawEdge = [from: string, to: string, label: string, kind: EdgeKind, detail: string];
export type RawFlow = [title: string, detail: string, hops: string, kind?: FlowKind];
export type RawFailure = [label: string, failed: string, affected: string, detail: string, mitigation: string];
export interface RawDesignMap {
  subtitle: string; basedOn?: string; sources?: [string, string][]; layers?: string[];
  nodes: RawNode[]; edges: RawEdge[]; flow: RawFlow[]; why: string[]; tradeoffs: string[]; failures?: RawFailure[];
}
export type EdgeKind = 'sync' | 'async' | 'obs';
export type FlowKind = 'read' | 'write' | 'background';
export interface GraphNode {
  id: string; label: string; sub: string; layer: string; detail: string; spec: string[];
  svc?: string; shape?: string; color?: string; badge?: string;
}
export interface GraphEdge { from: string; to: string; label: string; kind: EdgeKind; detail: string }
export interface GraphFlow { title: string; detail: string; nodes: string[]; edges: [string, string][]; kind: FlowKind }
export interface GraphFailure { label: string; nodes: string[]; affected: string[]; detail: string; mitigation: string }
export interface Graph {
  title: string; subtitle: string; layers: string[]; nodes: GraphNode[]; edges: GraphEdge[];
  flow: GraphFlow[]; why: string[]; tradeoffs: string[]; failures: GraphFailure[];
  basedOn?: string; sources: [string, string][]; aws?: boolean; colw?: number;
}

// src/types/concepts.ts
export interface Concept {
  id: string; name: string; kind: 'component' | 'pattern' | string; shape?: string; plain: string;
  match?: RegExp; what: string; why: string; tradeoffs: string[]; usedBy: string[]; alt?: string;
  aliases?: string[]; without?: string; breaks?: string; protect?: string;
}

// src/types/aws.ts
export interface AwsCategory { label: string; badge: string; color: string; q: string }
export interface AwsService {
  id: string; cat: string; name: string; short: string; shape: string; nonAws?: boolean;
  plain: string; popular?: boolean; analogy: string; use: string[];
  avoid: [reason: string, altId: string | null][]; pay: string; limits: string[];
  ai: string; who: string[]; tip: string; url: string; aliases: string[]; aiKey?: boolean;
}
export type AwsRawNode = [id: string, svcId: string, sub: string, layer: string, detail: string, label?: string, badge?: string];
export interface AwsLesson {
  id: string; group: 'start' | 'core' | 'genai'; title: string; question: string; summary: string;
  services: string[];
  decide: [when: string, ids: string[], why: string][];
  examples: [scenario: string, ids: string[], why: string, whyNot: string][];
  quiz: [question: string, options: string[], answer: number, why: string][];
  map: { title: string; subtitle: string; layers: string[]; nodes: AwsRawNode[]; edges: RawEdge[]; flow: RawFlow[]; why: string[]; tradeoffs: string[]; sources?: [string, string][] };
  compare?: { title: string; cols: string[]; rows: string[][] };
}
```

Check each type against the real data while converting (phase 2). If a field is missing or extra, fix the type, not the data.

## Appendix B. Storage helper

```ts
// src/lib/storage.ts — identical semantics to `store` in app.js
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false; // quota
    }
  },
  remove(key: string): void {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};
```

Store pattern (example):

```ts
// src/stores/canvasStore.ts
import { create } from 'zustand';
import { storage } from '../lib/storage';

type Dir = 'auto' | 'lr' | 'td';
interface CanvasState {
  layout: 'layers' | 'paths';
  route: 'curved' | 'ortho';
  dir: Dir;
  legend: 'on' | 'off' | null;
  focus: unknown;
  setDir(dir: Dir): void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  layout: storage.get('gs.arch.layout', 'layers') === 'paths' ? 'paths' : 'layers',
  route: storage.get('gs.arch.route', 'curved') === 'ortho' ? 'ortho' : 'curved',
  dir: ((v) => (v === 'lr' || v === 'td' ? v : 'auto'))(storage.get<string>('gs.arch.dir', 'auto')),
  legend: ((v) => (v === 'on' || v === 'off' ? v : null))(storage.get<string | null>('gs.arch.legend', null)),
  focus: null,
  setDir(dir) {
    storage.set('gs.arch.dir', dir);
    set({ dir });
  },
}));
```

In step 1 of the canvas port the engine keeps reading and writing `gs.arch.*` itself; the store only mirrors values for React components (for example the settings sheet). Do not write the same key from two places with different logic.

## Appendix C. Data conversion script

Run from `practice-ide/`. It turns each global into an export and prints anything it could not convert. Review every output file by hand afterwards.

```js
// web/scripts/convert-data.mjs
import fs from 'node:fs';

const jobs = [
  ['js/questions.js', 'web/src/data/questions.ts'],
  ['js/gs-questions.js', 'web/src/data/gsQuestions.ts'],
  ['js/gs-scraped.js', 'web/src/data/gsScraped.ts'],
  ['js/concepts.js', 'web/src/data/concepts.ts'],
  ['js/aws-services.js', 'web/src/data/awsServices.ts'],
];

for (const [from, to] of jobs) {
  let src = fs.readFileSync(from, 'utf8');
  // top-level `const NAME =` becomes `export const NAME =`
  src = src.replace(/^const ([A-Z_][A-Z0-9_]*) =/gm, 'export const $1 =');
  fs.mkdirSync('web/src/data', { recursive: true });
  fs.writeFileSync(to, '// Converted from ' + from + '. Edit here, not in the old file.\n' + src);
  console.log('wrote', to);
}
```

Manual steps the script does not do:
- `concepts.ts`: cut the `ConceptLib` IIFE out into `src/lib/concepts.ts` and import `CONCEPTS` there.
- `questions.ts`: delete the `DESIGN_QUESTIONS` line.
- Design maps: create `designMaps.ts` by copying each `Object.assign(DESIGN_MAPS, { ... })` object body into one exported object literal (parts 1, 2, 3 in order).
- Design catalog: create `designCatalog.ts` as `export const DESIGN_CATALOG: CatalogEntry[] = [ <arg 1>, <arg 2>, ... ]` copying each `DesignCatalog.add(` argument in file order (parts 1, 2, 3). Count must be 36.
- AWS lessons: create `awsLessons.ts` with the array from lessons-1, then append each `AWS_LESSONS.push( ... )` argument from lessons-2 in order. Count must be 14.
- Add type annotations (`export const QUESTIONS: CodingQuestion[] = [`).

## Appendix D. Dump data and storage from the old app

Data dump (Node, run from `practice-ide/`; writes JSON fixtures for phase 2 tests):

```js
// docs/baseline/dump-data.cjs
const fs = require('fs');
const vm = require('vm');
const ctx = { console };
vm.createContext(ctx);
const files = ['questions', 'gs-questions', 'gs-scraped', 'design-graphs', 'design-examples',
  'design-maps-1', 'design-maps-2', 'design-maps-3', 'design-catalog',
  'design-catalog-1', 'design-catalog-2', 'design-catalog-3', 'concepts',
  'aws-services', 'aws-lessons-1', 'aws-lessons-2'];
for (const f of files) {
  let src = fs.readFileSync('js/' + f + '.js', 'utf8');
  if (f === 'design-graphs') src = src.replace(/const DesignGraph = \(\(\) => \{[\s\S]*$/, '');
  src = src.replace(/^const (\w+)/gm, 'var $1');
  vm.runInContext(src, ctx, { filename: f });
}
const counts = {
  QUESTIONS: ctx.QUESTIONS.length, GS_QUESTIONS: ctx.GS_QUESTIONS.length, GS_SCRAPED: ctx.GS_SCRAPED.length,
  DESIGN_QUESTIONS: ctx.DESIGN_QUESTIONS.length, DESIGN_GRAPHS: Object.keys(ctx.DESIGN_GRAPHS).length,
  DESIGN_BRIEFS: Object.keys(ctx.DESIGN_BRIEFS).length, CONCEPTS: ctx.CONCEPTS.length,
  AWS_SERVICES: ctx.AWS_SERVICES.length, AWS_LESSONS: ctx.AWS_LESSONS.length,
  firstDesign: ctx.DESIGN_QUESTIONS[0].id, lastDesign: ctx.DESIGN_QUESTIONS.at(-1).id,
};
fs.writeFileSync('docs/baseline/counts.json', JSON.stringify(counts, null, 2));
fs.writeFileSync('docs/baseline/graph-url-shortener.json', JSON.stringify(ctx.DESIGN_GRAPHS['url-shortener'], null, 2));
console.log(counts);
```

(AWS graphs are created inside `aws-guide.js`, which needs the DOM. For the `aws-overview` fixture, open the old app in a browser and run `copy(JSON.stringify(DESIGN_GRAPHS['aws-overview']))` in the console, then save it to `docs/baseline/graph-aws-overview.json`. Also record `ALL_CODING.map(q => q.id)` the same way into `docs/baseline/all-coding-ids.json`.)

`localStorage` export from the old app (browser console on http://127.0.0.1:8765):

```js
copy(JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('gs.')).map((k) => [k, localStorage.getItem(k)]))));
```

Import into the new app (browser console on the new app, then reload):

```js
const dump = /* paste */ {};
Object.entries(dump).forEach(([k, v]) => localStorage.setItem(k, v));
```

## Appendix E. Vite config

```ts
// web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = 'http://127.0.0.1:8765';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: api, changeOrigin: false },
      '/graphify-out': { target: api },
      '/graphify-vendor': { target: api },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./tests/setup.ts'] },
});
```

`tests/setup.ts`: `import '@testing-library/jest-dom'; beforeEach(() => localStorage.clear());`

Chat streaming through the Vite proxy: the proxy streams by default. If replies arrive all at once, add `configure: (proxy) => proxy.on('proxyRes', (res) => { res.headers['cache-control'] = 'no-cache'; })` to the `/api` entry.

## Appendix F. Playwright config and sample test

```ts
// web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: process.env.APP_URL || 'http://127.0.0.1:5173' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
    { name: 'landscape', use: { ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 } } },
  ],
});
```

```ts
// web/tests/e2e/canvas.spec.ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('gs.help.seen', 'true'); });
  await page.reload();
});

test('line style switch keeps the view', async ({ page }) => {
  await page.getByRole('tab', { name: 'AWS' }).click();
  await page.locator('#arch-zoom-in').click();
  await page.locator('#arch-zoom-in').click();
  await page.waitForTimeout(800);
  const before = await page.locator('#arch-svg').getAttribute('viewBox');
  await page.locator('#arch-menu-btn').click();
  await page.locator('#arch-menu [data-route="ortho"]').click();
  expect(await page.locator('#arch-svg').getAttribute('viewBox')).toBe(before);
});

test('packets pause when idle', async ({ page }) => {
  await page.getByRole('tab', { name: 'AWS' }).click();
  await page.waitForTimeout(13000);
  expect(await page.locator('#arch-svg').evaluate((svg) => (svg as SVGSVGElement).animationsPaused())).toBe(true);
});
```

## Appendix G. Conversion patterns (HTML string → JSX)

| Old | New |
|---|---|
| `` `<div class="x">${esc(text)}</div>` `` | `<div className="x">{text}</div>` (React escapes) |
| `` `${cond ? '<b>y</b>' : ''}` `` | `{cond && <b>y</b>}` |
| `` items.map((i) => `<li>${esc(i)}</li>`).join('') `` | `{items.map((i) => <li key={i}>{i}</li>)}` (use a stable key; index only if items never reorder) |
| `el.innerHTML = html; el.querySelector('#x').addEventListener('click', f)` | `<button onClick={f}>` |
| delegated `panel.addEventListener('click', (e) => { const b = e.target.closest('[data-go]') ... })` | one `onClick` per button, passing the id: `onClick={() => selectNode(id)}` |
| `style="--cat:${color}"` | `style={{ '--cat': color } as React.CSSProperties}` |
| `data-foo="${v}"` used only by CSS | keep `data-foo={v}` |
| `document.body.classList.toggle('chat-open', on)` | `useBodyClasses()` reading store state |
| `setTimeout` / `setInterval` in modules | `useEffect` with cleanup |
| `localStorage` direct calls | `storage.get/set` inside store actions |

When porting a render function, keep a copy of the old output for one sample (open the old app, copy the element's `outerHTML`) and compare it with the React output's `outerHTML` in a unit test using `@testing-library/react`. Class names and nesting must match; whitespace may differ.
