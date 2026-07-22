import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { ParsedTransaction } from '../lib/smsParser';
import { UserBehaviorModel, UserLabel } from '../lib/personalization';

const C = {
  bg: "#080808", glass: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)",
  textPrimary: "#FFFFFF", textSecondary: "#B8B8B8", accent: "#38BDF8", success: "#10B981", warning: "#F59E0B", danger: "#EF4444",
};

interface Props {
  transactions: ParsedTransaction[];
  mode: 'strict' | 'liberal' | null;
  userLabels: UserLabel[];
  labeledTxnIds: string[];
  avgAmount: number;
  model: UserBehaviorModel;
  handleLabelTransaction: (txn: ParsedTransaction, isImpulsive: boolean) => void;
}

export default function TransactionsScreen({ transactions, mode, userLabels, labeledTxnIds, avgAmount, model, handleLabelTransaction }: Props) {
  return (
    <View style={{ flex: 1, marginTop: 20 }}>
      <Text style={styles.headerTitle}>Transactions</Text>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id!}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={styles.txnCard}>
            <View style={styles.txnRow}>
              <View style={styles.txnLeft}>
                <Text style={styles.txnMerchant}>{item.merchant || item.bank}</Text>
                <Text style={styles.txnDate}>{item.category} • {item.date.toLocaleString()}</Text>
              </View>
              <View style={styles.txnRight}>
                {userLabels.length >= 5 && item.type === 'debit' && (
                  <View style={[styles.mlBadge, { backgroundColor: model.predict(model.extractFeatures(item, avgAmount)) > 0.6 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)' }]}>
                    <Text style={[styles.mlBadgeText, { color: model.predict(model.extractFeatures(item, avgAmount)) > 0.6 ? C.danger : C.success }]}>
                      {Math.round(model.predict(model.extractFeatures(item, avgAmount)) * 100)}% Impulse
                    </Text>
                  </View>
                )}
                <Text style={[styles.txnAmount, { color: item.type === 'credit' ? C.success : C.textPrimary }]}>
                  {item.type === 'credit' ? '+' : '-'}₹{item.amount}
                </Text>
              </View>
            </View>

            {item.type === 'debit' && mode === 'liberal' && userLabels.length < 15 && !labeledTxnIds.includes(item.id!) ? (
              <View style={styles.labelContainer}>
                <Text style={styles.labelPrompt}>Happy with this purchase?</Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={[styles.labelButton, { backgroundColor: 'rgba(16,185,129,0.1)' }]} onPress={() => handleLabelTransaction(item, false)}>
                    <Text style={[styles.labelButtonText, { color: C.success }]}>Worth it</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.labelButton, { backgroundColor: 'rgba(239,68,68,0.1)' }]} onPress={() => handleLabelTransaction(item, true)}>
                    <Text style={[styles.labelButtonText, { color: C.danger }]}>Impulsive</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              item.type === 'debit' && mode === 'liberal' && labeledTxnIds.includes(item.id!) && userLabels.length < 15 && (
                <Text style={styles.thankYouText}>✓ Logged for your personal model</Text>
              )
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitle: { color: C.textPrimary, fontSize: 26, fontWeight: '700', marginBottom: 20 },
  txnCard: { backgroundColor: C.glass, borderColor: C.border, borderWidth: 1, padding: 16, borderRadius: 16, marginBottom: 12 },
  txnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  txnLeft: { flexDirection: 'column', flex: 1 },
  txnMerchant: { color: C.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  txnDate: { color: C.textSecondary, fontSize: 12 },
  txnRight: { flexDirection: 'column', alignItems: 'flex-end' },
  mlBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 6 },
  mlBadgeText: { fontSize: 11, fontWeight: 'bold' },
  txnAmount: { fontSize: 16, fontWeight: 'bold' },
  labelContainer: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, marginTop: 4 },
  labelPrompt: { color: C.textSecondary, fontSize: 12, textAlign: 'center', marginBottom: 8 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  labelButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  labelButtonText: { fontWeight: '600', fontSize: 13 },
  thankYouText: { color: C.textSecondary, fontSize: 12, textAlign: 'center', fontStyle: 'italic', marginTop: 4 }
});