import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, PermissionsAndroid, BackHandler,
  Alert, NativeModules, FlatList, StatusBar, AppState, Modal, ActivityIndicator, ScrollView, Share, TextInput, Dimensions, RefreshControl
} from 'react-native';
import { parseBankSMS, ParsedTransaction } from './src/lib/smsParser';
import { calculateDisciplineScore, calculateImpulseIndex, calculateWellnessScore, calculateVolatilityScore, detectSubscriptionLeaks } from './src/lib/behavioralEngine';
import { backfillHistory } from './src/lib/historicalSync';
import { UserBehaviorModel, UserLabel } from './src/lib/personalization';
import BudgetsScreen from './src/screens/BudgetsScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import AICoachScreen from './src/screens/AICoachScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CircularScoreCard from './src/components/CircularScoreCard';
import PremiumChart from './src/components/PremiumChart';
import { supabase } from './src/lib/supabase';
import AuthScreen from './src/screens/AuthScreen';
import { Session } from '@supabase/supabase-js';
import { getScoreColor as getDynamicScoreColor } from './src/theme/scoreColor';


const { SmsModule } = NativeModules;
const STORAGE_KEY = 'centiq_state_v1';

// Refined design tokens -- same accent hues, tuned for real depth. Still
// pure View/StyleSheet, zero new dependencies.
const C = {
  bg: "#080808",
  glass: "rgba(255,255,255,0.05)",
  glassStrong: "rgba(255,255,255,0.08)",
  glassHighlight: "rgba(255,255,255,0.22)", // borderTopColor only -- the "light on glass edge" trick
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.14)",
  textPrimary: "#FFFFFF",
  textSecondary: "#9A9AA0",
  accent: "#38BDF8",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  purple: "#8B5CF6",
  shadow: "#000000",
};

export default function App() {
  const [goals, setGoals] = useState<any[]>([]);
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalCurrent, setNewGoalCurrent] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAllRepetitive, setShowAllRepetitive] = useState(false);

  const [morningBriefing, setMorningBriefing] = useState<string | null>(null);
  const [showBriefing, setShowBriefing] = useState(false);
  const [isFetchingBriefing, setIsFetchingBriefing] = useState(false);
  const [expandedCharge, setExpandedCharge] = useState<string | null>(null);

  // PASTE YOUR GEMINI API KEY HERE
  const API_KEY = 'YOUR_GEMINI_API_KEY';

  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [scores, setScores] = useState({ discipline: 0, impulse: 0, volatility: 0, wellness: 0, savingsRate: 0 });

  const [mode, setMode] = useState<'strict' | 'liberal' | null>(null);
  const [worthItTxnIds, setWorthItTxnIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'budgets' | 'coach' | 'settings'>('dashboard');
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const chartScrollRef = useRef<FlatList>(null);
  const [activeHeatmapDay, setActiveHeatmapDay] = useState<number | null>(null);

  const [model] = useState(new UserBehaviorModel());
  const [userLabels, setUserLabels] = useState<UserLabel[]>([]);
  const [labeledTxnIds, setLabeledTxnIds] = useState<string[]>([]);

  const savedStateRef = useRef<any>(null);
  const [session, setSession] = useState<Session | null>(null);

  // --- ALL HOOKS MUST BE HERE, AT THE TOP LEVEL ---
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

  // Check for notification button clicks when app opens
  useEffect(() => {
    const checkPendingNotif = async () => {
      try {
        const result = await SmsModule.getPendingNotifLabel();
        if (result.status === 'found' && transactions.length > 0) {
          // Find the most recent debit transaction
          const recentTxn = transactions.find(t => t.type === 'debit');
          if (recentTxn) {
            const isImpulsive = result.isImpulsive;
            handleLabelTransaction(recentTxn, isImpulsive);
            Alert.alert(
              "Model Updated",
              `Your latest transaction was logged as ${isImpulsive ? 'Impulsive' : 'Worth It'} from the notification.`
            );
          }
        }
      } catch (e) {
        console.warn("Failed to check pending notif", e);
      }
    };

    // Run when app opens
    checkPendingNotif();

    // Run when app returns to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkPendingNotif();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [transactions]);

  useEffect(() => {
    const checkDailyBriefing = async () => {
      try {
        const lastShownDate = await SmsModule.loadData('last_briefing_date');
        const today = new Date().toDateString();

        if (lastShownDate !== today && transactions.length > 0) {
          // It's a new day! Fetch the briefing.
          setIsFetchingBriefing(true);
          setShowBriefing(true); // Show the modal immediately with a loading spinner
          await fetchMorningBriefing();
          await SmsModule.saveData('last_briefing_date', today);
        }
      } catch (e) {
        console.warn("Briefing check failed", e);
      }
    };

    // Only run if user has transactions and is past onboarding
    if (hasPermission && mode) {
      checkDailyBriefing();
    }
  }, [hasPermission, mode, transactions]);

  const avgAmount = useMemo(() => {
    if (transactions.length === 0) return 0;
    return transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length;
  }, [transactions]);

  // Group transactions into Weeks of the current Month
  const monthlyWeeklyData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Initialize 5 weeks (max in a month), each with Mon-Sun structure
    const weeks = Array.from({ length: 5 }, (_, i) => ({
      weekNum: i + 1,
      data: [
        { day: 'Mon', amount: 0 }, { day: 'Tue', amount: 0 }, { day: 'Wed', amount: 0 },
        { day: 'Thu', amount: 0 }, { day: 'Fri', amount: 0 }, { day: 'Sat', amount: 0 }, { day: 'Sun', amount: 0 }
      ]
    }));

    transactions.forEach(t => {
      if (t.type === 'debit' && t.date.getMonth() === currentMonth && t.date.getFullYear() === currentYear) {
        const dayOfMonth = t.date.getDate();
        const weekIndex = Math.floor((dayOfMonth - 1) / 7); // 0 to 4
        if (weekIndex < 5) {
          const dayOfWeek = t.date.getDay(); // 0=Sun, 1=Mon...
          const mapIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Map to 0=Mon, 6=Sun
          weeks[weekIndex].data[mapIndex].amount += t.amount;
        }
      }
    });

    // Determine which weeks actually have data or are the current week
    const currentWeekIndex = Math.floor((now.getDate() - 1) / 7);
    return weeks.filter((w, i) => w.data.some(d => d.amount > 0) || i === currentWeekIndex);
  }, [transactions]);

  // Find the highest spend day across the whole month for a consistent Y-axis scale
  const globalMaxSpend = useMemo(() => {
    let max = 0;
    monthlyWeeklyData.forEach(week => {
      week.data.forEach(day => {
        if (day.amount > max) max = day.amount;
      });
    });
    return max > 0 ? max : 1;
  }, [monthlyWeeklyData]);
  // State to track which week is selected
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);

  // Calculate Monthly Forecast & Overspend Risk
  const monthlyForecast = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();

    const monthTxns = transactions.filter(t =>
      t.type === 'debit' &&
      t.date.getMonth() === now.getMonth() &&
      t.date.getFullYear() === now.getFullYear()
    );

    const spentSoFar = monthTxns.reduce((a, b) => a + b.amount, 0);
    const monthlyIncome = transactions.filter(t =>
      t.type === 'credit' &&
      t.date.getMonth() === now.getMonth() &&
      t.date.getFullYear() === now.getFullYear()
    ).reduce((a, b) => a + b.amount, 0);

    // Calculate average daily spend so far
    const avgDailySpend = dayOfMonth > 0 ? spentSoFar / dayOfMonth : 0;

    // Project that to the end of the month
    const projectedSpend = avgDailySpend * daysInMonth;

    // Calculate Risk Percentage (How much of your income will be consumed?)
    // If projected spend > income, risk is 100%+
    const riskRatio = monthlyIncome > 0 ? (projectedSpend / monthlyIncome) : 0;
    const overspendRisk = Math.max(0, Math.min(100, Math.round(riskRatio * 100)));

    // Determine risk level for UI color
    let riskLevel = 'Low';
    let riskColor = C.success;
    if (overspendRisk > 85) { riskLevel = 'High'; riskColor = C.danger; }
    else if (overspendRisk > 65) { riskLevel = 'Moderate'; riskColor = C.warning; }

    return {
      projectedSpend: Math.round(projectedSpend),
      overspendRisk,
      riskLevel,
      riskColor
    };
  }, [transactions]);

  const recurringCharges = useMemo(() => {
    const result = detectSubscriptionLeaks(transactions) || { knownSubscriptions: [], repetitivePayments: [] };
    const knownSubs = result.knownSubscriptions || [];
    const repetitivePays = result.repetitivePayments || [];

    const totalSubsCost = knownSubs.reduce((sum: number, l: any) => sum + l.amount, 0);
    const totalRepetitiveCost = repetitivePays.reduce((sum: number, l: any) => sum + l.amount, 0);

    return { knownSubscriptions: knownSubs, repetitivePayments: repetitivePays, totalSubsCost, totalRepetitiveCost };
  }, [transactions]);

  // Generate Real-Time Behavioral Insights
  const behaviorFeed = useMemo(() => {
    const insights: { icon: string; title: string; text: string; color: string }[] = [];
    const debitTxns = transactions.filter(t => t.type === 'debit');

    // 1. Weekend Spending Insight
    const weekendTxns = debitTxns.filter(t => t.date.getDay() === 0 || t.date.getDay() === 6);
    const weekendSpend = weekendTxns.reduce((a, b) => a + b.amount, 0);
    const totalSpend = debitTxns.reduce((a, b) => a + b.amount, 0);
    if (totalSpend > 0 && weekendSpend / totalSpend > 0.4) {
      insights.push({
        icon: 'calendar',
        title: 'WEEKEND WARRIOR',
        text: `You spend ${Math.round((weekendSpend / totalSpend) * 100)}% of your money on weekends. Watch out for impulse food delivery!`,
        color: C.warning
      });
    }

    // 2. Late Night Cravings Insight
    const lateNightTxns = debitTxns.filter(t => t.date.getHours() >= 22 || t.date.getHours() <= 4);
    if (lateNightTxns.length > 2) {
      insights.push({
        icon: 'moon',
        title: 'LATE NIGHT CRAVINGS',
        text: `We detected ${lateNightTxns.length} transactions between 10 PM and 4 AM. These are highly likely to be impulsive.`,
        color: C.purple
      });
    }

    // 3. Top Category Insight
    const catTotals: { [key: string]: number } = {};
    debitTxns.forEach(t => {
      const cat = t.category || 'Other';
      catTotals[cat] = (catTotals[cat] || 0) + t.amount;
    });
    const topCat = Object.keys(catTotals).sort((a, b) => catTotals[b] - catTotals[a])[0];
    if (topCat && catTotals[topCat] > 0) {
      insights.push({
        icon: 'tag',
        title: 'TOP CATEGORY',
        text: `${topCat} is your highest spending category at ₹${Math.round(catTotals[topCat]).toLocaleString('en-IN')}. Consider setting a budget for this.`,
        color: C.accent
      });
    }

    // 4. High Value Transaction Insight
    const avgAmt = debitTxns.length > 0 ? totalSpend / debitTxns.length : 0;
    const highValueTxns = debitTxns.filter(t => t.amount > avgAmt * 3);
    if (highValueTxns.length > 0) {
      insights.push({
        icon: 'alert',
        title: 'UNUSUAL SPENDING',
        text: `You made ${highValueTxns.length} transactions significantly larger than your average of ₹${Math.round(avgAmt)}.`,
        color: C.danger
      });
    }

    return insights;
  }, [transactions]);

  // Financial Persona & 30-Day Heatmap Engine
  const behavioralProfile = useMemo(() => {
    const debitTxns = transactions.filter(t => t.type === 'debit');

    // Calculate Top Category for "Foodie" persona
    const catTotals: { [key: string]: number } = {};
    debitTxns.forEach(t => { catTotals[t.category || 'Other'] = (catTotals[t.category || 'Other'] || 0) + t.amount; });
    const topCat = Object.keys(catTotals).sort((a, b) => catTotals[b] - catTotals[a])[0];

    // 1. Determine Persona based on ML scores and data
    let persona = { name: 'The Balanced Spender', desc: 'You have a healthy mix of discipline and spontaneity.', icon: '⚖️', color: C.accent };

    // High Priority Extremes
    if (scores.impulse > 60 && scores.volatility > 60) {
      persona = { name: 'The Midnight Impulser', desc: 'High volatility and late-night triggers. You act fast and feel it later.', icon: '⚡', color: C.danger };
    } else if (scores.discipline > 70 && scores.savingsRate > 50) {
      persona = { name: 'The Stealth Saver', desc: 'Highly disciplined. You crush your savings goals without thinking twice.', icon: '🛡️', color: C.success };
    }
    // New Specialized Personas
    else if (recurringCharges.knownSubscriptions.length >= 4) {
      persona = { name: 'The Subscription Hoarder', desc: 'You have 4+ active recurring subscriptions. Time to audit and cancel the unused ones!', icon: '📦', color: C.purple };
    } else if (topCat === 'Food' && scores.impulse > 50) {
      persona = { name: 'The Foodie Impulser', desc: 'Food is your top category, and your impulse score is high. Those late-night deliveries add up!', icon: '🍔', color: C.warning };
    } else if (scores.impulse > 40 && scores.discipline < 50) {
      persona = { name: 'The Weekend Warrior', desc: 'You stay disciplined during the week, but cut loose on the weekends.', icon: '🎉', color: C.warning };
    }

    // 2. Generate 30-Day Heatmap Data
    const days: { date: Date; amount: number; isImpulsive: boolean }[] = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const dayTxns = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.toDateString() === date.toDateString() && t.type === 'debit';
      });

      const amount = dayTxns.reduce((a, b) => a + b.amount, 0);
      const isImpulsive = dayTxns.some(t => t.date.getHours() >= 22 || t.date.getHours() <= 4 || t.amount > avgAmount * 1.5);

      days.push({ date, amount, isImpulsive });
    }

    return { persona, heatmap: days };
  }, [scores, transactions, avgAmount, recurringCharges]); // Added recurringCharges to dependencies

  // --- FUNCTIONS START HERE ---
  const loadSavedData = async () => {
    try {
      const raw = await SmsModule.loadData(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.mode) setMode(parsed.mode);
      if (parsed.userLabels) setUserLabels(parsed.userLabels);
      if (parsed.labeledTxnIds) setLabeledTxnIds(parsed.labeledTxnIds);
      if (parsed.worthItTxnIds) setWorthItTxnIds(parsed.worthItTxnIds);
      if (parsed.goals) setGoals(parsed.goals); // <-- ADD THIS
      return parsed;
    } catch (e) { return null; }
  };

  const saveState = async (overrides: any = {}) => {
    const payload = {
      mode: overrides.mode ?? mode,
      userLabels: overrides.userLabels ?? userLabels,
      labeledTxnIds: overrides.labeledTxnIds ?? labeledTxnIds,
      worthItTxnIds: overrides.worthItTxnIds ?? worthItTxnIds,
      goals: overrides.goals ?? goals, // <-- ADD THIS
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
      // Ask for both READ and RECEIVE permissions
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
      ]);

      if (
        granted[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
        granted[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED
      ) {
        setHasPermission(true);
        fetchSMS(savedStateRef.current);
      } else {
        Alert.alert("Permission Denied", "CentiQ cannot function without SMS access. Exiting.");
        setTimeout(() => BackHandler.exitApp(), 1500);
      }
    } catch (err) {}
  };

  const fetchMorningBriefing = async () => {
    try {
      const now = new Date();
      const last24Hours = transactions.filter(t => {
        const diff = now.getTime() - t.date.getTime();
        return diff < (24 * 60 * 60 * 1000);
      });

      const txnsSummary = last24Hours.map(t =>
        `${t.type === 'credit' ? 'Income' : 'Spent'} ₹${t.amount} at ${t.merchant || t.bank} (${t.category || 'Other'})`
      ).join(', ');

      const prompt = `
        You are a Gen-Z behavioral finance coach. Generate a 2-sentence proactive morning briefing.
        Sentence 1: A brief, encouraging good morning greeting acknowledging their financial wellness score (${scores.wellness}/100).
        Sentence 2: One actionable insight based on their last 24 hours of spending (Transactions: ${txnsSummary || 'No spending in the last 24 hours.'}).
        Keep it under 40 words. Do not use markdown or hashtags.
      `;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 100 }
        })
      });

      const data = await response.json();
      if (data.candidates && data.candidates[0].content) {
        setMorningBriefing(data.candidates[0].content.parts[0].text);
      } else {
        setMorningBriefing("Good morning! Ready to make some smart financial moves today?");
      }
    } catch (e) {
      setMorningBriefing("Good morning! Ready to make some smart financial moves today?");
    } finally {
      setIsFetchingBriefing(false);
    }
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSMS(savedStateRef.current);
    setIsRefreshing(false);
  };

  const syncToCloud = async (txns: ParsedTransaction[]) => {
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
      const { error } = await supabase
        .from('transactions')
        .upsert(payload, { onConflict: 'user_id, txn_date, amount, merchant' });

      if (error) console.warn('Cloud sync error:', error.message);
      else console.log('☁️ Synced transactions to Supabase!');
    } catch (e) {
      console.warn('Failed to sync to cloud', e);
    }
  };

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

  const handleAddGoal = () => {
    if (!newGoalName || !newGoalTarget) {
      Alert.alert("Error", "Please enter a goal name and target amount.");
      return;
    }

    const colors = [C.accent, C.success, C.warning, C.purple, C.danger];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newGoal = {
      id: Date.now().toString(),
      name: newGoalName,
      target: parseFloat(newGoalTarget),
      current: parseFloat(newGoalCurrent) || 0,
      color: randomColor,
      deadline: 'No deadline'
    };

    const updatedGoals = [...goals, newGoal];
    setGoals(updatedGoals);
    saveState({ goals: updatedGoals });

    // Reset inputs and close modal
    setNewGoalName('');
    setNewGoalTarget('');
    setNewGoalCurrent('');
    setShowAddGoalModal(false);
  };

  // TEMPORARILY BYPASS LOGIN TO TEST THE APP
  // if (!session) {
  //   return <AuthScreen />;
  // }

  if (!hasPermission) {
    return (
      <View style={styles.darkContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.onboardingContent}>
          <Text style={styles.logo}>CentiQ</Text>
          <Text style={styles.onboardingTitle}>Understand your money habits.</Text>
          <Text style={styles.onboardingSubtext}>Not just where you spend, but why. Connect your SMS to unlock your behavioral profile.</Text>
        </View>
        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={requestPermission}>
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
          <TouchableOpacity style={[styles.modeCard, { borderColor: 'rgba(239,68,68,0.4)' }]} activeOpacity={0.85} onPress={() => { setMode('strict'); saveState({ mode: 'strict' }); }}>
            <Text style={styles.modeTitle}>Strict Mode</Text>
            <Text style={styles.modeText}>Judges spending against standard population benchmarks. No excuses, pure math.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeCard, { borderColor: 'rgba(16,185,129,0.4)' }]} activeOpacity={0.85} onPress={() => { setMode('liberal'); saveState({ mode: 'liberal' }); }}>
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
          contentContainerStyle={{ paddingBottom: 110 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={C.accent} // Makes the spinner blue!
            />
          }
          ListHeaderComponent={() => (
            <View>
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.greeting}>Welcome back</Text>
                  <Text style={styles.headerTitle}>Your money, decoded.</Text>
                </View>
                <TouchableOpacity style={styles.syncPill} activeOpacity={0.8} onPress={resetAppData}>
                  <View style={styles.syncDot} />
                  <Text style={styles.syncText}>Reset</Text>
                </TouchableOpacity>
              </View>

              {/* Financial Wellness Card (Heavy Glass) */}
              <View style={[styles.glassCardHeavy, { padding: 24, marginBottom: 18 }]}>
                <Text style={[styles.cardHeaderTitle, { marginBottom: 22 }]}>FINANCIAL WELLNESS</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {/* Left Side: Circle */}
                  <View style={styles.ringWrap}>
                    <CircularScoreCard score={scores.wellness} label="Score" color={getDynamicScoreColor(scores.wellness, 'higher_is_better')} size={100} />
                  </View>

                  {/* Right Side: Meters */}
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <View style={styles.meterContainer}>
                      <View style={styles.meterLabelRow}><Text style={styles.meterLabel}>Discipline</Text><Text style={styles.meterValue}>{scores.discipline}/100</Text></View>
                      <View style={styles.meterBackground}><View style={[styles.meterFill, { width: `${scores.discipline}%`, backgroundColor: getDynamicScoreColor(scores.discipline, 'higher_is_better') }]} /></View>
                    </View>
                    <View style={styles.meterContainer}>
                      <View style={styles.meterLabelRow}><Text style={styles.meterLabel}>Impulse Index</Text><Text style={styles.meterValue}>{scores.impulse}/100</Text></View>
                      <View style={styles.meterBackground}><View style={[styles.meterFill, { width: `${scores.impulse}%`, backgroundColor: getDynamicScoreColor(scores.impulse, 'lower_is_better') }]} /></View>
                    </View>
                    <View style={styles.meterContainer}>
                      <View style={styles.meterLabelRow}><Text style={styles.meterLabel}>Volatility</Text><Text style={styles.meterValue}>{scores.volatility}/100</Text></View>
                      <View style={styles.meterBackground}><View style={[styles.meterFill, { width: `${scores.volatility}%`, backgroundColor: getDynamicScoreColor(scores.volatility, 'lower_is_better') }]} /></View>
                    </View>
                    <View style={styles.meterContainer}>
                      <View style={styles.meterLabelRow}><Text style={styles.meterLabel}>Savings Rate</Text><Text style={styles.meterValue}>{Math.round(scores.savingsRate)}/100</Text></View>
                      <View style={styles.meterBackground}><View style={[styles.meterFill, { width: `${scores.savingsRate}%`, backgroundColor: getDynamicScoreColor(scores.savingsRate, 'higher_is_better') }]} /></View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Financial Persona Card */}
              <View style={[styles.glassCardHeavy, { padding: 22, marginBottom: 18, flexDirection: 'row', alignItems: 'center' }]}>
                <View style={[
                  styles.personaIconBadge,
                  {
                    backgroundColor: `${behavioralProfile.persona.color}20`,
                    borderColor: `${behavioralProfile.persona.color}50`,
                    shadowColor: behavioralProfile.persona.color,
                  },
                ]}>
                  <Text style={{ fontSize: 28 }}>{behavioralProfile.persona.icon}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={styles.personaLabel}>YOUR FINANCIAL PERSONA</Text>
                  <Text style={[styles.personaName, { color: behavioralProfile.persona.color }]}>{behavioralProfile.persona.name}</Text>
                  <Text style={styles.personaDesc}>{behavioralProfile.persona.desc}</Text>
                </View>
              </View>

              {/* Behavioral Heatmap */}
              <View style={[styles.glassCard, { padding: 22, marginBottom: 18 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={styles.cardHeaderTitle}>30-DAY BEHAVIOR MAP</Text>

                  {/* Dynamic Day Info */}
                  {activeHeatmapDay !== null && behavioralProfile.heatmap[activeHeatmapDay] ? (
                    <Text style={styles.heatmapSelectedText}>
                      {behavioralProfile.heatmap[activeHeatmapDay].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ₹{Math.round(behavioralProfile.heatmap[activeHeatmapDay].amount).toLocaleString('en-IN')}
                    </Text>
                  ) : (
                    <Text style={styles.heatmapSelectedText}>Tap a day</Text>
                  )}
                </View>

                <View style={styles.heatmapGrid}>
                  {behavioralProfile.heatmap.map((day, i) => {
                    let bgColor = 'rgba(255,255,255,0.05)'; // No spend
                    if (day.amount > 0 && !day.isImpulsive) bgColor = 'rgba(56,189,248,0.3)'; // Normal spend
                    if (day.amount > 0 && day.isImpulsive) bgColor = C.danger; // Impulsive spend
                    const isSelected = activeHeatmapDay === i;

                    return (
                      <TouchableOpacity
                        key={i}
                        activeOpacity={0.75}
                        onPress={() => setActiveHeatmapDay(activeHeatmapDay === i ? null : i)}
                        style={[
                          styles.heatmapCell,
                          { backgroundColor: bgColor },
                          isSelected && {
                            borderWidth: 1.5, borderColor: '#FFFFFF',
                            shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 6, elevation: 4,
                          },
                        ]}
                      />
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                  <Text style={styles.heatmapLegend}>Less</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={[styles.heatmapCell, { width: 10, height: 10, backgroundColor: 'rgba(255,255,255,0.05)' }]} />
                    <View style={[styles.heatmapCell, { width: 10, height: 10, backgroundColor: 'rgba(56,189,248,0.3)' }]} />
                    <View style={[styles.heatmapCell, { width: 10, height: 10, backgroundColor: C.danger }]} />
                    <Text style={styles.heatmapLegend}>More / Impulsive</Text>
                  </View>
                </View>
              </View>

              {/* Digital Subscriptions Card (Always Visible) */}
              <View style={[styles.glassCard, { padding: 22, marginBottom: 16, borderColor: 'rgba(56,189,248,0.22)' }]}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTitleWithIcon}>
                    <View style={[styles.iconBadge, { backgroundColor: 'rgba(56,189,248,0.14)' }]}>
                      <Text style={styles.iconBadgeGlyph}>🎬</Text>
                    </View>
                    <Text style={[styles.cardHeaderTitle, { marginBottom: 0, color: C.accent }]}>SUBSCRIPTIONS</Text>
                  </View>
                  {recurringCharges.knownSubscriptions.length > 0 && (
                    <Text style={styles.cardTopRowValue}>₹{recurringCharges.totalSubsCost.toLocaleString('en-IN')}/mo</Text>
                  )}
                </View>

                {recurringCharges.knownSubscriptions.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                    <Text style={{ fontSize: 28, marginBottom: 8 }}>🎉</Text>
                    <Text style={{ color: C.success, fontSize: 13.5, fontWeight: '700', marginBottom: 6, letterSpacing: 0.4 }}>NO SUBSCRIPTION LEAKS</Text>
                    <Text style={{ color: C.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
                      Great job! We didn't find any sneaky digital subscriptions in your history. Keep it up!
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={{ color: C.textSecondary, fontSize: 13, marginBottom: 14, lineHeight: 18 }}>
                      You have {recurringCharges.knownSubscriptions.length} active digital subscriptions.
                    </Text>
                    {recurringCharges.knownSubscriptions.map((l, i) => (
                      <View key={i} style={styles.leakRow}>
                        <View>
                          <Text style={styles.leakMerchant}>{l.merchant}</Text>
                          <Text style={styles.leakCount}>Charged {l.count} times</Text>
                        </View>
                        <Text style={styles.leakAmount}>₹{l.amount.toLocaleString('en-IN')}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>

              {/* Repetitive Payments Card (Only if they exist) */}
              {recurringCharges.repetitivePayments.length > 0 && (
                <View style={[styles.glassCard, { padding: 22, marginBottom: 16, borderColor: 'rgba(245,158,11,0.22)' }]}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardTitleWithIcon}>
                      <View style={[styles.iconBadge, { backgroundColor: 'rgba(245,158,11,0.14)' }]}>
                        <Text style={styles.iconBadgeGlyph}>⚠️</Text>
                      </View>
                      <Text style={[styles.cardHeaderTitle, { marginBottom: 0, color: C.warning }]}>REPETITIVE PAYMENTS</Text>
                    </View>
                    <Text style={[styles.cardTopRowValue, { color: C.warning }]}>₹{recurringCharges.totalRepetitiveCost.toLocaleString('en-IN')}/mo</Text>
                  </View>
                  <Text style={{ color: C.textSecondary, fontSize: 13, marginBottom: 14, lineHeight: 18 }}>
                    We detected {recurringCharges.repetitivePayments.length} recurring charges (bills, rent, gyms, etc). Tap to view dates.
                  </Text>

                  {/* Show only top 3, or all if showAllRepetitive is true */}
                  {(showAllRepetitive ? recurringCharges.repetitivePayments : recurringCharges.repetitivePayments.slice(0, 3)).map((l, i) => {
                    const key = `${l.merchant}-${l.amount}`;
                    const isExpanded = expandedCharge === key;

                    return (
                      <View key={i} style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                        <TouchableOpacity
                          style={styles.leakRow}
                          activeOpacity={0.75}
                          onPress={() => setExpandedCharge(isExpanded ? null : key)}
                        >
                          <View>
                            <Text style={styles.leakMerchant}>{l.merchant}</Text>
                            <Text style={styles.leakCount}>Charged {l.count} times · Tap to {isExpanded ? 'hide' : 'expand'}</Text>
                          </View>
                          <Text style={styles.leakAmount}>₹{l.amount.toLocaleString('en-IN')} total</Text>
                        </TouchableOpacity>

                        {isExpanded && (
                          <View style={styles.expandedList}>
                            {l.transactions.map((t, tIdx) => (
                              <Text key={tIdx} style={styles.expandedText}>
                                • {new Date(t.date).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* View More / View Less Button */}
                  {recurringCharges.repetitivePayments.length > 3 && (
                    <TouchableOpacity
                      style={{ alignItems: 'center', paddingVertical: 14, marginTop: 4 }}
                      activeOpacity={0.75}
                      onPress={() => setShowAllRepetitive(!showAllRepetitive)}
                    >
                      <Text style={{ color: C.warning, fontSize: 12, fontWeight: 'bold' }}>
                        {showAllRepetitive ? 'View Less' : `View ${recurringCharges.repetitivePayments.length - 3} More`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* AI Behavior Feed */}
              {behaviorFeed.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.cardHeaderTitle}>AI BEHAVIOR FEED</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingRight: 20 }}
                  >
                    {behaviorFeed.map((insight, i) => (
                      <View key={i} style={[styles.insightCard, { borderColor: `${insight.color}30` }]}>
                        <View style={[styles.insightIconBadge, { backgroundColor: `${insight.color}20` }]}>
                          <Text style={{ fontSize: 14 }}>{insight.icon === 'calendar' ? '📅' : insight.icon === 'moon' ? '🌙' : insight.icon === 'tag' ? '🏷️' : '⚠️'}</Text>
                        </View>
                        <Text style={[styles.insightTitle, { color: insight.color }]}>{insight.title}</Text>
                        <Text style={styles.insightText}>{insight.text}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* AI Monthly Forecast Card */}
              <View style={[styles.glassCard, { padding: 20, marginBottom: 16 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View style={[styles.iconBadge, { backgroundColor: 'rgba(56,189,248,0.14)', marginRight: 12 }]}>
                    <Text style={styles.iconBadgeGlyph}>📈</Text>
                  </View>
                  <View>
                    <Text style={styles.cardHeaderTitle}>NEXT MONTH FORECAST</Text>
                    <Text style={styles.subtleText}>Based on your current spending velocity</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 4 }}>Projected Spend</Text>
                    <Text style={{ color: C.textPrimary, fontSize: 22, fontWeight: '800' }}>
                      ₹{monthlyForecast.projectedSpend.toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 4 }}>Overspend Risk</Text>
                    <Text style={{ color: monthlyForecast.riskColor, fontSize: 22, fontWeight: '800' }}>
                      {monthlyForecast.overspendRisk}%
                    </Text>
                  </View>
                </View>

                {/* Risk Bar -- now matches the wellness meters' height/radius */}
                <View style={styles.meterBackground}>
                  <View style={[
                    styles.meterFill,
                    { width: `${monthlyForecast.overspendRisk}%`, backgroundColor: monthlyForecast.riskColor }
                  ]} />
                </View>
                <Text style={{ color: monthlyForecast.riskColor, fontSize: 11, fontWeight: '700', marginTop: 8, textAlign: 'right' }}>
                  {monthlyForecast.riskLevel.toUpperCase()} RISK
                </Text>
              </View>

              {/* Savings Goals Card */}
              <View style={[styles.glassCard, { padding: 20, marginBottom: 16 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={styles.cardHeaderTitle}>SAVINGS GOALS</Text>
                  <TouchableOpacity activeOpacity={0.75} onPress={() => setShowAddGoalModal(true)}>
                    <Text style={{ color: C.accent, fontSize: 12, fontWeight: 'bold' }}>+ Add Goal</Text>
                  </TouchableOpacity>
                </View>

                {goals.length === 0 ? (
                  <Text style={{ color: C.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 10 }}>
                    No goals yet. Tap "+ Add Goal" to start tracking!
                  </Text>
                ) : (
                  goals.map((goal) => {
                    const pct = Math.min((goal.current / goal.target) * 100, 100);
                    return (
                      <View key={goal.id} style={styles.goalRow}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={styles.goalName}>{goal.name}</Text>
                          <Text style={styles.goalMeta}>₹{goal.current.toLocaleString('en-IN')} / ₹{goal.target.toLocaleString('en-IN')}</Text>
                        </View>
                        {/* Goal progress -- now matches the wellness meters' height/radius */}
                        <View style={styles.meterBackground}>
                          <View style={[styles.meterFill, { width: `${pct}%`, backgroundColor: goal.color }]} />
                        </View>
                        <Text style={[styles.goalDeadline, { marginTop: 6 }]}>{goal.deadline} · {Math.round(pct)}% complete</Text>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Premium Weekly Spending Chart */}
              <View style={[styles.glassCard, { padding: 20, marginBottom: 16 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={styles.cardHeaderTitle}>WEEKLY SPENDING</Text>
                  <Text style={styles.subtleText}>
                    Total: ₹{Math.round(monthlyWeeklyData[activeWeekIndex]?.data.reduce((a, b) => a + b.amount, 0) || 0).toLocaleString('en-IN')}
                  </Text>
                </View>

                {/* Week Selector */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexDirection: 'row', marginBottom: 16, maxHeight: 36 }}
                  contentContainerStyle={{ alignItems: 'center' }}
                >
                  {monthlyWeeklyData.map((week, i) => (
                    <TouchableOpacity
                      key={i}
                      activeOpacity={0.8}
                      style={[styles.weekChip, activeWeekIndex === i && styles.weekChipActive, { marginRight: 8 }]}
                      onPress={() => { setActiveWeekIndex(i); setActiveDay(null); }}
                    >
                      <Text style={[styles.weekChipText, activeWeekIndex === i && styles.weekChipTextActive]}>Week {week.weekNum}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* The Chart (Direct Render) */}
                {monthlyWeeklyData[activeWeekIndex] && (
                  <PremiumChart
                    data={monthlyWeeklyData[activeWeekIndex].data}
                    activeDay={activeDay}
                    setActiveDay={setActiveDay}
                    maxValue={globalMaxSpend}
                  />
                )}
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

      {/* AI Daily Morning Briefing Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showBriefing}
        onRequestClose={() => setShowBriefing(false)}
      >
        <View style={styles.briefingOverlay}>
          <View style={styles.briefingCard}>
            <View style={styles.briefingIconRing}>
              <Text style={styles.briefingIconGlyph}>☀️</Text>
            </View>
            <Text style={styles.briefingTitle}>Good Morning</Text>

            {isFetchingBriefing ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator color={C.accent} size="large" />
                <Text style={{ color: C.textSecondary, marginTop: 12, fontSize: 13 }}>Analyzing your data...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.briefingText}>{morningBriefing}</Text>
                <TouchableOpacity
                  style={styles.briefingButton}
                  activeOpacity={0.85}
                  onPress={() => setShowBriefing(false)}
                >
                  <Text style={styles.briefingButtonText}>Let's go</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Goal Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAddGoalModal}
        onRequestClose={() => setShowAddGoalModal(false)}
      >
        <View style={styles.briefingOverlay}>
          <View style={styles.briefingCard}>
            <Text style={styles.briefingTitle}>Create a Goal</Text>

            <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 8, alignSelf: 'flex-start' }}>GOAL NAME</Text>
            <TextInput
              style={styles.goalInput}
              placeholder="e.g. Iceland Trip"
              placeholderTextColor="#5A5A60"
              value={newGoalName}
              onChangeText={setNewGoalName}
            />

            <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 8, marginTop: 16, alignSelf: 'flex-start' }}>TARGET AMOUNT (₹)</Text>
            <TextInput
              style={styles.goalInput}
              placeholder="e.g. 50000"
              placeholderTextColor="#5A5A60"
              keyboardType="numeric"
              value={newGoalTarget}
              onChangeText={setNewGoalTarget}
            />

            <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 8, marginTop: 16, alignSelf: 'flex-start' }}>AMOUNT SAVED SO FAR (₹)</Text>
            <TextInput
              style={styles.goalInput}
              placeholder="e.g. 10000"
              placeholderTextColor="#5A5A60"
              keyboardType="numeric"
              value={newGoalCurrent}
              onChangeText={setNewGoalCurrent}
            />

            <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginTop: 24 }}>
              <TouchableOpacity
                style={[styles.briefingButton, { backgroundColor: 'rgba(255,255,255,0.1)', flex: 1, shadowOpacity: 0 }]}
                activeOpacity={0.8}
                onPress={() => setShowAddGoalModal(false)}
              >
                <Text style={[styles.briefingButtonText, { color: C.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.briefingButton, { flex: 1 }]}
                activeOpacity={0.85}
                onPress={handleAddGoal}
              >
                <Text style={styles.briefingButtonText}>Save Goal</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabButton} activeOpacity={0.75} onPress={() => setActiveTab('dashboard')}>
          {activeTab === 'dashboard' && <View style={styles.tabActivePill} />}
          <Text style={[styles.tabIcon, activeTab === 'dashboard' && styles.tabIconActive]}>◉</Text>
          <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabLabelActive]}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabButton} activeOpacity={0.75} onPress={() => setActiveTab('transactions')}>
          {activeTab === 'transactions' && <View style={styles.tabActivePill} />}
          <Text style={[styles.tabIcon, activeTab === 'transactions' && styles.tabIconActive]}>≣</Text>
          <Text style={[styles.tabLabel, activeTab === 'transactions' && styles.tabLabelActive]}>Transactions</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabButton} activeOpacity={0.75} onPress={() => setActiveTab('budgets')}>
          {activeTab === 'budgets' && <View style={styles.tabActivePill} />}
          <Text style={[styles.tabIcon, activeTab === 'budgets' && styles.tabIconActive]}>◍</Text>
          <Text style={[styles.tabLabel, activeTab === 'budgets' && styles.tabLabelActive]}>Budgets</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabButton} activeOpacity={0.75} onPress={() => setActiveTab('coach')}>
          {activeTab === 'coach' && <View style={styles.tabActivePill} />}
          <Text style={[styles.tabIcon, activeTab === 'coach' && styles.tabIconActive]}>✦</Text>
          <Text style={[styles.tabLabel, activeTab === 'coach' && styles.tabLabelActive]}>AI Coach</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabButton} activeOpacity={0.75} onPress={() => setActiveTab('settings')}>
          {activeTab === 'settings' && <View style={styles.tabActivePill} />}
          <Text style={[styles.tabIcon, activeTab === 'settings' && styles.tabIconActive]}>☰</Text>
          <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  darkContainer: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20, paddingTop: 60 },
  onboardingContent: { flex: 1, justifyContent: 'center' },
  logo: { color: C.textPrimary, fontSize: 32, fontWeight: '700', marginBottom: 20, letterSpacing: -0.5 },
  onboardingTitle: { color: C.textPrimary, fontSize: 28, fontWeight: '700', marginBottom: 12, lineHeight: 34, letterSpacing: -0.5 },
  onboardingSubtext: { color: C.textSecondary, fontSize: 16, lineHeight: 23 },
  primaryButton: {
    backgroundColor: C.accent, padding: 18, borderRadius: 16, alignItems: 'center', marginBottom: 20,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 6,
  },
  primaryButtonText: { color: '#001018', fontSize: 16, fontWeight: '700' },

  // Dashboard Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 },
  greeting: { color: C.textSecondary, fontSize: 13, marginBottom: 4 },
  headerTitle: { color: C.textPrimary, fontSize: 25, fontWeight: '700', letterSpacing: -0.4 },
  syncPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass,
    borderWidth: 1, borderColor: C.border, borderTopColor: C.glassHighlight,
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20,
  },
  syncDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success, marginRight: 6 },
  syncText: { color: C.textSecondary, fontSize: 12, fontWeight: '600' },

  // Glass Cards -- real depth via shadow, plus a lighter top border for
  // the "light on glass edge" feel instead of a flat uniform border.
  glassCard: {
    backgroundColor: C.glass, borderColor: C.border, borderTopColor: C.glassHighlight,
    borderWidth: 1, borderRadius: 22,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 5,
  },
  glassCardHeavy: {
    backgroundColor: C.glassStrong, borderColor: C.borderStrong, borderTopColor: C.glassHighlight,
    borderWidth: 1, borderRadius: 26,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.32, shadowRadius: 22, elevation: 7,
  },
  cardHeaderTitle: { color: C.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.6, marginBottom: 16 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitleWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTopRowValue: { color: C.accent, fontSize: 14, fontWeight: '700' },
  subtleText: { color: C.textSecondary, fontSize: 12 },

  iconBadge: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconBadgeGlyph: { fontSize: 15 },

  ringWrap: { width: 108, height: 108, justifyContent: 'center', alignItems: 'center', marginRight: 20 },

  // Meters -- also reused for the Forecast risk bar and Goal progress
  // bars now, so every progress indicator in the app shares one visual
  // family instead of three slightly different bar styles.
  meterContainer: { marginBottom: 15 },
  meterLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  meterLabel: { color: C.textSecondary, fontSize: 12.5 },
  meterValue: { color: C.textPrimary, fontSize: 12.5, fontWeight: '600' },
  meterBackground: { height: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)', marginTop: 4 },
  meterFill: { height: '100%', borderRadius: 999 },

  // Subscription Leaks
  leakRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  leakMerchant: { color: C.textPrimary, fontSize: 15, fontWeight: '500' },
  leakCount: { color: C.textSecondary, fontSize: 11, marginTop: 2 },
  leakAmount: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },

  // Charts
  chartContainer: { flexDirection: 'row', justifyContent: 'space-between', height: 140, alignItems: 'flex-end', marginTop: 20 },
  chartBarWrapper: { alignItems: 'center', width: 38, height: '100%', justifyContent: 'flex-end' },
  barTooltip: {
    position: 'absolute', top: 0, backgroundColor: C.accent, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8,
    zIndex: 10, minWidth: 50, left: -6, alignItems: 'center',
    shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  barTooltipText: { color: '#001018', fontSize: 11, fontWeight: '700', flexWrap: 'nowrap' },
  chartBarBg: { width: 14, height: '75%', justifyContent: 'flex-end', borderRadius: 7, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)' },
  chartBarFill: { width: '100%' },
  chartDayLabel: { color: C.textSecondary, fontSize: 10, marginTop: 7 },

  // Mode Selection
  modeCard: {
    backgroundColor: C.glass, borderWidth: 1.5, padding: 22, borderRadius: 20, marginBottom: 16,
    borderTopColor: C.glassHighlight,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 4,
  },
  modeTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8, letterSpacing: -0.2 },
  modeText: { color: C.textSecondary, fontSize: 14, lineHeight: 20 },

  // Tab Bar -- active tab now gets a soft pill background, not just a
  // color swap.
  tabBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: 'rgba(10,10,10,0.94)', flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: C.border, paddingBottom: 16, paddingTop: 10,
  },
  tabButton: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 },
  tabActivePill: {
    position: 'absolute', top: 2, width: 44, height: 30, borderRadius: 14,
    backgroundColor: 'rgba(56,189,248,0.12)',
  },
  tabIcon: { color: C.textSecondary, fontSize: 21 },
  tabIconActive: { color: C.accent, fontSize: 22 },
  tabLabel: { color: 'transparent', fontSize: 10, fontWeight: '600', height: 12 },
  tabLabelActive: { color: C.accent, fontWeight: '700' },

  // AI Morning Briefing Modal
  briefingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  briefingCard: {
    width: '100%',
    backgroundColor: C.glassStrong,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.28)',
    borderTopColor: 'rgba(56,189,248,0.45)', // brighter top edge, same glass-highlight trick, tinted to the modal's own accent
    borderRadius: 26,
    padding: 30,
    alignItems: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 26,
    elevation: 10,
  },
  briefingIconRing: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(56,189,248,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  briefingIconGlyph: { fontSize: 26 },
  briefingTitle: {
    color: C.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  briefingText: {
    color: C.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 26,
  },
  briefingButton: {
    backgroundColor: C.accent,
    paddingVertical: 13,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  briefingButtonText: {
    color: '#001018',
    fontSize: 15,
    fontWeight: '700',
  },

  // AI Behavior Feed -- now with real depth and the same glass-edge
  // highlight as the other cards, instead of a flat undefined border.
  insightCard: {
    width: 260,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderTopColor: C.glassHighlight,
    borderRadius: 20,
    padding: 18,
    marginRight: 12,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 4,
  },
  insightIconBadge: {
    width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12
  },
  insightTitle: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6
  },
  insightText: {
    color: C.textPrimary, fontSize: 13, lineHeight: 19
  },

  // Savings Goals
  goalRow: { marginBottom: 18 },
  goalName: { color: C.textPrimary, fontSize: 14, fontWeight: '600' },
  goalMeta: { color: C.textSecondary, fontSize: 12 },
  goalDeadline: { color: C.textSecondary, fontSize: 11 },
  goalInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: C.border,
    borderTopColor: C.glassHighlight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: C.textPrimary,
    fontSize: 15,
  },

  // Week Selector -- active chip now lifts slightly with its own shadow
  weekChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 10,
  },
  weekChipActive: {
    backgroundColor: 'rgba(56,189,248,0.15)',
    borderColor: 'rgba(56,189,248,0.4)',
    shadowColor: C.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  weekChipText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '600'
  },
  weekChipTextActive: {
    color: C.accent,
    fontWeight: 'bold'
  },

  // Persona Card -- icon badge now gets a glow tinted to that persona's
  // color, added inline via shadowColor override in JSX.
  personaIconBadge: {
    width: 56, height: 56, borderRadius: 16, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5,
  },
  personaLabel: { color: C.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  personaName: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  personaDesc: { color: C.textSecondary, fontSize: 12, lineHeight: 17 },

  // Heatmap
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
  },
  heatmapCell: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heatmapLegend: {
    color: C.textSecondary, fontSize: 10, fontWeight: '600'
  },
  heatmapSelectedText: {
    color: C.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },

  // Expanded repetitive-payment detail list -- now reads as "a drawer
  // opening from the row above it" via a colored left accent border,
  // instead of a disconnected plain list.
  expandedList: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
    marginLeft: 4,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(245,158,11,0.35)',
  },
  expandedText: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
