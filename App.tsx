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
import { calculateDisciplineScore, calculateImpulseIndex, calculateWellnessScore } from './src/lib/behavioralEngine';
import { UserBehaviorModel, UserLabel } from './src/lib/personalization';

const { SmsModule } = NativeModules;

const getScoreColor = (score: number, type: 'good' | 'bad') => {
  if (type === 'good') return score >= 70 ? '#4ADE80' : score >= 40 ? '#FACC15' : '#F87171';
  if (type === 'bad') return score >= 70 ? '#F87171' : score >= 40 ? '#FACC15' : '#4ADE80';
  return '#FFFFFF';
};

export default function App() {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [scores, setScores] = useState({ discipline: 0, impulse: 0, wellness: 0 });

  //Add newly by Sanjana
  const [mode, setMode] = useState<'strict' | 'liberal' | null>(null);
  const [worthItTxnIds, setWorthItTxnIds] = useState<string[]>([]);

  // ML State
  const [model] = useState(new UserBehaviorModel()); // Initialize model once
  const [userLabels, setUserLabels] = useState<UserLabel[]>([]);
  const [labeledTxnIds, setLabeledTxnIds] = useState<string[]>([]); // To hide buttons after clicking

  useEffect(() => {
    loadSavedData();
    checkPermission();
  }, []);

  const loadSavedData = async () => {
    //try {
    //  const savedLabels = await AsyncStorage.getItem('userLabels');
    //  if (savedLabels) {
    //    const parsedLabels = JSON.parse(savedLabels);
    //    setUserLabels(parsedLabels);
    //    model.train(parsedLabels);
    //  }
    //  const savedMode = await AsyncStorage.getItem('userMode');
    //  if (savedMode) setMode(savedMode as 'strict' | 'liberal');
    //} catch (e) {
    //  console.error("Failed to load saved data", e);
    //}
  };

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
        const parsedTxns = rawSmsList
          .map((sms: any) => parseBankSMS(sms.body, sms.date))
          .filter((txn: ParsedTransaction | null) => txn !== null) as ParsedTransaction[];

        // Add unique ID
        parsedTxns.forEach((txn, index) => {
          txn.id = `txn_${index}`;
        });

        setTransactions(parsedTxns);

        // ONLY calculate behavioral scores on DEBITS (money going out)
        const debitTxns = parsedTxns.filter(t => t.type === 'debit');
        if (debitTxns.length > 0) {
          const discipline = calculateDisciplineScore(debitTxns);
          const impulse = calculateImpulseIndex(debitTxns);
          const wellness = calculateWellnessScore(discipline, impulse, discipline);
          setScores({ discipline, impulse, wellness });
        }
      } catch (e) {
        console.error("Failed to read SMS", e);
      }
    };

  // Calculate user's average spend amount to feed to the ML model
  const avgAmount = useMemo(() => {
    if (transactions.length === 0) return 0;
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    return total / transactions.length;
  }, [transactions]);

  // Handle user pressing "Worth it" or "Impulsive"
  const handleLabelTransaction = (txn: ParsedTransaction, isImpulsive: boolean) => {
    const features = model.extractFeatures(txn, avgAmount);
    const newLabel: UserLabel = {
      txnFeatures: features,
      isImpulsive: isImpulsive ? 1 : 0
    };

    const updatedLabels = [...userLabels, newLabel];
    setUserLabels(updatedLabels);
    setLabeledTxnIds([...labeledTxnIds, txn.id!]);

    // If "Worth it", add to exclusion list
    if (!isImpulsive) {
      setWorthItTxnIds([...worthItTxnIds, txn.id!]);
    }

    // Retrain the model in real-time!
    model.train(updatedLabels);


    // RECALCULATE IMPULSE SCORE (Liberal Mode!)
    const debitTxns = transactions.filter(t => t.type === 'debit');
    // Exclude the ones marked "Worth it"
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
            onPress={() => {
              setMode('strict');
            }}
          >
            <Text style={styles.modeTitle}>Strict Mode</Text>
            <Text style={styles.modeText}>Judges spending against standard population benchmarks. No excuses, pure math.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeCard, { borderColor: '#4ADE80', borderWidth: 2 }]}
            onPress={() => {
              setMode('liberal');
            }}
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

      {/* ML Status Card */}
      <View style={styles.mlCard}>
        <Text style={styles.mlTitle}>Personalized ML Engine</Text>
        <Text style={styles.mlStatus}>
          {userLabels.length < 15 ? `Learning... ${userLabels.length}/15 labels needed` : `Active! Trained on ${userLabels.length} decisions`}
        </Text>
      </View>

      {/* Scores Section */}
      <View style={styles.scoresContainer}>
        <View style={[styles.scoreCard, { flex: 1.2 }]}>
          <Text style={styles.scoreLabel}>Wellness</Text>
          <Text style={[styles.scoreValue, { color: getScoreColor(scores.wellness, 'good') }]}>
            {scores.wellness}
          </Text>
        </View>

        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Discipline</Text>
          <Text style={[styles.scoreValue, { color: getScoreColor(scores.discipline, 'good') }]}>
            {scores.discipline}
          </Text>
        </View>

        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Impulse</Text>
          <Text style={[styles.scoreValue, { color: getScoreColor(scores.impulse, 'bad') }]}>
            {scores.impulse}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Transactions</Text>

      {/* Transaction List */}
            <FlatList
              data={transactions}
              keyExtractor={(item) => item.id!}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item }) => (
                <View style={styles.txnCard}>
                  <View style={styles.txnRow}>
                    <View style={styles.txnLeft}>
                      <Text style={styles.txnBank}>{item.bank}</Text>
                      {item.merchant !== 'Unknown' && (
                        <Text style={styles.txnMerchant}>{item.merchant}</Text>
                      )}
                      <Text style={styles.txnDate}>{item.date.toLocaleDateString()}</Text>
                    </View>

                    <View style={styles.txnRight}>
                      {/* ML PREDICTION BADGE */}
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

                  {/* Liberal Mode Labeling Buttons (Only show for debits, under 15 labels, AND in Liberal Mode) */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  darkContainer: { flex: 1, backgroundColor: '#0F111A', paddingHorizontal: 24, paddingTop: 50 },

  // Onboarding
  onboardingContent: { flex: 1, justifyContent: 'center' },
  logo: { color: '#FFF', fontSize: 32, fontWeight: 'bold', marginBottom: 20 },
  onboardingTitle: { color: '#FFF', fontSize: 28, fontWeight: '600', marginBottom: 12, lineHeight: 34 },
  onboardingSubtext: { color: '#8E8E93', fontSize: 16, lineHeight: 22 },
  primaryButton: { backgroundColor: '#4ADE80', padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  primaryButtonText: { color: '#0F111A', fontSize: 16, fontWeight: 'bold' },

  // Dashboard Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },

  // ML Card
  mlCard: { backgroundColor: '#1A1A2E', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#4ADE80' },
  mlTitle: { color: '#4ADE80', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  mlStatus: { color: '#8E8E93', fontSize: 13 },

  // Scores
  scoresContainer: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  scoreCard: { backgroundColor: '#1E2233', padding: 16, borderRadius: 12, alignItems: 'center' },
  scoreLabel: { color: '#8E8E93', fontSize: 12, marginBottom: 6 },
  scoreValue: { fontSize: 28, fontWeight: 'bold' },

  // Transactions
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  txnCard: { backgroundColor: '#1E2233', padding: 16, borderRadius: 12, marginBottom: 12 },
  txnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  txnLeft: { flexDirection: 'column' },
  txnBank: { color: '#FFF', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  txnDate: { color: '#8E8E93', fontSize: 12 },
  txnAmount: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  // Labeling UI
  labelContainer: { borderTopWidth: 1, borderTopColor: '#2D2D44', paddingTop: 12 },
  labelPrompt: { color: '#8E8E93', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  labelButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  labelButtonTextWorth: { color: '#4ADE80', fontWeight: '600', fontSize: 13 },
  labelButtonTextImpulse: { color: '#F87171', fontWeight: '600', fontSize: 13 },
  thankYouText: { color: '#666', fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
  txnMerchant: { color: '#B0B0C0', fontSize: 13, marginBottom: 2, fontWeight: '500' },
  txnRight: { flexDirection: 'column', alignItems: 'flex-end' },
  mlBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 6 },
  mlBadgeText: { fontSize: 11, fontWeight: 'bold' },
  modeCard: { backgroundColor: '#1E2233', padding: 20, borderRadius: 12, marginBottom: 16 },
  modeTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  modeText: { color: '#8E8E93', fontSize: 14, lineHeight: 20 },
});