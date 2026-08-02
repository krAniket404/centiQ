import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal } from 'react-native';
import { ParsedTransaction } from '../lib/smsParser';
import { UserBehaviorModel, UserLabel } from '../lib/personalization';
import { detectAnomaly } from '../lib/anomalyDetector';
import { Typography } from '../theme/typography';

const C = {
  bg: "#080808", glass: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)",
  textPrimary: "#FFFFFF", textSecondary: "#9A9AA0", accent: "#38BDF8", success: "#10B981", warning: "#F59E0B", danger: "#EF4444",
};

const CAT_COLORS: { [key: string]: string } = {
  Food: '#F59E0B', Groceries: '#84CC16', Shopping: '#8B5CF6', Travel: '#38BDF8',
  Entertainment: '#EF4444', Bills: '#10B981', Health: '#F97316', Other: '#64748B', Income: '#10B981',
  'Personal Care': '#EC4899'
};

const CAT_ICONS: { [key: string]: string } = {
  Food: '🍔', Groceries: '🛒', Shopping: '🛍️', Travel: '✈️',
  Entertainment: '🎬', Bills: '📄', Health: '💊', Other: '📦', Income: '💰',
  'Personal Care': '💈'
};

const ALL_CATEGORIES = ['Food', 'Groceries', 'Shopping', 'Travel', 'Entertainment', 'Bills', 'Health', 'Personal Care', 'Other'];

interface Props {
  transactions: ParsedTransaction[];
  mode: 'strict' | 'liberal' | null;
  userLabels: UserLabel[];
  labeledTxnIds: string[];
  worthItTxnIds: string[];
  avgAmount: number;
  model: UserBehaviorModel;
  handleLabelTransaction: (txn: ParsedTransaction, isImpulsive: boolean) => void;
  onSetCategory: (txnId: string, category: string) => void;
}

export default function TransactionsScreen({ transactions, mode, userLabels, labeledTxnIds, worthItTxnIds, avgAmount, model, handleLabelTransaction, onSetCategory }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [editingTxn, setEditingTxn] = useState<ParsedTransaction | null>(null);

  const categories = ['All', 'Food', 'Groceries', 'Shopping', 'Travel', 'Entertainment', 'Bills', 'Health', 'Personal Care', 'Other'];

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

          const isAnomaly = detectAnomaly(item, transactions).isAnomaly;
          const impulseProb = userLabels.length >= 5 && item.type === 'debit' ? model.predict(model.extractFeatures(item, avgAmount)) : 0;
          const isLabeled = labeledTxnIds.includes(item.id!);

          return (
            <TouchableOpacity
              style={styles.txnCard}
              activeOpacity={0.8}
              onPress={() => setEditingTxn(item)}
            >
              <View style={styles.txnRow}>
                <View style={styles.txnLeft}>
                  <View style={[styles.avatarBox, { backgroundColor: accentColor }]}>
                    <Text style={styles.avatarText}>{firstLetter}</Text>
                  </View>

                  <View style={styles.txnInfo}>
                    <Text style={styles.txnMerchant} numberOfLines={1}>{name}</Text>
                    <View style={styles.catRow}>
                      <View style={[styles.catDot, { backgroundColor: accentColor }]} />
                      <Text style={styles.txnDate} numberOfLines={1}>{category} • {item.date.toLocaleDateString()}</Text>
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
                        {worthItTxnIds.includes(item.id!) ? '✅ Logged as Worth It' : '❤️‍🔥 Logged as Impulsive'}
                      </Text>
                      <TouchableOpacity onPress={() => {
                        const isCurrentlyWorthIt = worthItTxnIds.includes(item.id!);
                        handleLabelTransaction(item, isCurrentlyWorthIt ? true : false);
                      }}>
                        <Text style={styles.changeText}>Change to {worthItTxnIds.includes(item.id!) ? 'Impulsive' : 'Worth It'}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Category Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editingTxn !== null}
        onRequestClose={() => setEditingTxn(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Category</Text>
            <Text style={styles.modalSubtitle}>Classify "{editingTxn?.merchant || editingTxn?.bank}"</Text>

            <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
              {ALL_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catOption,
                    editingTxn?.category === cat && { backgroundColor: 'rgba(56,189,248,0.15)', borderColor: 'rgba(56,189,248,0.4)' }
                  ]}
                  onPress={() => {
                    if (editingTxn) onSetCategory(editingTxn.id!, cat);
                    setEditingTxn(null);
                  }}
                >
                  <Text style={styles.catOptionText}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setEditingTxn(null)}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: 20 },
  headerTitle: { color: C.textPrimary, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4, fontFamily: Typography.fontFamilyBold },
  subtleText: { color: C.textSecondary, fontSize: 13, marginBottom: 24, fontFamily: Typography.fontFamilyRegular },

  // Search Bar
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, paddingHorizontal: 16, marginBottom: 20, height: 52
  },
  searchIcon: { fontSize: 16, marginRight: 12, color: '#666' },
  searchInput: { flex: 1, color: C.textPrimary, fontSize: 15, fontFamily: Typography.fontFamilyRegular },

  // Category Chips
  chipScrollView: { flexGrow: 0, marginBottom: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 10
  },
  chipActive: { backgroundColor: 'rgba(56,189,248,0.15)', borderColor: 'rgba(56,189,248,0.4)' },
  chipText: { color: C.textSecondary, fontSize: 13, fontWeight: '600', fontFamily: Typography.fontFamilyMedium },
  chipTextActive: { color: C.accent, fontWeight: '800', fontFamily: Typography.fontFamilyBold },

  // Transaction Card
  txnCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
    borderRadius: 24, padding: 18, marginBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 3
  },
  txnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Left Side (Avatar + Info)
  txnLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  avatarBox: {
    width: 44, height: 44, borderRadius: 14, // The "Squircle" shape!
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4
  },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', fontFamily: Typography.fontFamilyBold },

  txnInfo: { flexShrink: 1 },
  txnMerchant: { color: C.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 3, fontFamily: Typography.fontFamilyBold },
  catRow: { flexDirection: 'row', alignItems: 'center' },
  catDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  txnDate: { color: C.textSecondary, fontSize: 12, fontFamily: Typography.fontFamilyRegular },

  // Right Side (Badges + Amount)
  txnRight: { flexDirection: 'column', alignItems: 'flex-end' },
  mlBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 4 },
  mlBadgeText: { fontSize: 10.5, fontWeight: '800', fontFamily: Typography.fontFamilyBold },
  txnAmount: { fontSize: 16, fontWeight: '800', fontFamily: Typography.fontFamilyBold },
  statusPill: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  statusText: { color: C.textSecondary, fontSize: 10, fontWeight: '600', fontFamily: Typography.fontFamilyMedium },

  // Liberal Mode Labeling UI
  labelContainer: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 14, marginTop: 14, alignItems: 'center' },
  labelPrompt: { color: C.textSecondary, fontSize: 13, marginBottom: 10, fontFamily: Typography.fontFamilyMedium },
  buttonRow: { flexDirection: 'row', gap: 10, width: '100%' },
  labelButton: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  labelButtonText: { fontWeight: '800', fontSize: 13, fontFamily: Typography.fontFamilyBold },
  currentLabelText: { color: C.textSecondary, fontSize: 13, fontWeight: '600', fontFamily: Typography.fontFamilyMedium },
  changeText: { color: C.accent, fontSize: 12, fontWeight: '700', fontFamily: Typography.fontFamilyBold },

  // Category Edit Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#1A1A1A', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingTop: 24, paddingBottom: 40,
    paddingHorizontal: 24, maxHeight: '70%'
  },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 4, fontFamily: Typography.fontFamilyBold },
  modalSubtitle: { color: '#8A8E93', fontSize: 14, marginBottom: 24, fontFamily: Typography.fontFamilyRegular },
  catOption: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, marginBottom: 10
  },
  catOptionText: { color: '#FFF', fontSize: 15, fontWeight: '600', fontFamily: Typography.fontFamilyMedium },
  closeBtn: { alignItems: 'center', marginTop: 16, padding: 10 },
  closeBtnText: { color: '#8A8E93', fontSize: 14, fontWeight: '600', fontFamily: Typography.fontFamilyMedium }
});