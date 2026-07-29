import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { ParsedTransaction } from '../lib/smsParser';
import { UserBehaviorModel, UserLabel } from '../lib/personalization';
import { detectAnomaly } from '../lib/anomalyDetector';

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
  worthItTxnIds: string[]; // <-- ADD THIS
  avgAmount: number;
  model: UserBehaviorModel;
  handleLabelTransaction: (txn: ParsedTransaction, isImpulsive: boolean) => void;
}

// Derives a transaction's effective category the SAME way in both the
// filter and the display -- previously the display used this fallback but
// the filter checked raw t.category directly, so a transaction showing
// "Other" on screen could fail to appear when you tapped the "Other" chip.
const deriveCategory = (t: ParsedTransaction): string =>
  t.category || (t.type === 'credit' ? 'Income' : 'Other');

export default function TransactionsScreen({ transactions, mode, userLabels, labeledTxnIds, worthItTxnIds, avgAmount, model, handleLabelTransaction }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const categories = ['All', 'Food', 'Groceries', 'Shopping', 'Travel', 'Entertainment', 'Bills', 'Health', 'Income', 'Other'];

  const filteredTxns = transactions.filter(t => {
    // Defensive fallback -- if both merchant and bank are ever empty,
    // this previously called .toLowerCase() on undefined and crashed.
    const matchesSearch = (t.merchant || t.bank || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeFilter === 'All' || deriveCategory(t) === activeFilter;
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
          const category = deriveCategory(item);
          const accentColor = item.type === 'credit' ? CAT_COLORS.Income : (CAT_COLORS[category] || CAT_COLORS.Other);

          const isAnomaly = detectAnomaly(item, transactions).isAnomaly;
          const impulseProb = userLabels.length >= 5 && item.type === 'debit' ? model.predict(model.extractFeatures(item, avgAmount)) : 0;
          const isLabeled = labeledTxnIds.includes(item.id!);
          const isCurrentlyWorthIt = worthItTxnIds.includes(item.id!);

          return (
            <View style={styles.txnCard}>
              <View style={styles.txnRow}>
                <View style={styles.txnLeft}>
                  <View style={[styles.avatarBox, { backgroundColor: accentColor }]}>
                    <Text style={styles.avatarText}>{firstLetter}</Text>
                  </View>

                  <View style={styles.txnInfo}>
                    <Text style={styles.txnMerchant} numberOfLines={1}>{name}</Text>
                    <View style={styles.catRow}>
                      <View style={[styles.catDot, { backgroundColor: accentColor }]} />
                      <Text style={styles.txnDate} numberOfLines={1}>{category} · {item.date.toLocaleDateString()}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.txnRight}>
                  {impulseProb > 0.4 && (
                    <View style={[styles.mlBadge, { backgroundColor: impulseProb > 0.7 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)' }]}>
                      <Text style={[styles.mlBadgeText, { color: impulseProb > 0.7 ? C.danger : C.success }]}>
                        {Math.round(impulseProb * 100)}% Impulse
                      </Text>
                    </View>
                  )}
                  {isAnomaly && (
                    <View style={[styles.mlBadge, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                      <Text style={[styles.mlBadgeText, { color: C.warning }]}>⚠️ Unusual</Text>
                    </View>
                  )}
                  <Text style={[styles.txnAmount, { color: item.type === 'credit' ? C.success : C.textPrimary }]}>
                    {item.type === 'credit' ? '+' : '-'}₹{Math.round(Number(item.amount) || 0).toLocaleString('en-IN')}
                  </Text>
                  {/* FIX: styles.statusPill was referenced here but never
                      defined, so this rendered as bare unstyled text
                      (visible in your screenshot as plain "DONE" text). */}
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>Done</Text>
                  </View>
                </View>
              </View>

              {/* ALWAYS show labeling buttons for debits in Liberal Mode */}
              {item.type === 'debit' && mode === 'liberal' && (
                <View style={[styles.labelContainer, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                  {!isLabeled ? (
                    <>
                      <Text style={styles.labelPrompt}>Happy with this purchase?</Text>
                      <View style={styles.buttonRow}>
                        <TouchableOpacity style={[styles.labelButton, { backgroundColor: 'rgba(16,185,129,0.1)' }]} onPress={() => handleLabelTransaction(item, false)}>
                          <Text style={[styles.labelButtonText, { color: C.success }]}>Worth it</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.labelButton, { backgroundColor: 'rgba(239,68,68,0.1)' }]} onPress={() => handleLabelTransaction(item, true)}>
                          <Text style={[styles.labelButtonText, { color: C.danger }]}>Impulsive</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.currentLabelText}>
                        {isCurrentlyWorthIt ? '✅ Logged as Worth It' : '❤️‍🔥 Logged as Impulsive'}
                      </Text>
                      {/* FIX: this was calling handleLabelTransaction with
                          `!isCurrentlyWorthIt`, which is the OPPOSITE of what
                          the button text promises -- tapping "Change to
                          Impulsive" was silently re-confirming "Worth It",
                          and vice versa. Removing the negation makes the
                          call match the button's stated intent.
                          NOTE: this also needs a companion fix in App.tsx's
                          handleLabelTransaction -- see the note below this
                          file for why. */}
                      <TouchableOpacity onPress={() => handleLabelTransaction(item, isCurrentlyWorthIt)}>
                        <Text style={styles.changeText}>Change to {isCurrentlyWorthIt ? 'Impulsive' : 'Worth It'}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
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

  // FIX: this style was missing entirely -- "Done" rendered as bare text
  // with no pill background at all.
  statusPill: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  statusText: { color: C.success, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  labelContainer: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 12, marginTop: 12 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  labelButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  labelButtonText: { fontWeight: '600', fontSize: 13 },
  thankYouText: { color: C.textSecondary, fontSize: 12, textAlign: 'center', fontStyle: 'italic', marginTop: 12 },
  currentLabelText: { color: C.textSecondary, fontSize: 13, fontWeight: '600' },
  changeText: { color: C.accent, fontSize: 12, fontWeight: '700' },
});