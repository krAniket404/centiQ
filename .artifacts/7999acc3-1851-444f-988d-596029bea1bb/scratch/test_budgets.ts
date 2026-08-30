// Minimal simulation of BudgetsScreen logic
const DEFAULT_BUDGETS = {
  Food: 4000, Groceries: 3000, Shopping: 5000, Travel: 1500,
  Entertainment: 1000, Bills: 2000, Health: 1000, 'Personal Care': 1500, Other: 2000
};

let budgets = { ...DEFAULT_BUDGETS };
let spent = { Food: 500, UnknownCat: 200 };

// Simulation of useEffect that detects new categories
function updateUnseenCategories(transactions: any[]) {
    const monthlySpent: any = {};
    const unseenCategories: string[] = [];

    transactions.forEach(t => {
        const cat = t.category || 'Other';
        monthlySpent[cat] = (monthlySpent[cat] || 0) + t.amount;
        if (!(cat in budgets) && !unseenCategories.includes(cat)) {
            unseenCategories.push(cat);
        }
    });

    spent = monthlySpent;

    if (unseenCategories.length > 0) {
        console.log("Adding unseen categories:", unseenCategories);
        const next = { ...budgets };
        unseenCategories.forEach(cat => {
            next[cat] = next[cat] ?? 1000;
        });
        budgets = next;
    }
}

const txns = [
    { category: 'Food', amount: 500, type: 'debit', date: new Date() },
    { category: 'Education', amount: 2000, type: 'debit', date: new Date() }
];

console.log("Initial budgets:", budgets);
updateUnseenCategories(txns);
console.log("Budgets after unseen categories:", budgets);

function updateBudget(cat: string, value: string) {
    budgets = { ...budgets, [cat]: parseInt(value) || 0 };
}

updateBudget('Food', '6000');
console.log("Budgets after updating Food to 6000:", budgets);

updateBudget('Food', '');
console.log("Budgets after clearing Food:", budgets);
