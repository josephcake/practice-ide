/* ============================================================
   GOLDMAN SACHS: SCRAPED QUESTION SET (2024-2026 reports)
   ------------------------------------------------------------
   Collected on 2026-10-24 from public candidate reports and
   level-tagged interview guides. Every entry carries:

     seniority   junior | mid | senior | manager | N/A
     added       '2026-10-24'  (date it entered this queue)
     sourceDate  publication / report date, when the source
                 publishes one
     levelWhy    the evidence behind the level label

   Level mapping used here (Goldman's engineering ladder):
     Analyst / SDE-1 / new grad ............ junior
     Associate / SDE-2 ..................... mid
     VP / Senior SWE / SDE-3 ............... senior
     Hiring manager / Engineering manager .. manager
     Source does not state a level ......... N/A

   `N/A` is deliberate: a frequency list or a coderpad repo can
   prove a question is asked without proving who was asked it.
   We do not guess a level to make the table look complete.

   These complement js/gs-questions.js (the curated, verified
   set). Nothing here duplicates an id from that file.
   ============================================================ */

const GS_SCRAPED = [
  /* ==========================================================
     JUNIOR - Analyst / SDE-1 loops
     ========================================================== */
  {
    id: 'gsr-decode-ways',
    cat: 'gs-core',
    level: 2,
    seniority: 'junior',
    added: '2026-10-24',
    title: 'Decode Ways (A=1 ... Z=26)',
    confidence: 'high',
    tag: 'DP / counting',
    reportCount: 'Analyst Software Engineer loop, online assessment (2 YOE candidate; Analyst is Goldman\'s entry band).',
    levelWhy: 'Reported in an Analyst Software Engineer loop, which is Goldman\'s entry-level engineering band.',
    sources: [
      { label: 'LeetCode Discuss 6928017 - Goldman Sachs Analyst Software Engineering', url: 'https://leetcode.com/discuss/post/6928017/' }
    ],
    prompt: [
      'A message of digits is encoded with A=1, B=2, ... Z=26. Return the number of ways to decode it.',
      '',
      ' "12"   -> 2   ("AB", "L")',
      ' "226"  -> 3   ("BZ", "VF", "BBF")',
      ' "06"  -> 0   (a leading zero cannot stand alone)',
      ' "10"  -> 1',
      '',
      'Reported as the second question in the Goldman Analyst online assessment, solved in the first 15-20 minutes. Follow-up: print the decodings, not just count them.'
    ].join('\n'),
    signature: 'numDecodings(s)',
    starter: [
      'function numDecodings(s) {',
      '  // dp[i] = ways to decode s[0..i-1]',
      '  // one-digit step if s[i-1] is 1-9, two-digit step if 10-26',
      '}'
    ].join('\n'),
    hints: [
      'This is a 1-D DP over prefixes. dp[0] = 1 (the empty prefix has one decoding) and dp[1] = 1 unless s[0] is "0".',
      'At each position you have at most two ways to finish: take one digit, or take two. Add both valid options.',
      'A single digit is valid when it is "1".."9". A pair is valid when the two-character number is 10..26 - watch "10" and "20", where the single digit is invalid but the pair is valid.',
      'You only ever read dp[i-1] and dp[i-2], so two rolling variables replace the array. That is the O(1)-space version they like.',
      'Edge cases: empty string, "0", "06", "10", "27", and a long run of 1s ("1111" -> 5) which is the Fibonacci case.'
    ],
    solution: [
      'function numDecodings(s) {',
      '  if (!s || s[0] === "0") return 0;',
      '  let prev2 = 1; // dp[0]',
      '  let prev1 = 1; // dp[1]',
      '  for (let i = 1; i < s.length; i++) {',
      '    let cur = 0;',
      '    const one = Number(s[i]);',
      '    if (one >= 1) cur += prev1;',
      '    const two = Number(s.slice(i - 1, i + 1));',
      '    if (two >= 10 && two <= 26) cur += prev2;',
      '    prev2 = prev1;',
      '    prev1 = cur;',
      '  }',
      '  return prev1;',
      '}'
    ].join('\n'),
    complexity: 'O(n) time, O(1) space.',
    tests: [
      { input: '"12"', expected: 2, custom: 'Test.numDecodings("12")' },
      { input: '"226"', expected: 3, custom: 'Test.numDecodings("226")' },
      { input: '"06"', expected: 0, custom: 'Test.numDecodings("06")', note: 'leading zero' },
      { input: '"10"', expected: 1, custom: 'Test.numDecodings("10")', note: 'only the pair 10 works' },
      { input: '"27"', expected: 1, custom: 'Test.numDecodings("27")', note: '27 > 26, so only "2" then "7"' },
      { input: '"11106"', expected: 2, custom: 'Test.numDecodings("11106")' }
    ]
  },

  {
    id: 'gsr-quicksort',
    cat: 'gs-core',
    level: 2,
    seniority: 'junior',
    added: '2026-10-24',
    title: 'Quicksort, in place, no extra array',
    confidence: 'high',
    tag: 'Sorting / partitioning',
    reportCount: 'Analyst Software Engineer loop, round 1: "implement a sorting algorithm which works in place and doesn\'t take extra space".',
    levelWhy: 'Round 1 of the Analyst loop; the candidate had 2 YOE and was interviewed at entry band.',
    sources: [
      { label: 'LeetCode Discuss 6928017 - Goldman Sachs Analyst Software Engineering', url: 'https://leetcode.com/discuss/post/6928017/' }
    ],
    prompt: [
      'Implement a sorting algorithm that works IN PLACE and does not allocate an extra array. The interviewer explicitly asked for quicksort after the candidate named quicksort and heapsort.',
      '',
      'Your function receives an array of numbers and must sort it in place, then return it.',
      '',
      'Follow-ups the report mentions: what is the worst case, when does it happen, and how do you avoid it? How would you make it stable if it had to be?'
    ].join('\n'),
    signature: 'quickSort(arr)',
    starter: [
      'function quickSort(arr) {',
      '  // pick a pivot, partition in place, recurse on both sides',
      '  // do not allocate a second array',
      '}'
    ].join('\n'),
    hints: [
      'Lomuto partition is the easiest to write correctly on a whiteboard: keep a boundary index i, scan j from lo to hi-1, and swap into i whenever arr[j] < pivot.',
      'Put the pivot at the end first, partition, then swap the pivot into its final position at i. Everything left of i is smaller, everything right is larger or equal.',
      'Recurse on (lo, i-1) and (i+1, hi). Guard with if (lo >= hi) return so single elements and empty ranges stop.',
      'Duplicates break naive two-way partitions into O(n^2). Strict "<" comparisons (as here) keep duplicates on the right and stay correct, though equal-heavy inputs still degrade.',
      'Worst case is already-sorted input with a last-element pivot: O(n^2) time and O(n) recursion depth. Median-of-three or a random pivot fixes the expected case; say that out loud even if you code the simple pivot.'
    ],
    solution: [
      'function quickSort(arr) {',
      '  const sort = (lo, hi) => {',
      '    if (lo >= hi) return;',
      '    const pivot = arr[hi];',
      '    let i = lo;',
      '    for (let j = lo; j < hi; j++) {',
      '      if (arr[j] < pivot) {',
      '        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;',
      '        i++;',
      '      }',
      '    }',
      '    const t = arr[i]; arr[i] = arr[hi]; arr[hi] = t;',
      '    sort(lo, i - 1);',
      '    sort(i + 1, hi);',
      '  };',
      '  sort(0, arr.length - 1);',
      '  return arr;',
      '}'
    ].join('\n'),
    complexity: 'Expected O(n log n), worst O(n^2) on sorted input with a bad pivot. O(log n) stack expected, O(n) worst.',
    tests: [
      { input: '[3, 1, 2]', expected: [1, 2, 3], custom: '(() => { const a = [3, 1, 2]; Test.quickSort(a); return a; })()' },
      { input: '[5, 5, 1, 5]', expected: [1, 5, 5, 5], custom: '(() => { const a = [5, 5, 1, 5]; Test.quickSort(a); return a; })()', note: 'duplicates' },
      { input: '[]', expected: [], custom: '(() => { const a = []; Test.quickSort(a); return a; })()' },
      { input: '[1]', expected: [1], custom: '(() => { const a = [1]; Test.quickSort(a); return a; })()' },
      { input: '[4, 3, 2, 1]', expected: [1, 2, 3, 4], custom: '(() => { const a = [4, 3, 2, 1]; Test.quickSort(a); return a; })()', note: 'reverse sorted - the pivot choice matters' }
    ]
  },

  {
    id: 'gsr-maximal-square',
    cat: 'gs-core',
    level: 3,
    seniority: 'junior',
    added: '2026-10-24',
    title: 'Maximal Square (largest all-1s square)',
    confidence: 'high',
    tag: 'Grid DP',
    reportCount: 'Analyst Software Engineer Superday, DSA round 2 - the candidate called this round "easy".',
    levelWhy: 'Analyst Superday (entry band). The problem difficulty is hard-ish but the reported round was at junior scope.',
    sources: [
      { label: 'LeetCode Discuss 6928017 - Goldman Sachs Analyst Software Engineering', url: 'https://leetcode.com/discuss/post/6928017/' }
    ],
    prompt: [
      'Given an m x n binary matrix filled with 0s and 1s, find the largest square containing only 1s and return its AREA (not its side length).',
      '',
      ' [[1,0,1,0,0],',
      '  [1,0,1,1,1],',
      '  [1,1,1,1,1],',
      '  [1,0,0,1,0]]  -> 4',
      '',
      'Follow-up reported by candidates: also return the top-left coordinate of the square, and say how you would handle a matrix too large for memory.'
    ].join('\n'),
    signature: 'maximalSquare(matrix)',
    starter: [
      'function maximalSquare(matrix) {',
      '  // dp[r][c] = side of the largest square whose bottom-right corner is (r, c)',
      '  // dp = min(top, left, top-left) + 1',
      '}'
    ].join('\n'),
    hints: [
      'Define dp[r][c] as the SIDE of the largest all-1 square whose bottom-right corner is (r,c). If the cell is 0, dp is 0.',
      'If the cell is 1, dp[r][c] = 1 + min(dp[r-1][c], dp[r][c-1], dp[r-1][c-1]). That min is the whole proof: all three neighbours must support a square one smaller.',
      'Track the maximum dp value as you go, then square it at the end. Squaring early is a common off-by-one bug.',
      'Only the previous row is needed, so a single dp array of length n+1 plus a `diag` variable saves O(m*n) memory. This is the version to offer as the optimization.',
      'Edge cases: empty matrix, one row, one column, a matrix of all zeros, and a matrix of all ones (answer is min(m,n)^2).'
    ],
    solution: [
      'function maximalSquare(matrix) {',
      '  const m = matrix.length;',
      '  if (!m) return 0;',
      '  const n = matrix[0].length;',
      '  const dp = new Array(n + 1).fill(0);',
      '  let best = 0;',
      '  for (let r = 1; r <= m; r++) {',
      '    let diag = 0;',
      '    for (let c = 1; c <= n; c++) {',
      '      const prev = dp[c];',
      '      if (Number(matrix[r - 1][c - 1]) === 1) {',
      '        dp[c] = Math.min(dp[c], dp[c - 1], diag) + 1;',
      '        if (dp[c] > best) best = dp[c];',
      '      } else {',
      '        dp[c] = 0;',
      '      }',
      '      diag = prev;',
      '    }',
      '  }',
      '  return best * best;',
      '}'
    ].join('\n'),
    complexity: 'O(m*n) time, O(n) space with the rolling row.',
    tests: [
      {
        input: '[[1,0,1,0,0],[1,0,1,1,1],[1,1,1,1,1],[1,0,0,1,0]]',
        expected: 4,
        custom: 'Test.maximalSquare([[1,0,1,0,0],[1,0,1,1,1],[1,1,1,1,1],[1,0,0,1,0]])'
      },
      { input: '[[1,1],[1,1]]', expected: 4, custom: 'Test.maximalSquare([[1,1],[1,1]])' },
      { input: '[[0,0],[0,0]]', expected: 0, custom: 'Test.maximalSquare([[0,0],[0,0]])' },
      { input: '[[1]]', expected: 1, custom: 'Test.maximalSquare([[1]])' },
      { input: '[[1,0,1,1,1],[1,0,1,1,1],[1,1,1,1,1]]', expected: 9, custom: 'Test.maximalSquare([[1,0,1,1,1],[1,0,1,1,1],[1,1,1,1,1]])' }
    ]
  },

  {
    id: 'gsr-maze-ii',
    cat: 'gs-core',
    level: 3,
    seniority: 'junior',
    added: '2026-10-24',
    title: 'The Maze II (rolling ball, shortest distance)',
    confidence: 'high',
    tag: 'Dijkstra on a grid',
    reportCount: 'Analyst Software Engineer Superday, "Software Engineering practices" round: solved with BFS, then optimised with a priority queue.',
    levelWhy: 'Analyst Superday round 3. The level is junior even though the shortest-path variant is a step above plain BFS.',
    sources: [
      { label: 'LeetCode Discuss 6928017 - Goldman Sachs Analyst Software Engineering', url: 'https://leetcode.com/discuss/post/6928017/' }
    ],
    prompt: [
      'A ball sits at `start` in a maze of 0 (empty) and 1 (wall). It can roll up, down, left or right, and it keeps rolling until it hits a wall. It then stops and may choose a new direction. It cannot stop in the middle of open space.',
      '',
      'Return the shortest number of steps to reach `destination`, or -1 if it is unreachable. Each cell entered counts as one step.',
      '',
      'Follow-up asked in the report: BFS vs DFS, and where Dijkstra beats plain BFS here (edge weights vary because rolls have different lengths).'
    ].join('\n'),
    signature: 'shortestDistance(maze, start, destination)',
    starter: [
      'function shortestDistance(maze, start, destination) {',
      '  // 1) from each stop, roll in 4 directions until the next cell is a wall',
      '  // 2) edge weight = number of cells rolled',
      '  // 3) Dijkstra with a min-heap of [distance, r, c]',
      '}'
    ].join('\n'),
    hints: [
      'The states are STOP CELLS, not every cell you pass through. From a stop, roll as far as possible in each direction; the neighbour is where you stop, and the edge weight is the number of steps rolled.',
      'Because different rolls cost different numbers of steps, plain BFS does not give the shortest distance. Use Dijkstra (or BFS over a weighted graph, which is the same thing).',
      'dist[r][c] starts at Infinity; set dist[start] = 0. Pop the smallest distance; if it is stale (greater than the recorded dist), skip it.',
      'When you pop the destination for the first time, that distance is final - return it. Do not keep searching after that.',
      'If a roll has zero steps in a direction (wall immediately adjacent), it is not a legal move; skip it. Also handle start === destination, which is 0.'
    ],
    solution: [
      'function shortestDistance(maze, start, destination) {',
      '  const m = maze.length, n = maze[0].length;',
      '  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];',
      '  const dist = Array.from({ length: m }, () => new Array(n).fill(Infinity));',
      '  const heap = [[0, start[0], start[1]]];',
      '  dist[start[0]][start[1]] = 0;',
      '',
      '  const push = (node) => {',
      '    heap.push(node);',
      '    let i = heap.length - 1;',
      '    while (i > 0) {',
      '      const p = (i - 1) >> 1;',
      '      if (heap[p][0] <= heap[i][0]) break;',
      '      const t = heap[p]; heap[p] = heap[i]; heap[i] = t;',
      '      i = p;',
      '    }',
      '  };',
      '  const pop = () => {',
      '    const top = heap[0];',
      '    const last = heap.pop();',
      '    if (heap.length) {',
      '      heap[0] = last;',
      '      let i = 0;',
      '      for (;;) {',
      '        const l = 2 * i + 1, r = l + 1;',
      '        let s = i;',
      '        if (l < heap.length && heap[l][0] < heap[s][0]) s = l;',
      '        if (r < heap.length && heap[r][0] < heap[s][0]) s = r;',
      '        if (s === i) break;',
      '        const t = heap[s]; heap[s] = heap[i]; heap[i] = t;',
      '        i = s;',
      '      }',
      '    }',
      '    return top;',
      '  };',
      '',
      '  while (heap.length) {',
      '    const [d, r, c] = pop();',
      '    if (d > dist[r][c]) continue;',
      '    if (r === destination[0] && c === destination[1]) return d;',
      '    for (const [dr, dc] of dirs) {',
      '      let nr = r, nc = c, steps = 0;',
      '      while (',
      '        nr + dr >= 0 && nr + dr < m &&',
      '        nc + dc >= 0 && nc + dc < n &&',
      '        maze[nr + dr][nc + dc] === 0',
      '      ) {',
      '        nr += dr; nc += dc; steps++;',
      '      }',
      '      if (steps > 0 && d + steps < dist[nr][nc]) {',
      '        dist[nr][nc] = d + steps;',
      '        push([d + steps, nr, nc]);',
      '      }',
      '    }',
      '  }',
      '  return -1;',
      '}'
    ].join('\n'),
    complexity: 'O(m*n*log(m*n)) with the heap; each cell is relaxed at most once per direction.',
    tests: [
      {
        input: 'maze=[[0,0,1,0,0],[0,0,0,0,0],[0,0,0,1,0],[1,1,0,1,1],[0,0,0,0,0]], start=[0,4], dest=[4,4]',
        expected: 12,
        custom: 'Test.shortestDistance([[0,0,1,0,0],[0,0,0,0,0],[0,0,0,1,0],[1,1,0,1,1],[0,0,0,0,0]], [0,4], [4,4])'
      },
      {
        input: 'same maze, start=[0,4], dest=[3,2]',
        expected: -1,
        custom: 'Test.shortestDistance([[0,0,1,0,0],[0,0,0,0,0],[0,0,0,1,0],[1,1,0,1,1],[0,0,0,0,0]], [0,4], [3,2])',
        note: 'unreachable corner'
      },
      {
        input: 'start=[0,0], dest=[0,0]',
        expected: 0,
        custom: 'Test.shortestDistance([[0,0,0],[0,0,0]], [0,0], [0,0])'
      },
      {
        input: '[[0,0],[0,0]], start=[0,0], dest=[1,1]',
        expected: 2,
        custom: 'Test.shortestDistance([[0,0],[0,0]], [0,0], [1,1])',
        note: 'roll down then right (or right then down)'
      }
    ]
  },

  {
    id: 'gsr-prime-factorization',
    cat: 'gs-core',
    level: 1,
    seniority: 'junior',
    added: '2026-10-24',
    title: 'Prime Factorization (product equals x)',
    confidence: 'high',
    tag: 'Math / trial division',
    reportCount: 'Analyst Bengaluru online assessment, question 1 - reported with the exact examples used.',
    levelWhy: 'Analyst (entry band) OA. Also a recurring India-campus HackerRank pattern per level guides.',
    sources: [
      { label: 'LeetCode Discuss 6834408 - Goldman Sachs Analyst Bengaluru Selected', url: 'https://leetcode.com/discuss/post/6834408/' }
    ],
    prompt: [
      'Return an array of prime numbers whose product is x, in ascending order with multiplicity.',
      '',
      ' primeFactorization(6)  -> [2, 3]',
      ' primeFactorization(5)  -> [5]',
      ' primeFactorization(12) -> [2, 2, 3]',
      '',
      'The reported OA asked this as a warm-up beside Trapping Rain Water. Follow-up: do it without a primality helper, and in O(sqrt(x)).'
    ].join('\n'),
    signature: 'primeFactorization(x)',
    starter: [
      'function primeFactorization(x) {',
      '  // divide out each factor from 2 upward; whatever is left > 1 is prime',
      '}'
    ].join('\n'),
    hints: [
      'You do not need a sieve or a primality test. Trial-divide n by 2, then 3, then 5, ... and push each successful divisor, dividing n as you go.',
      'Only loop while p * p <= n. Once that fails, the remaining n is either 1 or a prime larger than sqrt(original x) - push it if it is > 1.',
      'Use p++ rather than only odd numbers if you want the simplest code; it is still O(sqrt(x)) because the loop stops at sqrt(n).',
      'Watch integer division: `n % p === 0` then `n /= p` is fine in JS for safe integers, but say that you would use integer division explicitly in Java/C++.',
      'Edge cases: x = 1 (return []), a prime, a prime squared (49 -> [7, 7]), and a product of two large primes.'
    ],
    solution: [
      'function primeFactorization(x) {',
      '  const out = [];',
      '  let n = x;',
      '  for (let p = 2; p * p <= n; p++) {',
      '    while (n % p === 0) {',
      '      out.push(p);',
      '      n /= p;',
      '    }',
      '  }',
      '  if (n > 1) out.push(n);',
      '  return out;',
      '}'
    ].join('\n'),
    complexity: 'O(sqrt(x)) time, O(log x) output space.',
    tests: [
      { input: '6', expected: [2, 3], custom: 'Test.primeFactorization(6)' },
      { input: '5', expected: [5], custom: 'Test.primeFactorization(5)' },
      { input: '12', expected: [2, 2, 3], custom: 'Test.primeFactorization(12)' },
      { input: '1', expected: [], custom: 'Test.primeFactorization(1)', note: 'no prime factors' },
      { input: '97', expected: [97], custom: 'Test.primeFactorization(97)', note: 'prime' },
      { input: '100', expected: [2, 2, 5, 5], custom: 'Test.primeFactorization(100)' }
    ]
  },

  {
    id: 'gsr-unique-substrings',
    cat: 'gs-core',
    level: 1,
    seniority: 'junior',
    added: '2026-10-24',
    title: 'Count unique substrings of length k',
    confidence: 'medium',
    tag: 'Sliding window / set',
    reportCount: 'Confirmed CoderPad bank item, attributed to an analyst-round report (LeetCode 7233519) in the 2026 CoderPad guide.',
    levelWhy: 'The guide attributes the report to an analyst round; Analyst is the junior band.',
    sources: [
      { label: 'InterviewFox - Goldman Sachs CoderPad guide (20 Oct 2026)', url: 'https://interviewfox.ai/interview-questions/goldman-sachs-coderpad-oa-guide/' }
    ],
    prompt: [
      'Given a string s and an integer k, return how many DISTINCT substrings of length k it contains.',
      '',
      ' uniqueSubstrings("abcabc", 3) -> 3   ("abc", "bca", "cab")',
      ' uniqueSubstrings("aaaa", 2)   -> 1   ("aa")',
      '',
      'The reported follow-up adds exception handling for an invalid k (0, negative, or longer than the string) - return 0 rather than throwing.'
    ].join('\n'),
    signature: 'uniqueSubstrings(s, k)',
    starter: [
      'function uniqueSubstrings(s, k) {',
      '  // validate k, then slide a window of length k into a Set',
      '}'
    ].join('\n'),
    hints: [
      'The number of windows is s.length - k + 1. Each window is a substring of length k.',
      'Put every window in a Set and return its size; duplicates collapse automatically.',
      'Validate first: k must be an integer, > 0, and <= s.length. Return 0 otherwise (the follow-up explicitly asks for this instead of an exception).',
      'This is O(n*k) time because slicing copies k characters, and O(n*k) space in the worst case. Rolling hash would make it O(n) expected - good follow-up to mention.',
      'Edge cases: empty string, k equal to the length (answer 1 if non-empty), and all-identical characters (answer 1).'
    ],
    solution: [
      'function uniqueSubstrings(s, k) {',
      '  if (!Number.isInteger(k) || k <= 0 || k > s.length) return 0;',
      '  const seen = new Set();',
      '  for (let i = 0; i + k <= s.length; i++) {',
      '    seen.add(s.slice(i, i + k));',
      '  }',
      '  return seen.size;',
      '}'
    ].join('\n'),
    complexity: 'O(n*k) time and space with string slicing.',
    tests: [
      { input: '"abcabc", 3', expected: 3, custom: 'Test.uniqueSubstrings("abcabc", 3)' },
      { input: '"aaaa", 2', expected: 1, custom: 'Test.uniqueSubstrings("aaaa", 2)' },
      { input: '"abc", 5', expected: 0, custom: 'Test.uniqueSubstrings("abc", 5)', note: 'invalid k' },
      { input: '"abc", 0', expected: 0, custom: 'Test.uniqueSubstrings("abc", 0)', note: 'invalid k' },
      { input: '"ab", 2', expected: 1, custom: 'Test.uniqueSubstrings("ab", 2)' }
    ]
  },

  {
    id: 'gsr-trapping-rain-water',
    cat: 'gs-core',
    level: 3,
    seniority: 'junior',
    added: '2026-10-24',
    title: 'Trapping Rain Water',
    confidence: 'high',
    tag: 'Two pointers / prefix max',
    reportCount: 'Analyst Bengaluru online assessment, question 2 (the ASCII elevation example). Also the single most frequent GS-tagged problem in frequency tables.',
    levelWhy: 'Reported as an Analyst OA question. The same problem also appears in mid and senior loops, so do not read "junior" as "only junior".',
    sources: [
      { label: 'LeetCode Discuss 6834408 - Goldman Sachs Analyst Bengaluru Selected', url: 'https://leetcode.com/discuss/post/6834408/' },
      { label: 'SWE180 - Goldman Sachs frequency table (Freq 100.0)', url: 'https://www.swe180.com/companies/goldman-sachs?tab=leetcode' }
    ],
    prompt: [
      'Given an array of non-negative integers representing elevations in a vertical cross-section, return how many units of rain water are trapped between the bars.',
      '',
      ' [0,1,0,2,1,0,1,3,2,1,2,1] -> 6',
      ' [4,2,0,3,2,5]             -> 9',
      '',
      'The report shows the ASCII elevation map Goldman used. Expect the interviewer to ask for the O(1)-space two-pointer version after you present the O(n)-space prefix-max version.'
    ].join('\n'),
    signature: 'trap(height)',
    starter: [
      'function trap(height) {',
      '  // water at i = min(maxLeft, maxRight) - height[i]',
      '  // two pointers lets you drop the arrays',
      '}'
    ].join('\n'),
    hints: [
      'Water above bar i is min(tallest bar to its left, tallest bar to its right) - height[i], floored at 0.',
      'The straightforward version precomputes leftMax[i] and rightMax[i] in two passes, then sums in a third. O(n) time, O(n) space.',
      'For O(1) space, keep two pointers at the ends and the best height seen from each side. Advance the side with the SMALLER current max, because that side\'s water is already determined by its own max.',
      'Careful: when height[left] < height[right], the water at left is leftMax - height[left] (leftMax is the max so far on the left), then move left inward. Mirror for the other side.',
      'Edge cases: fewer than 3 bars, a monotonic ramp (0 water), and equal heights (0 water).'
    ],
    solution: [
      'function trap(height) {',
      '  let left = 0, right = height.length - 1;',
      '  let leftMax = 0, rightMax = 0, water = 0;',
      '  while (left < right) {',
      '    if (height[left] < height[right]) {',
      '      leftMax = Math.max(leftMax, height[left]);',
      '      water += leftMax - height[left];',
      '      left++;',
      '    } else {',
      '      rightMax = Math.max(rightMax, height[right]);',
      '      water += rightMax - height[right];',
      '      right--;',
      '    }',
      '  }',
      '  return water;',
      '}'
    ].join('\n'),
    complexity: 'O(n) time, O(1) space.',
    tests: [
      { input: '[0,1,0,2,1,0,1,3,2,1,2,1]', expected: 6, custom: 'Test.trap([0,1,0,2,1,0,1,3,2,1,2,1])' },
      { input: '[4,2,0,3,2,5]', expected: 9, custom: 'Test.trap([4,2,0,3,2,5])' },
      { input: '[]', expected: 0, custom: 'Test.trap([])' },
      { input: '[3,3,3]', expected: 0, custom: 'Test.trap([3,3,3])' },
      { input: '[5,0,5]', expected: 5, custom: 'Test.trap([5,0,5])' }
    ]
  },

  /* ==========================================================
     MID - Associate / SDE-2 loops
     ========================================================== */
  {
    id: 'gsr-two-sum-sorted',
    cat: 'gs-core',
    level: 1,
    seniority: 'mid',
    added: '2026-10-24',
    title: 'Two Sum II - sorted input, 1-indexed',
    confidence: 'high',
    tag: 'Two pointers',
    reportCount: 'Associate SDE-2 loop, round 1 DSA, question 1 of 3 (the third was offered because 20 minutes were left).',
    levelWhy: 'SDE-2 / Associate loop, the mid-level band.',
    sources: [
      { label: 'LeetCode Discuss 4878508 - Goldman Sachs SDE-2 Offer Accepted', url: 'https://leetcode.com/discuss/post/4878508/' }
    ],
    prompt: [
      'Given a 1-indexed array of integers `numbers` sorted in non-decreasing order, find two numbers that add up to `target` and return their 1-based indices as [i, j] with i < j.',
      '',
      ' numbers = [2,7,11,15], target = 9  -> [1,2]',
      ' numbers = [-1,0],     target = -1 -> [1,2]',
      '',
      'Exactly one solution exists and you may not use the same element twice. The sorted order is the permission slip to use two pointers instead of a hash map.'
    ].join('\n'),
    signature: 'twoSumSorted(numbers, target)',
    starter: [
      'function twoSumSorted(numbers, target) {',
      '  // left = 0, right = end; move the pointer that can fix the sum',
      '}'
    ].join('\n'),
    hints: [
      'Start with the smallest and largest values. Their sum tells you which pointer to move.',
      'If the sum is too small, no pair with the current left works (the largest remaining partner is already too small), so left++. If too large, right--.',
      'Return [left + 1, right + 1] because the problem is 1-indexed. This off-by-one is the most common wrong answer.',
      'The hash-map solution is O(n) time and O(n) space; two pointers is O(n) time and O(1) space. Say why sorted input makes the better version possible.',
      'Edge cases: two elements only, negative numbers, and a target formed by the two ends.'
    ],
    solution: [
      'function twoSumSorted(numbers, target) {',
      '  let left = 0, right = numbers.length - 1;',
      '  while (left < right) {',
      '    const sum = numbers[left] + numbers[right];',
      '    if (sum === target) return [left + 1, right + 1];',
      '    if (sum < target) left++;',
      '    else right--;',
      '  }',
      '  return [];',
      '}'
    ].join('\n'),
    complexity: 'O(n) time, O(1) space.',
    tests: [
      { input: '[2,7,11,15], 9', expected: [1, 2], custom: 'Test.twoSumSorted([2,7,11,15], 9)' },
      { input: '[-1,0], -1', expected: [1, 2], custom: 'Test.twoSumSorted([-1,0], -1)' },
      { input: '[1,2,3,4,5], 9', expected: [4, 5], custom: 'Test.twoSumSorted([1,2,3,4,5], 9)' },
      { input: '[2,3,4], 6', expected: [1, 3], custom: 'Test.twoSumSorted([2,3,4], 6)' }
    ]
  },

  {
    id: 'gsr-palindromic-substrings',
    cat: 'gs-core',
    level: 2,
    seniority: 'mid',
    added: '2026-10-24',
    title: 'Palindromic Substrings (count)',
    confidence: 'high',
    tag: 'Expand around center',
    reportCount: 'Associate SDE-2 loop, round 1 DSA, question 2 of 3.',
    levelWhy: 'SDE-2 / Associate loop, the mid-level band.',
    sources: [
      { label: 'LeetCode Discuss 4878508 - Goldman Sachs SDE-2 Offer Accepted', url: 'https://leetcode.com/discuss/post/4878508/' }
    ],
    prompt: [
      'Given a string s, return the number of palindromic substrings in it. Substrings with the same content at different positions count separately.',
      '',
      ' "abc"  -> 3   ("a", "b", "c")',
      ' "aaa"  -> 6   ("a" x3, "aa" x2, "aaa")',
      ' "abba" -> 6',
      '',
      'Follow-up: return the longest one instead of the count, and then the count of DISTINCT palindromic substrings (that version needs hashing or a palindromic tree).'
    ].join('\n'),
    signature: 'countPalindromicSubstrings(s)',
    starter: [
      'function countPalindromicSubstrings(s) {',
      '  // every palindrome has a center: n odd centers, n-1 even centers',
      '}'
    ].join('\n'),
    hints: [
      'Do not enumerate substrings - there are O(n^2) of them and checking each is O(n), which is O(n^3).',
      'Every palindrome is defined by its center. There are 2n-1 centers: n odd-length (a single character) and n-1 even-length (between two characters).',
      'For each center, expand while the two sides match; every successful expansion is one more palindrome. That is O(n^2) total.',
      'Count both odd and even expansions in the same loop: expand(i, i) and expand(i, i+1).',
      'Edge cases: empty string (0), a single character (1), all-identical characters (n(n+1)/2), and no repeats ("abcd" -> 4).'
    ],
    solution: [
      'function countPalindromicSubstrings(s) {',
      '  let count = 0;',
      '  const expand = (left, right) => {',
      '    while (left >= 0 && right < s.length && s[left] === s[right]) {',
      '      count++;',
      '      left--;',
      '      right++;',
      '    }',
      '  };',
      '  for (let i = 0; i < s.length; i++) {',
      '    expand(i, i);',
      '    expand(i, i + 1);',
      '  }',
      '  return count;',
      '}'
    ].join('\n'),
    complexity: 'O(n^2) time, O(1) space.',
    tests: [
      { input: '"abc"', expected: 3, custom: 'Test.countPalindromicSubstrings("abc")' },
      { input: '"aaa"', expected: 6, custom: 'Test.countPalindromicSubstrings("aaa")' },
      { input: '"abba"', expected: 6, custom: 'Test.countPalindromicSubstrings("abba")' },
      { input: '""', expected: 0, custom: 'Test.countPalindromicSubstrings("")' },
      { input: '"a"', expected: 1, custom: 'Test.countPalindromicSubstrings("a")' }
    ]
  },

  {
    id: 'gsr-meeting-rooms-ii',
    cat: 'gs-core',
    level: 2,
    seniority: 'mid',
    added: '2026-10-24',
    title: 'Meeting Rooms II (minimum rooms)',
    confidence: 'high',
    tag: 'Sweep line / heap',
    reportCount: 'Associate SDE-2 loop, round 1 DSA, question 3 of 3 - the "spare 20 minutes" question.',
    levelWhy: 'SDE-2 / Associate loop, the mid-level band.',
    sources: [
      { label: 'LeetCode Discuss 4878508 - Goldman Sachs SDE-2 Offer Accepted', url: 'https://leetcode.com/discuss/post/4878508/' }
    ],
    prompt: [
      'Given an array of meeting time intervals [[start, end], ...], return the minimum number of conference rooms required so that no two meetings overlap.',
      '',
      ' [[0,30],[5,10],[15,20]] -> 2',
      ' [[7,10],[2,4]]         -> 1',
      '',
      'A meeting ending at 5 and another starting at 5 do NOT overlap - one room is enough. Confirm that boundary with the interviewer before coding.'
    ].join('\n'),
    signature: 'minMeetingRooms(intervals)',
    starter: [
      'function minMeetingRooms(intervals) {',
      '  // sort starts and ends separately, then sweep',
      '}'
    ].join('\n'),
    hints: [
      'Sort all start times and all end times into separate arrays. A room is needed whenever a start is before the earliest available end.',
      'Walk the starts in order with a pointer into the ends. If starts[i] < ends[endPtr], you need one more room; otherwise a room just freed up, so advance endPtr.',
      'This is the standard sweep: O(n log n) for the sorts, O(n) for the pass, O(n) extra space. A min-heap of end times gives the same complexity with a different constant.',
      'The boundary "end == start" is not an overlap, so use strict "<" when deciding to add a room (otherwise [[1,5],[5,10]] wrongly returns 2).',
      'Edge cases: empty input (0), one meeting (1), all meetings overlapping (n), and exact back-to-back meetings (1).'
    ],
    solution: [
      'function minMeetingRooms(intervals) {',
      '  if (!intervals.length) return 0;',
      '  const starts = intervals.map((x) => x[0]).sort((a, b) => a - b);',
      '  const ends = intervals.map((x) => x[1]).sort((a, b) => a - b);',
      '  let rooms = 0, endPtr = 0;',
      '  for (let i = 0; i < starts.length; i++) {',
      '    if (starts[i] < ends[endPtr]) rooms++;',
      '    else endPtr++;',
      '  }',
      '  return rooms;',
      '}'
    ].join('\n'),
    complexity: 'O(n log n) time, O(n) space.',
    tests: [
      { input: '[[0,30],[5,10],[15,20]]', expected: 2, custom: 'Test.minMeetingRooms([[0,30],[5,10],[15,20]])' },
      { input: '[[7,10],[2,4]]', expected: 1, custom: 'Test.minMeetingRooms([[7,10],[2,4]])' },
      { input: '[]', expected: 0, custom: 'Test.minMeetingRooms([])' },
      { input: '[[1,5],[5,10]]', expected: 1, custom: 'Test.minMeetingRooms([[1,5],[5,10]])', note: 'back-to-back is not an overlap' },
      { input: '[[1,10],[2,7],[3,19],[8,12],[10,20],[11,30]]', expected: 4, custom: 'Test.minMeetingRooms([[1,10],[2,7],[3,19],[8,12],[10,20],[11,30]])' }
    ]
  },

  {
    id: 'gsr-copy-random-list',
    cat: 'gs-core',
    level: 3,
    seniority: 'mid',
    added: '2026-10-24',
    title: 'Copy List with Random Pointer (O(1) space)',
    confidence: 'high',
    tag: 'Linked list / interleaving',
    reportCount: 'Associate SDE-2 Superday, round 1. Candidate gave the hash-map solution, then was pushed to O(1) space.',
    levelWhy: 'SDE-2 / Associate Superday, the mid-level band. The O(1)-space follow-up is the senior signal.',
    sources: [
      { label: 'LeetCode Discuss 4878508 - Goldman Sachs SDE-2 Offer Accepted', url: 'https://leetcode.com/discuss/post/4878508/' }
    ],
    prompt: [
      'A linked list has nodes with `val`, `next` and `random`, where `random` may point to any node in the list or be null. Return a DEEP copy of the list.',
      '',
      'The hash-map solution (map old node -> new node) is O(n) space. The interviewer asked to do it with O(1) extra space.',
      '',
      'The O(1) trick: interleave the copies into the original list, wire the random pointers, then split the two lists apart. Do not modify the original in the final state.'
    ].join('\n'),
    signature: 'copyRandomList(head)',
    starter: [
      'function copyRandomList(head) {',
      '  // 1) A -> A\' -> B -> B\' -> ...',
      '  // 2) A\'.random = A.random ? A.random.next : null',
      '  // 3) detach and restore the original',
      '}'
    ].join('\n'),
    hints: [
      'Step 1: for each node, insert its copy immediately after it: A -> A\' -> B -> B\'. Do not touch the random pointers yet.',
      'Step 2: for each original node with a random pointer, the copy\'s random is `original.random.next` - that is the copy sitting right after the random target.',
      'Step 3: restore the original `next` pointers and set each copy\'s `next` to the next copy. Two separate walks, each with a temporary variable.',
      'The subtle part is step 3: save copy = cur.next, then cur.next = copy.next, then copy.next = copy.next ? copy.next.next : null, then advance cur = cur.next.',
      'The hash-map version is easier and O(n) space; mention it first, then offer this. Edge cases: empty list, a single node, and random pointers that are null.'
    ],
    solution: [
      'function copyRandomList(head) {',
      '  if (!head) return null;',
      '',
      '  // 1) interleave copies: A -> A\' -> B -> B\'',
      '  for (let cur = head; cur; cur = cur.next.next) {',
      '    const copy = { val: cur.val, next: cur.next, random: null };',
      '    cur.next = copy;',
      '  }',
      '',
      '  // 2) copy random pointers',
      '  for (let cur = head; cur; cur = cur.next.next) {',
      '    if (cur.random) cur.next.random = cur.random.next;',
      '  }',
      '',
      '  // 3) detach: restore originals, link copies',
      '  const newHead = head.next;',
      '  for (let cur = head; cur; cur = cur.next) {',
      '    const copy = cur.next;',
      '    cur.next = copy.next;',
      '    copy.next = copy.next ? copy.next.next : null;',
      '  }',
      '  return newHead;',
      '}'
    ].join('\n'),
    complexity: 'O(n) time, O(1) extra space (the copies themselves are the output).',
    tests: [
      {
        input: 'A(7) -> B(13) -> C(11), randoms A->C, B->A, C->B',
        expected: [true, 7, 13, 11, 11, 7, 13, true],
        custom: '(() => { const a={val:7,next:null,random:null}, b={val:13,next:null,random:null}, c={val:11,next:null,random:null}; a.next=b; b.next=c; a.random=c; b.random=a; c.random=b; const d=Test.copyRandomList(a); return [d!==a, d.val, d.next.val, d.next.next.val, d.random.val, d.next.random.val, d.next.next.random.val, a.next===b]; })()',
        note: 'deep copy, correct randoms, original restored'
      },
      { input: 'null', expected: null, custom: 'Test.copyRandomList(null)' },
      {
        input: 'single node with random to itself',
        expected: [1, 1],
        custom: '(() => { const a={val:1,next:null,random:null}; a.random=a; const d=Test.copyRandomList(a); return [d.val, d.random.val]; })()'
      }
    ]
  },

  {
    id: 'gsr-132-pattern',
    cat: 'gs-core',
    level: 3,
    seniority: 'mid',
    added: '2026-10-24',
    title: '132 Pattern',
    confidence: 'high',
    tag: 'Monotonic stack',
    reportCount: 'Associate SDE-2 Superday, round 1, question 2. Follow-up asked to COUNT the number of 132 triples (candidate gave O(n^2)).',
    levelWhy: 'SDE-2 / Associate Superday, the mid-level band.',
    sources: [
      { label: 'LeetCode Discuss 4878508 - Goldman Sachs SDE-2 Offer Accepted', url: 'https://leetcode.com/discuss/post/4878508/' }
    ],
    prompt: [
      'Given an array of n integers, return true if there is a 132 pattern: indices i < j < k with nums[i] < nums[k] < nums[j].',
      '',
      ' [3,1,4,2]     -> true   (i=1 value 1, j=2 value 4, k=3 value 2)',
      ' [1,2,3,4]     -> false  (increasing, no j with two smaller later values)',
      ' [-1,3,2,0]    -> true   (-1 < 0 < 3)',
      '',
      'Follow-up from the report: count the NUMBER of such triples. The O(n^2) counting answer was accepted as a discussion; the O(n log n) version uses a Fenwick tree.'
    ].join('\n'),
    signature: 'find132pattern(nums)',
    starter: [
      'function find132pattern(nums) {',
      '  // scan right to left, keep a decreasing stack of candidates for nums[j]',
      '  // `third` is the best (largest) nums[k] seen below a candidate j',
      '}'
    ].join('\n'),
    hints: [
      'Scan from RIGHT to LEFT. Maintain a stack of values that could play the role of nums[j] (the "3"), in decreasing order from bottom to top.',
      'Keep a variable `third` = the largest value that has been popped off the stack. A popped value is a valid nums[k] for some earlier j, and bigger is better.',
      'At each i: if nums[i] < third, you have found i < j < k with nums[i] < nums[k] < nums[j] - return true.',
      'Then pop every stack value smaller than nums[i] into `third`, and push nums[i]. The stack stays decreasing, so the top is the smallest candidate j.',
      'This is O(n) time and O(n) space. The brute force is O(n^3); the counting follow-up in O(n^2) is a double loop over j with prefix/suffix counts - say both, then code the stack.'
    ],
    solution: [
      'function find132pattern(nums) {',
      '  const stack = [];',
      '  let third = -Infinity;',
      '  for (let i = nums.length - 1; i >= 0; i--) {',
      '    if (nums[i] < third) return true;',
      '    while (stack.length && stack[stack.length - 1] < nums[i]) {',
      '      third = stack.pop();',
      '    }',
      '    stack.push(nums[i]);',
      '  }',
      '  return false;',
      '}'
    ].join('\n'),
    complexity: 'O(n) time, O(n) space.',
    tests: [
      { input: '[3,1,4,2]', expected: true, custom: 'Test.find132pattern([3,1,4,2])' },
      { input: '[1,2,3,4]', expected: false, custom: 'Test.find132pattern([1,2,3,4])' },
      { input: '[-1,3,2,0]', expected: true, custom: 'Test.find132pattern([-1,3,2,0])' },
      { input: '[3,5,0,3,4]', expected: true, custom: 'Test.find132pattern([3,5,0,3,4])' },
      { input: '[1,0,1,-4,-3]', expected: false, custom: 'Test.find132pattern([1,0,1,-4,-3])' }
    ]
  },

  {
    id: 'gsr-prefix-indices',
    cat: 'gs-core',
    level: 2,
    seniority: 'mid',
    added: '2026-10-24',
    title: 'Prefix occurrences in a document (char indices)',
    confidence: 'high',
    tag: 'Scan / trie follow-up',
    reportCount: 'Associate SDE-2 Superday, round 2. The candidate jumped to a trie; the interviewer asked for the simple scan first, then made them code the trie.',
    levelWhy: 'SDE-2 / Associate Superday, the mid-level band.',
    sources: [
      { label: 'LeetCode Discuss 4878508 - Goldman Sachs SDE-2 Offer Accepted', url: 'https://leetcode.com/discuss/post/4878508/' }
    ],
    prompt: [
      'Given a document string and a prefix, return the character indices at which a word in the document starts with that prefix.',
      '',
      ' doc = "A BCD AB CDE DEF AGH", prefix = "A"  -> [0, 6, 17]',
      ' same doc, prefix = "AB"                      -> [6]',
      '',
      'Words are separated by single spaces. The follow-up: answer Q prefix queries over the same immutable document - build a trie of (word, index) pairs, then walk the prefix and return the stored index list.'
    ].join('\n'),
    signature: 'prefixIndices(doc, prefix)',
    starter: [
      'function prefixIndices(doc, prefix) {',
      '  // scan word by word, remember each word\'s START index in the doc',
      '}'
    ].join('\n'),
    hints: [
      'Do NOT use indexOf in a loop - that finds substrings anywhere, including inside a word. You need WORD starts that begin with the prefix.',
      'Tokenise with a regex like /\\S+/g. Each match has .index, which is exactly the character offset you need.',
      'Filter matches whose text starts with the prefix, and collect match.index. That is O(doc length) and needs no trie.',
      'For the Q-query follow-up, build a trie where each node carries a list of word-start indices; a prefix query walks the prefix and returns the list. That is O(total chars + Q * prefix length), at the cost of memory.',
      'Edge cases: empty prefix (every word matches - decide with the interviewer), a prefix longer than any word, and repeated words at different positions.'
    ],
    solution: [
      'function prefixIndices(doc, prefix) {',
      '  const out = [];',
      '  const re = /\\S+/g;',
      '  let match;',
      '  while ((match = re.exec(doc)) !== null) {',
      '    if (match[0].startsWith(prefix)) out.push(match.index);',
      '  }',
      '  return out;',
      '}'
    ].join('\n'),
    complexity: 'O(n) time for one query, O(1) extra space (plus the output).',
    tests: [
      { input: '"A BCD AB CDE DEF AGH", "A"', expected: [0, 6, 17], custom: 'Test.prefixIndices("A BCD AB CDE DEF AGH", "A")' },
      { input: '"A BCD AB CDE DEF AGH", "AB"', expected: [6], custom: 'Test.prefixIndices("A BCD AB CDE DEF AGH", "AB")' },
      { input: '"abc abc", "abc"', expected: [0, 4], custom: 'Test.prefixIndices("abc abc", "abc")' },
      { input: '"x y z", "q"', expected: [], custom: 'Test.prefixIndices("x y z", "q")' }
    ]
  },

  {
    id: 'gsr-remove-duplicates-sorted',
    cat: 'gs-core',
    level: 1,
    seniority: 'mid',
    added: '2026-10-24',
    sourceDate: '2026-10-20',
    title: 'Remove Duplicates from Sorted Array (in place)',
    confidence: 'high',
    tag: 'Two pointers / in place',
    reportCount: 'The author\'s own 2026 Goldman CoderPad associate round, question 1 - solved in about eight minutes.',
    levelWhy: 'Reported in an associate-level CoderPad round; Associate maps to the mid band.',
    sources: [
      { label: 'InterviewFox - I Took the Goldman Sachs CoderPad Interview in 2026 (20 Oct 2026)', url: 'https://interviewfox.ai/interview-questions/goldman-sachs-coderpad-oa-guide/' }
    ],
    prompt: [
      'Given a sorted integer array, remove the duplicates IN PLACE so each value appears once. Return the new length k, and the first k slots must hold the unique values in order.',
      '',
      ' [1,1,2]           -> k = 2, first 2 slots [1,2]',
      ' [0,0,1,1,1,2,2,3,3,4] -> k = 5, first 5 slots [0,1,2,3,4]',
      '',
      'Allocation of a second array is not allowed. The interviewer watches that you do not call splice in a loop (O(n^2)).'
    ].join('\n'),
    signature: 'removeDuplicates(nums)',
    starter: [
      'function removeDuplicates(nums) {',
      '  // slow = last unique slot, fast = scanner',
      '}'
    ].join('\n'),
    hints: [
      'Sorted input means duplicates are adjacent, so a single scan is enough.',
      'Keep a slow pointer k = number of unique values written so far. Fast pointer i scans from 1.',
      'If nums[i] !== nums[k-1], write nums[i] into nums[k] and increment k. Otherwise skip.',
      'Never remove elements with splice - that shifts the tail and turns an O(n) scan into O(n^2). The judge only cares about the first k slots.',
      'Edge cases: empty array (0), one element (1), all duplicates (1), and no duplicates (n).'
    ],
    solution: [
      'function removeDuplicates(nums) {',
      '  if (!nums.length) return 0;',
      '  let k = 1;',
      '  for (let i = 1; i < nums.length; i++) {',
      '    if (nums[i] !== nums[k - 1]) {',
      '      nums[k] = nums[i];',
      '      k++;',
      '    }',
      '  }',
      '  return k;',
      '}'
    ].join('\n'),
    complexity: 'O(n) time, O(1) space.',
    tests: [
      {
        input: '[1,1,2]',
        expected: [2, [1, 2]],
        custom: '(() => { const a = [1,1,2]; const k = Test.removeDuplicates(a); return [k, a.slice(0, k)]; })()'
      },
      {
        input: '[0,0,1,1,1,2,2,3,3,4]',
        expected: [5, [0, 1, 2, 3, 4]],
        custom: '(() => { const a = [0,0,1,1,1,2,2,3,3,4]; const k = Test.removeDuplicates(a); return [k, a.slice(0, k)]; })()'
      },
      {
        input: '[]',
        expected: [0, []],
        custom: '(() => { const a = []; const k = Test.removeDuplicates(a); return [k, a.slice(0, k)]; })()'
      },
      {
        input: '[7,7,7]',
        expected: [1, [7]],
        custom: '(() => { const a = [7,7,7]; const k = Test.removeDuplicates(a); return [k, a.slice(0, k)]; })()'
      }
    ]
  },

  {
    id: 'gsr-max-gold',
    cat: 'gs-core',
    level: 3,
    seniority: 'N/A',
    added: '2026-10-24',
    sourceDate: '2026-10-20',
    title: 'Path with Maximum Gold (backtracking)',
    confidence: 'medium',
    tag: 'DFS + backtracking',
    reportCount: 'Confirmed CoderPad bank item (LeetCode report 1837497), cited in the 2026 guide - a grid traversal collecting the most gold.',
    levelWhy: 'The guide confirms the question but does not state the candidate level for this bank item, so it stays N/A.',
    sources: [
      { label: 'InterviewFox - Goldman Sachs CoderPad guide (20 Oct 2026)', url: 'https://interviewfox.ai/interview-questions/goldman-sachs-coderpad-oa-guide/' }
    ],
    prompt: [
      'A grid contains gold amounts; 0 means an empty cell. You may start anywhere and move up, down, left or right, collecting the gold in each cell you visit. You may not visit the same cell twice.',
      '',
      ' [[0,6,0],',
      '  [5,8,7],',
      '  [0,9,0]]  -> 24   (9 -> 8 -> 7)',
      '',
      'Return the maximum gold you can collect. This is the 4-directional cousin of the up/right grid DP - here you need DFS with backtracking because the path can turn.'
    ].join('\n'),
    signature: 'getMaximumGold(grid)',
    starter: [
      'function getMaximumGold(grid) {',
      '  // DFS from every non-zero cell; zero the cell on entry, restore on exit',
      '}'
    ].join('\n'),
    hints: [
      'You cannot use the up/right DP here because movement is 4-directional and revisits are banned - the state is the SET of visited cells, not just (r, c).',
      'Backtracking: on entering a cell, save its value, set it to 0 (marks it visited), recurse into the 4 neighbours, then restore the value.',
      'DFS returns the best gold from this cell onward. At each cell take the max over the four neighbour results, then add the current value.',
      'Try every non-zero cell as a start and keep the global best. Complexity is exponential in the worst case (4 * 3^(k-1) for k gold cells), but the grid is small.',
      'Edge cases: all zeros (0), a single cell, and a grid where the best path is not the obvious greedy one.'
    ],
    solution: [
      'function getMaximumGold(grid) {',
      '  const rows = grid.length, cols = grid[0].length;',
      '  let best = 0;',
      '  const dfs = (r, c) => {',
      '    if (r < 0 || c < 0 || r >= rows || c >= cols || grid[r][c] === 0) return 0;',
      '    const gold = grid[r][c];',
      '    grid[r][c] = 0;',
      '    const next = Math.max(',
      '      dfs(r + 1, c), dfs(r - 1, c),',
      '      dfs(r, c + 1), dfs(r, c - 1)',
      '    );',
      '    grid[r][c] = gold;',
      '    return gold + next;',
      '  };',
      '  for (let r = 0; r < rows; r++) {',
      '    for (let c = 0; c < cols; c++) {',
      '      if (grid[r][c] !== 0) best = Math.max(best, dfs(r, c));',
      '    }',
      '  }',
      '  return best;',
      '}'
    ].join('\n'),
    complexity: 'Exponential worst case (4 * 3^(k-1) for k gold cells); O(k) recursion depth.',
    tests: [
      {
        input: '[[0,6,0],[5,8,7],[0,9,0]]',
        expected: 24,
        custom: 'Test.getMaximumGold([[0,6,0],[5,8,7],[0,9,0]])',
        note: 'best path is 9 -> 8 -> 7 = 24'
      },
      { input: '[[1,0,7],[2,0,6],[3,4,5]]', expected: 28, custom: 'Test.getMaximumGold([[1,0,7],[2,0,6],[3,4,5]])' },
      { input: '[[0,0,0]]', expected: 0, custom: 'Test.getMaximumGold([[0,0,0]])' },
      { input: '[[1,1]]', expected: 2, custom: 'Test.getMaximumGold([[1,1]])' }
    ]
  },

  /* ==========================================================
     SENIOR - VP / Senior SWE / SDE-3 loops
     ========================================================== */
  {
    id: 'gsr-longest-prefix-suffix',
    cat: 'gs-core',
    level: 3,
    seniority: 'senior',
    added: '2026-10-24',
    sourceDate: '2024-10-01',
    title: 'Longest Happy Prefix (longest prefix that is also a suffix)',
    confidence: 'high',
    tag: 'KMP / prefix function',
    reportCount: 'Senior Software Engineer, Bengaluru - the first (online coding) round, described as "a hard LeetCode problem".',
    levelWhy: 'Interviewed for Senior Software Engineer (VP-equivalent IC band). Source dates the experience 1 Oct 2024.',
    sources: [
      { label: 'Taro - Goldman Sachs Senior SWE Bengaluru, 1 Oct 2024', url: 'https://www.jointaro.com/interviews/companies/goldman-sachs/experiences/senior-software-engineer-bengaluru-october-1-2024-no-offer-neutral-2f116d11/' }
    ],
    prompt: [
      'A "happy prefix" is a non-empty prefix of s that is also a suffix of s, but is not the whole string. Return the longest happy prefix, or "" if none exists.',
      '',
      ' "ababab" -> "abab"',
      ' "abcabc" -> "abc"',
      ' "abcd"   -> ""',
      ' "aaaa"   -> "aaa"',
      '',
      'This is LeetCode 1392, reported as the first-round coding question for a Goldman Senior SWE in Bengaluru. The expected path is the KMP prefix function in O(n).'
    ].join('\n'),
    signature: 'longestPrefix(s)',
    starter: [
      'function longestPrefix(s) {',
      '  // pi[i] = length of the longest proper prefix of s[0..i] that is also a suffix',
      '  // answer = s.slice(0, pi[n-1])',
      '}'
    ].join('\n'),
    hints: [
      'The naive version compares every prefix to the matching suffix: O(n^2) in the worst case ("aaaa..."). The interviewer wants the KMP prefix function.',
      'Build pi left to right. pi[i] is the length of the longest proper prefix of s[0..i] that is also a suffix of s[0..i].',
      'Keep a fallback pointer k = pi[i-1]. While k > 0 and s[i] !== s[k], set k = pi[k-1]. If s[i] === s[k], k++. Then pi[i] = k.',
      'The answer is the last pi value: prefix length = pi[n-1], so slice s from 0 to pi[n-1]. It is "proper", so a full-length match must not be returned.',
      'Edge cases: empty string, single character (0 - the whole string is not allowed), and strings with no border ("abcd").'
    ],
    solution: [
      'function longestPrefix(s) {',
      '  const n = s.length;',
      '  if (n === 0) return "";',
      '  const pi = new Array(n).fill(0);',
      '  for (let i = 1, k = 0; i < n; i++) {',
      '    while (k > 0 && s[i] !== s[k]) k = pi[k - 1];',
      '    if (s[i] === s[k]) k++;',
      '    pi[i] = k;',
      '  }',
      '  return s.slice(0, pi[n - 1]);',
      '}'
    ].join('\n'),
    complexity: 'O(n) time, O(n) space for the prefix table.',
    tests: [
      { input: '"ababab"', expected: 'abab', custom: 'Test.longestPrefix("ababab")' },
      { input: '"abcabc"', expected: 'abc', custom: 'Test.longestPrefix("abcabc")' },
      { input: '"abcd"', expected: '', custom: 'Test.longestPrefix("abcd")' },
      { input: '"aaaa"', expected: 'aaa', custom: 'Test.longestPrefix("aaaa")', note: 'proper prefix only' },
      { input: '""', expected: '', custom: 'Test.longestPrefix("")' }
    ]
  },

  {
    id: 'gsr-median-two-sorted',
    cat: 'gs-core',
    level: 3,
    seniority: 'senior',
    added: '2026-10-24',
    sourceDate: '2026-09-16',
    title: 'Median of Two Sorted Arrays',
    confidence: 'medium',
    tag: 'Binary search on a partition',
    reportCount: 'Listed in the experienced / VP data-structures surface and in the senior tier of a 2026 GS frequency guide. Also appears in the coderpad repo without a level.',
    levelWhy: 'Level guides put it in the experienced and senior-tier surface; no first-hand senior report names it explicitly, so confidence is medium.',
    sources: [
      { label: 'InterviewLegend - Goldman Sachs process (Sep 2026): US/experienced coding surface', url: 'https://interviewlegend.com/guides/companies/goldman-sachs/overview/process-overview' },
      { label: 'Verve AI - 30 GS questions, Tier 3 "senior rounds"', url: 'https://www.vervecopilot.com/blog/top-30-goldman-sachs-leetcode-interview-questions' }
    ],
    prompt: [
      'Given two sorted arrays a and b, return the median of the combined array in O(log(min(m, n))) time.',
      '',
      ' [1,3] and [2]     -> 2',
      ' [1,2] and [3,4]   -> 2.5',
      ' []    and [1]     -> 1',
      '',
      'Do not merge the arrays - that is O(m+n) and the interviewer will ask you to do better. The trick is binary-searching the CUT point in the smaller array.'
    ].join('\n'),
    signature: 'findMedianSortedArrays(a, b)',
    starter: [
      'function findMedianSortedArrays(a, b) {',
      '  // binary search i in [0, m]; j = half - i',
      '  // valid partition: a[i-1] <= b[j] and b[j-1] <= a[i]',
      '}'
    ].join('\n'),
    hints: [
      'Ensure a is the shorter array (swap if needed). That gives O(log(min(m,n))).',
      'Think of a partition: take i elements from a and j = half - i from b, where half = floor((m+n)/2). The union of the left parts must all be <= the union of the right parts.',
      'The partition is valid when aLeft <= bRight and bLeft <= aRight. If aLeft > bRight, move i left; else move i right.',
      'Use -Infinity / +Infinity for the out-of-range neighbours so you do not special-case empty sides.',
      'Odd total: median is min(aRight, bRight). Even total: average of max(aLeft, bLeft) and min(aRight, bRight). Watch integer division and the / 2 producing .5.'
    ],
    solution: [
      'function findMedianSortedArrays(a, b) {',
      '  if (a.length > b.length) {',
      '    const t = a; a = b; b = t;',
      '  }',
      '  const m = a.length, n = b.length;',
      '  const half = Math.floor((m + n) / 2);',
      '  let lo = 0, hi = m;',
      '  for (;;) {',
      '    const i = Math.floor((lo + hi) / 2);',
      '    const j = half - i;',
      '    const aLeft = i > 0 ? a[i - 1] : -Infinity;',
      '    const aRight = i < m ? a[i] : Infinity;',
      '    const bLeft = j > 0 ? b[j - 1] : -Infinity;',
      '    const bRight = j < n ? b[j] : Infinity;',
      '    if (aLeft <= bRight && bLeft <= aRight) {',
      '      if ((m + n) % 2 === 1) return Math.min(aRight, bRight);',
      '      return (Math.max(aLeft, bLeft) + Math.min(aRight, bRight)) / 2;',
      '    }',
      '    if (aLeft > bRight) hi = i - 1;',
      '    else lo = i + 1;',
      '  }',
      '}'
    ].join('\n'),
    complexity: 'O(log(min(m,n))) time, O(1) space.',
    tests: [
      { input: '[1,3], [2]', expected: 2, custom: 'Test.findMedianSortedArrays([1,3], [2])' },
      { input: '[1,2], [3,4]', expected: 2.5, custom: 'Test.findMedianSortedArrays([1,2], [3,4])' },
      { input: '[], [1]', expected: 1, custom: 'Test.findMedianSortedArrays([], [1])' },
      { input: '[], [2,3]', expected: 2.5, custom: 'Test.findMedianSortedArrays([], [2,3])' },
      { input: '[1,2,3], [4,5,6]', expected: 3.5, custom: 'Test.findMedianSortedArrays([1,2,3], [4,5,6])' }
    ]
  },

  /* ==========================================================
     N/A - the source proves it is asked, not who was asked
     ========================================================== */
  {
    id: 'gsr-longest-subarray-abs-diff',
    cat: 'gs-core',
    level: 3,
    seniority: 'N/A',
    added: '2026-10-24',
    sourceDate: '2026-09-16',
    title: 'Longest subarray with max-min <= limit',
    confidence: 'medium',
    tag: 'Monotonic deques',
    reportCount: 'Top of a 2026 GS frequency list (reported at 100% frequency on some trackers). No level attached.',
    levelWhy: 'Frequency data only - the source does not state the level of the candidates asked.',
    sources: [
      { label: 'Verve AI - 30 GS LeetCode questions (updated 16 Sep 2026)', url: 'https://www.vervecopilot.com/blog/top-30-goldman-sachs-leetcode-interview-questions' }
    ],
    prompt: [
      'Given an array of integers and a limit, return the length of the longest contiguous subarray such that the difference between its maximum and minimum is at most `limit`.',
      '',
      ' nums = [8,2,4,7], limit = 4 -> 2   ([2,4] or [4,7])',
      ' nums = [10,1,2,4,7,2], limit = 5 -> 4   ([2,4,7,2]? max 7, min 2, diff 5)',
      ' nums = [4,2,2,2,4,4,2,2], limit = 0 -> 3',
      '',
      'The obvious heap solution is O(n log n). The Goldman-favoured solution is two monotonic deques in O(n).'
    ].join('\n'),
    signature: 'longestSubarray(nums, limit)',
    starter: [
      'function longestSubarray(nums, limit) {',
      '  // window + deque for max + deque for min',
      '}'
    ].join('\n'),
    hints: [
      'A sliding window works because adding elements can only widen [min, max]. If the window is invalid, shrinking from the left can only help.',
      'You need the max and min of the window in O(1) as it slides. Two monotonic deques do exactly that: one decreasing (max at front), one increasing (min at front).',
      'When pushing index r, pop from the back of the max deque while its value is <= nums[r]. Mirror with >= for the min deque. Then push r.',
      'While maxDeque.front value - minDeque.front value > limit, increment left and drop any deque front that is now < left.',
      'Update the answer as r - left + 1 after the window is valid. Edge cases: single element, limit 0, and an all-constant array.'
    ],
    solution: [
      'function longestSubarray(nums, limit) {',
      '  const maxQ = [], minQ = [];',
      '  let left = 0, best = 0;',
      '  for (let right = 0; right < nums.length; right++) {',
      '    while (maxQ.length && nums[maxQ[maxQ.length - 1]] <= nums[right]) maxQ.pop();',
      '    maxQ.push(right);',
      '    while (minQ.length && nums[minQ[minQ.length - 1]] >= nums[right]) minQ.pop();',
      '    minQ.push(right);',
      '    while (nums[maxQ[0]] - nums[minQ[0]] > limit) {',
      '      left++;',
      '      if (maxQ[0] < left) maxQ.shift();',
      '      if (minQ[0] < left) minQ.shift();',
      '    }',
      '    best = Math.max(best, right - left + 1);',
      '  }',
      '  return best;',
      '}'
    ].join('\n'),
    complexity: 'O(n) time, O(n) space for the deques.',
    tests: [
      { input: '[8,2,4,7], 4', expected: 2, custom: 'Test.longestSubarray([8,2,4,7], 4)' },
      { input: '[10,1,2,4,7,2], 5', expected: 4, custom: 'Test.longestSubarray([10,1,2,4,7,2], 5)' },
      { input: '[4,2,2,2,4,4,2,2], 0', expected: 3, custom: 'Test.longestSubarray([4,2,2,2,4,4,2,2], 0)' },
      { input: '[1], 0', expected: 1, custom: 'Test.longestSubarray([1], 0)' }
    ]
  },

  {
    id: 'gsr-open-the-lock',
    cat: 'gs-core',
    level: 2,
    seniority: 'N/A',
    added: '2026-10-24',
    sourceDate: '2026-09-16',
    title: 'Open the Lock (shortest combination)',
    confidence: 'medium',
    tag: 'BFS on a state graph',
    reportCount: 'Second-highest frequency item in a 2026 GS list (reported 82%). No level attached.',
    levelWhy: 'Frequency data only - the source does not state the level of the candidates asked.',
    sources: [
      { label: 'Verve AI - 30 GS LeetCode questions (updated 16 Sep 2026)', url: 'https://www.vervecopilot.com/blog/top-30-goldman-sachs-leetcode-interview-questions' }
    ],
    prompt: [
      'A lock has 4 wheels, each 0-9, starting at "0000". One move turns one wheel by one slot (0 -> 9 wraps, 9 -> 0 wraps). Some combinations are dead ends you may never enter.',
      '',
      ' deadends = ["0201","0101","0102","1212","2002"], target = "0202" -> 6',
      ' deadends = ["8888"], target = "0009" -> 1',
      ' deadends = ["8888"], target = "0000" -> 0',
      '',
      'Return the minimum number of moves, or -1 if the target cannot be reached.'
    ].join('\n'),
    signature: 'openLock(deadends, target)',
    starter: [
      'function openLock(deadends, target) {',
      '  // BFS over 10^4 states; 8 neighbours per state',
      '}'
    ].join('\n'),
    hints: [
      'The state space is only 10,000 combinations, so BFS from "0000" is enough. BFS gives the minimum number of moves because every edge has weight 1.',
      'Neighbours: for each of the 4 positions, add 1 mod 10 and subtract 1 mod 10. That is 8 neighbours.',
      'Seed the visited set with the deadends (plus "0000" if it is a dead end), otherwise you waste work and may wrongly return a path through one.',
      'Check the target when you pop or when you generate - either works; be consistent. Return the depth when found, -1 when the queue drains.',
      'Edge cases: target "0000" (0 moves, unless it is a dead end), deadend at "0000" (-1), and unreachable targets.'
    ],
    solution: [
      'function openLock(deadends, target) {',
      '  const dead = new Set(deadends);',
      '  if (dead.has("0000")) return -1;',
      '  if (target === "0000") return 0;',
      '  const queue = ["0000"];',
      '  const seen = new Set(["0000"]);',
      '  let depth = 0;',
      '  while (queue.length) {',
      '    depth++;',
      '    for (let size = queue.length; size > 0; size--) {',
      '      const cur = queue.shift();',
      '      for (let i = 0; i < 4; i++) {',
      '        for (const delta of [1, 9]) {',
      '          const digits = cur.split("");',
      '          digits[i] = String((Number(digits[i]) + delta) % 10);',
      '          const next = digits.join("");',
      '          if (seen.has(next) || dead.has(next)) continue;',
      '          if (next === target) return depth;',
      '          seen.add(next);',
      '          queue.push(next);',
      '        }',
      '      }',
      '    }',
      '  }',
      '  return -1;',
      '}'
    ].join('\n'),
    complexity: 'O(10^4 * 8) time, O(10^4) space.',
    tests: [
      { input: '["0201","0101","0102","1212","2002"], "0202"', expected: 6, custom: 'Test.openLock(["0201","0101","0102","1212","2002"], "0202")' },
      { input: '["8888"], "0009"', expected: 1, custom: 'Test.openLock(["8888"], "0009")' },
      { input: '["8888"], "0000"', expected: 0, custom: 'Test.openLock(["8888"], "0000")' },
      {
        input: '["8887","8889","8878","8898","8788","8988","7888","9888"], "8888"',
        expected: -1,
        custom: 'Test.openLock(["8887","8889","8878","8898","8788","8988","7888","9888"], "8888")',
        note: 'all neighbours of 8888 are dead'
      },
      { input: '["0000"], "8888"', expected: -1, custom: 'Test.openLock(["0000"], "8888")' }
    ]
  },

  {
    id: 'gsr-two-bsts',
    cat: 'gs-core',
    level: 2,
    seniority: 'N/A',
    added: '2026-10-24',
    sourceDate: '2026-09-16',
    title: 'All Elements in Two BSTs (sorted)',
    confidence: 'medium',
    tag: 'Inorder traversal + merge',
    reportCount: 'Named as a confirmed Goldman ask in a 2026 frequency guide ("All Elements in Two Binary Search Trees"). No level attached.',
    levelWhy: 'Guide confirms the ask but publishes no candidate level, so the label stays N/A.',
    sources: [
      { label: 'Verve AI - 30 GS LeetCode questions (updated 16 Sep 2026)', url: 'https://www.vervecopilot.com/blog/top-30-goldman-sachs-leetcode-interview-questions' }
    ],
    prompt: [
      'Given the roots of two binary search trees, return a sorted list containing every value from both trees.',
      '',
      ' tree1 = [2,1,4], tree2 = [1,0,3] -> [0,1,1,2,3,4]',
      '',
      'The straightforward answer collects both traversals and sorts: O((m+n) log(m+n)). The follow-up is to merge two sorted inorder traversals in O(m+n) without sorting.'
    ].join('\n'),
    signature: 'getAllElements(root1, root2)',
    starter: [
      'function getAllElements(root1, root2) {',
      '  // inorder = sorted for a BST; merge the two streams',
      '}'
    ].join('\n'),
    hints: [
      'An inorder traversal of a BST visits values in sorted order. Do it for both trees.',
      'With the two sorted arrays in hand, merge them exactly like merge sort\'s merge step. That is O(m+n) and avoids a sort.',
      'A more advanced version uses two explicit stacks to lazily stream the inorders, which avoids materialising both arrays. Offer it as the follow-up.',
      'Recursion is fine for balanced trees; mention that a skewed BST makes the recursion O(n) deep and an iterative stack avoids that.',
      'Edge cases: one tree empty, both empty, duplicate values across the trees (they both stay), and negative values.'
    ],
    solution: [
      'function getAllElements(root1, root2) {',
      '  const inorder = (node, out) => {',
      '    if (!node) return;',
      '    inorder(node.left, out);',
      '    out.push(node.val);',
      '    inorder(node.right, out);',
      '  };',
      '  const a = [], b = [];',
      '  inorder(root1, a);',
      '  inorder(root2, b);',
      '  const merged = [];',
      '  let i = 0, j = 0;',
      '  while (i < a.length && j < b.length) {',
      '    if (a[i] <= b[j]) merged.push(a[i++]);',
      '    else merged.push(b[j++]);',
      '  }',
      '  while (i < a.length) merged.push(a[i++]);',
      '  while (j < b.length) merged.push(b[j++]);',
      '  return merged;',
      '}'
    ].join('\n'),
    complexity: 'O(m+n) time, O(m+n) space.',
    tests: [
      {
        input: 'tree1 = [2,1,4], tree2 = [1,0,3]',
        expected: [0, 1, 1, 2, 3, 4],
        custom: 'Test.getAllElements(Test.T(2,Test.T(1),Test.T(4)), Test.T(1,Test.T(0),Test.T(3)))'
      },
      { input: 'tree1 = [1], tree2 = null', expected: [1], custom: 'Test.getAllElements(Test.T(1), null)' },
      { input: 'null, null', expected: [], custom: 'Test.getAllElements(null, null)' },
      {
        input: 'tree1 = tree2 = [2,1,3]',
        expected: [1, 1, 2, 2, 3, 3],
        custom: 'Test.getAllElements(Test.T(2,Test.T(1),Test.T(3)), Test.T(2,Test.T(1),Test.T(3)))',
        note: 'duplicates are kept'
      }
    ]
  },

];
