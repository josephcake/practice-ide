/* ============================================================
   SYSTEM DESIGN — "what is being asked" briefs
   ask:      the task in one plain sentence
   examples: concrete user-visible interactions the system must support
   deliver:  what the interviewer expects you to produce
   Filled in by design-catalog*.js.
   ============================================================ */

const DESIGN_BRIEFS = {};

const DESIGN_BRIEF_FALLBACK = {
  ask: 'Design the system described in the question. Start with what users do, then how the system handles it at scale.',
  examples: [],
  deliver: ['Requirements and non-goals', 'A rough estimate of scale', 'A high-level diagram with the main components', 'One deep dive and the main failure modes']
};
