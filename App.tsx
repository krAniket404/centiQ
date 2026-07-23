import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, PermissionsAndroid, BackHandler,
  Alert, NativeModules, FlatList, StatusBar
} from 'react-native';
import { parseBankSMS, ParsedTransaction } from './src/lib/smsParser';
import { calculateDisciplineScore, calculateImpulseIndex, calculateWellnessScore, calculateVolatilityScore } from './src/lib/behavioralEngine';
import { UserBehaviorModel, UserLabel } from './src/lib/personalization';
import { backfillHistory } from './src/lib/historicalSync';
import BudgetsScreen from './src/screens/BudgetsScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import AICoachScreen from './src/screens/AICoachScreen';
import CircularScoreCard from './src/components/CircularScoreCard';
import PremiumChart from './src/components/PremiumChart';
import { supabase } from './src/lib/supabase';
import AuthScreen from './src/screens/AuthScreen';
import { Session } from '@supabase/supabase-js';
import SettingsScreen from './src/screens/SettingsScreen';

const { SmsModule } = NativeModules;
const STORAGE_KEY = 'centiq_state_v1';

// Exact Figma Design Tokens
const C = {
  bg: "#080808",
  glass: "rgba(255,255,255,0.07)",
  glassStrong: "rgba(255,255,255,0.10)",
  border: "rgba(255,255,255,0.13)",
  borderStrong: "rgba(255,255,255,0.18)",
  textPrimary: "#FFFFFF",
  textSecondary: "#B8B8B8",
  accent: "#38BDF8",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  purple: "#8B5CF6"
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'budgets' | 'coach' | 'settings'>('dashboard');
  const [activeDay, setActiveDay] = useState<number | null>(null);

  const [model] = useState(new UserBehaviorModel());
  const [userLabels, setUserLabels] = useState<UserLabel[]>([]);
  const [labeledTxnIds, setLabeledTxnIds] = useState<string[]>([]);

  const savedStateRef = useRef<any>(null);

  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

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
      setMode(null); setHasPermission(false); setTransactions([]); setUserLabels([]);
      setLabeledTxnIds([]); setWorthItTxnIds([]);
      setScores({ discipline: 0, impulse: 0, volatility: 0, wellness: 0, savingsRate: 0 });
    } catch (e) {}
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
      syncToCloud(parsedTxns);

      const debitTxns = parsedTxns.filter(t => t.type === 'debit');
      if (debitTxns.length === 0) return;

      const worthIt = saved?.worthItTxnIds ?? worthItTxnIds;
      const liberalTxns = debitTxns.filter(t => !worthIt.includes(t.id!));

      const discipline = calculateDisciplineScore(debitTxns);
      const impulse = calculateImpulseIndex(liberalTxns);
      const volatility = calculateVolatilityScore(debitTxns);

      const now = new Date();
      const monthlyDebit = debitTxns.filter(t => t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear()).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const monthlyCredit = parsedTxns.filter(t => t.type === 'credit' && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear()).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const savingsRate = monthlyCredit > 0 ? Math.max(0, Math.min(100, ((monthlyCredit - monthlyDebit) / monthlyCredit) * 100)) : 0;

      const wellness = calculateWellnessScore(discipline, impulse, volatility);
      setScores({ discipline, impulse, volatility, wellness, savingsRate });

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

  const syncToCloud = async (txns: ParsedTransaction[]) => {
    // If login is bypassed, we use a mock user ID for testing
    const userId = session?.user?.id || '00000000-0000-0000-0000-000000000000';

    const payload = txns.map(t => ({
      user_id: userId,
      amount: t.amount,
      merchant: t.merchant,
      category: t.category,
      txn_date: t.date.toISOString(),
      type: t.type
    }));

    try {
      // Upload to Supabase (ignoring duplicates)
      const { error } = await supabase
        .from('transactions')
        .upsert(payload, { onConflict: 'user_id, txn_date, amount, merchant' });

      if (error) console.warn('Cloud sync error:', error.message);
      else console.log('☁️ Synced transactions to Supabase!');
    } catch (e) {
      console.warn('Failed to sync to cloud', e);
    }
  };

  const avgAmount = useMemo(() => {
    if (transactions.length === 0) return 0;
    return transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length;
  }, [transactions]);

  const weeklyData = useMemo(() => {
    const spendByDay = [0, 0, 0, 0, 0, 0, 0];
    const now = new Date();
    transactions.forEach(t => {
      if (t.type === 'debit') {
        const diffDays = Math.floor((now.getTime() - t.date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 7) spendByDay[t.date.getDay()] += t.amount;
      }
    });
    return [
      { day: 'Mon', amount: spendByDay[1] }, { day: 'Tue', amount: spendByDay[2] },
      { day: 'Wed', amount: spendByDay[3] }, { day: 'Thu', amount: spendByDay[4] },
      { day: 'Fri', amount: spendByDay[5] }, { day: 'Sat', amount: spendByDay[6] },
      { day: 'Sun', amount: spendByDay[0] },
    ];
  }, [transactions]);

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
  //Temporary Login bypass
  //if(!session){
  //    return <AuthScreen/> ;
  //    }

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
                <TouchableOpacity style={styles.syncPill} onPress={resetAppData}>
                  <View style={styles.syncDot} />
                  <Text style={styles.syncText}>Reset</Text>
                </TouchableOpacity>
              </View>

              {/* Financial Wellness Card (Heavy Glass) */}
              <View style={[styles.glassCardHeavy, { padding: 22, marginBottom: 16 }]}>
                <Text style={[styles.cardHeaderTitle, { marginBottom: 20 }]}>FINANCIAL WELLNESS</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ marginRight: 20 }}>
                    <CircularScoreCard score={scores.wellness} label="Score" color={C.accent} size={110} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.meterContainer}>
                      <View style={styles.meterLabelRow}><Text style={styles.meterLabel}>Discipline</Text><Text style={styles.meterValue}>{scores.discipline}/100</Text></View>
                      <View style={styles.meterBackground}><View style={[styles.meterFill, { width: `${scores.discipline}%`, backgroundColor: C.success }]} /></View>
                    </View>
                    <View style={styles.meterContainer}>
                      <View style={styles.meterLabelRow}><Text style={styles.meterLabel}>Impulse Index</Text><Text style={styles.meterValue}>{scores.impulse}/100</Text></View>
                      <View style={styles.meterBackground}><View style={[styles.meterFill, { width: `${scores.impulse}%`, backgroundColor: C.warning }]} /></View>
                    </View>
                    <View style={styles.meterContainer}>
                      <View style={styles.meterLabelRow}><Text style={styles.meterLabel}>Volatility</Text><Text style={styles.meterValue}>{scores.volatility}/100</Text></View>
                      <View style={styles.meterBackground}><View style={[styles.meterFill, { width: `${scores.volatility}%`, backgroundColor: C.purple }]} /></View>
                    </View>
                    <View style={styles.meterContainer}>
                      <View style={styles.meterLabelRow}><Text style={styles.meterLabel}>Savings Rate</Text><Text style={styles.meterValue}>{Math.round(scores.savingsRate)}/100</Text></View>
                      <View style={styles.meterBackground}><View style={[styles.meterFill, { width: `${scores.savingsRate}%`, backgroundColor: C.accent }]} /></View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Bar Chart */}
              <View style={[styles.glassCard, { padding: 22 }]}>
                <Text style={styles.cardHeaderTitle}>WEEKLY SPENDING (BARS)</Text>
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

              {/* Premium Weekly Spending Chart */}
              <View style={[styles.glassCard, { padding: 22, marginTop: 16 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={styles.cardHeaderTitle}>WEEKLY SPENDING (TREND)</Text>
                  <Text style={styles.subtleText}>₹{Math.round(weeklyData.reduce((a,b) => a + b.amount, 0)).toLocaleString('en-IN')}</Text>
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
      ) : activeTab === 'budgets' ? (
        <BudgetsScreen transactions={transactions} />
      ) : activeTab === 'coach' ? (
        <AICoachScreen transactions={transactions} scores={scores} />
      ) : (
        <SettingsScreen
          mode={mode}
          setMode={(m) => { setMode(m); saveState({ mode: m }); }}
          resetAppData={resetAppData}
          userLabels={userLabels}
        />
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
        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('coach')}>
          <Text style={[styles.tabText, activeTab === 'coach' && styles.tabTextActive]}>AI Coach</Text>
        </TouchableOpacity>
        {/* ADD THIS NEW BUTTON */}
        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('settings')}>
          <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>Settings</Text>
        </TouchableOpacity>
      </View>      
    </View>
  );
}

const styles = StyleSheet.create({
  darkContainer: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20, paddingTop: 50 },
  onboardingContent: { flex: 1, justifyContent: 'center' },
  logo: { color: C.textPrimary, fontSize: 32, fontWeight: 'bold', marginBottom: 20 },
  onboardingTitle: { color: C.textPrimary, fontSize: 28, fontWeight: '700', marginBottom: 12, lineHeight: 34 },
  onboardingSubtext: { color: C.textSecondary, fontSize: 16, lineHeight: 22 },
  primaryButton: { backgroundColor: C.accent, padding: 18, borderRadius: 14, alignItems: 'center', marginBottom: 20 },
  primaryButtonText: { color: '#001018', fontSize: 16, fontWeight: 'bold' },

  // Dashboard Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { color: C.textSecondary, fontSize: 13, marginBottom: 4 },
  headerTitle: { color: C.textPrimary, fontSize: 24, fontWeight: '700' },
  syncPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  syncDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success, marginRight: 6 },
  syncText: { color: C.textSecondary, fontSize: 12, fontWeight: '600' },

  // Glass Cards
  glassCard: { backgroundColor: C.glass, borderColor: C.border, borderWidth: 1, borderRadius: 20 },
  glassCardHeavy: { backgroundColor: C.glassStrong, borderColor: C.borderStrong, borderWidth: 1, borderRadius: 24 },
  cardHeaderTitle: { color: C.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 16 },
  subtleText: { color: C.textSecondary, fontSize: 12 },

  // Meters
  meterContainer: { marginBottom: 14 },
  meterLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  meterLabel: { color: C.textSecondary, fontSize: 12.5 },
  meterValue: { color: C.textPrimary, fontSize: 12.5, fontWeight: '600' },
  meterBackground: { height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 999 },

  // Charts
  chartContainer: { flexDirection: 'row', justifyContent: 'space-between', height: 140, alignItems: 'flex-end', marginTop: 20 },
  chartBarWrapper: { alignItems: 'center', width: 38, height: '100%', justifyContent: 'flex-end' },
  barTooltip: { position: 'absolute', top: 0, backgroundColor: C.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, zIndex: 10, minWidth: 50, left: -6, alignItems: 'center' },
  barTooltipText: { color: '#001018', fontSize: 11, fontWeight: 'bold', flexWrap: 'nowrap' },
  chartBarBg: { width: 14, height: '75%', justifyContent: 'flex-end' },
  chartBarFill: { width: '100%' },
  chartDayLabel: { color: C.textSecondary, fontSize: 10, marginTop: 6 },

  // Mode Selection
  modeCard: { backgroundColor: C.glass, borderWidth: 2, padding: 20, borderRadius: 18, marginBottom: 16 },
  modeTitle: { color: C.textPrimary, fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  modeText: { color: C.textSecondary, fontSize: 14, lineHeight: 20 },

  // Tab Bar
  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, backgroundColor: 'rgba(8,8,8,0.9)', flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border },
  tabButton: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabText: { color: C.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: C.accent }
});