import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal } from 'react-native';
import { ParsedTransaction } from '../lib/smsParser';
import { UserBehaviorModel, UserLabel } from '../lib/personalization';
import { detectAnomaly } from '../lib/anomalyDetector';
import { Typography } from '../theme/typography';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const C = {
  bg: "#080808", glass: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)",
  textPrimary: "#FFFFFF", textSecondary: "#9A9AA0", accent: "#38BDF8", success: "#10B981", warning: "#F59E0B", danger: "#EF4444",
};

const CAT_COLORS: { [key: string]: string } = {
  Food: '#F59E0B', Groceries: '#84CC16', Shopping: '#8B5CF6', Travel: '#38BDF8',
  Entertainment: '#EF4444', Bills: '#10B981', Health: '#F97316', Other: '#64748B', Income: '#10B981',
  'Personal Care': '#EC4899'
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
        <Icon name="magnify" size={20} color="#666" style={styles.searchIcon} />
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
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
        renderItem={({ item }) => {
          const name = item.merchant || item.bank || '?';
          const firstLetter = name.charAt(0).toUpperCase();
          const category = item.category || (item.type === 'credit' ? 'Income' : 'Other');
          // Use category color for debits, Income color for credits
          const accentColor = item.type === 'credit' ? CAT_COLORS.Income : (CAT_COLORS[category] || CAT_COLORS.Other);

          const isLabeled = labeledTxnIds.includes(item.id!);
          const isWorthIt = worthItTxnIds.includes(item.id!);

          return (
            <TouchableOpacity
              style={styles.txnCard}
              activeOpacity={0.8}
              onPress={() => setEditingTxn(item)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                {/* AVATAR WITH FIRST LETTER & CATEGORY COLOR */}
                <View style={[styles.txnIconBadge, { backgroundColor: `${accentColor}20` }]}>
                  <Text style={[styles.avatarText, { color: accentColor }]}>{firstLetter}</Text>
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.txnMerchant} numberOfLines={1}>{name}</Text>
                  <Text style={styles.txnCategory}>{category} • {new Date(item.date).toLocaleDateString()}</Text>
                </View>

                <Text style={[styles.txnAmount, { color: item.type === 'credit' ? C.success : C.textPrimary }]}>
                  {item.type === 'credit' ? '+' : '-'}₹{Math.round(item.amount).toLocaleString('en-IN')}
                </Text>
              </View>

              {/* ACTION BUTTONS FOR LIBERAL MODE */}
              {item.type === 'debit' && mode === 'liberal' && (
                <View style={styles.txnActionRow}>
                  {!isLabeled ? (
                    <>
                      <TouchableOpacity
                        style={[styles.actionPill, { borderColor: C.success }]}
                        onPress={() => handleLabelTransaction(item, false)}
                      >
                        <Icon name="check-circle-outline" size={14} color={C.success} />
                        <Text style={[styles.actionPillText, { color: C.success }]}>Worth It</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionPill, { borderColor: C.danger }]}
                        onPress={() => handleLabelTransaction(item, true)}
                      >
                        <Icon name="flash-outline" size={14} color={C.danger} />
                        <Text style={[styles.actionPillText, { color: C.danger }]}>Impulsive</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={styles.labeledContainer}>
                      <Icon name={isWorthIt ? 'check-circle' : 'flash'} size={16} color={isWorthIt ? C.success : C.danger} />
                      <Text style={styles.currentLabelText}>
                        Logged as {isWorthIt ? 'Worth It' : 'Impulsive'}
                      </Text>
                      <TouchableOpacity onPress={() => handleLabelTransaction(item, isWorthIt)}>
                        <Text style={styles.changeText}>Change</Text>
                      </TouchableOpacity>
                    </View>
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
  searchIcon: { marginRight: 12 },
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
    borderRadius: 20, padding: 18, marginBottom: 14,
  },

  // Icon Badge (Avatar)
  txnIconBadge: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '900', fontFamily: Typography.fontFamilyBold },
  txnMerchant: { color: C.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 3, fontFamily: Typography.fontFamilyBold },
  txnCategory: { color: C.textSecondary, fontSize: 12, fontFamily: Typography.fontFamilyRegular },
  txnAmount: { fontSize: 15, fontWeight: '800', fontFamily: Typography.fontFamilyBold },

  // Action Buttons
  txnActionRow: {
    flexDirection: 'row', gap: 10, marginTop: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  actionPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, borderRadius: 980, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  actionPillText: { fontSize: 12, fontWeight: '700' },

  // Labeled State
  labeledContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
  },
  currentLabelText: { color: C.textSecondary, fontSize: 13, fontWeight: '600', flex: 1, marginLeft: 4 },
  changeText: { color: C.accent, fontSize: 12, fontWeight: '700' },

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