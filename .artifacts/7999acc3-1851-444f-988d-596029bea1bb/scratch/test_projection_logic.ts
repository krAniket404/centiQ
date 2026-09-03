function calculateProjectedSpend(transactions: any[], now: Date) {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();

    // Current Month Data
    const monthTxns = transactions.filter(t => t.type === 'debit' && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear());
    const spentSoFar = monthTxns.reduce((a, b) => a + b.amount, 0);

    // Linear Projection for Current Month
    const avgDailySpend = dayOfMonth > 0 ? spentSoFar / dayOfMonth : 0;
    const currentProjected = avgDailySpend * daysInMonth;

    // Last Month Data
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();
    const lastMonthTxns = transactions.filter(t => t.type === 'debit' && t.date.getMonth() === lastMonth && t.date.getFullYear() === lastMonthYear);
    const lastMonthSpend = lastMonthTxns.reduce((a, b) => a + b.amount, 0);

    // Blending Logic (Day 1-7)
    let projectedSpend = currentProjected;
    if (dayOfMonth <= 7 && lastMonthSpend > 0) {
        const weight = dayOfMonth / 7;
        projectedSpend = (currentProjected * weight) + (lastMonthSpend * (1 - weight));
    }

    return Math.round(projectedSpend);
}

// Mock Transactions
const mockTransactions = [
    // Last Month (August 2026 - if current is Sept)
    { type: 'debit', amount: 5000, date: new Date(2026, 7, 10) },
    { type: 'debit', amount: 5000, date: new Date(2026, 7, 20) }, // Total 10000 last month
];

console.log("--- Projection Logic Verification ---");

// Test Case 1: Day 1 (Sept 1st), No transactions today
const day1 = new Date(2026, 8, 1);
const proj1 = calculateProjectedSpend(mockTransactions, day1);
console.log(`Day 1 (No spend): Projected = ${proj1} (Expected approx 8571 - 6/7 of 10000)`);

// Test Case 2: Day 1 (Sept 1st), Spent 500 today
const mockWithDay1Spend = [...mockTransactions, { type: 'debit', amount: 500, date: new Date(2026, 8, 1) }];
const proj1WithSpend = calculateProjectedSpend(mockWithDay1Spend, day1);
// currentProjected = 500 * 30 = 15000
// weight = 1/7
// projected = (15000 * 0.1428) + (10000 * 0.8571) = 2142 + 8571 = 10713
console.log(`Day 1 (Spent 500): Projected = ${proj1WithSpend} (Expected approx 10714)`);

// Test Case 3: Day 4 (Sept 4th), Spent 1200 so far
const day4 = new Date(2026, 8, 4);
const mockDay4 = [...mockTransactions, { type: 'debit', amount: 1200, date: new Date(2026, 8, 2) }];
const proj4 = calculateProjectedSpend(mockDay4, day4);
// spentSoFar = 1200
// avgDaily = 1200 / 4 = 300
// currentProjected = 300 * 30 = 9000
// weight = 4/7 (~0.57)
// projected = (9000 * 0.5714) + (10000 * 0.4285) = 5142 + 4285 = 9427
console.log(`Day 4 (Spent 1200): Projected = ${proj4} (Expected approx 9429)`);

// Test Case 4: Day 8 (Sept 8th), Spent 2400 so far
const day8 = new Date(2026, 8, 8);
const mockDay8 = [...mockTransactions, { type: 'debit', amount: 2400, date: new Date(2026, 8, 4) }];
const proj8 = calculateProjectedSpend(mockDay8, day8);
// spentSoFar = 2400
// avgDaily = 2400 / 8 = 300
// currentProjected = 300 * 30 = 9000
// weight = 8/7 (Logic says if <= 7, so day 8 uses currentProjected only)
console.log(`Day 8 (Spent 2400): Projected = ${proj8} (Expected 9000)`);
