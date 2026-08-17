import { ParsedTransaction } from './smsParser';
import { isKnownSubscription } from './subscriptionList';

// JPMorgan Chase Institute CV boundaries shifted down by 15%
const CV_BOUNDARIES = {
  Q1: 0.187 * 0.85,
  Q2: 0.272 * 0.85,
  Q3: 0.374 * 0.85,
  Q4: 0.561 * 0.85,
};

// Distinct Priors for Discipline (Monthly) vs Volatility (Weekly)
const DISCIPLINE_PRIOR = 0.2312;
const VOLATILITY_PRIOR = 0.3500; // Weekly spending is naturally more volatile
const PRIOR_STRENGTH = 3; // Lowered from 10 so personal data has much more impact

function mapCVtoScore(cv: number): number {
  if (cv < CV_BOUNDARIES.Q1) return 100;
  if (cv < CV_BOUNDARIES.Q2) return 80;
  if (cv < CV_BOUNDARIES.Q3) return 60;
  if (cv < CV_BOUNDARIES.Q4) return 40;
  return 20;
}

// --- EMPIRICAL BAYES SHRINKAGE ---
function blendCV(personalCV: number, dataPoints: number, prior: number): number {
  const k = PRIOR_STRENGTH;
  const n = Math.max(dataPoints, 0);
  const blended = ((prior * k) + (personalCV * n)) / (k + n);
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

  // Use Discipline Prior
  const blendedCV = blendCV(personalCV, monthsOfData, DISCIPLINE_PRIOR);
  return mapCVtoScore(blendedCV);
}

export function calculateImpulseIndex(transactions: ParsedTransaction[], monthlyIncome: number = 0): number {
  const discretionary = transactions.filter(t => t.type === 'debit');
  if (discretionary.length === 0) return 0;

  // 1. Late-Night Rule (40% weight)
  const lateNight = discretionary.filter(t => {
    const hour = t.date.getHours();
    return hour >= 22 || hour <= 6;
  }).length;
  const lateNightRatio = lateNight / discretionary.length;

  // 2. Velocity/Cluster Rule (30% weight)
  const dayMap: { [key: string]: number } = {};
  discretionary.forEach(t => {
    const dayKey = t.date.toDateString();
    dayMap[dayKey] = (dayMap[dayKey] || 0) + 1;
  });
  const clusterDays = Object.values(dayMap).filter(count => count >= 3).length;
  const totalDays = Object.keys(dayMap).length;
  const sameDayClusterRatio = totalDays > 0 ? clusterDays / totalDays : 0;

  // 3. NEW: Affordability Rule (30% weight)
  let highValueRatio = 0;
  if (monthlyIncome > 0) {
    // If they spend more than 15% of their monthly income on a single transaction, it's an anomaly
    const threshold = monthlyIncome * 0.15;
    const highValueTxns = discretionary.filter(t => t.amount > threshold).length;
    highValueRatio = highValueTxns / discretionary.length;
  }

  // Weighted calculation
  return Math.round((lateNightRatio * 0.4 + sameDayClusterRatio * 0.3 + highValueRatio * 0.3) * 100);
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

  // Use Volatility Prior
  const blendedCV = blendCV(personalCV, weeksOfData, VOLATILITY_PRIOR);
  return mapCVtoScore(blendedCV);
}

// --- SUBSCRIPTION & REPETITIVE PAYMENT DETECTION ---

export interface RecurringCharge {
  merchant: string;
  amount: number;
  count: number;
  transactions: ParsedTransaction[]; // Added to hold the actual dates
}

export interface SubscriptionResult {
  knownSubscriptions: RecurringCharge[];
  repetitivePayments: RecurringCharge[];
}

export function detectSubscriptionLeaks(transactions: ParsedTransaction[]): SubscriptionResult {
  const recurringMap: { [key: string]: ParsedTransaction[] } = {};

  // Group transactions by Merchant Name ONLY (ignoring amount)
  transactions.filter(t => t.type === 'debit').forEach(t => {
    const key = t.merchant || 'Unknown Merchant';
    if (!recurringMap[key]) recurringMap[key] = [];
    recurringMap[key].push(t);
  });

  const knownSubs: RecurringCharge[] = [];
  const repetitivePays: RepetitiveCharge[] = [];

  // Split them based on the known list
  Object.values(recurringMap).forEach(group => {
    if (group.length >= 3) { // 3 or more transactions = recurring
      // Calculate total amount spent across all transactions
      const totalAmount = group.reduce((sum, t) => sum + t.amount, 0);

      const charge = {
        merchant: group[0].merchant,
        amount: totalAmount, // Now shows total spent
        count: group.length,
        transactions: group
      };

      if (isKnownSubscription(charge.merchant)) {
        knownSubs.push(charge);
      } else {
        repetitivePays.push(charge);
      }
    }
  });

  return { knownSubscriptions: knownSubs, repetitivePayments: repetitivePays };
}

export function calculateWellnessScore(discipline: number, impulse: number, volatility: number): number {
  return Math.round((discipline * (1/3)) + ((100 - impulse) * (1/3)) + ((100 - volatility) * (1/3)));
}