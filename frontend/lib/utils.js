export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(iso);
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// "problem_solving" -> "Problem solving"
export const pretty = (s) => (s ? s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '');

export function tierFor(overall) {
  if (overall >= 8.5) return 'Excellent';
  if (overall >= 7) return 'Strong';
  if (overall >= 5) return 'Developing';
  return 'Needs work';
}

export function statusTone(status) {
  return status === 'completed' ? 'green' : status === 'abandoned' ? 'amber' : 'neutral';
}
