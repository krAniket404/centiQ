import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { ParsedTransaction } from '../lib/smsParser';
import { UserBehaviorModel, UserLabel } from '../lib/personalization';

const C = {
  bg: "#080808", glass: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.13)",
  textPrimary: "#FFFFFF", textSecondary: "#B8B8B8", accent: "#38BDF8", success: "#10B981", warning: "#F59E0B", danger: "#EF4444",
};

const CAT_COLORS: { [key: string]: string } = {
  Food: '#F59E0B', Groceries: '#84CC16', Shopping: '#8B5CF6', Travel: '#38BDF8',
  Entertainment: '#EF4444', Bills: '#10B981', Health: '#F97316', Other: '#64748B', Income: '#10B981'
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

  const categories = ['All', 'Food', 'Groceries', 'Shopping', 'Travel', 'Entertainment', 'Bills', 'Health', 'Income', 'Other'];

  const filteredTxns = transactions.filter(t => {
    const matchesSearch = (t.merchant || t.bank).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeFilter === 'All' || t.category === activeFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <View style={{ flex: 1, marginTop: 20 }}>
      <Text style={styles.headerTitle}>Transactions</Text>
      <Text style={styles.subtleText}>{filteredTxns.length} found</Text>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search merchants…"
          placeholderTextColor="#555"
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
          const name = item.merchant || item.bank || '?';
          const firstLetter = name.charAt(0).toUpperCase();
          const category = item.category || (item.type === 'credit' ? 'Income' : 'Other');
          const accentColor = item.type === 'credit' ? CAT_COLORS.Income : (CAT_COLORS[category] || CAT_COLORS.Other);

          return (
            <View style={styles.txnCard}>
              <View style={styles.txnRow}>
                <View style={styles.txnLeft}>
                  <View style={[styles.avatarBox, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}30` }]}>
                    <Text style={[styles.avatarText, { color: accentColor }]}>{firstLetter}</Text>
                  </View>

                  {/* Text Container with flexShrink to prevent pushing */}
                  <View style={styles.txnInfo}>
                    <Text style={styles.txnMerchant} numberOfLines={1}>{name}</Text>
                    <View style={styles.catRow}>
                      <View style={[styles.catDot, { backgroundColor: accentColor }]} />
                      <Text style={styles.txnDate} numberOfLines={1}>{category} · {item.date.toLocaleDateString()}</Text>
                    </View>
                  </View>
                </View>

                {/* Right Side with flexShrink: 0 so it never squishes */}
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
  headerTitle: { color: C.textPrimary, fontSize: 24, fontWeight: '700' },
  subtleText: { color: C.textSecondary, fontSize: 12, marginBottom: 16 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderRadius: 14, paddingHorizontal: 16, marginBottom: 16 },
  searchIcon: { fontSize: 14, marginRight: 12, color: '#555' },
  searchInput: { flex: 1, color: C.textPrimary, paddingVertical: 14, fontSize: 14 },
  chipScrollView: { flexGrow: 0, marginBottom: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginRight: 10 },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#001018', fontWeight: 'bold' },

  txnCard: { backgroundColor: C.glass, borderColor: C.border, borderWidth: 1, padding: 16, borderRadius: 20, marginBottom: 10 },
  txnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Left side: Avatar + Info
  txnLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  avatarBox: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: 'bold' },
  txnInfo: { flexShrink: 1 }, // Allows text to truncate instead of pushing layout

  txnMerchant: { color: C.textPrimary, fontSize: 15, fontWeight: '500', marginBottom: 2 },
  catRow: { flexDirection: 'row', alignItems: 'center' },
  catDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  txnDate: { color: C.textSecondary, fontSize: 11 },

  // Right side: Amount + Badge
  txnRight: { flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }, // Prevents right side from squishing
  mlBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 4 },
  mlBadgeText: { fontSize: 11, fontWeight: 'bold' },
  txnAmount: { fontSize: 16, fontWeight: 'bold' },
  statusText: { color: C.textSecondary, fontSize: 10, marginTop: 2, textTransform: 'uppercase' },

  labelContainer: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 12, marginTop: 12 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  labelButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  labelButtonText: { fontWeight: '600', fontSize: 13 },
  thankYouText: { color: C.textSecondary, fontSize: 12, textAlign: 'center', fontStyle: 'italic', marginTop: 12 }
});