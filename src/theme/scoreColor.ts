// src/theme/scoreColor.ts
export const C = {
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  accent: '#38BDF8',
};

export function getScoreColor(score: number, direction: 'higher_is_better' | 'lower_is_better'): string {
  const effective = direction === 'higher_is_better' ? score : 100 - score;
  if (effective >= 70) return C.success;
  if (effective >= 40) return C.warning;
  return C.danger;
}