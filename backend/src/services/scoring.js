const { weights } = require('../config');

const round1 = (n) => Math.round(n * 10) / 10;

function overallScore({ correctness, completeness, fluency }) {
  return round1(
    correctness * weights.correctness + completeness * weights.completeness + fluency * weights.fluency
  );
}

// turns: plain objects. Only answered turns with an evaluation count.
function summarize(turns) {
  const done = turns.filter((t) => t.answered && t.evaluation);
  if (done.length === 0) return null;

  const avg = (key) => round1(done.reduce((sum, t) => sum + t.evaluation[key], 0) / done.length);

  const counts = new Map();
  for (const t of done) {
    for (const concept of t.evaluation.missingConcepts || []) {
      counts.set(concept, (counts.get(concept) || 0) + 1);
    }
  }
  const missingConcepts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([concept]) => concept);

  return {
    correctness: avg('correctness'),
    completeness: avg('completeness'),
    fluency: avg('fluency'),
    overall: avg('overall'),
    answeredCount: done.length,
    missingConcepts,
  };
}

module.exports = { overallScore, summarize };
