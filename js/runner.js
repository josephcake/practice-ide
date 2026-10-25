/* ============================================================
   TEST RUNNER
   Runs user code inside a Web Worker so infinite loops can be
   killed with a hard timeout and the UI never freezes.
   Test bodies are custom expressions evaluated with a `Test`
   object that exposes the user's top-level declarations.
   ============================================================ */
const DEFAULT_TIMEOUT_MS = 5000;

const WORKER_SRC = String.raw`
const __deepEq = (a, b) => {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') {
    return Number.isNaN(a) && Number.isNaN(b);
  }
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!__deepEq(a[k], b[k])) return false;
  return true;
};

const __matches = (actual, expected, anyOf) => {
  if (Array.isArray(expected) && anyOf && typeof expected[0] === 'string' && !Array.isArray(actual)) {
    return expected.some(e => __deepEq(actual, e));
  }
  return __deepEq(actual, expected);
};

// runtime type label shown next to every logged value
const __type = (v) => {
  if (v === null) return "Null";
  if (v === undefined) return "Undefined";
  return Object.prototype.toString.call(v).slice(8, -1);
};

// readable formatting for captured console output
const __fmt = (v) => {
  if (typeof v === "string") return v;
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
  if (typeof v === "function") return "[Function " + (v.name || "anonymous") + "]";
  if (v instanceof Error) return v.stack || (v.name + ": " + v.message);
  if (v instanceof Date) return isNaN(v.getTime()) ? "Invalid Date" : v.toISOString();
  if (v instanceof RegExp) return String(v);
  if (v instanceof Map) {
    try { return "Map(" + v.size + ") " + JSON.stringify(Array.from(v.entries()), null, 2); }
    catch (_) { return "Map(" + v.size + ")"; }
  }
  if (v instanceof Set) {
    try { return "Set(" + v.size + ") " + JSON.stringify(Array.from(v.values()), null, 2); }
    catch (_) { return "Set(" + v.size + ")"; }
  }
  try {
    const seen = new WeakSet();
    const text = JSON.stringify(v, (key, val) => {
      if (typeof val === "function") return "[Function]";
      if (typeof val === "bigint") return String(val) + "n";
      if (val && typeof val === "object") {
        if (seen.has(val)) return "[Circular]";
        seen.add(val);
      }
      return val;
    }, 2);
    return text === undefined ? String(v) : text;
  } catch (_) {
    return String(v);
  }
};

self.onmessage = async (e) => {
  const { id, code, names, tests, anyOf, harness } = e.data;
  const out = { id, results: [], fatal: null };

  // every console.* call in the candidate's code is streamed to the UI
  let logCount = 0;
  const emit = (level, args) => {
    if (logCount > 500) return;
    if (logCount === 500) {
      logCount++;
      self.postMessage({ id: id, type: "log", level: "warn", text: "… console output truncated after 500 entries" });
      return;
    }
    logCount++;
    const parts = args.map((v) => {
      let text;
      try { text = __fmt(v); }
      catch (_) { text = String(v); }
      if (text.length > 20000) text = text.slice(0, 20000) + " …";
      return { type: __type(v), text: text };
    });
    const text = parts.map((p) => p.text).join(" ");
    self.postMessage({ id: id, type: "log", level: level, text: text, parts: parts });
  };
  const capture = (level) => function () {
    emit(level, Array.prototype.slice.call(arguments));
  };
  console.log = console.info = console.debug = console.dir = console.table = capture("log");
  console.warn = capture("warn");
  console.error = capture("error");
  console.clear = function () { self.postMessage({ id: id, type: "clear" }); };

  let Test = {};
  try {
    const src = (harness ? harness + '\n' : '') + '\n' + code + '\n;return {' +
      names.map(n => JSON.stringify(n) + ': (typeof ' + n + ' !== "undefined" ? ' + n + ' : undefined)').join(',') + '};';
    Test = new Function(src)();
    if (harness) { const h = new Function(harness + ';return {arrToLL, llToArr, T};')(); Object.assign(Test, h); }
  } catch (err) {
    out.fatal = (err && err.message) || String(err);
    self.postMessage(out);
    return;
  }

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    const r = { pass: false, actual: undefined, error: null };
    try {
      const expr = t.custom || ('Test.' + names[0] + '(/* no case */)');
      const fn = new Function('Test', 'return (' + expr + ');');
      let actual = fn(Test);
      if (actual && typeof actual.then === 'function') actual = await actual;
      r.actual = actual;
      r.pass = __matches(actual, t.expected, anyOf);
    } catch (err) {
      r.error = (err && err.message) || String(err);
    }
    out.results.push(r);
  }
  self.postMessage(out);
};
`;

const Runner = (() => {
  let worker = null;
  let seq = 0;
  const pending = new Map();

  function spawn() {
    const blob = new Blob([WORKER_SRC], { type: 'text/javascript' });
    const w = new Worker(URL.createObjectURL(blob));
    w.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      if (e.data.type === 'log') { if (p.onLog) p.onLog(e.data.level, e.data.text, e.data.parts); return; }
      if (e.data.type === 'clear') { if (p.onClear) p.onClear(); return; }
      pending.delete(e.data.id);
      clearTimeout(p.timer);
      p.resolve(e.data);
    };
    w.onerror = (err) => {
      for (const [id, p] of pending) {
        clearTimeout(p.timer);
        p.resolve({ id, results: [], fatal: err.message || 'Worker error' });
      }
      pending.clear();
    };
    return w;
  }

  function get() {
    if (!worker) worker = spawn();
    return worker;
  }

  function recycle() {
    if (worker) worker.terminate();
    worker = null;
  }

  /**
   * @param {object} q      question object
   * @param {string} code   user source
   * @param {object} meta   { names: string[], harness: string }
   */
  function run(q, code, meta, handlers) {
    const hooks = handlers || {};
    return new Promise((resolve) => {
      const w = get();
      const id = ++seq;
      const timer = setTimeout(() => {
        pending.delete(id);
        recycle(); // a hung worker is contaminated
        resolve({ results: [], fatal: 'Timeout after ' + DEFAULT_TIMEOUT_MS + 'ms - possible infinite loop.' });
      }, DEFAULT_TIMEOUT_MS);

      pending.set(id, { resolve, timer, onLog: hooks.onLog, onClear: hooks.onClear });
      w.postMessage({
        id,
        code,
        names: meta.names,
        harness: meta.harness,
        anyOf: !!q.anyOf,
        tests: q.tests
      });
    });
  }

  return { run, recycle };
})();
