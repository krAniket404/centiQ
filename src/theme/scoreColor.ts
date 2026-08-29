// src/theme/scoreColor.ts
import { Theme } from './themes';

export const C = {
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  accent: '#38BDF8',
};

export function getScoreColor(score: number, direction: 'higher_is_better' | 'lower_is_better', theme?: Theme): string {
  const effective = direction === 'higher_is_better' ? score : 100 - score;
  const colors = theme || C;
  if (effective >= 70) return colors.success;
  if (effective >= 40) return colors.warning;
  return colors.danger;
}