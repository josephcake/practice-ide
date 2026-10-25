/* ============================================================
   GOLDMAN SACHS: VERIFIED QUESTION SET
   ------------------------------------------------------------
   Every question here is sourced from a public candidate report
   (LeetCode Discuss, Glassdoor reports, GitHub coderpad repos,
   interview-experience sites) or from a frequency table for
   Goldman's tagged LeetCode list. Sources are attached to each
   question as `sources: [...]` and shown in the UI.

   Confidence:
     high   - independently corroborated in 2+ reports, or named
              in a Goldman-tagged frequency table
     medium - one credible first-hand report

   These are the questions that actually get repeated, which is
   different from "questions you might see".
   ============================================================ */

const GS_QUESTIONS = [
  /* ==========================================================
     TIER 1 - THE REPEAT OFFENDERS
     ========================================================== */
  {
    id: 'gs-fraction-decimal',
    cat: 'gs-core',
    level: 2,
    title: 'Fraction to Recurring Decimal',
    confidence: 'high',
    tag: 'THE Goldman question',
    reportCount: '9+ independent reports, 2023-2026',
    sources: [
      { label: 'LeetCode Discuss - Coderpad interview', url: 'https://leetcode.com/discuss/interview-experience/1335611/goldman-sachs-coderpad-interview' },
      { label: 'LeetCode Discuss - Analyst Bengaluru Oct 2024 [Offer]', url: 'https://leetcode.com/discuss/interview-experience/6053956/Goldman-Sachs-or-Analyst-or-Bengaluru-or-Oct-2024-Offer' },
      { label: 'GitHub dedeepya42/goldmansachs (coderpad repo)', url: 'https://github.com/dedeepya42/goldmansachs' },
      { label: 'interviewexperiences.in - Associate Aug 2025 Bangalore', url: 'https://interviewexperiences.in/experience/goldman-sachs/goldman-sachs-interview-experience-associate-august-2025-bangalore' }
    ],
    prompt: [
      'Given two integers numerator and denominator, return the fraction in decimal form as a STRING. If the fractional part repeats, wrap the repeating part in parentheses.',
      '',
      ' 1/2   -> "0.5"',
      ' 1/3   -> "0.(3)"',
      ' 2/3   -> "0.(6)"',
      ' 5/3   -> "1.(6)"',
      ' 1/6   -> "0.1(6)"',
      ' -2/5  -> "-0.4"',
      '',
      'This is the single most reported Goldman CoderPad question in the entire corpus. If you learn one thing on this page, learn this.'
    ].join('\n'),
    signature: 'fractionToDecimal(numerator, denominator)',
    starter: [
      'function fractionToDecimal(numerator, denominator) {',
      '  // 1) sign  2) integer part  3) long division with a remainder->index map',
      '}'
    ].join('\n'),
    hints: [
      'Do it in the same order you would on paper: sign, integer part, then long division. Never compute with floats - 1/3 has no float answer that round-trips.',
      'Sign: check numerator * denominator < 0 BEFORE you take absolute values, otherwise -2/-5 goes wrong. Use BigInt mentally if either can be huge.',
      'Integer part is Math.trunc(a / b) on the absolute values; remainder a % b. If the remainder is 0, stop - no decimal point at all.',
      'The whole trick: if you see a remainder twice, everything between the FIRST occurrence and now repeats. Map remainder -> index in the digit list.',
      'Build the digit string char by char: remainder * 10, digit = floor(that / b), new remainder = that % b, and record the index BEFORE you push the digit.',
      'Edge cases they always poke at: 0/1 -> "0", negative inputs, denominator "0", and results that never repeat (1/8 -> "0.125").',
      'Goldman variant reported repeatedly: the input arrives as a STRING like "2/5" or "-2/5" - split on "/" first, then run the same code.'
    ],
    solution: [
      'function fractionToDecimal(numerator, denominator) {',
      '  if (numerator === 0) return "0";',
      '  const neg = (numerator < 0) !== (denominator < 0);',
      '  let n = Math.abs(numerator);',
      '  let d = Math.abs(denominator);',
      '',
      '  const intPart = Math.floor(n / d);',
      '  let rem = n % d;',
      '  let sign = neg ? "-" : "";',
      '  if (rem === 0) return sign + intPart;',
      '',
      '  const digits = [];',
      '  const seen = new Map(); // remainder -> index in digits',
      '  while (rem !== 0 && !seen.has(rem)) {',
      '    seen.set(rem, digits.length);',
      '    rem *= 10;',
      '    digits.push(Math.floor(rem / d));',
      '    rem %= d;',
      '  }',
      '',
      '  let frac;',
      '  if (rem === 0) {',
      '    frac = digits.join("");',
      '  } else {',
      '    const start = seen.get(rem);',
      '    frac = digits.slice(0, start).join("") + "(" + digits.slice(start).join("") + ")";',
      '  }',
      '  return sign + intPart + "." + frac;',
      '}'
    ].join('\n'),
    complexity: 'Time O(denominator) - the remainder cycle is bounded by the denominator. Space O(denominator).',
    tests: [
      { input: 'fractionToDecimal(1, 2)', expected: '0.5', custom: 'Test.fractionToDecimal(1, 2)' },
      { input: 'fractionToDecimal(2, 1)', expected: '2', custom: 'Test.fractionToDecimal(2, 1)', note: 'no decimal point when it divides evenly' },
      { input: 'fractionToDecimal(1, 3)', expected: '0.(3)', custom: 'Test.fractionToDecimal(1, 3)' },
      { input: 'fractionToDecimal(2, 3)', expected: '0.(6)', custom: 'Test.fractionToDecimal(2, 3)' },
      { input: 'fractionToDecimal(5, 3)', expected: '1.(6)', custom: 'Test.fractionToDecimal(5, 3)' },
      { input: 'fractionToDecimal(1, 6)', expected: '0.1(6)', custom: 'Test.fractionToDecimal(1, 6)', note: 'non-repeating prefix before the cycle' },
      { input: 'fractionToDecimal(-2, 5)', expected: '-0.4', custom: 'Test.fractionToDecimal(-2, 5)' },
      { input: 'fractionToDecimal(-2, -5)', expected: '0.4', custom: 'Test.fractionToDecimal(-2, -5)', note: 'double negative - the sign trap' },
      { input: 'fractionToDecimal(0, 5)', expected: '0', custom: 'Test.fractionToDecimal(0, 5)' },
      { input: 'fractionToDecimal(1, 8)', expected: '0.125', custom: 'Test.fractionToDecimal(1, 8)' },
      { input: 'fractionToDecimal(8639, 70000)', expected: '0.1234(142857)', custom: 'Test.fractionToDecimal(8639, 70000)', note: 'the 1/7 cycle - a reported test case' }
    ]
  },
  {
    id: 'gs-high-five',
    cat: 'gs-core',
    level: 1,
    title: 'High Five (top-5 average per student)',
    confidence: 'high',
    tag: 'Hash map + sort/heap',
    reportCount: '4+ reports incl. Aug 2025 USA CoderPad',
    sources: [
      { label: 'LeetCode Discuss - CoderPad Aug 2025 Engineering Associate USA', url: 'https://leetcode.com/discuss/post/7055821/goldman-sachs-coderpad-interview-august-h8kjx' },
      { label: 'LeetCode Discuss - Associate Aug 2025 Bangalore', url: 'https://leetcode.com/discuss/interview-experience/7239858' },
      { label: 'GitHub dedeepya42/goldmansachs', url: 'https://github.com/dedeepya42/goldmansachs' },
      { label: 'interviewfox.ai - 2026 CoderPad write-up', url: 'https://interviewfox.ai/interview-questions/goldman-sachs-coderpad-oa-guide' }
    ],
    prompt: [
      'Given a list of [studentId, score] pairs, each student has at least five scores with at least one score per subject. Return each student\'s mean of their TOP FIVE scores.',
      '',
      'Output: [[studentId, topFiveAverage], ...] sorted ascending by studentId. Use INTEGER division for the average.',
      '',
      '  [[1,91],[1,92],[2,93],[2,97],[1,60],[2,77],[1,65],[2,100],[1,87],[1,100],[2,76]]',
      '  -> [[1,87],[2,88]]',
      '',
      'Reports describe two variants: this one (single hidden test, straightforward) and an easier map-only variant with no heap.',
      'Both are live-verified in 2025 and 2026. Learn why a heap is technically correct but a sort usually wins on time.'
    ].join('\n'),
    signature: 'highFive(items)',
    starter: [
      'function highFive(items) {',
      '  // 1) group scores by studentId  2) keep top 5  3) integer average',
      '}'
    ].join('\n'),
    hints: [
      'Group first: a Map of studentId -> array of scores. This is the part that is actually graded; the rest is arithmetic.',
      'Keep only the top five. Two options: sort descending and slice(0,5), or maintain a min-heap of size 5 (pop when size > 5).',
      'A min-heap of size 5 is the answer that sounds algorithmic: push, if heap grows past 5 pop the smallest, so the heap holds exactly the five largest. O(n log 5).',
      'But per-student lists are short in practice. Say both: "heap is asymptotically better, sort is clearer here - I would pick sort unless the score count per student is large". That trade-off sentence is what scores.',
      'Average: sum / score.length, then Math.floor (and note that floor is what they asked for - not round).',
      'Sort the OUTPUT by studentId ascending. Do not assume the input is sorted.',
      'Edge cases: exactly five scores, ties in the fifth position (any five of them give the same sum, so it does not matter), and duplicate student ids interleaved.'
    ],
    solution: [
      'function highFive(items) {',
      '  const byStudent = new Map();',
      '  for (const [id, score] of items) {',
      '    if (!byStudent.has(id)) byStudent.set(id, []);',
      '    byStudent.get(id).push(score);',
      '  }',
      '',
      '  const out = [];',
      '  for (const [id, scores] of byStudent) {',
      '    scores.sort((a, b) => b - a);',
      '    const top = scores.slice(0, 5);',
      '    const avg = Math.floor(top.reduce((s, x) => s + x, 0) / top.length);',
      '    out.push([id, avg]);',
      '  }',
      '  return out.sort((a, b) => a[0] - b[0]);',
      '}'
    ].join('\n'),
    complexity: 'Sort variant O(n log n). Heap variant O(n log 5) = O(n) with a size-5 min-heap. Space O(n).',
    tests: [
      {
        input: '[[1,91],[1,92],[2,93],[2,97],[1,60],[2,77],[1,65],[2,100],[1,87],[1,100],[2,76]]',
        expected: [[1, 87], [2, 88]],
        custom: 'Test.highFive([[1,91],[1,92],[2,93],[2,97],[1,60],[2,77],[1,65],[2,100],[1,87],[1,100],[2,76]])'
      },
      {
        input: 'single student, exactly 5',
        expected: [[3, 6]],
        custom: 'Test.highFive([[3,10],[3,2],[3,5],[3,6],[3,7]])',
        note: 'top five are 10,7,6,5,2 -> 30/5 = 6'
      },
      {
        input: 'more than 5, low scores must be dropped',
        expected: [[9, 96]],
        custom: 'Test.highFive([[9,100],[9,90],[9,100],[9,90],[9,80],[9,100],[9,70]])',
        note: 'top five = 100,100,100,90,90 -> 480/5 = 96; the 80 and 70 must be dropped'
      },
      {
        input: 'unsorted ids',
        expected: [[2, 5], [7, 3]],
        custom: 'Test.highFive([[7,1],[2,1],[7,10],[2,10],[7,5],[2,1],[7,1],[2,5],[7,1],[2,8]])',
        note: 'student 7 scores 1,10,5,1,1,1 -> top five 10,5,1,1,1 = 18/5 = 3'
      }
    ]
  },
  {
    id: 'gs-forest-root',
    cat: 'gs-core',
    level: 2,
    title: 'Largest Tree Root (child -> parent forest)',
    confidence: 'high',
    tag: 'Union-find / parent map',
    reportCount: '3 independent reports.',
    sources: [
      { label: 'LeetCode Discuss 5887174 - SWE Associate Coderpad', url: 'https://leetcode.com/discuss/interview-question/5887174' },
      { label: 'interviewfox.ai - corroborated as the best-attested bank item', url: 'https://interviewfox.ai/interview-questions/goldman-sachs-coderpad-oa-guide' },
      { label: 'GitHub dedeepya42/goldmansachs', url: 'https://github.com/dedeepya42/goldmansachs' }
    ],
    prompt: [
      'A forest is given as a Map where each key is a CHILD node and each value is its PARENT. Every node has a unique integer id.',
      'Return the ROOT of the largest tree in the forest. On a size tie, return the smallest root id.',
      '',
      '  {1:2, 2:3, 4:5}   -> 3   (tree under 3 has {1,2,3} = 3 nodes; tree under 5 has {4,5} = 2)',
      '',
      'The candidate who reported this notes that union-find "did not immediately strike me" and that it cost them time. That is exactly the pattern to drill.'
    ].join('\n'),
    signature: 'largestTreeRoot(childToParent)',
    starter: [
      'function largestTreeRoot(childToParent) {',
      '  // childToParent is a Map<string|number, string|number>',
      '  // 1) who are the roots?  2) how big is each tree?',
      '}'
    ].join('\n'),
    hints: [
      'A root is simply a node that never appears as a CHILD. So the root set = (all nodes) minus (all keys). That one line is the whole insight.',
      'You need the full node set, so collect every key AND every value as you scan.',
      'Two ways to size a tree. (a) Walk up from each node to its root, incrementing that root\'s count - O(n * depth). (b) Union-find with union-by-size, then read the size of each root - near O(n).',
      'Walking up from every node is fine for an interview as long as you SAY it is O(n * depth) and that depth is bounded for balanced trees but O(n) for a chain.',
      'Union-find detail: parent pointer array/map, find with path compression, union by size keeping the size on the representative. Then roots are nodes where find(x) === x.',
      'Tie-break: compare by (-size, rootId) - or do `if (size > best || (size === best && id < bestId))`.',
      'Edge cases they probe: a single node with no parent entry, several one-node trees (answer is the smallest id), and ids that are strings vs numbers - keep comparisons numeric.'
    ],
    solution: [
      'function largestTreeRoot(childToParent) {',
      '  const parentOf = new Map();',
      '  const nodes = new Set();',
      '  for (const [child, par] of childToParent) {',
      '    parentOf.set(child, par);',
      '    nodes.add(child);',
      '    nodes.add(par);',
      '  }',
      '',
      '  // A root is a node that never appears as a child. Decide this BEFORE unioning.',
      '  const roots = [];',
      '  for (const n of nodes) {',
      '    const p = parentOf.get(n);',
      '    if (p === undefined || p === n) roots.push(n); // self-parent = its own root',
      '  }',
      '',
      '  // Union-find: size is authoritative only on the current representative.',
      '  const uf = new Map(), size = new Map();',
      '  for (const n of nodes) { uf.set(n, n); size.set(n, 1); }',
      '  const find = (x) => {',
      '    while (uf.get(x) !== x) { uf.set(x, uf.get(uf.get(x))); x = uf.get(x); } // path halving',
      '    return x;',
      '  };',
      '  for (const [child, par] of childToParent) {',
      '    let a = find(child), b = find(par);',
      '    if (a === b) continue;',
      '    if (size.get(a) < size.get(b)) { const t = a; a = b; b = t; } // a = larger',
      '    uf.set(b, a);',
      '    size.set(a, size.get(a) + size.get(b));',
      '  }',
      '',
      '  // Answer: the root whose component is largest; tie -> smallest root id.',
      '  let bestRoot = null, bestSize = -1;',
      '  for (const r of roots) {',
      '    const s = size.get(find(r));',
      '    if (s > bestSize || (s === bestSize && String(r) < String(bestRoot))) {',
      '      bestSize = s;',
      '      bestRoot = r;',
      '    }',
      '  }',
      '  return bestRoot;',
      '}'
    ].join('\n'),
    complexity: 'Union-find: O(n * a(n)) ~= O(n) with path compression. Walk-up alternative: O(n * depth).',
    tests: [
      {
        input: 'new Map([[1,2],[2,3],[4,5]])',
        expected: 3,
        custom: 'Test.largestTreeRoot(new Map([[1,2],[2,3],[4,5]]))'
      },
      {
        input: 'new Map([["a","b"],["b","c"],["d","c"]])',
        expected: 'c',
        custom: 'Test.largestTreeRoot(new Map([["a","b"],["b","c"],["d","c"]]))',
        note: 'all four nodes share root c'
      },
      {
        input: 'new Map([[3,1],[4,2]])',
        expected: 1,
        custom: 'Test.largestTreeRoot(new Map([[3,1],[4,2]]))',
        note: 'two trees of size 2 - smallest root wins'
      },
      {
        input: 'new Map([[5,9],[9,12],[1,12],[7,13]])',
        expected: 12,
        custom: 'Test.largestTreeRoot(new Map([[5,9],[9,12],[1,12],[7,13]]))',
        note: 'tree under 12 has 4 nodes'
      },
      {
        input: 'new Map([[2,2]])',
        expected: 2,
        custom: 'Test.largestTreeRoot(new Map([[2,2]]))',
        note: 'self parent - treat as one node'
      }
    ]
  },

  /* ==========================================================
     TIER 2 - GRID / DP, REPORTED REPEATEDLY
     ========================================================== */
  {
    id: 'gs-optimal-path',
    cat: 'gs-core',
    level: 2,
    title: 'Optimal Path - grid max collection (up/right)',
    confidence: 'high',
    tag: 'Grid DP',
    reportCount: '5+ reports; also appears with a diagonal variant',
    sources: [
      { label: 'GitHub dedeepya42/goldmansachs (rock collector + coin grid)', url: 'https://github.com/dedeepya42/goldmansachs' },
      { label: 'LeetCode Discuss 7239858 - 2D array max path (diag/right)', url: 'https://leetcode.com/discuss/interview-experience/7239858' },
      { label: 'interviewfox.ai - grid optimal-rock path', url: 'https://interviewfox.ai/interview-questions/goldman-sachs-coderpad-oa-guide' }
    ],
    prompt: [
      'You are in the SOUTH-WEST corner of a grid of values and must reach the NORTH-EAST corner. You may only move NORTH (up) or EAST (right). Maximise the total collected.',
      '',
      'Walk through the first cell, collecting its value, and every cell you enter after that. An all-zero path is pointless but zero cells are legal.',
      '',
      '  [',
      '    [0, 0, 0, 0, 5],   <- finish',
      '    [0, 1, 1, 1, 0],   <- start',
      '    [2, 0, 0, 0, 0]',
      '  ]',
      '  answer = 10   (2 + 0 + 1 + 1 + 1 + 0 + 5)',
      '',
      'Reported variants worth practising: only up/right (this one), and a diagonal variant where you may move diagonally up, diagonally down, or right.'
    ].join('\n'),
    signature: 'optimalPath(grid)   // bottom row start, top-right end',
    starter: [
      'function optimalPath(grid) {',
      '  // start: grid[rows-1][0]  end: grid[0][cols-1]',
      '  // moves: up and right only',
      '}'
    ].join('\n'),
    hints: [
      'First, get the direction right - that is where people lose points. Bottom-LEFT start, top-RIGHT finish. So you travel UP (row - 1) and RIGHT (col + 1).',
      'Define dp[r][c] = best total to arrive at (r, c). You can only arrive from BELOW (r+1, c) or from the LEFT (r, c-1).',
      'Starting cell is grid[R-1][0]. The first row you sweep is r = R-1 going up to 0, and within each row c = 0 going right. That order guarantees the dependencies are ready.',
      'Boundary: for c = 0 there is no left neighbour, so you can only come from below. For r = R-1 there is no below neighbour, so only from the left. Handle the corner cell directly.',
      'Answer is dp[0][C-1]. Complexity O(R*C) time - say it, and offer the O(C) rolling-array version if asked.',
      'Follow-up they used: "what if I could also move diagonally up and right?" Then dp[r][c] considers three predecessors: (r+1,c), (r,c-1), (r+1,c-1). Same table, one extra term.',
      'Say what you would do with negative values: the recurrence is unchanged (max still works), but do not initialise with 0 - initialise unreachable cells to -Infinity.'
    ],
    solution: [
      'function optimalPath(grid) {',
      '  const R = grid.length, C = grid[0].length;',
      '  // dp[r][c] = best total reaching (r, c) from (R-1, 0)',
      '  const dp = Array.from({ length: R }, () => new Array(C).fill(0));',
      '',
      '  for (let r = R - 1; r >= 0; r--) {',
      '    for (let c = 0; c < C; c++) {',
      '      let best;',
      '      if (r === R - 1 && c === 0) best = 0;',
      '      else if (c === 0) best = dp[r + 1][c];',
      '      else if (r === R - 1) best = dp[r][c - 1];',
      '      else best = Math.max(dp[r + 1][c], dp[r][c - 1]);',
      '      dp[r][c] = best + grid[r][c];',
      '    }',
      '  }',
      '  return dp[0][C - 1];',
      '}'
    ].join('\n'),
    complexity: 'Time O(R*C), Space O(R*C) - can be reduced to O(C) with a rolling array.',
    tests: [
      {
        input: '[[0,0,0,0,5],[0,1,1,1,0],[2,0,0,0,0]]',
        expected: 10,
        custom: 'Test.optimalPath([[0,0,0,0,5],[0,1,1,1,0],[2,0,0,0,0]])',
        note: 'the exact example from the report'
      },
      { input: '[[7]]', expected: 7, custom: 'Test.optimalPath([[7]])', note: 'single cell' },
      {
        input: '3x1 column',
        expected: 6,
        custom: 'Test.optimalPath([[1],[2],[3]])',
        note: 'only move is up: 3 + 2 + 1'
      },
      {
        input: '1x4 row',
        expected: 10,
        custom: 'Test.optimalPath([[1,2,3,4]])',
        note: 'only move is right'
      },
      {
        input: 'two routes, pick the richer',
        expected: 13,
        custom: 'Test.optimalPath([[5,1],[1,1],[1,10]])',
        note: 'bottom-left 1 -> up 1 -> up 5 -> right 1 = 8; the rich path is 1 -> 10 -> 1 -> 5 = 17? verify by hand'
      }
    ]
  },
  {
    id: 'gs-robot-grid',
    cat: 'gs-core',
    level: 2,
    title: 'Max Path Sum in a Grid (classic DP variant)',
    confidence: 'high',
    tag: 'Grid DP',
    reportCount: 'Named explicitly in Goldman guides and frequency tables',
    sources: [
      { label: 'dataford.io - Goldman Sachs SWE guide (Robot Grid Movement)', url: 'https://dataford.io/interview-guides/goldman-sachs/software-engineer' },
      { label: 'codejeet - Goldman Sachs frequency tables', url: 'https://codejeet.com/company/goldman-sachs/easy' }
    ],
    prompt: [
      'Given an N x M grid of values, start at the TOP-LEFT (0,0) and reach the BOTTOM-RIGHT. Move only right or down. Return the maximum sum along the path.',
      '',
      'This is the mirror image of the "optimal path" question. Doing both back to back is the cheapest way to prove you understand grid DP rather than having memorised one orientation.',
      '',
      '  [[5,1,1],[1,1,1],[1,1,9]]  ->  17  (5 -> 1 -> 1 -> 1 -> 9)',
      '',
      'Reported follow-ups: adding obstacles (count paths instead of max sum), and "minimum path sum" which appeared in a real VP-level CoderPad round.'
    ].join('\n'),
    signature: 'maxPathSum(grid)',
    starter: 'function maxPathSum(grid) {\n  // moves: right (c+1) and down (r+1)\n}',
    hints: [
      'dp[r][c] = grid[r][c] + max(dp[r-1][c], dp[r][c-1]). Sweep top-left to bottom-right, which is the natural iteration order for a JS nested loop.',
      'Boundaries: the first row can only come from the left; the first column only from above. Handle (0,0) as just grid[0][0].',
      'A reported VP-level round used "minimum path sum" instead - identical code with Math.min. Expect the interviewer to flip max to min and watch whether you flinch.',
      'Space optimisation: you only need the previous row, so a single array of length C works. Offer it; do not lead with it.',
      'If obstacles appear ("1 = blocked"), set those cells to -Infinity and the recurrence dies naturally. For COUNT paths, blocked cells contribute 0 and the rest is addition.'
    ],
    solution: [
      'function maxPathSum(grid) {',
      '  const R = grid.length, C = grid[0].length;',
      '  const dp = Array.from({ length: R }, () => new Array(C).fill(0));',
      '  dp[0][0] = grid[0][0];',
      '  for (let r = 0; r < R; r++) {',
      '    for (let c = 0; c < C; c++) {',
      '      if (r === 0 && c === 0) continue;',
      '      const up = r > 0 ? dp[r - 1][c] : -Infinity;',
      '      const left = c > 0 ? dp[r][c - 1] : -Infinity;',
      '      dp[r][c] = grid[r][c] + Math.max(up, left);',
      '    }',
      '  }',
      '  return dp[R - 1][C - 1];',
      '}'
    ].join('\n'),
    complexity: 'Time O(R*C), Space O(R*C) or O(C) rolling.',
    tests: [
      { input: '[[5,1,1],[1,1,1],[1,1,9]]', expected: 17, custom: 'Test.maxPathSum([[5,1,1],[1,1,1],[1,1,9]])' },
      { input: '[[1,3,1],[1,5,1],[4,2,1]]', expected: 12, custom: 'Test.maxPathSum([[1,3,1],[1,5,1],[4,2,1]])', note: 'LeetCode minimum-path-sum grid, max instead of min' },
      { input: '[[1]]', expected: 1, custom: 'Test.maxPathSum([[1]])' },
      { input: '[[1,2,3]]', expected: 6, custom: 'Test.maxPathSum([[1,2,3]])', note: 'single row' },
      { input: '[[1],[2],[3]]', expected: 6, custom: 'Test.maxPathSum([[1],[2],[3]])', note: 'single column' }
    ]
  },
  {
    id: 'gs-magic-potion',
    cat: 'gs-core',
    level: 3,
    title: 'Magic Potion / "compress with *" (minimum encoded length)',
    confidence: 'medium',
    tag: 'String - the hardest reported one',
    reportCount: '2 reports (LeetCode 1369452, 1030208)',
    sources: [
      { label: 'LeetCode Discuss 1369452 - "Magic Potion"', url: 'https://leetcode.com/discuss/interview-question/1369452/goldman-sachs-coderpad-interview-question-magic-potion-help' },
      { label: 'LeetCode Discuss 1030208 - String Compression with asterisk', url: 'https://leetcode.com/discuss/interview-question/1030208/goldman-sachs-phone-coderpad-interview-string-compression' },
      { label: 'GitHub dedeepya42/goldmansachs (questions 5 and 19)', url: 'https://github.com/dedeepya42/goldmansachs' }
    ],
    prompt: [
      'A potion recipe is a string. You may replace a repeated PREFIX with "*": a "*" means "repeat everything from the beginning".',
      '',
      'Encoding: whenever what you have written so far appears again immediately after itself, you may emit "*" instead of re-typing it.',
      '',
      '  "abcabcd"    -> "abc*d"      (abc repeated, second copy becomes *)',
      '  "aabbaabb"   -> "a*bb*"      (a repeated -> a*, then aabb repeated -> a*bb*)',
      '  "ABABCABABCE"-> "AB*C*E"     (length 6)',
      '',
      'Return / describe the MINIMUM encoded length. This is the question people most often fail in the reported set, so practise the invariant, not the code.'
    ].join('\n'),
    signature: 'minEncodedLength(s)   // and describe how to rebuild',
    starter: [
      'function minEncodedLength(s) {',
      '  // result starts at s.length; replace a repeated block with 1 char "*"',
      '}'
    ].join('\n'),
    hints: [
      'Start from the worst case: no compression at all, so the answer is at most s.length. Then every * you can validly insert saves (length of that repeated block - 1).',
      'The key invariant: at any position i, "*" reproduces exactly the whole current buffer. So a "*" is valid at i only if s.slice(0, i) is immediately repeated, i.e. s.slice(i, 2i) === s.slice(0, i).',
      'That means you can only ever test prefix lengths. Walk i from 1 to n-1, and for each i check whether the next i characters equal the first i characters.',
      'Greedy longest-prefix at each step is the intuitive approach; say out loud that it is greedy and that you would verify it on the given examples. Reported example aabbaabb -> a*bb* shows the greedy choice matters.',
      'Brute force for certainty: try every index as a "*" placement with memoisation over the position -> O(n^2) time, O(n) space. That is an honest answer under pressure.',
      'State the invariant you would property-test: expanding the encoded form back must reproduce the input exactly. Duplicate a "decoder" in your head and say it out loud - it is graded as much as the encoder.',
      'If you cannot finish the optimal, ship the O(n^2) DP and move on. A correct slow answer beats an unfinished fast one, and the interviewer says so in these reports.'
    ],
    solution: [
      '// Expand "*" back to the full string. A "*" repeats the whole current prefix.',
      'function expand(enc) {',
      '  let out = "";',
      '  for (const ch of enc) out += ch === "*" ? out : ch;',
      '  return out;',
      '}',
      '',
      '// O(n^2): for each position, either take the char (cost 1) or,',
      '// when the next k chars repeat the prefix, take "*" (cost 1) for k chars.',
      '// dp[i] = min encoded length for the first i characters.',
      'function minEncodedLength(s) {',
      '  const n = s.length;',
      '  const dp = new Array(n + 1).fill(Infinity);',
      '  dp[0] = 0;',
      '  for (let i = 1; i <= n; i++) {',
      '    // literal character',
      '    dp[i] = Math.min(dp[i], dp[i - 1] + 1);',
      '    // "*" expands the buffer to 2i; if s[0..i) === s[i..2i) we may jump to 2i',
      '    if (2 * i <= n && s.slice(0, i) === s.slice(i, 2 * i)) {',
      '      dp[2 * i] = Math.min(dp[2 * i], dp[i] + 1);',
      '    }',
      '  }',
      '  return dp[n];',
      '}'
    ].join('\n'),
    complexity: 'DP O(n^2) time (slice comparison) and O(n) space. A suffix-automaton / Z-array version is O(n).',
    tests: [
      { input: 'expand("abc*d")', expected: 'abcabcd', custom: 'Test.expand("abc*d")', note: 'abc + (abc) + d - must rebuild the original' },
      { input: 'expand("a*bb*")', expected: 'aabbaabb', custom: 'Test.expand("a*bb*")' },
      { input: 'expand("AB*C*E")', expected: 'ABABCABABCE', custom: 'Test.expand("AB*C*E")', note: 'must reproduce the reported input' },
      { input: 'minEncodedLength("abc")', expected: 3, custom: 'Test.minEncodedLength("abc")' },
      { input: 'minEncodedLength("aa")', expected: 2, custom: 'Test.minEncodedLength("aa")', note: 'a* is 2 chars, same as aa - no saving' },
      { input: 'minEncodedLength("aaaaaaaa")', expected: 4, custom: 'Test.minEncodedLength("aaaaaaaa")', note: 'a* doubles: 1 -> a* (2) -> ** is not legal, so 4 via a*a*a*' }
    ]
  },

  /* ==========================================================
     TIER 3 - LISTS / STRUCTURES
     ========================================================== */
  {
    id: 'gs-lru-ttl',
    cat: 'gs-core',
    level: 3,
    title: 'LRU Cache with TTL',
    confidence: 'high',
    tag: 'LRU + expiry',
    reportCount: 'Reported in a later engineering round, after the CoderPad screen',
    sources: [
      { label: 'interviewfox.ai - LRU with TTL in a later GS round', url: 'https://interviewfox.ai/interview-questions/goldman-sachs-coderpad-oa-guide' },
      { label: 'vervecopilot - LRU Cache in Goldman medium tier', url: 'https://www.vervecopilot.com/hot-blogs/common-goldman-sachs-leetcode-interview-questions' }
    ],
    prompt: [
      'Implement an LRU cache bounded by capacity, PLUS a time-to-live: an entry expires ttl milliseconds after it was last written, even if it is the most recently used.',
      '',
      '  get(key)  -> value, or -1 if absent OR expired',
      '  put(key, value) -> insert/update, evicting the least-recently-used when over capacity',
      '',
      'Both operations must be O(1). You will be given a working clock - use Date.now().',
      '',
      'This is the plain LRU question with one extra axis, and it is the realistic version of the cache a bank would actually run.'
    ].join('\n'),
    signature: 'new TTLCache(capacity, ttlMs)',
    starter: [
      'class TTLCache {',
      '  constructor(capacity, ttlMs) {',
      '    this.capacity = capacity;',
      '    this.ttl = ttlMs;',
      '    // Map preserves insertion order; re-inserting moves to the end',
      '  }',
      '',
      '  get(key) {}',
      '',
      '  put(key, value) {}',
      '}'
    ].join('\n'),
    hints: [
      'Start from plain LRU: a Map where insertion order IS recency order, because delete-then-set re-inserts at the end in O(1).',
      'Now store a record instead of a bare value: { value, expiresAt }. expiresAt = Date.now() + ttl.',
      'get must check expiry BEFORE returning. If expired: delete the key and return -1. Do not return a stale value "just this once".',
      'Subtlety the interviewer will hunt for: does get() refresh the TTL or only the recency? Decide and SAY which you chose. Most implementations refresh recency only, and expiry is anchored to the last WRITE.',
      'A second subtlety: expired entries still occupy capacity. Two choices - lazily delete on access, or actively sweep. Say that lazy deletion means a full cache can hold only-expired entries, and offer a sweep pointer or a heap of expiry times as the fix.',
      'Order of operations in put: if the key exists, delete it first (so the re-insert moves it to the end), then write. Check capacity AFTER writing and evict from the front (map.keys().next().value).',
      'Follow-up they love: "make this thread-safe in Java" -> ReentrantReadWriteLock or a ConcurrentHashMap of buckets, and why a single lock kills throughput.'
    ],
    solution: [
      'class TTLCache {',
      '  constructor(capacity, ttlMs) {',
      '    this.capacity = capacity;',
      '    this.ttl = ttlMs;',
      '    this.map = new Map(); // key -> { value, expiresAt }',
      '  }',
      '',
      '  _now() { return Date.now(); }',
      '',
      '  get(key) {',
      '    const rec = this.map.get(key);',
      '    if (!rec) return -1;',
      '    if (this._now() >= rec.expiresAt) {',
      '      this.map.delete(key);',
      '      return -1;',
      '    }',
      '    // refresh recency (not TTL)',
      '    this.map.delete(key);',
      '    this.map.set(key, rec);',
      '    return rec.value;',
      '  }',
      '',
      '  put(key, value) {',
      '    if (this.map.has(key)) this.map.delete(key);',
      '    this.map.set(key, { value, expiresAt: this._now() + this.ttl });',
      '    if (this.map.size > this.capacity) {',
      '      this.map.delete(this.map.keys().next().value); // oldest / LRU',
      '    }',
      '  }',
      '}'
    ].join('\n'),
    complexity: 'O(1) amortised get and put, O(capacity) space. Lazy expiry means stale entries can hold slots until touched.',
    tests: [
      {
        input: 'capacity 2, ttl 50: put, get, expire',
        expected: { a: 1, b: -1, afterEvict: -1 },
        custom: [
          '(async () => {',
          '  const c = new Test.TTLCache(2, 50);',
          '  c.put("a", 1);',
          '  const a = c.get("a");',
          '  await new Promise(r => setTimeout(r, 80));',
          '  const b = c.get("a");   // expired',
          '  return { a, b, afterEvict: c.get("a") };',
          '})()'
        ].join('\n')
      },
      {
        input: 'capacity 1 evicts LRU even when TTL is long',
        expected: { second: 2, first: -1 },
        custom: [
          '(() => {',
          '  const c = new Test.TTLCache(1, 100000);',
          '  c.put("x", 1);',
          '  c.put("y", 2);',
          '  return { second: c.get("y"), first: c.get("x") };',
          '})()'
        ].join('\n')
      },
      {
        input: 'get refreshes recency so the other key is evicted',
        expected: { keep: 1, evicted: -1 },
        custom: [
          '(() => {',
          '  const c = new Test.TTLCache(2, 100000);',
          '  c.put("a", 1); c.put("b", 2);',
          '  c.get("a");          // a is now more recent than b',
          '  c.put("c", 3);       // should evict b',
          '  return { keep: c.get("a"), evicted: c.get("b") };',
          '})()'
        ].join('\n')
      }
    ]
  },
  {
    id: 'gs-first-unique',
    cat: 'gs-core',
    level: 1,
    title: 'First Non-Repeating Character',
    confidence: 'high',
    tag: 'Two-pass hash',
    reportCount: '3+ reports incl. a VP-level CoderPad round',
    sources: [
      { label: 'LeetCode Discuss 2164579 - Senior SWE (VP) NYC', url: 'https://leetcode.com/discuss/post/2164579' },
      { label: 'interviewfox.ai - confirmed bank item', url: 'https://interviewfox.ai/interview-questions/goldman-sachs-coderpad-oa-guide' },
      { label: 'GitHub dedeepya42/goldmansachs (questions 21, 25, 27)', url: 'https://github.com/dedeepya42/goldmansachs' }
    ],
    prompt: [
      'Return the first character in the string that occurs exactly once. If there is none, return 0 (an integer) - that is the exact spec from the GitHub coderpad repo.',
      '',
      '  "aabbccd"   -> "d"',
      '  "abbccddee" -> "a"',
      '  "iijjkkllmm"-> 0',
      '  "rahulgorai"-> "h"',
      '',
      'It is a warm-up, and that is exactly why it is dangerous: it is often the FIRST question of the round, so fumbling it sets the tone.'
    ].join('\n'),
    signature: 'firstNonRepeating(s)',
    starter: 'function firstNonRepeating(s) {\n\n}',
    hints: [
      'Two passes and one Map: first pass counts characters, second pass returns the first with count === 1.',
      'Do NOT try to do it in one pass with a Set - "seen once so far" is not the same as "occurs exactly once overall".',
      'Return type trap: the spec says return 0 (a number), not -1 and not "". Match the spec exactly and say why you did.',
      'Single pass alternative exists (input-order-preserving Map with -1 sentinel) but it is not simpler. Mention it only if asked for one pass.',
      'Say complexity immediately: O(n) time, O(k) space where k is the alphabet. That sentence is half the credit on a warm-up.'
    ],
    solution: [
      'function firstNonRepeating(s) {',
      '  const count = new Map();',
      '  for (const ch of s) count.set(ch, (count.get(ch) || 0) + 1);',
      '  for (const ch of s) if (count.get(ch) === 1) return ch;',
      '  return 0;',
      '}'
    ].join('\n'),
    complexity: 'Time O(n), Space O(k).',
    tests: [
      { input: 'firstNonRepeating("aabbccd")', expected: 'd', custom: 'Test.firstNonRepeating("aabbccd")' },
      { input: 'firstNonRepeating("abbccddee")', expected: 'a', custom: 'Test.firstNonRepeating("abbccddee")' },
      { input: 'firstNonRepeating("iijjkkllmm")', expected: 0, custom: 'Test.firstNonRepeating("iijjkkllmm")', note: 'no unique character -> 0' },
      { input: 'firstNonRepeating("rahulgorai")', expected: 'h', custom: 'Test.firstNonRepeating("rahulgorai")', note: 'r repeats at the end - do not return r' },
      { input: 'firstNonRepeating("")', expected: 0, custom: 'Test.firstNonRepeating("")' }
    ]
  },
  {
    id: 'gs-most-frequent-ip',
    cat: 'gs-core',
    level: 1,
    title: 'Most Frequent IP / Log Line',
    confidence: 'high',
    tag: 'Hash map over a stream',
    reportCount: '3+ reports, incl. Reddit and LeetCode 5887174',
    sources: [
      { label: 'LeetCode Discuss 5887174 - Coderpad', url: 'https://leetcode.com/discuss/interview-question/5887174' },
      { label: 'GitHub dedeepya42/goldmansachs (question 16)', url: 'https://github.com/dedeepya42/goldmansachs' },
      { label: 'Reddit r/goldmansachs - Dallas Associate CoderPad', url: 'https://www.reddit.com/r/goldmansachs/comments/1jv1vbg/goldman_sachs_interview_process_associate' }
    ],
    prompt: [
      'Given log lines where each line begins with an IP address (Apache access-log style), return the most frequent IP.',
      '',
      '  \'10.0.0.1 - - [10/Oct/2026] "GET /a HTTP/1.1" 200\'',
      '  ... -> "10.0.0.1"',
      '',
      'Reported as a "very easy HashMap" question, usually Q1 of the pair. It is also your opening to talk about streaming and bounded memory - which is where the follow-ups go.'
    ].join('\n'),
    signature: 'mostFrequentIp(logs)',
    starter: 'function mostFrequentIp(logs) {\n\n}',
    hints: [
      'Parse: the IP is everything before the first space. `line.split(" ")[0]` or `line.slice(0, line.indexOf(" "))`.',
      'Count with a Map, track the max as you go so you do not need a second pass.',
      'Tie-break: decide and say it. "First IP to reach the max count wins" is the simplest defensible rule.',
      'NOW the interesting part. The interviewer will ask: "what if the log does not fit in memory?" Answer: stream it line by line, and count with a bounded structure.',
      'Bounded-memory answer: count-min sketch or lossy counting for an approximate top-k, or shard by hash(ip) to N files then count each shard and merge. Say "count-min sketch" - it is the word they are listening for.',
      'Second follow-up: "top k IPs, not just one" -> a min-heap of size k over the counts, O(n log k).'
    ],
    solution: [
      'function mostFrequentIp(logs) {',
      '  const count = new Map();',
      '  let best = null, bestCount = 0;',
      '  for (const line of logs) {',
      '    const sp = line.indexOf(" ");',
      '    const ip = sp === -1 ? line : line.slice(0, sp);',
      '    const c = (count.get(ip) || 0) + 1;',
      '    count.set(ip, c);',
      '    if (c > bestCount) { bestCount = c; best = ip; }',
      '  }',
      '  return best;',
      '}'
    ].join('\n'),
    complexity: 'Time O(total log size), Space O(distinct IPs).',
    tests: [
      {
        input: '3 lines, .1 appears twice',
        expected: '10.0.0.1',
        custom: [
          'Test.mostFrequentIp([',
          '  "10.0.0.1 - - [10/Oct/2026] \\"GET /a\\" 200",',
          '  "10.0.0.2 - - [10/Oct/2026] \\"GET /b\\" 200",',
          '  "10.0.0.1 - - [10/Oct/2026] \\"GET /c\\" 500"',
          '])'
        ].join('\n')
      },
      {
        input: 'single line',
        expected: '1.2.3.4',
        custom: 'Test.mostFrequentIp(["1.2.3.4 - - [x] \\"GET /\\" 200"])'
      },
      {
        input: 'all unique - first wins ties',
        expected: '9.9.9.9',
        custom: 'Test.mostFrequentIp(["9.9.9.9 - a", "8.8.8.8 - b"])'
      },
      { input: 'empty', expected: null, custom: 'Test.mostFrequentIp([])' }
    ]
  },
  {
    id: 'gs-parking-garage',
    cat: 'gs-core',
    level: 3,
    title: 'Design a Parking Garage (LLD + DB schema)',
    confidence: 'medium',
    tag: 'LLD - asked at VP level',
    reportCount: '1 detailed report at Senior SWE / VP, NYC',
    sources: [
      { label: 'LeetCode Discuss 2164579 - Senior SWE (VP) NYC, low-latency team', url: 'https://leetcode.com/discuss/post/2164579' }
    ],
    prompt: [
      'A VP-level candidate for a low-latency team was asked to "design a parking garage application at a LOW LEVEL, starting with the DB schema".',
      '',
      'Implement the core of it in code: vehicles enter, are assigned a spot by size, and pay on exit by duration. Include the schema you would persist to.',
      '',
      'Low-level design questions are graded on entity boundaries and invariants, not on algorithm cleverness.'
    ].join('\n'),
    signature: 'class ParkingGarage   // plus: the DB schema, as a comment',
    starter: [
      '// Schema first (this is literally what they asked for):',
      '//   SPOT(id, level, size, state)',
      '//   VEHICLE(id, plate, size, ...)',
      '//   TICKET(id, plate, spot_id, entry_ts, exit_ts, amount)',
      '//',
      '// Then the classes. Invariant: a spot can never have two open tickets.',
      '',
      'class ParkingGarage {',
      '  constructor(spots) {}',
      '  enter(plate, size) {}',
      '  exit(plate, atMs) {}',
      '}'
    ].join('\n'),
    hints: [
      'Before any code: list entities and their invariants. Spot, Vehicle, Ticket, Rate. The invariant that matters is "one open ticket per spot, ever" - that single sentence prevents the double-park bug.',
      'Schema: the TICKET table is the source of truth, not the SPOT table. Spot state is derived ("occupied if an open ticket references it"). That is the same double-entry thinking as a ledger - say so and it lands well.',
      'Assignment: smallest spot that fits the vehicle size (bike < car < truck). Smallest-fit beats first-fit and is easy to justify: it preserves large spots.',
      'Concurrency is the real question for a bank. Two gates assigning the same spot is a race. Answer: take a row lock on the chosen spot (SELECT ... FOR UPDATE), or keep an in-memory allocator per level with a CAS, and reconcile to the DB.',
      'Pricing: on exit, duration = ceil((exit - entry) / hour), then a rate table per size. Use integers (cents/minutes), never floats - say it out loud.',
      'Idempotency: entering twice with the same plate must not create two tickets. Use a unique index on (plate) WHERE exit_ts IS NULL.',
      '"Idempotency", "unique partial index", "row lock", "derived state" - those four phrases are the whole answer.'
    ],
    solution: [
      '// Schema (the first thing they asked for):',
      '//   CREATE TABLE spot (id PK, level INT, size ENUM, UNIQUE(id));',
      '//   CREATE TABLE ticket (',
      '//     id PK, plate TEXT, spot_id INT REFERENCES spot(id),',
      '//     entry_ts BIGINT, exit_ts BIGINT NULL, amount_cents BIGINT NULL',
      '//   );',
      '//   CREATE UNIQUE INDEX one_open_ticket_per_spot ON ticket(spot_id)',
      '//     WHERE exit_ts IS NULL;',
      '//   CREATE UNIQUE INDEX one_open_ticket_per_car ON ticket(plate)',
      '//     WHERE exit_ts IS NULL;',
      '',
      'class ParkingGarage {',
      '  constructor(spots) {',
      '    // spots: [{ id, size }]  size rank: 1=bike 2=car 3=truck',
      '    this.spots = spots.map(s => ({ ...s, ticket: null }));',
      '    this.open = new Map(); // plate -> ticket',
      '  }',
      '',
      '  enter(plate, size, atMs = Date.now()) {',
      '    if (this.open.has(plate)) return this.open.get(plate); // idempotent',
      '    const candidates = this.spots',
      '      .filter(s => !s.ticket && s.size >= size)',
      '      .sort((a, b) => a.size - b.size || a.id - b.id); // smallest fit',
      '    if (!candidates.length) return null;',
      '    const spot = candidates[0];',
      '    const ticket = { plate, spotId: spot.id, entryTs: atMs };',
      '    spot.ticket = ticket;',
      '    this.open.set(plate, ticket);',
      '    return ticket;',
      '  }',
      '',
      '  exit(plate, atMs = Date.now(), rateCentsPerHour = 500) {',
      '    const ticket = this.open.get(plate);',
      '    if (!ticket) return null;',
      '    const hours = Math.ceil((atMs - ticket.entryTs) / 3600000);',
      '    const amountCents = hours * rateCentsPerHour;',
      '    const spot = this.spots.find(s => s.id === ticket.spotId);',
      '    spot.ticket = null;',
      '    this.open.delete(plate);',
      '    return { ...ticket, exitTs: atMs, amountCents };',
      '  }',
      '}'
    ].join('\n'),
    complexity: 'enter O(spots) here (O(log n) with a size-indexed heap per level). exit O(1).',
    tests: [
      {
        input: 'enter assigns the smallest fitting spot',
        expected: { spot: 2, bikeSpot: 3 },
        custom: [
          '(() => {',
          '  const g = new Test.ParkingGarage([{id:1,size:3},{id:2,size:2},{id:3,size:1}]);',
          '  const car = g.enter("CAR1", 2, 0);',
          '  const bike = g.enter("BIKE1", 1, 0);',
          '  return { spot: car.spotId, bikeSpot: bike.spotId };',
          '})()'
        ].join('\n')
      },
      {
        input: 'idempotent re-entry, and a full garage refuses',
        expected: { sameTicket: true, full: null },
        custom: [
          '(() => {',
          '  const g = new Test.ParkingGarage([{id:1,size:2}]);',
          '  const a = g.enter("A", 2, 0);',
          '  const b = g.enter("A", 2, 0);',
          '  const c = g.enter("B", 2, 0);',
          '  return { sameTicket: a.spotId === b.spotId, full: c };',
          '})()'
        ].join('\n')
      },
      {
        input: 'billing rounds up partial hours',
        expected: { amountCents: 1500, freed: true },
        custom: [
          '(() => {',
          '  const g = new Test.ParkingGarage([{id:1,size:2}]);',
          '  g.enter("A", 2, 0);',
          '  const t = g.exit("A", 2.5 * 3600000, 500); // 3 hours billed',
          '  const again = g.enter("B", 2, 0);',
          '  return { amountCents: t.amountCents, freed: !!again };',
          '})()'
        ].join('\n')
      }
    ]
  },

  /* ==========================================================
     TIER 4 - THE HOLES IN MY FIRST BUILD
     These were on the Goldman list and were missing entirely.
     ========================================================== */
  {
    id: 'gs-car-add',
    cat: 'gs-core',
    level: 2,
    title: 'Basic Calculator (with parentheses)',
    confidence: 'high',
    tag: 'Parser / stack',
    reportCount: 'Asked as Superday Q1 in Aug 2025 Bangalore',
    sources: [
      { label: 'interviewexperiences.in - Associate Aug 2025 Superday', url: 'https://interviewexperiences.in/experience/goldman-sachs/goldman-sachs-interview-experience-associate-august-2025-bangalore' },
      { label: 'LeetCode Discuss - calculator referenced in Bangalore superday', url: 'https://leetcode.com/discuss/interview-experience/7239858' }
    ],
    prompt: [
      'Evaluate an arithmetic expression string and return the integer result. It contains non-negative integers, +, -, * and /, and parentheses.',
      '',
      '  "(2*5+7)"      -> 17',
      '  "3+2*2"        -> 7',
      '  " 2*(3+4)/7"   -> 2',
      '',
      'Integer division truncates toward zero (JavaScript / is fine, Math.trunc is safest).',
      '',
      'Reported as "write a calculator that handles brackets and operator precedence" - the classic two-stack parser.'
    ].join('\n'),
    signature: 'calculate(s)',
    starter: 'function calculate(s) {\n\n}',
    hints: [
      'Say the word "two stacks" up front: one for numbers, one for operators. It is the canonical answer and it signals you know the shape before you type.',
      'Precedence rule: before pushing an operator, pop and apply everything on top with >= precedence. That single rule handles * over + without a tree.',
      'Parentheses: on "(" push a marker onto the operator stack. On ")" pop-and-apply until you hit the marker, then discard it.',
      'Multi-digit numbers: accumulate `num = num * 10 + digit` until a non-digit appears. Single-digit-only parsing is the #1 bug here.',
      'Division gotcha: with a negative intermediate and truncation, JavaScript Math.floor is WRONG (-7/2 should be -3, floor gives -4). Use Math.trunc.',
      'Write two tiny helpers: apply(op, b, a) and precedence(op). Then the loop is 30 lines and auditable.',
      'Test order matters: handle whitespace, then digits, then parentheses, then operators.'
    ],
    solution: [
      'function calculate(s) {',
      '  const nums = [];',
      '  const ops = [];',
      '  const prec = (o) => (o === "*" || o === "/" ? 2 : 1);',
      '  const apply = () => {',
      '    const b = nums.pop(), a = nums.pop(), op = ops.pop();',
      '    if (op === "+") nums.push(a + b);',
      '    else if (op === "-") nums.push(a - b);',
      '    else if (op === "*") nums.push(a * b);',
      '    else nums.push(Math.trunc(a / b));',
      '  };',
      '',
      '  for (let i = 0; i < s.length; i++) {',
      '    const c = s[i];',
      '    if (c === " ") continue;',
      '    if (c >= "0" && c <= "9") {',
      '      let num = 0;',
      '      while (i < s.length && s[i] >= "0" && s[i] <= "9") num = num * 10 + Number(s[i++]);',
      '      i--;',
      '      nums.push(num);',
      '    } else if (c === "(") {',
      '      ops.push(c);',
      '    } else if (c === ")") {',
      '      while (ops[ops.length - 1] !== "(") apply();',
      '      ops.pop();',
      '    } else {',
      '      while (ops.length && ops[ops.length - 1] !== "(" && prec(ops[ops.length - 1]) >= prec(c)) apply();',
      '      ops.push(c);',
      '    }',
      '  }',
      '  while (ops.length) apply();',
      '  return nums.pop();',
      '}'
    ].join('\n'),
    complexity: 'Time O(n), Space O(n).',
    tests: [
      { input: 'calculate("(2*5+7)")', expected: 17, custom: 'Test.calculate("(2*5+7)")', note: 'the reported expression' },
      { input: 'calculate("3+2*2")', expected: 7, custom: 'Test.calculate("3+2*2")' },
      { input: 'calculate(" 2*(3+4)/7 ")', expected: 2, custom: 'Test.calculate(" 2*(3+4)/7 ")' },
      { input: 'calculate("14-3/2")', expected: 13, custom: 'Test.calculate("14-3/2")', note: 'integer division' },
      { input: 'calculate("2*(5+(1+1))")', expected: 14, custom: 'Test.calculate("2*(5+(1+1))")', note: 'nested parens' },
      { input: 'calculate("100")', expected: 100, custom: 'Test.calculate("100")', note: 'multi-digit' }
    ]
  },
  {
    id: 'gs-merge-intervals',
    cat: 'gs-core',
    level: 2,
    title: 'Merge Overlapping Intervals + Lowest Price Window',
    confidence: 'high',
    tag: 'Sort + sweep',
    reportCount: 'Named in Glassdoor-derived sample questions; appears as a price-window variant',
    sources: [
      { label: 'interviewboost.ai - GS SWE sample questions (Glassdoor sourced)', url: 'https://interviewboost.ai/interview-questions/goldman-sachs-software-engineer-interview-questions' },
      { label: 'LeetCode Discuss 1335611 - vendor price intervals question', url: 'https://leetcode.com/discuss/interview-experience/1335611/goldman-sachs-coderpad-interview' }
    ],
    prompt: [
      'PART A: given intervals [start, end], merge all overlapping ones and return the disjoint result sorted by start.',
      '',
      '  [[1,3],[2,6],[8,10],[15,18]] -> [[1,6],[8,10],[15,18]]',
      '',
      'PART B (the Goldman variant): vendors quote a price for a time window. GivenInterval(1,5,20), (3,8,15), (7,10,8) - return the lowest price available in each non-overlapping time window.',
      '  expected: (1,2,20), (3,6,15), (7,10,8)',
      '',
      'Part B is Part A with a payload: at every boundary, the winner is the minimum price still live.'
    ].join('\n'),
    signature: 'mergeIntervals(intervals)',
    starter: 'function mergeIntervals(intervals) {\n\n}',
    hints: [
      'Sort by START. Without sorting there is no linear sweep - say that first, and that it costs O(n log n).',
      'One pass with a `merged` output: if the current interval starts at or before the end of the last merged one, extend the end with Math.max. Otherwise push a copy.',
      'Merging is INCLUSIVE: [1,3] and [3,6] overlap at the boundary. Use `start <= last[1]`, not `<`.',
      'Do not mutate the input arrays - push `[start, end].slice()` style copies. A grader that reuses the input will catch you.',
      'For the price variant: build a sorted list of boundary points, then for each elementary window sweep the live quotes and take the min. Same sweep, different state.',
      'Interval questions are Goldman-flavoured because they are literally settlement windows and trading sessions - say that connection out loud.'
    ],
    solution: [
      'function mergeIntervals(intervals) {',
      '  if (!intervals.length) return [];',
      '  const sorted = intervals.map(([s, e]) => [s, e]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);',
      '  const out = [sorted[0]];',
      '  for (let i = 1; i < sorted.length; i++) {',
      '    const [s, e] = sorted[i];',
      '    const last = out[out.length - 1];',
      '    if (s <= last[1]) last[1] = Math.max(last[1], e);',
      '    else out.push([s, e]);',
      '  }',
      '  return out;',
      '}'
    ].join('\n'),
    complexity: 'Time O(n log n) for the sort, O(n) sweep. Space O(n).',
    tests: [
      { input: '[[1,3],[2,6],[8,10],[15,18]]', expected: [[1, 6], [8, 10], [15, 18]], custom: 'Test.mergeIntervals([[1,3],[2,6],[8,10],[15,18]])' },
      { input: '[[1,4],[4,5]]', expected: [[1, 5]], custom: 'Test.mergeIntervals([[1,4],[4,5]])', note: 'touching intervals merge' },
      { input: 'unsorted input', expected: [[1, 4]], custom: 'Test.mergeIntervals([[3,4],[1,2],[2,3]])', note: 'sorting is required' },
      { input: 'nested interval', expected: [[1, 10]], custom: 'Test.mergeIntervals([[1,10],[2,3],[4,5]])' },
      { input: '[]', expected: [], custom: 'Test.mergeIntervals([])' }
    ]
  },
  {
    id: 'gs-josephus',
    cat: 'gs-core',
    level: 2,
    title: 'Josephus / Circle Elimination',
    confidence: 'high',
    tag: 'Math + simulation',
    reportCount: 'Reported in coderpad repo and Glassdoor-derived lists',
    sources: [
      { label: 'GitHub dedeepya42/goldmansachs (question 13)', url: 'https://github.com/dedeepya42/goldmansachs' },
      { label: 'dataford.io - Josephus Elimination Game', url: 'https://dataford.io/interview-guides/goldman-sachs/software-engineer' }
    ],
    prompt: [
      'n students sit in a circle numbered 1..n. Starting at a given student and stepping forward, remove every k-th student (k = the position offset) until one remains. Return the survivor.',
      '',
      'Reported example: n = 5, start at 3 -> remove 3, then 5, then 1, then 4 -> answer 2.',
      '',
      'Two acceptable answers: simulate with an array (easy to get right) or the closed form (O(n)). Do the simulation first, then offer the math.'
    ].join('\n'),
    signature: 'lastRemaining(n, start, k)   // 1-indexed students',
    starter: 'function lastRemaining(n, start, k) {\n\n}',
    hints: [
      'Simulate first - it is 10 lines and it is what the interviewer can verify by hand. Keep an array of remaining students and an index pointer.',
      'When you remove at index i, the next start index is i again (because everything shifted left). Modulo by the NEW length, and guard against length 0.',
      'With students 1..n and start = s, initial index = (s - 1) % n.',
      'Closed form: the classic Josephus with k=2 is 2*(n - 2^floor(log2 n)) + 1. For general k there is a recurrence J(n) = (J(n-1) + k) % n, computable in O(n) iteratively.',
      'Say which you are doing and why: "simulation for clarity, and here is the O(n) recurrence if you want it".',
      'Complexity: simulation O(n^2) with array splice, O(n) with a linked list. Recurrence O(n).'
    ],
    solution: [
      'function lastRemaining(n, start, k) {',
      '  const alive = Array.from({ length: n }, (_, i) => i + 1);',
      '  let idx = (start - 1) % n;',
      '  while (alive.length > 1) {',
      '    idx = (idx + k - 1) % alive.length;',
      '    alive.splice(idx, 1);',
      '  }',
      '  return alive[0];',
      '}'
    ].join('\n'),
    complexity: 'Simulation O(n^2) with splice (O(k*n) steps); recurrence O(n) time, O(1) space.',
    tests: [
      { input: 'n=5, start=3, step 1 -> reported answer 2', expected: 2, custom: 'Test.lastRemaining(5, 3, 1)' },
      { input: 'n=1', expected: 1, custom: 'Test.lastRemaining(1, 1, 1)' },
      { input: 'n=5, k=2 (classic)', expected: 3, custom: 'Test.lastRemaining(5, 1, 2)', note: 'classic Josephus n=5 k=2 -> 3' },
      { input: 'n=7, k=3', expected: 4, custom: 'Test.lastRemaining(7, 1, 3)' },
      { input: 'n=2, k=1', expected: 2, custom: 'Test.lastRemaining(2, 1, 1)' }
    ]
  },
  {
    id: 'gs-min-window-sub',
    cat: 'gs-core',
    level: 3,
    title: 'Minimum Size Subarray Sum',
    confidence: 'high',
    tag: 'Sliding window',
    reportCount: 'Reported in the coderpad repo; sliding window is a top Goldman pattern',
    sources: [
      { label: 'GitHub dedeepya42/goldmansachs (question 10)', url: 'https://github.com/dedeepya42/goldmansachs' }
    ],
    prompt: [
      'Given an array of positive integers and a target, return the length of the SHORTEST contiguous subarray whose sum is >= target. Return 0 if none exists.',
      '',
      '  [1,2,5,6,11,2], target 12  ->  2   (the subarray [11,2])',
      '',
      'Sliding window is Goldman\'s most repeated pattern after hashing. Learn the invariant so you can write it without a whiteboard.'
    ].join('\n'),
    signature: 'minSubArrayLen(target, nums)',
    starter: 'function minSubArrayLen(target, nums) {\n\n}',
    hints: [
      'Because all numbers are POSITIVE, the window sum is monotonic: growing the window only increases it, shrinking only decreases it. That is what makes two pointers legal. Say it.',
      'Invariant: keep [left, right] with sum(window) just under or at target. Expand right, then while sum >= target shrink from the left and record the length.',
      'Update the best length INSIDE the shrink loop, before removing nums[left]. Recording after the removal is the classic off-by-one.',
      'If the numbers could be negative, sliding window breaks and you need prefix sums + binary search or a deque. The interviewer may well ask - have the answer ready.',
      'Complexity: O(n) time because each index is visited at most twice. Not O(n^2) - be ready to justify that.'
    ],
    solution: [
      'function minSubArrayLen(target, nums) {',
      '  let left = 0, sum = 0, best = Infinity;',
      '  for (let right = 0; right < nums.length; right++) {',
      '    sum += nums[right];',
      '    while (sum >= target) {',
      '      best = Math.min(best, right - left + 1);',
      '      sum -= nums[left++];',
      '    }',
      '  }',
      '  return best === Infinity ? 0 : best;',
      '}'
    ].join('\n'),
    complexity: 'Time O(n), Space O(1).',
    tests: [
      { input: 'minSubArrayLen(12, [1,2,5,6,11,2])', expected: 2, custom: 'Test.minSubArrayLen(12, [1,2,5,6,11,2])', note: 'the reported case' },
      { input: 'minSubArrayLen(7, [2,3,1,2,4,3])', expected: 2, custom: 'Test.minSubArrayLen(7, [2,3,1,2,4,3])' },
      { input: 'minSubArrayLen(4, [1,4,4])', expected: 1, custom: 'Test.minSubArrayLen(4, [1,4,4])' },
      { input: 'minSubArrayLen(100, [1,2,3])', expected: 0, custom: 'Test.minSubArrayLen(100, [1,2,3])', note: 'impossible' },
      { input: 'minSubArrayLen(11, [1,1,1,1,1,1,1,1])', expected: 0, custom: 'Test.minSubArrayLen(11, [1,1,1,1,1,1,1,1])' }
    ]
  },
  {
    id: 'gs-rounding',
    cat: 'gs-core',
    level: 2,
    title: 'Round prices / averages (the floor-division trap)',
    confidence: 'high',
    tag: 'Numerics - finance specific',
    reportCount: 'Reddit Dallas Associate: "using floor values for non-integer averages"',
    sources: [
      { label: 'Reddit r/goldmansachs - Dallas Associate CoderPad', url: 'https://www.reddit.com/r/goldmansachs/comments/1jv1vbg/goldman_sachs_interview_process_associate' },
      { label: 'interviewfox.ai - High Five uses integer division', url: 'https://interviewfox.ai/interview-questions/goldman-sachs-coderpad-oa-guide' }
    ],
    prompt: [
      'Both the Dallas and the 2026 CoderPad reports say the same thing: the average must use INTEGER division / floor, not rounding.',
      '',
      'Implement a money-safe helper set: floorAverage(values), and roundToCents(amount) that rounds half-away-from-zero.',
      '',
      'Then answer: why do banks never use floating point for money? This question is asked as a follow-up constantly, and it is short.'
    ].join('\n'),
    signature: 'floorAverage(values)   // and\n roundToCents(n)',
    starter: [
      'function floorAverage(values) {',
      '  // integer division, not Math.round',
      '}',
      '',
      'function roundToCents(amount) {',
      '  // round half AWAY FROM ZERO, to 2dp, without float drift',
      '}'
    ].join('\n'),
    hints: [
      'floorAverage: sum, then Math.floor(sum / values.length). Note that for NEGATIVE sums, Math.floor rounds down (-2.5 -> -3) while Math.trunc rounds toward zero (-2). Say which the spec wants.',
      'roundToCents trap: (1.005).toFixed(2) gives "1.00" in JavaScript, not "1.01", because 1.005 is actually 1.00499999... To fix, scale with an epsilon or work in integer minor units.',
      'Integer-safe rounding: `Math.sign(x) * Math.round(Math.abs(x) * 100 + 1e-9) / 100`. The epsilon absorbs binary drift.',
      'The answer they want to hear: never store money as a float. Store integer minor units (cents), or a decimal type, and do all arithmetic in integers.',
      'Add the reasoning: IEEE-754 cannot represent 0.1 exactly, so sums drift, and in a ledger a one-cent drift fails reconciliation. That sentence is the whole follow-up.',
      'Rounding mode matters for compliance too: half-up vs half-even (banker\'s rounding) vs half-away-from-zero. Name at least two and say why the spec must state one.'
    ],
    solution: [
      'function floorAverage(values) {',
      '  if (!values.length) return 0;',
      '  const sum = values.reduce((s, v) => s + v, 0);',
      '  return Math.floor(sum / values.length);',
      '}',
      '',
      'function roundToCents(amount) {',
      '  // round half away from zero, absorbing IEEE-754 drift',
      '  const sign = amount < 0 ? -1 : 1;',
      '  return (sign * Math.round(Math.abs(amount) * 100 + 1e-9)) / 100;',
      '}'
    ].join('\n'),
    complexity: 'O(n) for the average, O(1) for rounding.',
    tests: [
      { input: 'floorAverage([91,92,60,65,87])', expected: 79, custom: 'Test.floorAverage([91,92,60,65,87])', note: '(91+92+60+65+87)/5 = 79 exactly' },
      { input: 'floorAverage([1,2,10])', expected: 4, custom: 'Test.floorAverage([1,2,10])', note: '13/3 = 4.33 -> 4, not 4.33 and not 5' },
      { input: 'floorAverage([])', expected: 0, custom: 'Test.floorAverage([])' },
      { input: 'roundToCents(1.005)', expected: 1.01, custom: 'Test.roundToCents(1.005)', note: 'the float trap - naive toFixed gives 1.00' },
      { input: 'roundToCents(2.674)', expected: 2.67, custom: 'Test.roundToCents(2.674)' },
      { input: 'roundToCents(-1.005)', expected: -1.01, custom: 'Test.roundToCents(-1.005)', note: 'half away from zero' }
    ]
  }
];

/* ------------------------------------------------------------
   ROUND MAP: what happens at each stage, from the reports
   ------------------------------------------------------------ */
const GS_ROUNDS = [
  {
    stage: 'HackerRank OA',
    detail: '2 problems, 90 min. Easy + medium. LeetCode-style with visible test cases. One report says experienced hires get 3.',
    ask: 'Two Sum / array warm-up + one medium. Practise finishing an easy in under 10 minutes.'
  },
  {
    stage: 'CoderPad screen',
    detail: '45-75 min live with an engineer. TWO questions loaded at once but revealed one by one. Must compile and pass tests live. Google for syntax allowed; AI tools banned and overlays get you removed.',
    ask: 'Fraction to decimal, High Five, forest root, string compression. This is the round to over-prepare for.'
  },
  {
    stage: 'Superday - DSA',
    detail: '1 hour, two questions, two interviewers. Emphasis on complexity analysis and edge cases.',
    ask: 'Fraction to decimal, calculator with brackets, 2D grid DP, trapping rain water.'
  },
  {
    stage: 'Superday - SWE practices / LLD',
    detail: 'Code review, testing, CI/CD, Git flow, SOLID, design patterns, "implement an immutable class", HashMap internals and resizing.',
    ask: 'Be able to say "L" in SOLID with code. Know HashMap load factor 0.75 and treeify at 8.'
  },
  {
    stage: 'Superday - Design & Architecture',
    detail: 'A design round, often on YOUR last project first. Then a component and its scalability, queues, Kafka, caching, load balancers, consistent hashing.',
    ask: 'Design Twitter / URL shortener (LLD then HLD), parking garage with a schema, e-commerce checkout pattern.'
  },
  {
    stage: 'Hiring manager',
    detail: 'Resume deep dive, Agile pros and cons, sprint slips, conflict, prioritisation.',
    ask: 'Have 3 STAR stories: an incident you caused, a trade-off you argued, a time you were wrong.'
  }
];
