import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { ParsedTransaction } from '../lib/smsParser';

interface BudgetsScreenProps {
  transactions: ParsedTransaction[];
}

const getBudgetColor = (percent: number) => {
  if (percent >= 0.9) return '#F87171';
  if (percent >= 0.7) return '#FACC15';
  return '#4ADE80';
};

export default function BudgetsScreen({ transactions }: BudgetsScreenProps) {
  const [budgets, setBudgets] = useState({
    Food: 3000, Shopping: 5000, Transport: 1500, Entertainment: 1000, Bills: 2000, Other: 2000
  });
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

  const updateBudget = (cat: string, value: string) => {
    setBudgets({ ...budgets, [cat]: parseInt(value) || 0 });
  };

  // Calculate totals for the header
  const totalBudget = Object.values(budgets).reduce((a, b) => a + b, 0);
  const totalSpent = Object.values(spent).reduce((a, b) => a + b, 0);
  const totalRemaining = totalBudget - totalSpent;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.header}>Monthly Budgets</Text>

      {/* Monthly Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Budget</Text>
          <Text style={styles.summaryValue}>₹{totalBudget.toLocaleString()}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Spent this month</Text>
          <Text style={[styles.summaryValue, { color: '#F87171' }]}>₹{totalSpent.toLocaleString()}</Text>
        </View>
        <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.summaryLabel}>Remaining</Text>
          <Text style={[styles.summaryValue, { color: totalRemaining >= 0 ? '#4ADE80' : '#F87171' }]}>₹{totalRemaining.toLocaleString()}</Text>
        </View>
      </View>

      {/* Category Cards */}
      {Object.keys(budgets).map(category => {
        const spentAmount = spent[category] || 0;
        const budgetAmount = budgets[category] || 1;
        const percent = Math.min(spentAmount / budgetAmount, 1);
        const color = getBudgetColor(percent);

        return (
          <View key={category} style={styles.budgetCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.categoryName}>{category}</Text>
              <TextInput
                style={styles.budgetInput}
                value={budgets[category].toString()}
                onChangeText={(val) => updateBudget(category, val)}
                keyboardType="numeric"
              />
            </View>
            <Text style={[styles.spentText, { color }]}>
              Spent ₹{spentAmount.toFixed(0)} / ₹{budgetAmount}
            </Text>
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
  container: { flex: 1, backgroundColor: '#0F111A', paddingHorizontal: 24, paddingTop: 50 },
  header: { color: '#FFF', fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
  summaryCard: { backgroundColor: '#1E2233', padding: 20, borderRadius: 12, marginBottom: 24 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2D2D44' },
  summaryLabel: { color: '#8E8E93', fontSize: 16 },
  summaryValue: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  budgetCard: { backgroundColor: '#1E2233', padding: 16, borderRadius: 12, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  categoryName: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  budgetInput: { backgroundColor: '#2D2D44', color: '#4ADE80', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, fontSize: 16, fontWeight: 'bold', minWidth: 100, textAlign: 'right' },
  spentText: { fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
  progressBackground: { height: 10, backgroundColor: '#2D2D44', borderRadius: 5, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 5 }
});