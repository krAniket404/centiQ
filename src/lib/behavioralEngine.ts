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