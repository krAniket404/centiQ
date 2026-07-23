import { ParsedTransaction } from './smsParser';

export interface AnomalyResult {
  isAnomaly: boolean;
  reason?: string;
}

export function detectAnomaly(txn: ParsedTransaction, allTxns: ParsedTransaction[]): AnomalyResult {
  // Only check debits
  if (txn.type !== 'debit') return { isAnomaly: false };

  // Need at least 10 transactions to establish a baseline
  const debitTxns = allTxns.filter(t => t.type === 'debit');
  if (debitTxns.length < 10) return { isAnomaly: false };

  // 1. Calculate Amount Z-Score
  const amounts = debitTxns.map(t => t.amount);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);

  const amountZScore = stdDev > 0 ? (txn.amount - mean) / stdDev : 0;

  // 2. Check Time of Day (1 AM to 5 AM is highly unusual for spending)
  const hour = txn.date.getHours();
  const isLateNight = hour >= 1 && hour <= 5;

  // 3. Determine if Anomaly
  // Condition A: Amount is 3x the standard deviation (Statistically very rare)
  // Condition B: Amount is 2x std dev AND happens in the middle of the night
  if (amountZScore > 3) {
    return { isAnomaly: true, reason: `Unusually high amount (₹${txn.amount}) vs your average (₹${Math.round(mean)})` };
  }

  if (amountZScore > 2 && isLateNight) {
    return { isAnomaly: true, reason: `Large late-night purchase (₹${txn.amount} at ${hour}AM)` };
  }

  return { isAnomaly: false };
}