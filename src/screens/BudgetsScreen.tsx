import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { ParsedTransaction } from '../lib/smsParser';

const C = {
  bg: "#080808", glass: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)",
  textPrimary: "#FFFFFF", textSecondary: "#B8B8B8", accent: "#38BDF8", success: "#10B981", warning: "#F59E0B", danger: "#EF4444",
};

const CAT_COLORS: { [key: string]: string } = {
  Food: '#38BDF8', Shopping: '#7F77DD', Entertainment: '#F59E0B', Bills: '#10B981', Transport: '#5DCAA5', Other: '#888780'
};

export default function BudgetsScreen({ transactions }: { transactions: ParsedTransaction[] }) {
  const [budgets, setBudgets] = useState({ Food: 3000, Shopping: 5000, Transport: 1500, Entertainment: 1000, Bills: 2000, Other: 2000 });
  const [spent, setSpent] = useState<{[key: string]: number}>({});

  useEffect(() => {
    const now = new Date();
    const monthlySpent: {[key: string]: number} = {};
    transactions
      .filter(t => t.type === 'debit' && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear())
      .forEach(t => {
        const cat = t.category || 'Other';
        monthlySpent[cat] = (monthlySpent[cat] || 0) + t.amount;
      });
    setSpent(monthlySpent);
  }, [transactions]);

  const totalSpent = Object.values(spent).reduce((a, b) => a + b, 0);

  return (
    <ScrollView style={{ flex: 1, marginTop: 20 }} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.headerTitle}>Budgets</Text>

      {/* Category Breakdown (Donut alternative using Stacked Bar) */}
      <View style={[styles.glassCard, { padding: 22 }]}>
        <Text style={styles.sectionLabel}>Expense categories</Text>
        <View style={styles.stackedBar}>
          {Object.keys(spent).map((cat) => {
            const val = spent[cat] || 0;
            const pct = (val / totalSpent) * 100;
            if (pct === 0) return null;
            return <View key={cat} style={{ width: `${pct}%`, height: 10, backgroundColor: CAT_COLORS[cat] || C.textSecondary, borderTopLeftRadius: cat === Object.keys(spent)[0] ? 5 : 0, borderBottomLeftRadius: cat === Object.keys(spent)[0] ? 5 : 0, borderTopRightRadius: cat === Object.keys(spent).pop() ? 5 : 0, borderBottomRightRadius: cat === Object.keys(spent).pop() ? 5 : 0 }} />;
          })}
        </View>
        <View style={styles.legendContainer}>
          {Object.keys(spent).map((cat) => (
            <View key={cat} style={styles.legendRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.legendDot, { backgroundColor: CAT_COLORS[cat] || C.textSecondary }]} />
                <Text style={styles.legendText}>{cat}</Text>
              </View>
              <Text style={styles.legendValue}>{Math.round(((spent[cat] || 0) / totalSpent) * 100)}%</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Budget Limits */}
      <Text style={[styles.sectionLabel, { marginTop: 10 }]}>Monthly Limits</Text>
      {Object.keys(budgets).map(category => {
        const spentAmount = spent[category] || 0;
        const budgetAmount = budgets[category] || 1;
        const percent = Math.min(spentAmount / budgetAmount, 1);
        const color = percent >= 0.9 ? C.danger : percent >= 0.7 ? C.warning : C.success;

        return (
          <View key={category} style={styles.budgetCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.categoryName}>{category}</Text>
              <TextInput
                style={styles.budgetInput}
                value={budgets[category].toString()}
                onChangeText={(val) => setBudgets({ ...budgets, [category]: parseInt(val) || 0 })}
                keyboardType="numeric"
              />
            </View>
            <Text style={[styles.spentText, { color }]}>Spent ₹{spentAmount.toFixed(0)} / ₹{budgetAmount}</Text>
            <View style={styles.progressBackground}>
              <View style={[styles.progressBar, { width: `${percent * 100}%`, backgroundColor: color }]} />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerTitle: { color: C.textPrimary, fontSize: 26, fontWeight: '700', marginBottom: 20 },
  glassCard: { backgroundColor: C.glass, borderColor: C.border, borderWidth: 1, borderRadius: 20, marginBottom: 16 },
  sectionLabel: { color: C.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 16 },
  stackedBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 16 },
  legendContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', width: '48%', marginBottom: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendText: { color: C.textSecondary, fontSize: 13 },
  legendValue: { color: C.textPrimary, fontSize: 13, fontWeight: '600' },
  budgetCard: { backgroundColor: C.glass, borderColor: C.border, borderWidth: 1, padding: 16, borderRadius: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  categoryName: { color: C.textPrimary, fontSize: 16, fontWeight: '600' },
  budgetInput: { backgroundColor: 'rgba(255,255,255,0.08)', color: C.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, fontSize: 14, fontWeight: 'bold', minWidth: 100, textAlign: 'right' },
  spentText: { fontSize: 13, fontWeight: 'bold', marginBottom: 8 },
  progressBackground: { height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 999 }
});