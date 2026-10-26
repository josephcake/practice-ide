/* ============================================================
   QUESTIONS DATA
   ------------------------------------------------------------
   All prose uses SINGLE-QUOTED strings joined by \n so that
   backticks in code samples can never break parsing.

   Coding question shape:
   { id, cat, level, title, prompt, signature, starter,
     hints[], solution, complexity, tests[] }
   tests[]: { input, expected, custom?, note? }  - custom wins.
   ============================================================ */

const QUESTIONS = [
  /* ---------------------------------------------------------- ARRAYS */
  {
    id: 'two-sum',
    cat: 'arrays',
    level: 1,
    title: 'Two Sum',
    prompt: [
      'Given an array of integers nums and an integer target, return the INDICES of the two numbers that add up to target. Exactly one solution exists; you may not use the same element twice.',
      '',
      'The real question: can you move from O(n^2) to O(n)?'
    ].join('\n'),
    signature: 'twoSum(nums, target)',
    starter: [
      'function twoSum(nums, target) {',
      '  // brute force is O(n^2) - say the complexity out loud,',
      '  // then replace it with a hash map in O(n)',
      '}'
    ].join('\n'),
    hints: [
      'Brute force: two nested loops over every pair. O(n^2) time, O(1) space. Say this first - it earns credit and shows structure.',
      'For each number x the value you need is target - x. "Have I already seen it?" is a lookup, not a search.',
      'Keep a Map of value -> index. One pass. If seen.has(target - nums[i]) return [seen.get(target - nums[i]), i]; otherwise set nums[i] -> i.',
      'The trap: insert AFTER the lookup so you never pair an element with itself. [3,3] with target 6 must return [0,1].',
      'Goldman follow-ups: "what if the array is sorted?" -> two pointers, O(1) space. "How many pairs exist?" -> count complements in the same map.'
    ],
    solution: [
      'function twoSum(nums, target) {',
      '  const seen = new Map(); // value -> index',
      '  for (let i = 0; i < nums.length; i++) {',
      '    const need = target - nums[i];',
      '    if (seen.has(need)) return [seen.get(need), i];',
      '    seen.set(nums[i], i);',
      '  }',
      '  return [];',
      '}'
    ].join('\n'),
    complexity: 'Time O(n), Space O(n)',
    tests: [
      { input: 'twoSum([2,7,11,15], 9)', expected: [0, 1], custom: "Test.twoSum([2,7,11,15], 9)" },
      { input: 'twoSum([3,2,4], 6)', expected: [1, 2], custom: "Test.twoSum([3,2,4], 6)", note: 'cannot reuse index 0' },
      { input: 'twoSum([3,3], 6)', expected: [0, 1], custom: "Test.twoSum([3,3], 6)", note: 'the duplicate trap' },
      { input: 'twoSum([-3,4,3,90], 0)', expected: [0, 2], custom: "Test.twoSum([-3,4,3,90], 0)", note: 'negatives' }
    ]
  },
  {
    id: 'best-time-stock',
    cat: 'arrays',
    level: 1,
    title: 'Best Time to Buy and Sell Stock',
    prompt: [
      'prices[i] is the price of a stock on day i. Pick one day to buy and a LATER day to sell to maximise profit. Return the max profit, or 0 if none is possible.',
      '',
      'This is "one pass, track the running minimum". They are testing whether you can state an invariant out loud.'
    ].join('\n'),
    signature: 'maxProfit(prices)',
    starter: 'function maxProfit(prices) {\n\n}',
    hints: [
      'Brute force: every (buy, sell) pair with sell after buy -> O(n^2).',
      'Think incrementally. Standing on day i, what do you need from days 0..i-1 to answer "best profit if I sell today"?',
      'Exactly two things: the cheapest price so far, and the best profit so far. That pair is your invariant.',
      'Loop once: min = Math.min(min, p); best = Math.max(best, p - min).',
      'Edge case: strictly decreasing prices -> 0, never negative.'
    ],
    solution: [
      'function maxProfit(prices) {',
      '  let min = Infinity;',
      '  let best = 0;',
      '  for (const p of prices) {',
      '    min = Math.min(min, p);',
      '    best = Math.max(best, p - min);',
      '  }',
      '  return best;',
      '}'
    ].join('\n'),
    complexity: 'Time O(n), Space O(1)',
    tests: [
      { input: 'maxProfit([7,1,5,3,6,4])', expected: 5, custom: 'Test.maxProfit([7,1,5,3,6,4])' },
      { input: 'maxProfit([7,6,4,3,1])', expected: 0, custom: 'Test.maxProfit([7,6,4,3,1])', note: 'decreasing' },
      { input: 'maxProfit([2,4,1])', expected: 2, custom: 'Test.maxProfit([2,4,1])' },
      { input: 'maxProfit([1])', expected: 0, custom: 'Test.maxProfit([1])', note: 'single element' }
    ]
  },
  {
    id: 'group-anagrams',
    cat: 'arrays',
    level: 1,
    title: 'Contains Duplicate + Group Anagrams',
    prompt: [
      'PART A: return true if any value appears at least twice in nums.',
      '',
      'PART B: group the anagram strings together.',
      '',
      'Part B is the usual Goldman favourite. The mental move being tested - "what KEY makes two things equivalent?" - also applies to dedupe, caching and idempotency.'
    ].join('\n'),
    signature: 'containsDuplicate(nums)   // and\n groupAnagrams(strs)',
    starter: [
      'function containsDuplicate(nums) {',
      '',
      '}',
      '',
      'function groupAnagrams(strs) {',
      '',
      '}'
    ].join('\n'),
    hints: [
      'Part A is a Set: new Set(nums).size !== nums.length. State the trade-off - O(n) space for O(n) time.',
      'Part B needs a canonical key: all anagrams produce the same key, non-anagrams do not.',
      'Two valid keys: [...s].sort().join("") is O(k log k); a 26-length count vector is O(k). Give the sort first, mention the count vector as the optimisation.',
      'Group into Map<string, string[]>, push into the bucket, return [...map.values()].',
      'Follow-up: "this is a huge stream, keys are unbounded" -> count vector key is O(k) and independent of alphabet ordering; also mention hashing the vector.'
    ],
    solution: [
      'function containsDuplicate(nums) {',
      '  return new Set(nums).size !== nums.length;',
      '}',
      '',
      'function groupAnagrams(strs) {',
      '  const groups = new Map();',
      '  for (const s of strs) {',
      '    const key = [...s].sort().join("");',
      '    if (!groups.has(key)) groups.set(key, []);',
      '    groups.get(key).push(s);',
      '  }',
      '  return [...groups.values()];',
      '}'
    ].join('\n'),
    complexity: 'containsDuplicate O(n). groupAnagrams O(n * k log k).',
    tests: [
      { input: 'containsDuplicate([1,2,3,1])', expected: true, custom: 'Test.containsDuplicate([1,2,3,1])' },
      { input: 'containsDuplicate([1,2,3,4])', expected: false, custom: 'Test.containsDuplicate([1,2,3,4])' },
      {
        input: "groupAnagrams(['eat','tea','tan','ate','nat','bat'])",
        expected: [['ate', 'eat', 'tea'], ['bat'], ['nat', 'tan']],
        custom: "(() => { const g = Test.groupAnagrams(['eat','tea','tan','ate','nat','bat']); return g.map(a => [...a].sort()).sort((x,y) => x.join('').localeCompare(y.join(''))); })()"
      }
    ]
  },
  {
    id: 'product-except-self',
    cat: 'arrays',
    level: 2,
    title: 'Product of Array Except Self',
    prompt: [
      'Return out[i] = the product of every element except nums[i]. Do it WITHOUT division and in O(1) extra space (the output array is not counted).',
      '',
      'This is the prefix/suffix pattern. The naive "multiply everything then divide" quietly breaks on zeros, which is what they want to hear you say.'
    ].join('\n'),
    signature: 'productExceptSelf(nums)',
    starter: 'function productExceptSelf(nums) {\n\n}',
    hints: [
      'The banned answer is total product divided by nums[i]. It is wrong with a zero present and illegal under "no division". Say why.',
      'out[i] = (product of everything LEFT of i) * (product of everything RIGHT of i).',
      'Pass 1 left-to-right: write the running prefix product into out[i].',
      'Pass 2 right-to-left: hold one suffix scalar, multiply it into out[i], then suffix *= nums[i]. That is O(1) extra space.',
      'Edge cases: one zero -> only that index is non-zero. Two zeros -> all zeros.'
    ],
    solution: [
      'function productExceptSelf(nums) {',
      '  const n = nums.length;',
      '  const out = new Array(n).fill(1);',
      '  for (let i = 1; i < n; i++) out[i] = out[i - 1] * nums[i - 1];',
      '  let suffix = 1;',
      '  for (let i = n - 1; i >= 0; i--) {',
      '    out[i] *= suffix;',
      '    suffix *= nums[i];',
      '  }',
      '  return out;',
      '}'
    ].join('\n'),
    complexity: 'Time O(n), Space O(1) excluding output',
    tests: [
      { input: 'productExceptSelf([1,2,3,4])', expected: [24, 12, 8, 6], custom: 'Test.productExceptSelf([1,2,3,4])' },
      { input: 'productExceptSelf([-1,1,0,-3,3])', expected: [0, 0, 9, 0, 0], custom: 'Test.productExceptSelf([-1,1,0,-3,3])', note: 'zero kills division' },
      { input: 'productExceptSelf([2,3])', expected: [3, 2], custom: 'Test.productExceptSelf([2,3])' }
    ]
  },
  {
    id: 'longest-consecutive',
    cat: 'arrays',
    level: 2,
    title: 'Longest Consecutive Sequence',
    prompt: [
      'Given an unsorted array, return the length of the longest run of consecutive integers. Target O(n).',
      '',
      'Almost everyone reaches for sort (O(n log n)). The O(n) insight - only start counting from a run left edge - is the actual test.'
    ].join('\n'),
    signature: 'longestConsecutive(nums)',
    starter: 'function longestConsecutive(nums) {\n\n}',
    hints: [
      'Sorting works: O(n log n). Say it as the baseline, then ask "can a hash set let us skip the sort?"',
      'Put all values in a Set. A number STARTS a run only if set.has(x - 1) is false.',
      'From each start, walk x+1, x+2, ... while present, counting. Only left edges do any work.',
      'Every element is touched at most twice -> O(n). Drop the has(x-1) guard and you silently degrade to O(n^2).',
      'Handle duplicates: [1,1,1,2] -> 2.'
    ],
    solution: [
      'function longestConsecutive(nums) {',
      '  const set = new Set(nums);',
      '  let best = 0;',
      '  for (const n of set) {',
      '    if (set.has(n - 1)) continue;',
      '    let len = 1;',
      '    while (set.has(n + len)) len++;',
      '    best = Math.max(best, len);',
      '  }',
      '  return best;',
      '}'
    ].join('\n'),
    complexity: 'Time O(n) amortised, Space O(n)',
    tests: [
      { input: 'longestConsecutive([100,4,200,1,3,2])', expected: 4, custom: 'Test.longestConsecutive([100,4,200,1,3,2])' },
      { input: 'longestConsecutive([0,3,7,2,5,8,4,6,0,1])', expected: 9, custom: 'Test.longestConsecutive([0,3,7,2,5,8,4,6,0,1])' },
      { input: 'longestConsecutive([])', expected: 0, custom: 'Test.longestConsecutive([])' }
    ]
  },

  /* ---------------------------------------------------------- STRINGS */
  {
    id: 'valid-parens',
    cat: 'strings',
    level: 1,
    title: 'Valid Parentheses',
    prompt: [
      'Given a string made of the brackets ()[]{}, decide whether they are validly matched and correctly nested.',
      '',
      'A stack is the answer, but the question behind it is "when is a stack the right tool?". This is also the warm-up for the run-length parser follow-up.'
    ].join('\n'),
    signature: 'isValid(s)',
    starter: 'function isValid(s) {\n\n}',
    hints: [
      'You must remember what is currently open, most recent first. Most-recent-first is LIFO, so a stack.',
      'Push the EXPECTED CLOSER when you see an opener. That makes the check one comparison.',
      'On a closer: the stack must be non-empty and stack.pop() must equal the character.',
      'At the end the stack must be empty: "([]{})" true, "([)]" false, "(" false, "" true.',
      'State complexity: O(n) time, O(n) space worst case. Follow-ups they like: parse nested repeats, or a bracket-aware calculator.'
    ],
    solution: [
      'function isValid(s) {',
      '  const pairs = { "(": ")", "[": "]", "{": "}" };',
      '  const stack = [];',
      '  for (const ch of s) {',
      '    if (pairs[ch]) stack.push(pairs[ch]);',
      '    else if (stack.pop() !== ch) return false;',
      '  }',
      '  return stack.length === 0;',
      '}'
    ].join('\n'),
    complexity: 'Time O(n), Space O(n)',
    tests: [
      { input: "isValid('()[]{}')", expected: true, custom: "Test.isValid('()[]{}')" },
      { input: "isValid('([)]')", expected: false, custom: "Test.isValid('([)]')", note: 'interleaved' },
      { input: "isValid('(]')", expected: false, custom: "Test.isValid('(]')" },
      { input: "isValid('')", expected: true, custom: "Test.isValid('')", note: 'empty' },
      { input: "isValid('{[]}')", expected: true, custom: "Test.isValid('{[]}')" }
    ]
  },
  {
    id: 'longest-palindrome',
    cat: 'strings',
    level: 2,
    title: 'Longest Palindromic Substring',
    prompt: [
      'Return the longest palindromic substring of s.',
      '',
      'Expand-around-centre is the interview answer; it is short and O(1) space. Know that Manacher exists for O(n) and do not try to hand-write it under pressure.'
    ].join('\n'),
    signature: 'longestPalindrome(s)',
    starter: 'function longestPalindrome(s) {\n\n}',
    hints: [
      'Brute force: test every substring -> O(n^3). Say it, then move on.',
      'A palindrome is defined by its centre. There are 2n-1 centres: n odd (a character) and n-1 even (the gap between two).',
      'Expand while s[l] === s[r]. O(n^2) time, O(1) space.',
      'Get the even case right: start with l = i, r = i + 1 and still try it (it may be the best).',
      'Follow-up "make it O(n)": name Manacher, say it is linear, explain the idea in one sentence and stop there.'
    ],
    solution: [
      'function longestPalindrome(s) {',
      '  let bestStart = 0, bestLen = 0;',
      '  const expand = (l, r) => {',
      '    while (l >= 0 && r < s.length && s[l] === s[r]) { l--; r++; }',
      '    return [l + 1, r - l - 1];',
      '  };',
      '  for (let i = 0; i < s.length; i++) {',
      '    for (const [st, len] of [expand(i, i), expand(i, i + 1)]) {',
      '      if (len > bestLen) { bestLen = len; bestStart = st; }',
      '    }',
      '  }',
      '  return s.slice(bestStart, bestStart + bestLen);',
      '}'
    ].join('\n'),
    complexity: 'Time O(n^2), Space O(1)',
    tests: [
      {
        input: "longestPalindrome('babad')",
        expected: ['bab', 'aba'],
        custom: "Test.longestPalindrome('babad')",
        note: 'either is correct - ties allowed'
      },
      { input: "longestPalindrome('cbbd')", expected: 'bb', custom: "Test.longestPalindrome('cbbd')" },
      { input: "longestPalindrome('a')", expected: 'a', custom: "Test.longestPalindrome('a')" },
      { input: "longestPalindrome('forgeeksskeegfor')", expected: 'geeksskeeg', custom: "Test.longestPalindrome('forgeeksskeegfor')" }
    ],
    anyOf: true
  },
  {
    id: 'run-length',
    cat: 'strings',
    level: 1,
    title: 'Run-Length Encode / Decode (round-trip)',
    prompt: [
      'encode(s): compress runs. "aaabcc" -> "a3b1c2".',
      'decode(e): invert it and handle MULTI-DIGIT counts ("a12" is twelve a\'s).',
      'Bonus: decodeString("3[a2[b]]") -> "abbabbabb".',
      '',
      'Tests parsing and round-trip reasoning - the same thinking as writing a serialiser at work.'
    ].join('\n'),
    signature: 'encode(s)   // and\n decode(e)   // and\n decodeString(s)',
    starter: [
      'function encode(s) {',
      '  // "aaabcc" -> "a3b1c2"',
      '}',
      '',
      'function decode(e) {',
      '  // "a3b1c2" -> "aaabcc";  "a12" -> "a" x 12',
      '}',
      '',
      'function decodeString(s) {',
      '  // "3[a2[b]]" -> "abbabbabb"',
      '}'
    ].join('\n'),
    hints: [
      'encode: walk the string, grow a run of identical characters, flush char + count when the character changes or input ends.',
      'decode: read a letter, then consume ALL following digits as one number. Fixed-width slicing is the classic bug.',
      'Digit accumulation: let num = 0; while (c is a digit) { num = num * 10 + Number(c); i++; }',
      'decodeString: stack of frames { prev, count }. On "[" push; on "]" pop, repeat the current buffer count times, append to prev.',
      'State the invariant you would test: decode(encode(s)) === s for every s. That sentence sounds senior.',
      'Edge cases: empty string, single character, counts above 9, and invalid input (say what you would do).'
    ],
    solution: [
      'function encode(s) {',
      '  let out = "";',
      '  for (let i = 0; i < s.length; ) {',
      '    let j = i;',
      '    while (j < s.length && s[j] === s[i]) j++;',
      '    out += s[i] + (j - i);',
      '    i = j;',
      '  }',
      '  return out;',
      '}',
      '',
      'function decode(e) {',
      '  let out = "";',
      '  for (let i = 0; i < e.length; ) {',
      '    const ch = e[i++];',
      '    let num = 0;',
      '    while (i < e.length && e[i] >= "0" && e[i] <= "9") {',
      '      num = num * 10 + Number(e[i]);',
      '      i++;',
      '    }',
      '    out += ch.repeat(num);',
      '  }',
      '  return out;',
      '}',
      '',
      'function decodeString(s) {',
      '  const stack = [];',
      '  let cur = "", num = 0;',
      '  for (const ch of s) {',
      '    if (ch >= "0" && ch <= "9") num = num * 10 + Number(ch);',
      '    else if (ch === "[") { stack.push({ prev: cur, count: num }); cur = ""; num = 0; }',
      '    else if (ch === "]") { const f = stack.pop(); cur = f.prev + cur.repeat(f.count); }',
      '    else cur += ch;',
      '  }',
      '  return cur;',
      '}'
    ].join('\n'),
    complexity: 'encode O(n); decode O(output); stack O(nesting depth)',
    tests: [
      { input: "encode('aaabcc')", expected: 'a3b1c2', custom: "Test.encode('aaabcc')" },
      { input: "encode('')", expected: '', custom: "Test.encode('')" },
      { input: "decode('a12')", expected: 'aaaaaaaaaaaa', custom: "Test.decode('a12')", note: 'multi-digit' },
      { input: "decode('a3b1c2')", expected: 'aaabcc', custom: "Test.decode('a3b1c2')" },
      { input: "decodeString('3[a2[b]]')", expected: 'abbabbabb', custom: "Test.decodeString('3[a2[b]]')" }
    ]
  },

  /* ---------------------------------------------------------- LINKED LISTS */
  {
    id: 'reverse-list',
    cat: 'linkedlist',
    level: 1,
    title: 'Reverse a Linked List',
    prompt: [
      'Reverse a singly linked list iteratively, then describe the recursive version.',
      '',
      'Nodes look like { val, next }. Draw the three pointers before you type - that is the whole skill being tested.'
    ].join('\n'),
    signature: 'reverseList(head)',
    starter: [
      '// node = { val, next }',
      '// helpers available: arrToLL([1,2,3]), llToArr(head)',
      'function reverseList(head) {',
      '',
      '}'
    ].join('\n'),
    hints: [
      'Draw it: prev = null, cur = head. You must save cur.next BEFORE you overwrite it.',
      'Loop body: next = cur.next; cur.next = prev; prev = cur; cur = next.',
      'Return prev after the loop, because cur is null.',
      'Recursive: reverse(head.next) then head.next.next = head and head.next = null. O(n) call stack - say that.',
      'Edge cases that get graded: empty list, one node, two nodes.',
      'Follow-ups: reverse a sub-range [m,n]; reverse in groups of k; detect a cycle with Floyd first.'
    ],
    solution: [
      'function reverseList(head) {',
      '  let prev = null;',
      '  while (head) {',
      '    const next = head.next;',
      '    head.next = prev;',
      '    prev = head;',
      '    head = next;',
      '  }',
      '  return prev;',
      '}'
    ].join('\n'),
    complexity: 'Time O(n), Space O(1)',
    tests: [
      { input: 'reverseList([])', expected: [], custom: 'Test.llToArr(Test.reverseList(Test.arrToLL([])))' },
      { input: 'reverseList([1])', expected: [1], custom: 'Test.llToArr(Test.reverseList(Test.arrToLL([1])))' },
      { input: 'reverseList([1,2,3])', expected: [3, 2, 1], custom: 'Test.llToArr(Test.reverseList(Test.arrToLL([1,2,3])))' }
    ]
  },
  {
    id: 'lru-cache',
    cat: 'linkedlist',
    level: 3,
    title: 'LRU Cache (O(1) get and put)',
    prompt: [
      'Build a cache bounded to capacity with get(key) and put(key, value), both O(1). On overflow evict the least-recently-used key. get() counts as use.',
      '',
      'The most-asked "design a data structure" question in financial systems. You are graded on which two structures you combine and why.'
    ].join('\n'),
    signature: 'new LRUCache(capacity)',
    starter: [
      'class LRUCache {',
      '  constructor(capacity) {',
      '    this.capacity = capacity;',
      '    // a Map works here - but can you explain WHY?',
      '  }',
      '',
      '  get(key) {}',
      '',
      '  put(key, value) {}',
      '}'
    ].join('\n'),
    hints: [
      'You need two capabilities at once: O(1) lookup by key, and O(1) reorder by recency. No single textbook structure gives both.',
      'Textbook answer: HashMap (key -> node) + doubly linked list (recency order). Move to front on access, evict the tail.',
      'In JavaScript, Map preserves insertion order and delete+set re-inserts at the end in O(1). Oldest = map.keys().next().value.',
      'get: if missing return -1; else delete, re-set, return. put: delete existing; else if full evict the oldest; then set.',
      'Say the cross-language move out loud: LinkedHashMap in Java, OrderedDict in Python. It signals breadth.',
      'Follow-ups: TTL per entry; concurrency (lock striping); LFU instead of LRU; the distributed version needs a gossip or a shared store.'
    ],
    solution: [
      'class LRUCache {',
      '  constructor(capacity) {',
      '    this.capacity = capacity;',
      '    this.map = new Map();',
      '  }',
      '',
      '  get(key) {',
      '    if (!this.map.has(key)) return -1;',
      '    const v = this.map.get(key);',
      '    this.map.delete(key);',
      '    this.map.set(key, v); // refresh recency',
      '    return v;',
      '  }',
      '',
      '  put(key, value) {',
      '    if (this.map.has(key)) this.map.delete(key);',
      '    else if (this.map.size >= this.capacity) {',
      '      this.map.delete(this.map.keys().next().value); // oldest',
      '    }',
      '    this.map.set(key, value);',
      '  }',
      '}'
    ].join('\n'),
    complexity: 'O(1) amortised get and put, Space O(capacity)',
    tests: [
      {
        input: 'capacity 2: put(1,1) put(2,2) get(1) put(3,3) get(2) get(3) put(4,4) get(1) get(3)',
        expected: [1, -1, 3, -1, 3],
        custom: [
          '(() => {',
          '  const c = new Test.LRUCache(2);',
          '  const out = [];',
          '  c.put(1,1); c.put(2,2);',
          '  out.push(c.get(1));',
          '  c.put(3,3);',
          '  out.push(c.get(2));',
          '  out.push(c.get(3));',
          '  c.put(4,4);',
          '  out.push(c.get(1));',
          '  out.push(c.get(3));',
          '  return out;',
          '})()'
        ].join('\n')
      },
      {
        input: 'capacity 1: put(1,1) put(2,2) get(1) get(2)',
        expected: [-1, 2],
        custom: [
          '(() => {',
          '  const c = new Test.LRUCache(1);',
          '  c.put(1,1); c.put(2,2);',
          '  return [c.get(1), c.get(2)];',
          '})()'
        ].join('\n')
      }
    ]
  },

  /* ---------------------------------------------------------- TREES / GRIDS */
  {
    id: 'tree-bst',
    cat: 'trees',
    level: 1,
    title: 'Max Depth + Validate BST',
    prompt: [
      'PART A: maximum depth of a binary tree.',
      '',
      'PART B: validate a binary search tree - every node must be greater than all nodes in its left subtree and less than all in its right subtree.',
      '',
      'Part B is the trap roughly half of candidates fail, because they only compare against the immediate parent.'
    ].join('\n'),
    signature: 'maxDepth(root)   // and\n isValidBST(root)',
    starter: [
      '// node = { val, left, right }   (null = empty)',
      '// helper available in tests: T(val, left, right)',
      'function maxDepth(root) {',
      '',
      '}',
      '',
      'function isValidBST(root) {',
      '',
      '}'
    ].join('\n'),
    hints: [
      'Max depth: null -> 0, else 1 + max(depth(left), depth(right)). Note the O(h) stack space.',
      'BST trap example: [10, 5, 15, null, null, 6, 20]. Node 6 looks fine locally but is < 10, so the tree is invalid.',
      'Pass a valid range down: going left narrows the high bound to node.val, going right narrows the low bound.',
      'Alternative that impresses: in-order traversal must be strictly increasing. Say both, code one.',
      'Follow-ups: kth smallest (in-order, stop early), lowest common ancestor, serialize/deserialize with null markers.'
    ],
    solution: [
      'function maxDepth(root) {',
      '  if (!root) return 0;',
      '  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));',
      '}',
      '',
      'function isValidBST(root) {',
      '  const ok = (n, low, high) => {',
      '    if (!n) return true;',
      '    if (n.val <= low || n.val >= high) return false;',
      '    return ok(n.left, low, n.val) && ok(n.right, n.val, high);',
      '  };',
      '  return ok(root, -Infinity, Infinity);',
      '}'
    ].join('\n'),
    complexity: 'Both O(n) time, O(h) space',
    tests: [
      { input: 'maxDepth(T(3,T(9),T(20,T(15),T(7))))', expected: 3, custom: 'Test.maxDepth(Test.T(3, Test.T(9), Test.T(20, Test.T(15), Test.T(7))))' },
      { input: 'maxDepth(null)', expected: 0, custom: 'Test.maxDepth(null)' },
      { input: 'isValidBST(2,1,3)', expected: true, custom: 'Test.isValidBST(Test.T(2, Test.T(1), Test.T(3)))' },
      { input: 'isValidBST(5,1,4,null,null,3,6)', expected: false, custom: 'Test.isValidBST(Test.T(5, Test.T(1), Test.T(4, Test.T(3), Test.T(6))))' },
      {
        input: 'isValidBST(10,5,15,null,null,6,20)',
        expected: false,
        custom: 'Test.isValidBST(Test.T(10, Test.T(5), Test.T(15, Test.T(6), Test.T(20))))',
        note: 'passes a local check, fails a range check'
      }
    ]
  },
  {
    id: 'num-islands',
    cat: 'trees',
    level: 2,
    title: 'Number of Islands',
    prompt: [
      'A grid of "1" (land) and "0" (water). Count islands - land connected 4-directionally.',
      '',
      'Every market-data or risk interview eventually asks a flood fill. Great segue into the systems discussion about sharding.'
    ].join('\n'),
    signature: 'numIslands(grid)',
    starter: 'function numIslands(grid) {\n\n}',
    hints: [
      'Scan the grid. On unvisited land, increment the count and sink the whole island.',
      'Sinking with DFS recursion risks a stack overflow on a big grid. Prefer an explicit stack/queue and say why.',
      'Mutating the grid to "0" avoids a visited set but mutates the input. Name that trade-off explicitly.',
      'Bounds check BEFORE indexing: r >= 0 && r < R && c >= 0 && c < C.',
      'Follow-ups: count distinct island shapes (hash a normalised shape), shortest bridge, connected components arriving as a stream.'
    ],
    solution: [
      'function numIslands(grid) {',
      '  if (!grid.length) return 0;',
      '  const R = grid.length, C = grid[0].length;',
      '  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];',
      '  let count = 0;',
      '  for (let r = 0; r < R; r++) {',
      '    for (let c = 0; c < C; c++) {',
      '      if (grid[r][c] !== "1") continue;',
      '      count++;',
      '      const stack = [[r, c]];',
      '      grid[r][c] = "0";',
      '      while (stack.length) {',
      '        const [y, x] = stack.pop();',
      '        for (const [dy, dx] of dirs) {',
      '          const ny = y + dy, nx = x + dx;',
      '          if (ny >= 0 && ny < R && nx >= 0 && nx < C && grid[ny][nx] === "1") {',
      '            grid[ny][nx] = "0";',
      '            stack.push([ny, nx]);',
      '          }',
      '        }',
      '      }',
      '    }',
      '  }',
      '  return count;',
      '}'
    ].join('\n'),
    complexity: 'Time O(R*C), Space O(R*C) worst case',
    tests: [
      {
        input: 'numIslands(4x5 grid)',
        expected: 3,
        custom: [
          '(() => {',
          '  const g = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]];',
          '  return Test.numIslands(g);',
          '})()'
        ].join('\n')
      },
      { input: 'numIslands([["0"]])', expected: 0, custom: 'Test.numIslands([["0"]])' },
      { input: 'numIslands([["1"]])', expected: 1, custom: 'Test.numIslands([["1"]])' }
    ]
  },

  /* ---------------------------------------------------------- DP */
  {
    id: 'climb-stairs',
    cat: 'dp',
    level: 1,
    title: 'Climbing Stairs / Fibonacci family',
    prompt: [
      'You may climb 1 or 2 steps at a time. How many distinct ways to reach step n?',
      '',
      'They are testing how you NARRATE dynamic programming: state, recurrence, base cases, order, space optimisation. Do not just type a loop.'
    ].join('\n'),
    signature: 'climbStairs(n)',
    starter: 'function climbStairs(n) {\n\n}',
    hints: [
      'You arrived at n from n-1 or n-2, so f(n) = f(n-1) + f(n-2). Base cases f(0) = 1, f(1) = 1.',
      'Naive recursion is O(2^n). Memoising makes it O(n) time and O(n) space.',
      'Only the previous two values are ever needed, so two variables give O(1) space. That is the answer they want to hear.',
      'Say the 5-step DP recipe: define the state, write the recurrence, set base cases, choose iteration order, optimise space.',
      'Same recipe covers Min Cost Climbing Stairs, House Robber (no adjacent) and Coin Change.'
    ],
    solution: [
      'function climbStairs(n) {',
      '  let a = 1, b = 1;',
      '  for (let i = 2; i <= n; i++) {',
      '    const t = a + b;',
      '    a = b;',
      '    b = t;',
      '  }',
      '  return b;',
      '}'
    ].join('\n'),
    complexity: 'Time O(n), Space O(1)',
    tests: [
      { input: 'climbStairs(1)', expected: 1, custom: 'Test.climbStairs(1)' },
      { input: 'climbStairs(2)', expected: 2, custom: 'Test.climbStairs(2)' },
      { input: 'climbStairs(5)', expected: 8, custom: 'Test.climbStairs(5)' },
      { input: 'climbStairs(10)', expected: 89, custom: 'Test.climbStairs(10)' }
    ]
  },
  {
    id: 'coin-change',
    cat: 'dp',
    level: 2,
    title: 'Coin Change (fewest coins)',
    prompt: [
      'Given coin denominations and an amount, return the fewest coins that make the amount, or -1 if impossible. Unlimited coins of each type.',
      '',
      'Yes, it is on every list - and a money-movement firm will ask it. What gets graded is a clean state definition and the greedy counterexample.'
    ].join('\n'),
    signature: 'coinChange(coins, amount)',
    starter: 'function coinChange(coins, amount) {\n\n}',
    hints: [
      'Greedy fails: coins [1,3,4], amount 6. Greedy gives 4+1+1 = 3, optimal is 3+3 = 2. Say the counterexample.',
      'State: dp[a] = fewest coins summing to a. Recurrence: dp[a] = 1 + min(dp[a - c]) over coins c <= a.',
      'Base: dp[0] = 0, everything else Infinity. Answer dp[amount] === Infinity ? -1 : dp[amount].',
      'For min-coins the loop order does not matter; for COUNTING combinations coins must be the outer loop. Mention the difference.',
      'Follow-ups: return the actual coins (parent array), count the ways (Coin Change II), or handle huge amounts (BFS / meet in the middle).'
    ],
    solution: [
      'function coinChange(coins, amount) {',
      '  const dp = new Array(amount + 1).fill(Infinity);',
      '  dp[0] = 0;',
      '  for (let a = 1; a <= amount; a++) {',
      '    for (const c of coins) {',
      '      if (c <= a) dp[a] = Math.min(dp[a], dp[a - c] + 1);',
      '    }',
      '  }',
      '  return dp[amount] === Infinity ? -1 : dp[amount];',
      '}'
    ].join('\n'),
    complexity: 'Time O(amount * coins), Space O(amount)',
    tests: [
      { input: 'coinChange([1,2,5], 11)', expected: 3, custom: 'Test.coinChange([1,2,5], 11)' },
      { input: 'coinChange([2], 3)', expected: -1, custom: 'Test.coinChange([2], 3)' },
      { input: 'coinChange([1,3,4], 6)', expected: 2, custom: 'Test.coinChange([1,3,4], 6)', note: 'greedy returns 3' },
      { input: 'coinChange([1], 0)', expected: 0, custom: 'Test.coinChange([1], 0)' }
    ]
  },
  {
    id: 'jump-game',
    cat: 'dp',
    level: 2,
    title: 'Jump Game',
    prompt: [
      'nums[i] is the maximum jump length from index i. Starting at index 0, return true if you can reach the last index.',
      '',
      'The greedy solution is six lines, but it is only credible if you can state the invariant and a two-line proof.'
    ].join('\n'),
    signature: 'canJump(nums)',
    starter: 'function canJump(nums) {\n\n}',
    hints: [
      'DP version: dp[i] = reachable, O(n^2). Say it first, then optimise.',
      'Greedy invariant: maxReach = the furthest index reachable so far.',
      'Sweep i from 0. If i > maxReach the index is unreachable, so return false. Otherwise maxReach = max(maxReach, i + nums[i]).',
      'Proof sketch worth saying aloud: if maxReach >= i then every index up to maxReach is reachable, so extending is safe.',
      'Return early once maxReach >= n - 1. Watch the single-element case: already at the end, so true.'
    ],
    solution: [
      'function canJump(nums) {',
      '  let maxReach = 0;',
      '  for (let i = 0; i < nums.length; i++) {',
      '    if (i > maxReach) return false;',
      '    maxReach = Math.max(maxReach, i + nums[i]);',
      '    if (maxReach >= nums.length - 1) return true;',
      '  }',
      '  return true;',
      '}'
    ].join('\n'),
    complexity: 'Time O(n), Space O(1)',
    tests: [
      { input: 'canJump([2,3,1,1,4])', expected: true, custom: 'Test.canJump([2,3,1,1,4])' },
      { input: 'canJump([3,2,1,0,4])', expected: false, custom: 'Test.canJump([3,2,1,0,4])' },
      { input: 'canJump([0])', expected: true, custom: 'Test.canJump([0])' }
    ]
  },

  /* ---------------------------------------------------------- ASYNC / JS */
  {
    id: 'concurrency-pool',
    cat: 'async',
    level: 3,
    title: 'Concurrency Pool (max N promises in flight)',
    prompt: [
      'Given tasks: an array of functions returning promises, and limit: a number, run at most limit at a time and resolve with ALL results in the ORIGINAL order.',
      '',
      'The most likely JavaScript-specific question at a bank: a market-data client that must not flood the backend. They are testing event-loop understanding, not syntax.'
    ].join('\n'),
    signature: 'runPool(tasks, limit)',
    starter: [
      'async function runPool(tasks, limit) {',
      '  // at most `limit` promises in flight',
      '  // results must be in ORIGINAL task order',
      '  // reject if any task rejects (bonus: discuss allSettled)',
      '}'
    ].join('\n'),
    hints: [
      'Chunking the array and awaiting each chunk is the common wrong-but-accepted answer. Say why it is worse: each chunk stalls on its slowest task.',
      'Better: a shared cursor. Spawn min(limit, tasks.length) workers; each worker loops claiming the next index and awaiting it.',
      'Claim the index with const i = next++ BEFORE the await. Reading next after the await is the classic bug.',
      'Promise.all(workers) rejects fast and leaves the other workers running fire-and-forget. Mention AbortController as the senior fix.',
      'Edge cases they probe: limit greater than task count, limit = 1 (sequential), empty array, a task that throws.',
      'Companions to rehearse: Promise.all / race / any / allSettled differences, sleep, retry with backoff.'
    ],
    solution: [
      'async function runPool(tasks, limit) {',
      '  const results = new Array(tasks.length);',
      '  let next = 0;',
      '',
      '  const worker = async () => {',
      '    while (true) {',
      '      const i = next++;',
      '      if (i >= tasks.length) return;',
      '      results[i] = await tasks[i]();',
      '    }',
      '  };',
      '',
      '  const n = Math.max(1, Math.min(limit, tasks.length));',
      '  await Promise.all(Array.from({ length: n }, worker));',
      '  return results;',
      '}'
    ].join('\n'),
    complexity: 'Time O(total work), concurrency bounded by limit; Space O(n)',
    tests: [
      {
        input: '5 tasks, limit 2 -> order preserved, peak concurrency 2',
        expected: { res: [0, 10, 20, 30, 40], peak: 2 },
        custom: [
          '(async () => {',
          '  let inFlight = 0, peak = 0;',
          '  const make = (i, ms) => async () => {',
          '    inFlight++; peak = Math.max(peak, inFlight);',
          '    await new Promise(r => setTimeout(r, ms));',
          '    inFlight--;',
          '    return i * 10;',
          '  };',
          '  const tasks = [make(0,30), make(1,10), make(2,20), make(3,5), make(4,25)];',
          '  const res = await Test.runPool(tasks, 2);',
          '  return { res, peak };',
          '})()'
        ].join('\n')
      },
      {
        input: 'limit 1 -> strictly sequential',
        expected: { res: [0, 1, 2], order: [0, 1, 2] },
        custom: [
          '(async () => {',
          '  const order = [];',
          '  const tasks = [0,1,2].map(i => async () => {',
          '    await new Promise(r => setTimeout(r, [25,1,10][i]));',
          '    order.push(i);',
          '    return i;',
          '  });',
          '  const res = await Test.runPool(tasks, 1);',
          '  return { res, order };',
          '})()'
        ].join('\n')
      },
      {
        input: 'limit larger than task count + empty list',
        expected: { a: [1, 2], b: [] },
        custom: [
          '(async () => {',
          '  const a = await Test.runPool([async () => 1, async () => 2], 10);',
          '  const b = await Test.runPool([], 3);',
          '  return { a, b };',
          '})()'
        ].join('\n')
      }
    ]
  },
  {
    id: 'debounce-throttle',
    cat: 'async',
    level: 2,
    title: 'Debounce + Throttle',
    prompt: [
      'Implement debounce(fn, ms) and throttle(fn, ms). Then say when you would use each in a trading UI: order-book re-render, search box, resize, price ticker.',
      '',
      'This is a closures + timers + this-binding question dressed as a utility. Very common as a "JS fundamentals" screen.'
    ].join('\n'),
    signature: 'debounce(fn, ms)   // and\n throttle(fn, ms)',
    starter: [
      'function debounce(fn, ms) {',
      '  // fire only after ms of quiet; expose .cancel()',
      '}',
      '',
      'function throttle(fn, ms) {',
      '  // fire at most once per ms, leading edge',
      '}'
    ].join('\n'),
    hints: [
      'Debounce: every call clears the pending timer and schedules a new one. The timer variable lives in the closure, outside the returned function.',
      'Throttle: keep a last timestamp. Fire only when now - last >= ms, then update last.',
      'Preserve context and arguments: capture args at call time and invoke fn.apply(this, args).',
      'Add .cancel() to the debounced function. Interviewers like that production detail.',
      'Usage: debounce for search-as-you-type, draft saves, form validation. throttle for scroll/resize, ticker re-render, rate-limiting API calls.'
    ],
    solution: [
      'function debounce(fn, ms) {',
      '  let timer = null;',
      '  const debounced = function (...args) {',
      '    clearTimeout(timer);',
      '    timer = setTimeout(() => fn.apply(this, args), ms);',
      '  };',
      '  debounced.cancel = () => { clearTimeout(timer); timer = null; };',
      '  return debounced;',
      '}',
      '',
      'function throttle(fn, ms) {',
      '  let last = 0;',
      '  return function (...args) {',
      '    const now = Date.now();',
      '    if (now - last >= ms) {',
      '      last = now;',
      '      return fn.apply(this, args);',
      '    }',
      '  };',
      '}'
    ].join('\n'),
    complexity: 'O(1) per call',
    tests: [
      {
        input: 'debounce: 3 rapid calls -> one call with last arg; cancel works',
        expected: { afterRapid: [3], afterCancel: [3] },
        custom: [
          '(async () => {',
          '  const seen = [];',
          '  const d = Test.debounce(x => seen.push(x), 30);',
          '  d(1); d(2); d(3);',
          '  await new Promise(r => setTimeout(r, 70));',
          '  const afterRapid = seen.slice();',
          '  d(9);',
          '  if (d.cancel) d.cancel();',
          '  await new Promise(r => setTimeout(r, 70));',
          '  return { afterRapid, afterCancel: seen };',
          '})()'
        ].join('\n')
      },
      {
        input: 'throttle: 5 rapid calls in a window -> leading fire only',
        expected: [1, 4],
        custom: [
          '(async () => {',
          '  const seen = [];',
          '  const t = Test.throttle(x => seen.push(x), 50);',
          '  t(1); t(2); t(3);',
          '  await new Promise(r => setTimeout(r, 70));',
          '  t(4);',
          '  return seen;',
          '})()'
        ].join('\n')
      }
    ]
  },
  {
    id: 'promise-combinators',
    cat: 'async',
    level: 2,
    title: 'Promise.all + withTimeout + retry',
    prompt: [
      'Re-implement Promise.all from scratch. Then write withTimeout(promise, ms) and retry(fn, times, baseDelayMs).',
      '',
      'Writing a combinator proves you understand the microtask queue. retry with backoff is also the single most common resilience helper in a bank codebase.'
    ].join('\n'),
    signature: 'myAll(promises)   // and\n withTimeout(p, ms)   // and\n retry(fn, times, ms)',
    starter: [
      'function myAll(promises) {',
      '',
      '}',
      '',
      'function withTimeout(promise, ms) {',
      '',
      '}',
      '',
      'async function retry(fn, times, baseDelayMs) {',
      '',
      '}'
    ].join('\n'),
    hints: [
      'myAll: return new Promise, keep results = new Array(n) and a counter, resolve when the counter reaches n.',
      'Wrap non-promise values with Promise.resolve(p). Handle n === 0 by resolving immediately with [].',
      'Results are keyed by INPUT index, not completion order. Getting that backwards is the failure mode they look for.',
      'withTimeout: Promise.race the work against a rejecting timer. Note the timer is not cancelled, so clear it in finally.',
      'retry: exponential backoff, and only retry idempotent operations. Use the word idempotent - it matters in finance.',
      'Know the combinator differences: all (first rejection), race (first settled), any (first fulfilled), allSettled (never rejects).'
    ],
    solution: [
      'function myAll(promises) {',
      '  return new Promise((resolve, reject) => {',
      '    const n = promises.length;',
      '    if (n === 0) return resolve([]);',
      '    const results = new Array(n);',
      '    let done = 0;',
      '    promises.forEach((p, i) => {',
      '      Promise.resolve(p).then(v => {',
      '        results[i] = v;',
      '        if (++done === n) resolve(results);',
      '      }, reject);',
      '    });',
      '  });',
      '}',
      '',
      'function withTimeout(promise, ms) {',
      '  let timer;',
      '  const timeout = new Promise((_, reject) => {',
      '    timer = setTimeout(() => reject(new Error("timeout")), ms);',
      '  });',
      '  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));',
      '}',
      '',
      'const sleep = ms => new Promise(r => setTimeout(r, ms));',
      '',
      'async function retry(fn, times, baseDelayMs = 10) {',
      '  let lastErr;',
      '  for (let attempt = 0; attempt < times; attempt++) {',
      '    try {',
      '      return await fn(attempt);',
      '    } catch (e) {',
      '      lastErr = e;',
      '      if (attempt < times - 1) await sleep(baseDelayMs * 2 ** attempt);',
      '    }',
      '  }',
      '  throw lastErr;',
      '}'
    ].join('\n'),
    complexity: 'myAll O(n) time and space',
    tests: [
      {
        input: 'myAll: values and promises mixed, input order kept',
        expected: [1, 2, 3],
        custom: '(async () => Test.myAll([1, Promise.resolve(2), Promise.resolve(3)]))()'
      },
      {
        input: 'myAll: out-of-order completion keeps indices; rejects on error',
        expected: { ok: ['slow', 'fast'], rejected: true },
        custom: [
          '(async () => {',
          '  const slow = new Promise(r => setTimeout(() => r("slow"), 30));',
          '  const fast = new Promise(r => setTimeout(() => r("fast"), 1));',
          '  const ok = await Test.myAll([slow, fast]);',
          '  let rejected = false;',
          '  try { await Test.myAll([Promise.resolve(1), Promise.reject(new Error("x"))]); }',
          '  catch (e) { rejected = true; }',
          '  return { ok, rejected };',
          '})()'
        ].join('\n')
      },
      {
        input: 'withTimeout: fast resolves, slow times out',
        expected: { ok: 'yes', timedOut: true },
        custom: [
          '(async () => {',
          '  const ok = await Test.withTimeout(Promise.resolve("yes"), 50);',
          '  let timedOut = false;',
          '  try { await Test.withTimeout(new Promise(r => setTimeout(r, 100)), 10); }',
          '  catch (e) { timedOut = e.message === "timeout"; }',
          '  return { ok, timedOut };',
          '})()'
        ].join('\n')
      },
      {
        input: 'retry: fails twice then succeeds; exhausts after N',
        expected: { v: 'ok', calls: 3, exhausted: true },
        custom: [
          '(async () => {',
          '  let calls = 0;',
          '  const v = await Test.retry(async () => {',
          '    calls++;',
          '    if (calls < 3) throw new Error("flaky");',
          '    return "ok";',
          '  }, 4, 1);',
          '  let exhausted = false;',
          '  try { await Test.retry(async () => { throw new Error("nope"); }, 2, 1); }',
          '  catch (e) { exhausted = true; }',
          '  return { v, calls, exhausted };',
          '})()'
        ].join('\n')
      }
    ]
  },
  {
    id: 'js-traps',
    cat: 'js',
    level: 1,
    title: 'JS output traps',
    prompt: [
      'Predict every value below BEFORE running. These are the sanity checks that open many JavaScript interviews.',
      '',
      'Write your predictions as comments in the editor, then run the test below (which prints the real answers) and compare.'
    ].join('\n'),
    signature: 'answer key in the test',
    starter: [
      '// 1. var in a loop with setTimeout',
      'for (var i = 0; i < 3; i++) setTimeout(() => console.log("A" + i), 0);',
      '',
      '// 2. arrow vs method: what does `this` bind to?',
      'const obj = {',
      '  name: "gs",',
      '  arrow: () => console.log("B" + obj.name),',
      '  normal() { console.log("C" + this.name); }',
      '};',
      'const borrowed = { name: "other", arrow: obj.arrow, normal: obj.normal };',
      'borrowed.arrow();',
      'borrowed.normal();',
      '',
      '// 3. typeof',
      'console.log("D" + typeof null);',
      'console.log("E" + typeof []);',
      '',
      '// 4. coercion',
      'console.log("F" + ([] + {}));',
      'console.log("G" + (0.1 + 0.2 === 0.3));',
      'console.log("H" + (null == undefined));',
      'console.log("I" + (NaN === NaN));'
    ].join('\n'),
    hints: [
      'var is function-scoped, so all three callbacks read the SAME i which is 3 after the loop -> A3, A3, A3. With let you would get 0, 1, 2.',
      'Arrow functions take lexical this and IGNORE the receiver, so borrowing obj.arrow onto another object still logs the original scope -> Bgs. A method shorthand REBINDS to the new receiver -> Cother. That is the rule to memorise.',
      'typeof null is "object" - a historical bug kept for compatibility. typeof [] is also "object"; use Array.isArray.',
      '[] + {} concatenates to "[object Object]". Written as {} + [] at statement position you would get 0 - that asymmetry is the real trap.',
      '0.1 + 0.2 === 0.3 is false (IEEE-754). null == undefined is true. NaN === NaN is false.',
      'Other traps worth rehearsing: [1,2,10].sort() gives [1,10,2] - and [10,9,1] gives [1,10,9]; "5" - 1 is 4 while "5" + 1 is "51"; true + 1 is 2.'
    ],
    solution: [
      '// A3  A3  A3   -> var shares one binding',
      '// Bgs          -> arrow ignores the receiver, uses its defining scope',
      '// Cother       -> method shorthand rebinds to the call receiver',
      '// Dobject      -> typeof null quirk',
      '// Eobject      -> arrays are objects',
      '// F[object Object]',
      '// Gfalse       -> floating point',
      '// Htrue        -> loose equality null/undefined',
      '// Ifalse       -> NaN is never equal to itself'
    ].join('\n'),
    complexity: 'Language knowledge, not speed',
    tests: [
      {
        input: 'real answers',
        expected: ['Bgs', 'Cother', 'Dobject', 'Eobject', 'F[object Object]', 'Gfalse', 'Htrue', 'Ifalse', 'A3', 'A3', 'A3'],
        custom: [
          '(async () => {',
          '  const out = [];',
          '  const obj = {',
          '    name: "gs",',
          '    arrow: () => out.push("B" + obj.name),  // own `this` ignored',
          '    normal() { out.push("C" + this.name); }',
          '  };',
          '  const borrowed = { name: "other" };',
          '  borrowed.arrow = obj.arrow;',
          '  borrowed.normal = obj.normal;',
          '  borrowed.arrow();',
          '  borrowed.normal();',
          '  out.push("D" + typeof null);',
          '  out.push("E" + typeof []);',
          '  out.push("F" + ([] + {}));',
          '  out.push("G" + (0.1 + 0.2 === 0.3));',
          '  out.push("H" + (null == undefined));',
          '  out.push("I" + (NaN === NaN));',
          '  for (var i = 0; i < 3; i++) { setTimeout(() => out.push("A" + i), 0); }',
          '  await new Promise(r => setTimeout(r, 20));',
          '  return out;',
          '})()'
        ].join('\n')
      }
    ]
  },
  {
    id: 'memoize',
    cat: 'js',
    level: 2,
    title: 'Memoize (harder than it looks)',
    prompt: [
      'Write memoize(fn). It must handle multiple arguments, and you must be ready to discuss:',
      '- how you build the cache key',
      '- unbounded memory growth',
      '- what must NOT be memoised',
      '',
      'The 4-line answer is easy. The senior answer is about cache keys and eviction.'
    ].join('\n'),
    signature: 'memoize(fn)',
    starter: [
      'function memoize(fn) {',
      '  // multi-argument; bonus: expose .cache and an optional keyFn',
      '}'
    ].join('\n'),
    hints: [
      'The naive cache[args] stringifies arguments, so [1,2] and "1,2" collide and reference types are meaningless.',
      'Key options: JSON.stringify (breaks on undefined, functions, cycles); nested Maps (best for primitives); WeakMap on the first arg (best for objects).',
      'Nested Map approach: a child Map per argument position, result under the last key. Lookup is O(number of args).',
      'Preserve this with fn.apply(this, args) - required if you memoise a method.',
      'Say it out loud: unbounded caches leak. The production answer is LRU plus a TTL, or WeakMap for object keys.',
      'Do NOT memoise: non-deterministic functions (Date.now, random), side-effecting functions, unbounded input domains.'
    ],
    solution: [
      'function memoize(fn, keyFn) {',
      '  const cache = new Map();',
      '  const memoized = function (...args) {',
      '    const key = keyFn ? keyFn(...args) : JSON.stringify(args);',
      '    if (cache.has(key)) return cache.get(key);',
      '    const v = fn.apply(this, args);',
      '    cache.set(key, v);',
      '    return v;',
      '  };',
      '  memoized.cache = cache;',
      '  return memoized;',
      '}'
    ].join('\n'),
    complexity: 'O(1) amortised, Space O(distinct inputs)',
    tests: [
      {
        input: 'same args hit cache; different args do not',
        expected: { r1: 3, r2: 3, r3: 5, calls: 2 },
        custom: [
          '(() => {',
          '  let calls = 0;',
          '  const slow = Test.memoize((a, b) => { calls++; return a + b; });',
          '  return { r1: slow(1,2), r2: slow(1,2), r3: slow(2,3), calls };',
          '})()'
        ].join('\n')
      },
      {
        input: 'preserves `this` on a method',
        expected: { calls: 2, values: [11, 11, 12] },
        custom: [
          '(() => {',
          '  let calls = 0;',
          '  const obj = {',
          '    base: 10,',
          '    add: Test.memoize(function (n) { calls++; return this.base + n; })',
          '  };',
          '  const values = [obj.add(1), obj.add(1), obj.add(2)];',
          '  return { calls, values };',
          '})()'
        ].join('\n')
      }
    ]
  }
];

/* ------------------------------------------------------------
   SYSTEM DESIGN ROUND
   ------------------------------------------------------------ */
// System design questions are registered in design-catalog*.js
const DESIGN_QUESTIONS = [];

/* ------------------------------------------------------------
   ROUND PLAN + RUBRIC
   ------------------------------------------------------------ */
const ROUND_PLAN = [
  {
    day: 'Day 1 - rebuild the reflexes',
    items: ['Do every Level 1 coding question with NO hints. 15 min each, timed.', 'Write each solution from memory a second time.', 'Read the JS traps and say the answers out loud.']
  },
  {
    day: 'Day 2 - the JS round',
    items: ['Concurrency pool, debounce/throttle, promise combinators - implement all three from scratch.', 'Then implement Promise.all, race, any and allSettled in a scratch file and diff their behaviour.', 'Read the LRU cache and memoize hints; the follow-up answers are what get scored.']
  },
  {
    day: 'Day 3 - algorithms with narration',
    items: ['Level 2 questions, but talk out loud the whole time: brute force, complexity, then the optimisation.', 'Practise stating each invariant in one sentence before coding.', 'Do the BST trap and the Coin Change greedy counterexample until they are automatic.']
  },
  {
    day: 'Day 4 - systems',
    items: ['Payment system and Ticketmaster: 30 min each, using the Brief steps.', 'URL shortener and rate limiter: 20 min each.', 'Memorise your number vocabulary: p99 budget, sharding key, journal, idempotency key, fail-open vs fail-closed.']
  },
  {
    day: 'Day 5 - mock and debrief',
    items: ['Two random coding questions, 25 min total, no hints, no autocomplete.', 'One random design question out loud to a camera or a friend.', 'Re-read your Notes tab - everything you got wrong across the week.']
  }
];

const RUBRIC = {
  1: { label: 'Warm-up', note: 'Must be fluent. Stumbling here is the drill signal.' },
  2: { label: 'Core', note: 'Realistic senior phone screen. 15-20 minutes with clean code.' },
  3: { label: 'Deep', note: 'Onsite difficulty. Graded on follow-ups and trade-offs, not just code.' }
};
