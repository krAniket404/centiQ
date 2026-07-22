import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { ParsedTransaction } from '../lib/smsParser';
import { UserBehaviorModel, UserLabel } from '../lib/personalization';

const C = {
  bg: "#080808", glass: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)",
  textPrimary: "#FFFFFF", textSecondary: "#B8B8B8", accent: "#38BDF8", success: "#10B981", warning: "#F59E0B", danger: "#EF4444",
};

// Distinct Neon Colors for each category
const CAT_COLORS: { [key: string]: string } = {
  Food: '#38BDF8',          // Neon Blue
  Groceries: '#84CC16',     // Neon Lime
  Shopping: '#A855F7',      // Neon Purple
  Entertainment: '#F59E0B', // Neon Orange
  Bills: '#10B981',         // Neon Green
  Transport: '#2DD4BF',     // Neon Teal
  Other: '#94A3B8',         // Neon Slate
  Income: '#22C55E'         // Neon Mint
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const categories = ['All', 'Food', 'Groceries', 'Shopping', 'Entertainment', 'Bills', 'Transport', 'Other'];

  const filteredTxns = transactions.filter(t => {
    const matchesSearch = (t.merchant || t.bank).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeFilter === 'All' || t.category === activeFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <View style={{ flex: 1, marginTop: 20 }}>
      <Text style={styles.headerTitle}>Transactions</Text>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search transactions..."
          placeholderTextColor={C.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScrollView}
        contentContainerStyle={{ paddingRight: 24 }}
      >
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, activeFilter === cat && styles.chipActive]}
            onPress={() => setActiveFilter(cat)}
          >
            <Text style={[styles.chipText, activeFilter === cat && styles.chipTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredTxns}
        keyExtractor={(item) => item.id!}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
        renderItem={({ item }) => {
          // Extract first letter for the Box Avatar
          const name = item.merchant || item.bank || '?';
          const firstLetter = name.charAt(0).toUpperCase();

          // Determine category and neon color
          const category = item.category || (item.type === 'credit' ? 'Income' : 'Other');
          const avatarColor = item.type === 'credit' ? CAT_COLORS.Income : (CAT_COLORS[category] || CAT_COLORS.Other);

          return (
            <View style={styles.txnCard}>
              <View style={styles.txnRow}>
                <View style={styles.txnLeft}>
                  {/* Neon Box Avatar */}
                  <View style={[
                    styles.avatarBox,
                    {
                      borderColor: avatarColor,
                      backgroundColor: `${avatarColor}15`, // Add 15% opacity background
                      shadowColor: avatarColor,
                      shadowOpacity: 0.8,
                      shadowRadius: 6,
                      elevation: 6
                    }
                  ]}>
                    <Text style={[styles.avatarText, { color: avatarColor }]}>{firstLetter}</Text>
                  </View>
                  <View>
                    <Text style={styles.txnMerchant}>{name}</Text>
                    <Text style={styles.txnDate}>{category} • {item.date.toLocaleDateString()}</Text>
                  </View>
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
                    {item.type === 'credit' ? '+' : '-'}₹{Math.round(Number(item.amount) || 0).toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.statusText}>Done</Text>
                </View>
              </View>

              {item.type === 'debit' && mode === 'liberal' && userLabels.length < 15 && !labeledTxnIds.includes(item.id!) ? (
                <View style={styles.labelContainer}>
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
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitle: { color: C.textPrimary, fontSize: 26, fontWeight: '700', marginBottom: 16 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 16, marginBottom: 16 },
  searchIcon: { fontSize: 14, marginRight: 12 },
  searchInput: { flex: 1, color: C.textPrimary, paddingVertical: 14, fontSize: 14 },
  chipScrollView: { flexGrow: 0, marginBottom: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.glass, borderWidth: 1, borderColor: C.border, marginRight: 8 },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#001018', fontWeight: 'bold' },
  txnCard: { backgroundColor: C.glass, borderColor: C.border, borderWidth: 1, padding: 16, borderRadius: 16, marginBottom: 10 },
  txnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txnLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },

  // The Neon Box Avatar
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 12, // Squircle/Box shape
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarText: { fontSize: 18, fontWeight: 'bold' },

  txnMerchant: { color: C.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  txnDate: { color: C.textSecondary, fontSize: 12 },
  txnRight: { flexDirection: 'column', alignItems: 'flex-end' },
  mlBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 4 },
  mlBadgeText: { fontSize: 11, fontWeight: 'bold' },
  txnAmount: { fontSize: 16, fontWeight: 'bold' },
  statusText: { color: C.textSecondary, fontSize: 10, marginTop: 2, textTransform: 'uppercase' },
  labelContainer: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, marginTop: 12 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  labelButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  labelButtonText: { fontWeight: '600', fontSize: 13 },
  thankYouText: { color: C.textSecondary, fontSize: 12, textAlign: 'center', fontStyle: 'italic', marginTop: 12 }
});