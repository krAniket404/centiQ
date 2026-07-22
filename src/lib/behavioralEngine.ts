// src/lib/behavioralEngine.ts
import { ParsedTransaction } from './smsParser';

// JPMorgan Chase Institute CV boundaries shifted down by 15%
const CV_BOUNDARIES = {
  Q1: 0.187 * 0.85, // 0.1589
  Q2: 0.272 * 0.85, // 0.2312
  Q3: 0.374 * 0.85, // 0.3179
  Q4: 0.561 * 0.85, // 0.4768
};

function mapCVtoScore(cv: number): number {
  if (cv < CV_BOUNDARIES.Q1) return 100;
  if (cv < CV_BOUNDARIES.Q2) return 80;
  if (cv < CV_BOUNDARIES.Q3) return 60;
  if (cv < CV_BOUNDARIES.Q4) return 40;
  return 20; // Q5
}

export function calculateDisciplineScore(transactions: ParsedTransaction[]): number {
  // For this demo, we assume all parsed SMS are discretionary/transport
  if (transactions.length === 0) return 100;

  // Group by month
  const monthlySpend: { [key: string]: number } = {};
  transactions.forEach(t => {
    const monthKey = `${t.date.getFullYear()}-${t.date.getMonth()}`;
    monthlySpend[monthKey] = (monthlySpend[monthKey] || 0) + t.amount;
  });

  const spends = Object.values(monthlySpend);
  if (spends.length < 2) return 100; // Not enough data

  const mean = spends.reduce((a, b) => a + b, 0) / spends.length;
  const variance = spends.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / spends.length;
  const stdev = Math.sqrt(variance);
  const cv = stdev / mean;

  return mapCVtoScore(cv);
}

export function calculateImpulseIndex(transactions: ParsedTransaction[]): number {
  if (transactions.length === 0) return 0;

  // 1. Late night ratio (10pm - 6am)
  const lateNight = transactions.filter(t => {
    const hour = t.date.getHours();
    return hour >= 22 || hour <= 6;
  }).length;
  const lateNightRatio = lateNight / transactions.length;

  // 2. Same day cluster ratio (>= 3 transactions in a day)
  const dayMap: { [key: string]: number } = {};
  transactions.forEach(t => {
    const dayKey = t.date.toDateString();
    dayMap[dayKey] = (dayMap[dayKey] || 0) + 1;
  });
  const clusterDays = Object.values(dayMap).filter(count => count >= 3).length;
  const totalDays = Object.keys(dayMap).length;
  const sameDayClusterRatio = totalDays > 0 ? clusterDays / totalDays : 0;

  // Formula: (late_night_ratio × 0.6 + same_day_cluster_ratio × 0.4) × 100
  return Math.round((lateNightRatio * 0.6 + sameDayClusterRatio * 0.4) * 100);
}

export function calculateWellnessScore(discipline: number, impulse: number, volatility: number): number {
  // Equal weighted composite per CFPB precedent
  // For volatility, we will use Discipline score as a proxy for weekly volatility for now
  return Math.round((discipline * (1/3)) + ((100 - impulse) * (1/3)) + ((100 - volatility) * (1/3)));
}

// Covers two features described on the marketing site that aren't yet
// mentioned in the current build: subscription leak detection, and
// coaching nudges generated from the scores you already compute.

export interface SubscriptionLeak {
  activeSubscriptions: number;
  estimatedMonthly: number;
  estimatedAnnual: number;
}

export function computeSubscriptionLeak(transactions: { category: string; merchant: string; amount: number }[]): SubscriptionLeak {
  const subs = transactions.filter((t) => t.category === 'Subscriptions');
  const byMerchant: Record<string, number[]> = {};
  subs.forEach((t) => {
    (byMerchant[t.merchant] = byMerchant[t.merchant] || []).push(t.amount);
  });

  const monthlyTotal = Object.values(byMerchant).reduce(
    (sum, amounts) => sum + amounts.reduce((a, b) => a + b, 0) / amounts.length,
    0
  );

  return {
    activeSubscriptions: Object.keys(byMerchant).length,
    estimatedMonthly: Math.round(monthlyTotal),
    estimatedAnnual: Math.round(monthlyTotal * 12),
  };
}

export interface Nudge {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'none';
  message: string;
}

export function generateNudges(
  scores: { impulseIndex: number; disciplineScore: number },
  subscriptionLeak: SubscriptionLeak,
  transactionCount: number
): Nudge[] {
  const nudges: Nudge[] = [];

  if (scores.impulseIndex > 40) {
    nudges.push({
      type: 'impulse_spending',
      severity: scores.impulseIndex < 65 ? 'medium' : 'high',
      message: 'A good chunk of your food/shopping spend clusters late at night or same-day. A soft reminder before 10pm might help.',
    });
  }
  if (scores.disciplineScore < 50 && transactionCount > 10) {
    nudges.push({
      type: 'spend_consistency',
      severity: 'medium',
      message: 'Your monthly spend swings noticeably. Try a fixed weekly amount instead of one monthly number.',
    });
  }
  if (subscriptionLeak.activeSubscriptions >= 2) {
    nudges.push({
      type: 'subscription_leak',
      severity: 'low',
      message: `${subscriptionLeak.activeSubscriptions} recurring subscriptions detected, about ₹${subscriptionLeak.estimatedAnnual.toLocaleString('en-IN')}/year. Worth a quick review.`,
    });
  }
  if (nudges.length === 0) {
    nudges.push({
      type: 'status',
      severity: 'none',
      message: transactionCount < 8
        ? 'Add more transactions to unlock meaningful coaching.'
        : 'Nothing concerning right now.',
    });
  }
  return nudges;
}

export interface CategoryBudget {
  category: string;
  monthlyLimit: number;
}

export function getOverBudgetCategories(
  transactions: { category: string; amount: number; timestamp: number }[],
  budgets: CategoryBudget[]
): string[] {
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const monthTotals: Record<string, number> = {};

  transactions
    .filter((t) => new Date(t.timestamp).toISOString().slice(0, 7) === currentMonthKey)
    .forEach((t) => {
      monthTotals[t.category] = (monthTotals[t.category] || 0) + t.amount;
    });

  return budgets
    .filter((b) => monthTotals[b.category] && monthTotals[b.category] > b.monthlyLimit)
    .map((b) => b.category);
}

function getWeekOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + start.getDay() + 1) / 7);
}

// Spending Volatility (Weekly CV)
export function calculateVolatilityScore(transactions: ParsedTransaction[]): number {
  if (transactions.length === 0) return 100;

  const weeklySpend: { [key: string]: number } = {};
  transactions.forEach(t => {
    const weekKey = `${t.date.getFullYear()}-${getWeekOfYear(t.date)}`;
    weeklySpend[weekKey] = (weeklySpend[weekKey] || 0) + t.amount;
  });

  const spends = Object.values(weeklySpend);
  if (spends.length < 2) return 100;

  const mean = spends.reduce((a, b) => a + b, 0) / spends.length;
  if (mean === 0) return 100;

  const variance = spends.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / spends.length;
  const cv = Math.sqrt(variance) / mean;

  return mapCVtoScore(cv); // Reuse the JPMorgan mapCVtoScore function
}