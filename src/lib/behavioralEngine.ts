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

export function calculateDisciplineScore(transactions: ParsedTransaction[], excludeIds: string[] = []): number {
  const discretionary = transactions.filter(t => t.type === 'debit' && !excludeIds.includes(t.id!));
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

export function calculateImpulseIndex(transactions: ParsedTransaction[], monthlyIncome: number = 0, excludeIds: string[] = []): number {
  const discretionary = transactions.filter(t => t.type === 'debit' && !excludeIds.includes(t.id!));
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

export function calculateVolatilityScore(transactions: ParsedTransaction[], excludeIds: string[] = []): number {
  const discretionary = transactions.filter(t => t.type === 'debit' && !excludeIds.includes(t.id!));
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
  transactions: ParsedTransaction[];
  hasPriceIncrease?: boolean;
  isGhost?: boolean;
  isDuplicate?: boolean;
  previousAmount?: number;
}

export interface SubscriptionResult {
  knownSubscriptions: RecurringCharge[];
  repetitivePayments: RecurringCharge[];
  leaks: SubscriptionLeak[];
}

export interface SubscriptionLeak {
  merchant: string;
  type: 'price_hike' | 'duplicate' | 'new_recurring';
  amount: number;
  previousAmount?: number;
  reason: string;
}

export function detectSubscriptionLeaks(transactions: ParsedTransaction[], worthItTxnIds: string[] = []): SubscriptionResult {
  const recurringMap: { [key: string]: ParsedTransaction[] } = {};

  transactions.filter(t => t.type === 'debit').forEach(t => {
    const key = t.merchant || 'Unknown Merchant';
    if (!recurringMap[key]) recurringMap[key] = [];
    recurringMap[key].push(t);
  });

  const knownSubs: RecurringCharge[] = [];
  const repetitivePays: RecurringCharge[] = [];
  const leaks: SubscriptionLeak[] = [];
  const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);

  Object.values(recurringMap).forEach(group => {
    if (group.length >= 2) {
      const sorted = [...group].sort((a, b) => b.date.getTime() - a.date.getTime());
      const latestAmt = sorted[0].amount;
      const previousAmt = sorted[1]?.amount || latestAmt;
      const hasPriceIncrease = latestAmt > previousAmt * 1.05; // 5% buffer

      // Ghost detection: check if any transaction in last 60 days was marked "Worth It"
      const recentTxns = group.filter(t => t.date.getTime() > sixtyDaysAgo);
      const isGhost = recentTxns.length > 0 && !recentTxns.some(t => worthItTxnIds.includes(t.id!));

      // Duplicate detection (same week, same amount)
      let isDuplicate = false;
      if (recentTxns.length >= 2) {
        for (let i = 0; i < recentTxns.length; i++) {
          for (let j = i + 1; j < recentTxns.length; j++) {
            const d1 = recentTxns[i].date;
            const d2 = recentTxns[j].date;
            const dayDiff = Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24);
            if (dayDiff < 3 && Math.abs(recentTxns[i].amount - recentTxns[j].amount) < 2) {
              isDuplicate = true;
              leaks.push({
                merchant: group[0].merchant,
                type: 'duplicate',
                amount: recentTxns[i].amount,
                reason: `Double charged ₹${recentTxns[i].amount} on ${d1.toLocaleDateString()}`
              });
              break;
            }
          }
          if (isDuplicate) break;
        }
      }

      if (hasPriceIncrease) {
        leaks.push({
          merchant: group[0].merchant,
          type: 'price_hike',
          amount: latestAmt,
          previousAmount: previousAmt,
          reason: `Price hiked from ₹${previousAmt} to ₹${latestAmt}`
        });
      }

      const charge: RecurringCharge = {
        merchant: group[0].merchant,
        amount: latestAmt,
        count: group.length,
        transactions: group,
        hasPriceIncrease,
        isGhost,
        isDuplicate,
        previousAmount: previousAmt
      };

      if (isKnownSubscription(charge.merchant)) {
        knownSubs.push(charge);
      } else if (group.length >= 3) {
        repetitivePays.push(charge);
      }
    }
  });

  return { knownSubscriptions: knownSubs, repetitivePayments: repetitivePays, leaks };
}

export function calculateWellnessScore(discipline: number, impulse: number, volatility: number): number {
  return Math.round((discipline * (1/3)) + ((100 - impulse) * (1/3)) + ((100 - volatility) * (1/3)));
}

// --- PREDICTIVE INTELLIGENCE ---

export function predictBreachDate(category: string, spent: number, budget: number, transactions: ParsedTransaction[]): string | null {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = now.getDate();

    if (spent <= 0 || budget <= 0 || today < 3) return null; // Need some data

    // Calculate daily average for this category
    const dailyAvg = spent / today;

    if (spent >= budget) return "BREACHED";

    const remainingBudget = budget - spent;
    const daysUntilBreach = remainingBudget / dailyAvg;
    const breachDay = Math.floor(today + daysUntilBreach);

    if (breachDay > daysInMonth) return null; // Won't breach this month

    const breachDate = new Date(currentYear, currentMonth, breachDay);
    return breachDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
