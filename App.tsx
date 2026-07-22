// App.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  PermissionsAndroid,
  BackHandler,
  Alert,
  NativeModules,
  FlatList,
  StatusBar
} from 'react-native';
import { parseBankSMS, ParsedTransaction } from './src/lib/smsParser';
import { calculateDisciplineScore, calculateImpulseIndex, calculateWellnessScore, calculateVolatilityScore } from './src/lib/behavioralEngine';
import { UserBehaviorModel, UserLabel } from './src/lib/personalization';
import { backfillHistory } from './src/lib/historicalSync';
import BudgetsScreen from './src/screens/BudgetsScreen';
import CircularScoreCard from './src/components/CircularScoreCard';

const { SmsModule } = NativeModules;

const getScoreColor = (score: number, type: 'good' | 'bad') => {
  if (type === 'good') return score >= 70 ? '#4ADE80' : score >= 40 ? '#FACC15' : '#F87171';
  if (type === 'bad') return score >= 70 ? '#F87171' : score >= 40 ? '#FACC15' : '#4ADE80';
  return '#FFFFFF';
};

export default function App() {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [scores, setScores] = useState({ discipline: 0, impulse: 0, volatility: 0, wellness: 0 });

  const [mode, setMode] = useState<'strict' | 'liberal' | null>(null);
  const [worthItTxnIds, setWorthItTxnIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'budgets'>('dashboard');

  // ML State
  const [model] = useState(new UserBehaviorModel());
  const [userLabels, setUserLabels] = useState<UserLabel[]>([]);
  const [labeledTxnIds, setLabeledTxnIds] = useState<string[]>([]);

  useEffect(() => {
    loadSavedData();
    checkPermission();
  }, []);

  const loadSavedData = async () => { };

  const checkPermission = async () => {
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
    if (granted) {
      setHasPermission(true);
      fetchSMS();
    }
  };

  const requestPermission = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: "CentiQ Behavioral Access",
          message: "CentiQ analyzes your transaction SMS to show you WHY you spend.",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Exit App",
          buttonPositive: "Grant Access"
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        setHasPermission(true);
        fetchSMS();
      } else {
        Alert.alert("Permission Denied", "CentiQ cannot function without SMS access. Exiting.");
        setTimeout(() => BackHandler.exitApp(), 1500);
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const fetchSMS = async () => {
    try {
      const rawSmsList = await SmsModule.readBankSMS();
      const parsedTxns = backfillHistory(rawSmsList);

      parsedTxns.forEach((txn, index) => {
        txn.id = `txn_${index}`;
      });

      setTransactions(parsedTxns);

      const debitTxns = parsedTxns.filter(t => t.type === 'debit');
      if (debitTxns.length > 0) {
        const discipline = calculateDisciplineScore(debitTxns);
        const impulse = calculateImpulseIndex(debitTxns);
        const volatility = calculateVolatilityScore(debitTxns);
        const wellness = calculateWellnessScore(discipline, impulse, volatility);
        setScores({ discipline, impulse, volatility, wellness });

        // PRE-TRAIN ML MODEL ON ALL HISTORY
        const totalSpend = debitTxns.reduce((sum, t) => sum + t.amount, 0);
        const avgAmt = totalSpend / debitTxns.length;
        const pseudoLabels: UserLabel[] = debitTxns.map(t => {
          const features = model.extractFeatures(t, avgAmt);
          const hour = t.date.getHours();
          const isImpulsive = (hour >= 22 || hour <= 6) || t.amount > avgAmt ? 1 : 0;
          return { txnFeatures: features, isImpulsive };
        });
        model.train(pseudoLabels);
        setUserLabels(pseudoLabels);
      }
    } catch (e) {
      console.error("Failed to read SMS", e);
    }
  };

  const avgAmount = useMemo(() => {
    if (transactions.length === 0) return 0;
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    return total / transactions.length;
  }, [transactions]);

  const handleLabelTransaction = (txn: ParsedTransaction, isImpulsive: boolean) => {
    const features = model.extractFeatures(txn, avgAmount);
    const newLabel: UserLabel = {
      txnFeatures: features,
      isImpulsive: isImpulsive ? 1 : 0
    };

    const updatedLabels = [...userLabels, newLabel];
    setUserLabels(updatedLabels);
    setLabeledTxnIds([...labeledTxnIds, txn.id!]);

    if (!isImpulsive) {
      setWorthItTxnIds([...worthItTxnIds, txn.id!]);
    }

    model.train(updatedLabels);

    const debitTxns = transactions.filter(t => t.type === 'debit');
    const liberalTxns = debitTxns.filter(t => !worthItTxnIds.includes(t.id!));

    const newImpulse = calculateImpulseIndex(liberalTxns);
    const newWellness = calculateWellnessScore(scores.discipline, newImpulse, scores.discipline);
    setScores({ ...scores, impulse: newImpulse, wellness: newWellness });
  };

  // --- ONBOARDING SCREEN ---
  if (!hasPermission) {
    return (
      <View style={styles.darkContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.onboardingContent}>
          <Text style={styles.logo}>CentiQ</Text>
          <Text style={styles.onboardingTitle}>Understand your money habits.</Text>
          <Text style={styles.onboardingSubtext}>
            Not just where you spend, but why. Connect your SMS to unlock your behavioral profile.
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Connect SMS</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- MODE SELECTION SCREEN ---
  if (!mode) {
    return (
      <View style={styles.darkContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.onboardingContent}>
          <Text style={styles.logo}>Choose your style</Text>
          <Text style={styles.onboardingSubtext}>
            How do you want CentiQ to analyze your spending?
          </Text>

          <TouchableOpacity
            style={[styles.modeCard, { borderColor: '#F87171', borderWidth: 2 }]}
            onPress={() => setMode('strict')}
          >
            <Text style={styles.modeTitle}>Strict Mode</Text>
            <Text style={styles.modeText}>Judges spending against standard population benchmarks. No excuses, pure math.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeCard, { borderColor: '#4ADE80', borderWidth: 2 }]}
            onPress={() => setMode('liberal')}
          >
            <Text style={styles.modeTitle}>Liberal Mode</Text>
            <Text style={styles.modeText}>If you're happy with a purchase, we exclude it from your impulsivity score. You define your own discipline.</Text>
          </TouchableOpacity>

        </View>
      </View>
    );
  }

  // --- DASHBOARD SCREEN ---
  return (
    <View style={styles.darkContainer}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.logo}>CentiQ</Text>
      </View>

      {/* Render Active Screen */}
      {activeTab === 'dashboard' ? (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id!}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListHeaderComponent={() => (
            <View>
              {/* ML Status Card */}
              <View style={styles.mlCard}>
                <Text style={styles.mlTitle}>Personalized ML Engine</Text>
                <Text style={styles.mlStatus}>
                  {userLabels.length < 15 ? `Learning... ${userLabels.length}/15 labels needed` : `Active! Trained on ${userLabels.length} decisions`}
                </Text>
              </View>

              {/* Scores Section (Circular Charts) */}
              <View style={styles.scoresContainer}>
                <CircularScoreCard
                  score={scores.wellness}
                  label="Wellness"
                  color={getScoreColor(scores.wellness, 'good')}
                />
                <CircularScoreCard
                  score={scores.discipline}
                  label="Discipline"
                  color={getScoreColor(scores.discipline, 'good')}
                />
                <CircularScoreCard
                  score={scores.impulse}
                  label="Impulse"
                  color={getScoreColor(scores.impulse, 'bad')}
                />
                <CircularScoreCard
                  score={scores.volatility}
                  label="Volatility"
                  color={getScoreColor(scores.volatility, 'good')}
                />
              </View>

              <Text style={styles.sectionTitle}>Recent Transactions</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.txnCard}>
              <View style={styles.txnRow}>
                <View style={styles.txnLeft}>
                  {item.merchant !== '' ? (
                    <>
                      <Text style={styles.txnBank}>
                        {item.type === 'credit' ? `From: ${item.merchant}` : `To: ${item.merchant}`}
                      </Text>
                      <Text style={styles.txnDate}>{item.bank} • {item.date.toLocaleDateString()}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.txnBank}>{item.bank}</Text>
                      <Text style={styles.txnDate}>{item.date.toLocaleDateString()}</Text>
                    </>
                  )}
                </View>

                <View style={styles.txnRight}>
                  {userLabels.length >= 5 && item.type === 'debit' && (
                    <View style={[
                      styles.mlBadge,
                      { backgroundColor: model.predict(model.extractFeatures(item, avgAmount)) > 0.6 ? '#3A1E1E' : '#1E3A2F' }
                    ]}>
                      <Text style={[
                        styles.mlBadgeText,
                        { color: model.predict(model.extractFeatures(item, avgAmount)) > 0.6 ? '#F87171' : '#4ADE80' }
                      ]}>
                        {Math.round(model.predict(model.extractFeatures(item, avgAmount)) * 100)}% Impulse
                      </Text>
                    </View>
                  )}
                  <Text style={[
                    styles.txnAmount,
                    { color: item.type === 'credit' ? '#4ADE80' : '#FFFFFF' }
                  ]}>
                    {item.type === 'credit' ? '+' : '-'}₹{item.amount}
                  </Text>
                </View>
              </View>

              {item.type === 'debit' && mode === 'liberal' && userLabels.length < 15 && !labeledTxnIds.includes(item.id!) ? (
                <View style={styles.labelContainer}>
                  <Text style={styles.labelPrompt}>Happy with this purchase?</Text>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.labelButton, { backgroundColor: '#1E3A2F' }]}
                      onPress={() => handleLabelTransaction(item, false)}
                    >
                      <Text style={styles.labelButtonTextWorth}>Worth it</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.labelButton, { backgroundColor: '#3A1E1E' }]}
                      onPress={() => handleLabelTransaction(item, true)}
                    >
                      <Text style={styles.labelButtonTextImpulse}>Impulsive</Text>
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
      ) : (
        <BudgetsScreen transactions={transactions} />
      )}

      {/* Bottom Navigation Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('dashboard')}>
          <Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('budgets')}>
          <Text style={[styles.tabText, activeTab === 'budgets' && styles.tabTextActive]}>Budgets</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  darkContainer: { flex: 1, backgroundColor: '#0F111A', paddingHorizontal: 24, paddingTop: 50 },
  onboardingContent: { flex: 1, justifyContent: 'center' },
  logo: { color: '#FFF', fontSize: 32, fontWeight: 'bold', marginBottom: 20 },
  onboardingTitle: { color: '#FFF', fontSize: 28, fontWeight: '600', marginBottom: 12, lineHeight: 34 },
  onboardingSubtext: { color: '#8E8E93', fontSize: 16, lineHeight: 22 },
  primaryButton: { backgroundColor: '#4ADE80', padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  primaryButtonText: { color: '#0F111A', fontSize: 16, fontWeight: 'bold' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  mlCard: { backgroundColor: '#1A1A2E', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#4ADE80' },
  mlTitle: { color: '#4ADE80', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  mlStatus: { color: '#8E8E93', fontSize: 13 },
  scoresContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32, paddingHorizontal: 4 },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  txnCard: { backgroundColor: '#1E2233', padding: 16, borderRadius: 12, marginBottom: 12 },
  txnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  txnLeft: { flexDirection: 'column' },
  txnBank: { color: '#FFF', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  txnDate: { color: '#8E8E93', fontSize: 12 },
  txnAmount: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  labelContainer: { borderTopWidth: 1, borderTopColor: '#2D2D44', paddingTop: 12 },
  labelPrompt: { color: '#8E8E93', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  labelButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  labelButtonTextWorth: { color: '#4ADE80', fontWeight: '600', fontSize: 13 },
  labelButtonTextImpulse: { color: '#F87171', fontWeight: '600', fontSize: 13 },
  thankYouText: { color: '#666', fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
  txnRight: { flexDirection: 'column', alignItems: 'flex-end' },
  mlBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 6 },
  mlBadgeText: { fontSize: 11, fontWeight: 'bold' },
  modeCard: { backgroundColor: '#1E2233', padding: 20, borderRadius: 12, marginBottom: 16 },
  modeTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  modeText: { color: '#8E8E93', fontSize: 14, lineHeight: 20 },
  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, backgroundColor: '#1A1A2E', flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#2D2D44' },
  tabButton: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabText: { color: '#8E8E93', fontSize: 16, fontWeight: '600' },
  tabTextActive: { color: '#4ADE80' }
});