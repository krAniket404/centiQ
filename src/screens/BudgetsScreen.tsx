import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Animated, NativeModules, Modal, TouchableOpacity, FlatList } from 'react-native';
import { ParsedTransaction } from '../lib/smsParser';
import { predictBreachDate } from '../lib/behavioralEngine';
import { Typography } from '../theme/typography';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Theme, THEMES } from '../theme/themes';

const { SmsModule } = NativeModules;

const CAT_COLORS: { [key: string]: string } = {
  Food: '#F59E0B', Groceries: '#84CC16', Shopping: '#8B5CF6', Travel: '#38BDF8',
  Entertainment: '#EF4444', Bills: '#10B981', Health: '#F97316', Other: '#64748B', Income: '#10B981',
  'Personal Care': '#EC4899'
};

const CAT_ICONS: { [key: string]: string } = {
  Food: 'food-apple-outline', Groceries: 'cart-outline', Shopping: 'shopping-outline', Travel: 'airplane',
  Entertainment: 'movie-open-outline', Bills: 'file-document-outline', Health: 'pill', Other: 'package-variant-closed', Income: 'cash-multiple',
  'Personal Care': 'content-cut'
};

const DEFAULT_BUDGETS: { [key: string]: number } = {
  Food: 4000, Groceries: 3000, Shopping: 5000, Travel: 1500,
  Entertainment: 1000, Bills: 2000, Health: 1000, 'Personal Care': 1500, Other: 2000
};

const STORAGE_KEY = 'budgets:v1';

function createStyles(C: Theme) {
  return StyleSheet.create({
  headerTitle: { color: C.textPrimary, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 24 },

  glassCard: {
    backgroundColor: C.glass, borderColor: C.border, borderTopColor: C.glassHighlight,
    borderWidth: 1, borderRadius: 22, padding: 22, marginBottom: 24,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 5,
  },
  cardHeaderTitle: { color: C.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 18 },

  heroCard: {
    backgroundColor: C.glassStrong, borderColor: C.border, borderTopColor: C.glassHighlight,
    borderWidth: 1, borderRadius: 26, padding: 24, marginBottom: 24,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.32, shadowRadius: 22, elevation: 7,
  },
  heroLabel: { color: C.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  heroAmount: { color: C.textPrimary, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  heroSubtext: { color: C.textSecondary, fontSize: 12, marginTop: 4 },
  // Unified to the same pill shape (height 7, radius 999) as the meters
  // and other progress bars elsewhere in the app.
  heroProgressBg: { height: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 20, marginBottom: 8 },
  heroProgressFill: { height: '100%', borderRadius: 999, backgroundColor: C.accent },
  heroSpentText: { color: C.textSecondary, fontSize: 12, fontWeight: '600' },
  paceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border },
  paceText: { color: C.textSecondary, fontSize: 12, fontWeight: '600' },
  paceDivider: { color: C.textSecondary, fontSize: 12, marginHorizontal: 6, opacity: 0.5 },

  stackedBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.05)' },
  legendContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', width: '48%', marginBottom: 12, alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendText: { color: C.textSecondary, fontSize: 13 },
  legendValue: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },

  sectionTitle: { color: C.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 16, marginLeft: 4 },

  budgetCard: {
    backgroundColor: C.glass, borderColor: C.border, borderTopColor: C.glassHighlight,
    borderWidth: 1, borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 3,
  },
  budgetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  // Category icon now sits in a colored circular badge (tinted to that
  // category's own color) instead of floating as bare emoji text --
  // matches the icon-badge pattern used for Subscriptions/Forecast cards.
  categoryIconBadge: {
    width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  // categoryIcon style removed - using Icon component now
  categoryName: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },
  overBadge: {
    marginLeft: 8, backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  overBadgeText: { color: C.danger, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  budgetInputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: C.border, borderTopColor: C.glassHighlight, borderRadius: 10, paddingHorizontal: 10, minWidth: 100,
  },
  currencySymbol: { color: C.textSecondary, fontSize: 14, fontWeight: 'bold', marginRight: 4 },
  budgetInput: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', paddingVertical: 8, minWidth: 60, textAlign: 'right' },

  spentText: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  budgetProgressBg: { height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  budgetProgressFill: { height: '100%', borderRadius: 999 },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: C.glassStrong,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: C.border,
    borderTopColor: C.glassHighlight,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: '75%',
    shadowColor: C.shadow, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  modalIconBadge: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: {
    color: C.textPrimary,
    fontSize: 19,
    fontWeight: '800',
  },
  closeButtonWrap: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  // closeButton style removed - using Icon component now
  modalTxnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 24,
  },
  modalTxnMerchant: {
    color: C.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalTxnDate: {
    color: '#A0A0B0',
    fontSize: 12,
  },
  modalTxnAmount: {
    color: C.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
}

interface Props {
  transactions: ParsedTransaction[];
  theme: Theme;
}

export default function BudgetsScreen({ transactions, theme }: Props) {
  const C = theme || THEMES.azure;
  const styles = useMemo(() => createStyles(C), [C]);
  const [budgets, setBudgets] = useState<{ [key: string]: number }>(DEFAULT_BUDGETS);
  const [spent, setSpent] = useState<{ [key: string]: number }>({});
  const [loaded, setLoaded] = useState(false);
  const [viewingCategory, setViewingCategory] = useState<string | null>(null);

  const now = new Date();

  useEffect(() => {
    (async () => {
      try {
        const raw = await SmsModule.loadData(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          // Merge defaults with saved so new categories (like Personal Care) are added
          setBudgets({ ...DEFAULT_BUDGETS, ...saved });
        }
      } catch (e) {
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    SmsModule.saveData(STORAGE_KEY, JSON.stringify(budgets)).catch(() => {});
  }, [budgets, loaded]);

  useEffect(() => {
    const monthlySpent: { [key: string]: number } = {};
    const unseenCategories: string[] = [];

    transactions
      .filter(t => t.type === 'debit' && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear())
      .forEach(t => {
        const cat = t.category || 'Other';
        monthlySpent[cat] = (monthlySpent[cat] || 0) + t.amount;
        if (!(cat in budgets) && !unseenCategories.includes(cat)) unseenCategories.push(cat);
      });

    setSpent(monthlySpent);

    if (unseenCategories.length > 0) {
      setBudgets(prev => {
        const next = { ...prev };
        unseenCategories.forEach(cat => { next[cat] = next[cat] ?? 1000; });
        return next;
      });
    }
  }, [transactions]);

  const totalBudget = Object.values(budgets).reduce((a, b) => a + b, 0);
  const totalSpent = Object.values(spent).reduce((a, b) => a + b, 0);
  const remaining = totalBudget - totalSpent;
  const monthName = now.toLocaleString('default', { month: 'long' });
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(daysInMonth - now.getDate(), 1);
  const dailyAllowance = remaining > 0 ? remaining / daysLeft : 0;

  const updateBudget = (cat: string, value: string) => {
    setBudgets(prev => ({ ...prev, [cat]: parseInt(value) || 0 }));
  };

  const sortedCategories = Object.keys(budgets).sort((a, b) => {
    const pctA = (spent[a] || 0) / (budgets[a] || 1);
    const pctB = (spent[b] || 0) / (budgets[b] || 1);
    return pctB - pctA;
  });

  // Filter transactions for the Modal
  const viewingTransactions = transactions
    .filter(t => t.type === 'debit' && (t.category || 'Other') === viewingCategory && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear())
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110, marginTop: 20 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.headerTitle}>Budgets</Text>

        {/* Hero Summary Card -- now actually wrapped in styles.heroCard,
            which was defined but unused before (the section was floating
            without its intended glass container). */}
        <View style={styles.heroCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={styles.heroLabel}>TOTAL BUDGET</Text>
              <Text style={styles.heroAmount}>₹{totalBudget.toLocaleString('en-IN')}</Text>
              <Text style={styles.heroSubtext}>For {monthName}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', marginLeft: 16 }}>
              <Text style={styles.heroLabel}>REMAINING</Text>
              <Text style={[styles.heroAmount, { color: remaining >= 0 ? C.success : C.danger }]}>
                ₹{Math.abs(remaining).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.heroSubtext}>{remaining >= 0 ? 'Left to spend' : 'Over budget'}</Text>
            </View>
          </View>

          <View style={styles.heroProgressBg}>
            <View style={[
              styles.heroProgressFill,
              { width: `${totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0}%` }
            ]} />
          </View>
          <Text style={styles.heroSpentText}>
            Spent ₹{Math.round(totalSpent).toLocaleString('en-IN')} of ₹{totalBudget.toLocaleString('en-IN')}
          </Text>

          <View style={styles.paceRow}>
            <Text style={styles.paceText}>
              {daysLeft} day{daysLeft === 1 ? '' : 's'} left
            </Text>
            <Text style={styles.paceDivider}>·</Text>
            <Text style={[styles.paceText, { color: remaining >= 0 ? C.accent : C.danger }]}>
              {remaining >= 0
                ? `₹${Math.round(dailyAllowance).toLocaleString('en-IN')}/day to stay on track`
                : 'Already over for the month'}
            </Text>
          </View>
        </View>

        {/* Category Breakdown */}
        <View style={styles.glassCard}>
          <Text style={styles.cardHeaderTitle}>CATEGORY BREAKDOWN</Text>
          <View style={styles.stackedBar}>
            {sortedCategories.map((cat) => {
              const val = spent[cat] || 0;
              const pct = totalSpent > 0 ? (val / totalSpent) * 100 : 0;
              if (pct === 0) return null;
              return <View key={cat} style={{ width: `${pct}%`, height: 10, backgroundColor: CAT_COLORS[cat] || C.textSecondary }} />;
            })}
          </View>

          <View style={styles.legendContainer}>
            {sortedCategories.map((cat) => {
              const hasSpend = (spent[cat] || 0) > 0;
              return (
                <View key={cat} style={styles.legendRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.legendDot, { backgroundColor: CAT_COLORS[cat] || C.textSecondary, opacity: hasSpend ? 1 : 0.35 }]} />
                    <Text style={[styles.legendText, { opacity: hasSpend ? 1 : 0.5 }]}>{cat}</Text>
                  </View>
                  <Text style={[styles.legendValue, { opacity: hasSpend ? 1 : 0.5 }]}>
                    ₹{Math.round(spent[cat] || 0).toLocaleString('en-IN')}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Monthly Limits */}
        <Text style={styles.sectionTitle}>MONTHLY LIMITS · TAP TO VIEW TRANSACTIONS</Text>

        {sortedCategories.map(category => {
          const spentAmount = spent[category] || 0;
          const budgetAmount = budgets[category] || 1;
          const rawPercent = (spentAmount / budgetAmount) * 100;
          const percent = Math.min(rawPercent, 100);
          const isOver = rawPercent >= 100;
          const breachDate = predictBreachDate(category, spentAmount, budgetAmount, transactions);

          let progressColor = C.success;
          if (percent >= 90) progressColor = C.danger;
          else if (percent >= 70) progressColor = C.warning;

          return (
            <TouchableOpacity key={category} activeOpacity={0.8} onPress={() => setViewingCategory(category)}>
              <BudgetCard
                category={category}
                spentAmount={spentAmount}
                budgetAmount={budgetAmount}
                percent={percent}
                isOver={isOver}
                progressColor={progressColor}
                breachDate={breachDate}
                onChangeBudget={(val) => updateBudget(category, val)}
                theme={theme}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Transaction Viewer Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={viewingCategory !== null}
        onRequestClose={() => setViewingCategory(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.modalIconBadge, { backgroundColor: `${CAT_COLORS[viewingCategory || 'Other']}22` }]}>
                  <Icon name={CAT_ICONS[viewingCategory || 'Other']} size={18} color={CAT_COLORS[viewingCategory || 'Other']} />
                </View>
                <Text style={styles.modalTitle}>{viewingCategory} Transactions</Text>
              </View>
              <TouchableOpacity style={styles.closeButtonWrap} activeOpacity={0.75} onPress={() => setViewingCategory(null)}>
                <Icon name="close" size={18} color={C.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={viewingTransactions}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <View style={styles.modalTxnRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTxnMerchant}>{item.merchant || item.bank}</Text>
                    <Text style={styles.modalTxnDate}>{new Date(item.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <Text style={styles.modalTxnAmount}>- ₹{Math.round(item.amount).toLocaleString('en-IN')}</Text>
                </View>
              )}
              ListEmptyComponent={
                <Text style={{ color: C.textSecondary, textAlign: 'center', marginTop: 40 }}>No transactions in this category yet.</Text>
              }
            />
          </View>
        </View>
      </Modal>

    </View>
  );
}

function BudgetCard({
  category, spentAmount, budgetAmount, percent, isOver, progressColor, breachDate, onChangeBudget, theme
}: {
  category: string;
  spentAmount: number;
  budgetAmount: number;
  percent: number;
  isOver: boolean;
  progressColor: string;
  breachDate: string | null;
  onChangeBudget: (val: string) => void;
  theme: Theme;
}) {
  const C = theme || THEMES.azure;
  const styles = useMemo(() => createStyles(C), [C]);
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: percent,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  return (
    <View style={styles.budgetCard}>
      <View style={styles.budgetHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={[styles.categoryIconBadge, { backgroundColor: `${CAT_COLORS[category] || C.textSecondary}1F` }]}>
            <Icon name={CAT_ICONS[category] || 'package-variant-closed'} size={16} color={CAT_COLORS[category] || C.textSecondary} />
          </View>
          <Text style={styles.categoryName}>{category}</Text>
          {isOver && (
            <View style={styles.overBadge}>
              <Text style={styles.overBadgeText}>OVER</Text>
            </View>
          )}
        </View>
        <View style={styles.budgetInputWrapper}>
          <Text style={styles.currencySymbol}>₹</Text>
          <TextInput
            style={styles.budgetInput}
            value={budgetAmount.toString()}
            onChangeText={onChangeBudget}
            keyboardType="numeric"
            selectTextOnFocus
          />
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={[styles.spentText, { color: progressColor, marginBottom: 0 }]}>
            {percent.toFixed(0)}% Used · ₹{Math.round(spentAmount).toLocaleString('en-IN')} / ₹{budgetAmount.toLocaleString('en-IN')}
        </Text>
        {breachDate && !isOver && (
            <Text style={{ color: C.warning, fontSize: 10, fontWeight: '700' }}>
                ⚠️ BREACH {breachDate.toUpperCase()}
            </Text>
        )}
      </View>

      <View style={styles.budgetProgressBg}>
        <Animated.View
          style={[
            styles.budgetProgressFill,
            {
              backgroundColor: progressColor,
              width: widthAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
    </View>
  );
}
