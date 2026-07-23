import { ParsedTransaction } from './smsParser';

// JPMorgan Chase Institute CV boundaries shifted down by 15%
const CV_BOUNDARIES = {
  Q1: 0.187 * 0.85, // 0.1589
  Q2: 0.272 * 0.85, // 0.2312
  Q3: 0.374 * 0.85, // 0.3179
  Q4: 0.561 * 0.85, // 0.4768
};

// The population average (Prior) - roughly the Q2 boundary
const POPULATION_CV_PRIOR = 0.2312;
const PRIOR_STRENGTH = 10; // k=10 means prior is worth ~10 months of data

function mapCVtoScore(cv: number): number {
  if (cv < CV_BOUNDARIES.Q1) return 100;
  if (cv < CV_BOUNDARIES.Q2) return 80;
  if (cv < CV_BOUNDARIES.Q3) return 60;
  if (cv < CV_BOUNDARIES.Q4) return 40;
  return 20;
}

// --- EMPIRICAL BAYES SHRINKAGE ---
// Blends the population prior with the user's personal CV
function blendCV(personalCV: number, dataPoints: number): number {
  const k = PRIOR_STRENGTH;
  const n = Math.max(dataPoints, 0);

  // Formula: (population×k + personal×n) / (k+n)
  const blended = ((POPULATION_CV_PRIOR * k) + (personalCV * n)) / (k + n);
  return blended;
}

function getWeekOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + start.getDay() + 1) / 7);
}

export function calculateDisciplineScore(transactions: ParsedTransaction[]): number {
  const discretionary = transactions.filter(t => t.type === 'debit');
  if (discretionary.length === 0) return 100;

  const monthlySpend: { [key: string]: number } = {};
  discretionary.forEach(t => {
    const monthKey = `${t.date.getFullYear()}-${t.date.getMonth()}`;
    monthlySpend[monthKey] = (monthlySpend[monthKey] || 0) + t.amount;
  });

  const spends = Object.values(monthlySpend);
  const monthsOfData = spends.length;
  if (monthsOfData < 1) return 100;

  const mean = spends.reduce((a, b) => a + b, 0) / monthsOfData;
  if (mean === 0) return 100;

  const variance = spends.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / monthsOfData;
  const personalCV = Math.sqrt(variance) / mean;

  // Blend with population prior
  const blendedCV = blendCV(personalCV, monthsOfData);
  return mapCVtoScore(blendedCV);
}

export function calculateImpulseIndex(transactions: ParsedTransaction[]): number {
  const discretionary = transactions.filter(t => t.type === 'debit');
  if (discretionary.length === 0) return 0;

  const lateNight = discretionary.filter(t => {
    const hour = t.date.getHours();
    return hour >= 22 || hour <= 6;
  }).length;
  const lateNightRatio = lateNight / discretionary.length;

  const dayMap: { [key: string]: number } = {};
  discretionary.forEach(t => {
    const dayKey = t.date.toDateString();
    dayMap[dayKey] = (dayMap[dayKey] || 0) + 1;
  });
  const clusterDays = Object.values(dayMap).filter(count => count >= 3).length;
  const totalDays = Object.keys(dayMap).length;
  const sameDayClusterRatio = totalDays > 0 ? clusterDays / totalDays : 0;

  return Math.round((lateNightRatio * 0.6 + sameDayClusterRatio * 0.4) * 100);
}

export function calculateVolatilityScore(transactions: ParsedTransaction[]): number {
  const discretionary = transactions.filter(t => t.type === 'debit');
  if (discretionary.length === 0) return 100;

  const weeklySpend: { [key: string]: number } = {};
  discretionary.forEach(t => {
    const weekKey = `${t.date.getFullYear()}-${getWeekOfYear(t.date)}`;
    weeklySpend[weekKey] = (weeklySpend[weekKey] || 0) + t.amount;
  });

  const spends = Object.values(weeklySpend);
  const weeksOfData = spends.length;
  if (weeksOfData < 1) return 100;

  const mean = spends.reduce((a, b) => a + b, 0) / weeksOfData;
  if (mean === 0) return 100;

  const variance = spends.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / weeksOfData;
  const personalCV = Math.sqrt(variance) / mean;

  // Blend with population prior
  const blendedCV = blendCV(personalCV, weeksOfData);
  return mapCVtoScore(blendedCV);
}

export function calculateWellnessScore(discipline: number, impulse: number, volatility: number): number {
  return Math.round((discipline * (1/3)) + ((100 - impulse) * (1/3)) + ((100 - volatility) * (1/3)));
}

// Detect subscription leaks (same amount, same merchant, 3+ times)
export function detectSubscriptionLeaks(transactions: ParsedTransaction[]): ParsedTransaction[] {
  const recurringMap: { [key: string]: ParsedTransaction[] } = {};

  transactions.filter(t => t.type === 'debit').forEach(t => {
    const key = `${t.merchant}-${t.amount}`;
    if (!recurringMap[key]) recurringMap[key] = [];
    recurringMap[key].push(t);
  });

  const leaks: ParsedTransaction[] = [];
  Object.values(recurringMap).forEach(group => {
    if (group.length >= 3) {
      leaks.push(...group);
    }
  });

  return leaks;
}