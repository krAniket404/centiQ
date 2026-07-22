import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, PermissionsAndroid, BackHandler,
  Alert, NativeModules, FlatList, StatusBar, Modal
} from 'react-native';
import { parseBankSMS, ParsedTransaction } from './src/lib/smsParser';
import { calculateDisciplineScore, calculateImpulseIndex, calculateWellnessScore, calculateVolatilityScore } from './src/lib/behavioralEngine';
import { UserBehaviorModel, UserLabel } from './src/lib/personalization';
import { backfillHistory } from './src/lib/historicalSync';
import BudgetsScreen from './src/screens/BudgetsScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import CircularScoreCard from './src/components/CircularScoreCard';
import PremiumChart from './src/components/PremiumChart';

const { SmsModule } = NativeModules;
const STORAGE_KEY = 'centiq_state_v1';

const C = {
  bg: "#080808", glass: "rgba(255,255,255,0.06)", glassStrong: "rgba(255,255,255,0.09)",
  border: "rgba(255,255,255,0.12)", textPrimary: "#FFFFFF", textSecondary: "#B8B8B8",
  accent: "#38BDF8", success: "#10B981", warning: "#F59E0B", danger: "#EF4444",
};

const getScoreColor = (score: number, type: 'good' | 'bad') => {
  if (type === 'good') return score >= 70 ? C.success : score >= 40 ? C.warning : C.danger;
  if (type === 'bad') return score >= 70 ? C.danger : score >= 40 ? C.warning : C.success;
  return C.textPrimary;
};

export default function App() {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [scores, setScores] = useState({ discipline: 0, impulse: 0, volatility: 0, wellness: 0, savingsRate: 0 });
  const [mode, setMode] = useState<'strict' | 'liberal' | null>(null);
  const [worthItTxnIds, setWorthItTxnIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'budgets'>('dashboard');
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'week' | '3m' | '6m' | '1y'>('week');
  const [analyticsActiveDay, setAnalyticsActiveDay] = useState<number | null>(null);

  const [model] = useState(new UserBehaviorModel());
  const [userLabels, setUserLabels] = useState<UserLabel[]>([]);
  const [labeledTxnIds, setLabeledTxnIds] = useState<string[]>([]);

  const savedStateRef = useRef<any>(null);

  useEffect(() => {
    const init = async () => {
      const saved = await loadSavedData();
      savedStateRef.current = saved;
      await checkPermission(saved);
    };
    init();
  }, []);

  const loadSavedData = async () => {
    try {
      const raw = await SmsModule.loadData(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.mode) setMode(parsed.mode);
      if (parsed.userLabels) setUserLabels(parsed.userLabels);
      if (parsed.labeledTxnIds) setLabeledTxnIds(parsed.labeledTxnIds);
      if (parsed.worthItTxnIds) setWorthItTxnIds(parsed.worthItTxnIds);
      return parsed;
    } catch (e) { return null; }
  };

  const saveState = async (overrides: any = {}) => {
    const payload = {
      mode: overrides.mode ?? mode,
      userLabels: overrides.userLabels ?? userLabels,
      labeledTxnIds: overrides.labeledTxnIds ?? labeledTxnIds,
      worthItTxnIds: overrides.worthItTxnIds ?? worthItTxnIds,
    };
    try { await SmsModule.saveData(STORAGE_KEY, JSON.stringify(payload)); } catch (e) {}
  };

  const resetAppData = async () => {
    try {
      await SmsModule.saveData(STORAGE_KEY, JSON.stringify({}));
      setMode(null);
      setHasPermission(false);
      setTransactions([]);
      setUserLabels([]);
      setLabeledTxnIds([]);
      setWorthItTxnIds([]);
      setScores({ discipline: 0, impulse: 0, volatility: 0, wellness: 0 });
    } catch (e) {
      console.warn("Failed to reset data", e);
    }
  };

  const checkPermission = async (saved?: any) => {
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
    if (granted) { setHasPermission(true); fetchSMS(saved); }
  };

  const requestPermission = async () => {
    try {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
        title: "CentiQ Behavioral Access", message: "CentiQ analyzes your transaction SMS to show you WHY you spend.",
        buttonNeutral: "Ask Me Later", buttonNegative: "Exit App", buttonPositive: "Grant Access"
      });
      if (granted === PermissionsAndroid.RESULTS.GRANTED) { setHasPermission(true); fetchSMS(savedStateRef.current); }
      else { Alert.alert("Permission Denied", "CentiQ cannot function without SMS access. Exiting."); setTimeout(() => BackHandler.exitApp(), 1500); }
    } catch (err) {}
  };

  const fetchSMS = async (saved?: any) => {
    try {
      const rawSmsList = await SmsModule.readBankSMS();
      const parsedTxns = backfillHistory(rawSmsList);
      parsedTxns.forEach((txn) => { txn.id = `${txn.date.getTime()}_${txn.amount}_${txn.merchant}_${txn.type}`; });
      setTransactions(parsedTxns);

      const debitTxns = parsedTxns.filter(t => t.type === 'debit');
      if (debitTxns.length === 0) return;

      const worthIt = saved?.worthItTxnIds ?? worthItTxnIds;
      const liberalTxns = debitTxns.filter(t => !worthIt.includes(t.id!));

      const discipline = calculateDisciplineScore(debitTxns);
      const impulse = calculateImpulseIndex(liberalTxns);
      const volatility = calculateVolatilityScore(debitTxns);

      // Calculate Savings Rate for the current month
      const now = new Date();
      const monthlyDebit = debitTxns.filter(t => t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear()).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const monthlyCredit = parsedTxns.filter(t => t.type === 'credit' && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear()).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const savingsRate = monthlyCredit > 0 ? Math.max(0, Math.min(100, ((monthlyCredit - monthlyDebit) / monthlyCredit) * 100)) : 0;

      const wellness = calculateWellnessScore(discipline, impulse, volatility);
      setScores({ discipline, impulse, volatility, wellness });

      const existingLabels = saved?.userLabels;
      if (existingLabels && existingLabels.length > 0) {
        model.train(existingLabels); setUserLabels(existingLabels);
      } else {
        const totalSpend = debitTxns.reduce((sum, t) => sum + t.amount, 0);
        const avgAmt = totalSpend / debitTxns.length;
        const pseudoLabels: UserLabel[] = debitTxns.map(t => {
          const features = model.extractFeatures(t, avgAmt);
          const hour = t.date.getHours();
          const isImpulsive = (hour >= 22 || hour <= 6) || t.amount > avgAmt ? 1 : 0;
          return { txnFeatures: features, isImpulsive };
        });
        model.train(pseudoLabels); setUserLabels(pseudoLabels); saveState({ userLabels: pseudoLabels });
      }
    } catch (e) { console.error("Failed to read SMS", e); }
  };

  const avgAmount = useMemo(() => {
    if (transactions.length === 0) return 0;
    return transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length;
  }, [transactions]);

  // Real Weekly Spending Calculation
  const weeklyData = useMemo(() => {
    const spendByDay = [0, 0, 0, 0, 0, 0, 0]; // Sun to Sat
    const now = new Date();
    transactions.forEach(t => {
      if (t.type === 'debit') {
        const txnDate = new Date(t.date);
        const diffTime = now.getTime() - txnDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 7) {
          spendByDay[txnDate.getDay()] += t.amount;
        }
      }
    });
    return [
      { day: 'Mon', amount: spendByDay[1] }, { day: 'Tue', amount: spendByDay[2] },
      { day: 'Wed', amount: spendByDay[3] }, { day: 'Thu', amount: spendByDay[4] },
      { day: 'Fri', amount: spendByDay[5] }, { day: 'Sat', amount: spendByDay[6] },
      { day: 'Sun', amount: spendByDay[0] },
    ];
  }, [transactions]);

  // Aggregates data for the Analytics Modal based on selected time frame
  const analyticsData = useMemo(() => {
    const now = new Date();
    const debitTxns = transactions.filter(t => t.type === 'debit');

    if (analyticsPeriod === 'week') {
      const spendByDay = [0, 0, 0, 0, 0, 0, 0];
      debitTxns.forEach(t => {
        const diffDays = Math.floor((now.getTime() - t.date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 7) spendByDay[t.date.getDay()] += t.amount;
      });
      return [
        { day: 'Mon', amount: spendByDay[1] }, { day: 'Tue', amount: spendByDay[2] },
        { day: 'Wed', amount: spendByDay[3] }, { day: 'Thu', amount: spendByDay[4] },
        { day: 'Fri', amount: spendByDay[5] }, { day: 'Sat', amount: spendByDay[6] },
        { day: 'Sun', amount: spendByDay[0] },
      ];
    }

    if (analyticsPeriod === '3m') {
      const weeks = 12; // ~3 months
      const data = Array(weeks).fill(0).map((_, i) => ({ day: `W${i+1}`, amount: 0 }));
      debitTxns.forEach(t => {
        const diffDays = Math.floor((now.getTime() - t.date.getTime()) / (1000 * 60 * 60 * 24));
        const diffWeeks = Math.floor(diffDays / 7);
        if (diffWeeks >= 0 && diffWeeks < weeks) data[weeks - 1 - diffWeeks].amount += t.amount;
      });
      return data;
    }

    // 6m and 1y (Group by Month)
    const months = analyticsPeriod === '6m' ? 6 : 12;
    const data = Array(months).fill(0).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      return { day: d.toLocaleString('default', { month: 'short' }), amount: 0, year: d.getFullYear(), month: d.getMonth() };
    });

    debitTxns.forEach(t => {
      const tDate = t.date;
      for (let i = 0; i < months; i++) {
        if (tDate.getFullYear() === data[i].year && tDate.getMonth() === data[i].month) {
          data[i].amount += t.amount;
          break;
        }
      }
    });
    return data.map(d => ({ day: d.day, amount: d.amount }));
  }, [transactions, analyticsPeriod]);

  const handleLabelTransaction = (txn: ParsedTransaction, isImpulsive: boolean) => {
    const features = model.extractFeatures(txn, avgAmount);
    const newLabel: UserLabel = { txnFeatures: features, isImpulsive: isImpulsive ? 1 : 0 };
    const updatedLabels = [...userLabels, newLabel];
    const updatedLabeledIds = [...labeledTxnIds, txn.id!];
    const updatedWorthIt = isImpulsive ? worthItTxnIds : [...worthItTxnIds, txn.id!];

    setUserLabels(updatedLabels); setLabeledTxnIds(updatedLabeledIds); setWorthItTxnIds(updatedWorthIt);
    model.train(updatedLabels);

    const debitTxns = transactions.filter(t => t.type === 'debit');
    const liberalTxns = debitTxns.filter(t => !updatedWorthIt.includes(t.id!));
    const newImpulse = calculateImpulseIndex(liberalTxns);
    const newWellness = calculateWellnessScore(scores.discipline, newImpulse, scores.volatility);
    setScores({ ...scores, impulse: newImpulse, wellness: newWellness });
    saveState({ userLabels: updatedLabels, labeledTxnIds: updatedLabeledIds, worthItTxnIds: updatedWorthIt });
  };

  if (!hasPermission) {
    return (
      <View style={styles.darkContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.onboardingContent}>
          <Text style={styles.logo}>CentiQ</Text>
          <Text style={styles.onboardingTitle}>Understand your money habits.</Text>
          <Text style={styles.onboardingSubtext}>Not just where you spend, but why. Connect your SMS to unlock your behavioral profile.</Text>
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Connect SMS</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!mode) {
    return (
      <View style={styles.darkContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.onboardingContent}>
          <Text style={styles.logo}>Choose your style</Text>
          <Text style={styles.onboardingSubtext}>How do you want CentiQ to analyze your spending?</Text>
          <TouchableOpacity style={[styles.modeCard, { borderColor: C.danger }]} onPress={() => { setMode('strict'); saveState({ mode: 'strict' }); }}>
            <Text style={styles.modeTitle}>Strict Mode</Text>
            <Text style={styles.modeText}>Judges spending against standard population benchmarks. No excuses, pure math.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeCard, { borderColor: C.success }]} onPress={() => { setMode('liberal'); saveState({ mode: 'liberal' }); }}>
            <Text style={styles.modeTitle}>Liberal Mode</Text>
            <Text style={styles.modeText}>If you're happy with a purchase, we exclude it from your impulsivity score. You define your own discipline.</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.darkContainer}>
      <StatusBar barStyle="light-content" />

      {activeTab === 'dashboard' ? (
        <FlatList
          data={[]}
          renderItem={null}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListHeaderComponent={() => (
            <View>
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.greeting}>Welcome back</Text>
                  <Text style={styles.headerTitle}>Your money, decoded.</Text>
                </View>
                <View style={[styles.glassCard, { padding: 10, marginBottom: 0 }]}>
                  <CircularScoreCard score={scores.wellness} label="Wellness" color={C.accent} size={100} />
                </View>
              </View>

              <View style={[styles.glassCard, { padding: 16, borderColor: 'rgba(56,189,248,0.25)' }]}>
                <Text style={styles.mlTitle}>✨ Personalized ML Engine</Text>
                <Text style={styles.mlStatus}>
                  {userLabels.length < 15 ? `Learning... ${userLabels.length}/15 labels needed` : `Active! Trained on ${userLabels.length} decisions`}
                </Text>
              </View>

              {/* Financial Wellness Card */}
              <View style={[styles.glassCard, { padding: 22, marginBottom: 16 }]}>
                <Text style={[styles.sectionLabel, { marginBottom: 20 }]}>FINANCIAL WELLNESS</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ marginRight: 20 }}>
                    <CircularScoreCard score={scores.wellness} label="Score" color={C.accent} size={110} />
                  </View>

                  <View style={{ flex: 1 }}>
                    {/* Discipline Meter */}
                    <View style={styles.meterContainer}>
                      <View style={styles.meterLabelRow}>
                        <Text style={styles.meterLabel}>Discipline</Text>
                        <Text style={styles.meterValue}>{scores.discipline}/100</Text>
                      </View>
                      <View style={styles.meterBackground}><View style={[styles.meterFill, { width: `${scores.discipline}%`, backgroundColor: C.success }]} /></View>
                    </View>

                    {/* Impulse Meter */}
                    <View style={styles.meterContainer}>
                      <View style={styles.meterLabelRow}>
                        <Text style={styles.meterLabel}>Impulse Index</Text>
                        <Text style={styles.meterValue}>{scores.impulse}/100</Text>
                      </View>
                      <View style={styles.meterBackground}><View style={[styles.meterFill, { width: `${scores.impulse}%`, backgroundColor: C.warning }]} /></View>
                    </View>

                    {/* Volatility Meter */}
                    <View style={styles.meterContainer}>
                      <View style={styles.meterLabelRow}>
                        <Text style={styles.meterLabel}>Volatility</Text>
                        <Text style={styles.meterValue}>{scores.volatility}/100</Text>
                      </View>
                      <View style={styles.meterBackground}><View style={[styles.meterFill, { width: `${scores.volatility}%`, backgroundColor: '#7F77DD' }]} /></View>
                    </View>

                    {/* Savings Rate Meter */}
                    <View style={styles.meterContainer}>
                      <View style={styles.meterLabelRow}>
                        <Text style={styles.meterLabel}>Savings Rate</Text>
                        <Text style={styles.meterValue}>{Math.round(scores.savingsRate)}/100</Text>
                      </View>
                      <View style={styles.meterBackground}><View style={[styles.meterFill, { width: `${scores.savingsRate}%`, backgroundColor: C.accent }]} /></View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Bar Chart */}
              <View style={[styles.glassCard, { padding: 22 }]}>
                <Text style={styles.sectionLabel}>Weekly spending (Bars)</Text>
                <View style={styles.chartContainer}>
                  {weeklyData.map((item, i) => {
                    const maxVal = Math.max(...weeklyData.map(d => Number(d.amount) || 0), 1);
                    const heightPct = ((Number(item.amount) || 0) / maxVal) * 100;
                    return (
                      <TouchableOpacity key={i} style={styles.chartBarWrapper} onPress={() => setActiveDay(activeDay === i ? null : i)}>
                        {activeDay === i && (
                          <View style={styles.barTooltip}>
                            <Text style={styles.barTooltipText}>₹{Math.round(Number(item.amount) || 0).toLocaleString('en-IN')}</Text>
                          </View>
                        )}
                        <View style={styles.chartBarBg}>
                          <View style={[styles.chartBarFill, {
                            height: `${heightPct}%`,
                            backgroundColor: activeDay === i ? C.accent : 'rgba(56,189,248,0.3)',
                            borderTopLeftRadius: 6, borderTopRightRadius: 6
                          }]} />
                        </View>
                        <Text style={styles.chartDayLabel}>{item.day}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Area / Line Chart */}
              <View style={[styles.glassCard, { padding: 22 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={styles.sectionLabel}>Weekly spending (Trend)</Text>
                  <TouchableOpacity onPress={() => setShowAnalytics(true)}>
                       <Text style={{ color: C.textSecondary, fontSize: 12 }}>View analytics</Text>
                  </TouchableOpacity>
                </View>
                <PremiumChart data={weeklyData} activeDay={activeDay} setActiveDay={setActiveDay} />
              </View>
            </View>
          )}
        />
      ) : activeTab === 'transactions' ? (
        <TransactionsScreen
          transactions={transactions}
          mode={mode}
          userLabels={userLabels}
          labeledTxnIds={labeledTxnIds}
          avgAmount={avgAmount}
          model={model}
          handleLabelTransaction={handleLabelTransaction}
        />
      ) : (
        <BudgetsScreen transactions={transactions} />
      )}

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('dashboard')}>
          <Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('transactions')}>
          <Text style={[styles.tabText, activeTab === 'transactions' && styles.tabTextActive]}>Transactions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('budgets')}>
          <Text style={[styles.tabText, activeTab === 'budgets' && styles.tabTextActive]}>Budgets</Text>
        </TouchableOpacity>
      </View>

      {/* Floating Reset Button for Testing */}
      <TouchableOpacity style={styles.resetBtn} onPress={resetAppData}>
        <Text style={styles.resetBtnText}>Reset</Text>
      </TouchableOpacity>

      {/* Analytics Modal */}
      <Modal visible={showAnalytics} animationType="slide" transparent={true} onRequestClose={() => setShowAnalytics(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Spending Analytics</Text>
              <TouchableOpacity onPress={() => setShowAnalytics(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Time Period Selector */}
            <View style={styles.periodSelector}>
              {[
                { key: 'week', label: '1W' },
                { key: '3m', label: '3M' },
                { key: '6m', label: '6M' },
                { key: '1y', label: '1Y' }
              ].map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.periodBtn, analyticsPeriod === p.key && styles.periodBtnActive]}
                  onPress={() => { setAnalyticsPeriod(p.key as any); setAnalyticsActiveDay(null); }}
                >
                  <Text style={[styles.periodBtnText, analyticsPeriod === p.key && styles.periodBtnTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* The Dynamic Chart */}
            <View style={{ marginTop: 20, alignItems: 'center' }}>
              <PremiumChart data={analyticsData} activeDay={analyticsActiveDay} setActiveDay={setAnalyticsActiveDay} />
            </View>

          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  darkContainer: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 24, paddingTop: 50 },
  onboardingContent: { flex: 1, justifyContent: 'center' },
  logo: { color: C.textPrimary, fontSize: 32, fontWeight: 'bold', marginBottom: 20 },
  onboardingTitle: { color: C.textPrimary, fontSize: 28, fontWeight: '700', marginBottom: 12, lineHeight: 34 },
  onboardingSubtext: { color: C.textSecondary, fontSize: 16, lineHeight: 22 },
  primaryButton: { backgroundColor: C.accent, padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  primaryButtonText: { color: '#001018', fontSize: 16, fontWeight: 'bold' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { color: C.textSecondary, fontSize: 13.5, marginBottom: 4 },
  headerTitle: { color: C.textPrimary, fontSize: 26, fontWeight: '700' },
  glassCard: { backgroundColor: C.glass, borderColor: C.border, borderWidth: 1, borderRadius: 20, marginBottom: 16 },
  mlTitle: { color: C.accent, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  mlStatus: { color: C.textSecondary, fontSize: 13 },
  sectionLabel: { color: C.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 16 },
  meterContainer: { marginBottom: 16 },
  meterLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  meterLabel: { color: C.textSecondary, fontSize: 12.5 },
  meterValue: { color: C.textPrimary, fontSize: 12.5, fontWeight: '600' },
  meterBackground: { height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 999 },
  chartContainer: { flexDirection: 'row', justifyContent: 'space-between', height: 140, alignItems: 'flex-end', marginTop: 20 },
  chartBarWrapper: { alignItems: 'center', width: 38, height: '100%', justifyContent: 'flex-end' },
  barTooltip: {
    position: 'absolute',
    top: -10,
    backgroundColor: C.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
    minWidth: 50, // Force it to be wider
    left: -6, // Center it over the bar
    alignItems: 'center'
  },
  barTooltipText: {
    color: '#001018',
    fontSize: 11,
    fontWeight: 'bold',
    flexWrap: 'nowrap' // Prevent text from wrapping to the next line
  },
  chartBarBg: { width: 14, height: '75%', justifyContent: 'flex-end' },
  chartBarFill: { width: '100%' },
  chartDayLabel: { color: C.textSecondary, fontSize: 10, marginTop: 6 },  modeCard: { backgroundColor: C.glass, borderWidth: 2, padding: 20, borderRadius: 16, marginBottom: 16 },
  modeTitle: { color: C.textPrimary, fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  modeText: { color: C.textSecondary, fontSize: 14, lineHeight: 20 },
  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, backgroundColor: 'rgba(8,8,8,0.9)', flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border },
  tabButton: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabText: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: C.accent },
  resetBtn: { position: 'absolute', top: 50, right: 24, backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)' },
  resetBtnText: { color: C.danger, fontSize: 12, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, height: '60%', borderWidth: 1, borderColor: C.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: C.textPrimary, fontSize: 20, fontWeight: 'bold' },
  closeBtn: { color: C.textSecondary, fontSize: 18, padding: 8 },
  periodSelector: { flexDirection: 'row', backgroundColor: C.glass, borderRadius: 12, padding: 4 },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  periodBtnActive: { backgroundColor: C.accent },
  periodBtnText: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },
  periodBtnTextActive: { color: '#001018', fontWeight: 'bold' }
});