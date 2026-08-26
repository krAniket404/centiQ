import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, PermissionsAndroid, BackHandler,
  Alert, NativeModules, FlatList, StatusBar, AppState, Modal, ActivityIndicator, ScrollView, Share, TextInput, Dimensions, RefreshControl, Vibration, Animated,
  LayoutAnimation, UIManager, Platform, DeviceEventEmitter, Linking
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
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AuthScreen from './src/screens/AuthScreen';
import { getScoreColor as getDynamicScoreColor } from './src/theme/scoreColor';
import PaywallScreen from './src/screens/PaywallScreen';
import AnimatedNumber from './src/components/AnimatedNumber';
import SkeletonCard from './src/components/SkeletonCard';
import { MONEY_QUOTES } from './src/lib/quotes';
import { Typography } from './src/theme/typography';
import WowModal from './src/components/WowModal';
import WellnessCard from './src/components/WellnessCard';
import MonthlyWrapModal from './src/components/MonthlyWrapModal';

const { SmsModule } = NativeModules;
const STORAGE_KEY = 'centiq_state_v1';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// Refined Luxury Design Tokens
const C = {
  bg: "#060608",               // Deeper, richer black
  glass: "rgba(255,255,255,0.04)", // Slightly darker glass for contrast
  glassStrong: "rgba(255,255,255,0.07)",
  glassHighlight: "rgba(255,255,255,0.2)", // Brighter top edge for the "glass" trick
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.12)",
  textPrimary: "#FFFFFF",
  textSecondary: "#A0A0B0",    // Slightly brighter for better readability
  accent: "#38BDF8",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  purple: "#8B5CF6",
  shadow: "#000000",
};

// Haptic Feedback Helper
const triggerHaptic = (ms: number = 15) => {
  Vibration.vibrate(ms);
};

export default function App() {
  const [goals, setGoals] = useState<any[]>([]);
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalCurrent, setNewGoalCurrent] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAllRepetitive, setShowAllRepetitive] = useState(false);
  const [showMonthlyWrap, setShowMonthlyWrap] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0)); // 0 = invisible
  const [slideAnim] = useState(new Animated.Value(30)); // Starts 30px down
  const [pendingPurchases, setPendingPurchases] = useState<any[]>([]);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseName, setPauseName] = useState('');
  const [pauseAmount, setPauseAmount] = useState('');
  const [activeStreaks, setActiveStreaks] = useState<string[]>(['late_night']);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);
  const [forecastAnim] = useState(new Animated.Value(0));
  const [morningQuote, setMorningQuote] = useState<string | null>(null);
  const [showWowModal, setShowWowModal] = useState(false);
  const [manualCategories, setManualCategories] = useState<{[key: string]: string}>({});
  const [emergencyTxnIds, setEmergencyTxnIds] = useState<string[]>([]);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyTxnId, setEmergencyTxnId] = useState<string | null>(null);
  const [emergencyReason, setEmergencyReason] = useState('');

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
  const [session, setSession] = useState<FirebaseAuthTypes.User | null>(null);

  // Animation values for the meters
  const meterAnimations = React.useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0)
  ]).current;

  // --- ALL HOOKS MUST BE HERE, AT THE TOP LEVEL ---

  useEffect(() => {
    const animations = [
      { value: scores.discipline, anim: meterAnimations[0] },
      { value: scores.impulse, anim: meterAnimations[1] },
      { value: scores.volatility, anim: meterAnimations[2] },
      { value: scores.savingsRate, anim: meterAnimations[3] },
    ];

    animations.forEach(({ value, anim }) => {
      Animated.timing(anim, {
        toValue: Math.max(0, Math.min(value, 100)),
        duration: 1000, // 1 second smooth slide
        useNativeDriver: false,
      }).start();
    });
  }, [scores]);

/*  useEffect(() => {
    // Safety check to prevent the crash
    if (!auth || typeof auth !== 'function') {
      console.error("Firebase Auth module is not linked properly!");
      return;
    }

    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      setSession(user);
      if (user) {
        // Fetch Pro Status from Firestore
        const doc = await firestore().collection('profiles').doc(user.uid).get();
        if (doc.exists) {
          const data = doc.data();
          if (data?.subscription_status === 'trialing' || data?.subscription_status === 'active') {
            if (data.subscription_status === 'trialing' && data.trial_end_date && new Date(data.trial_end_date) < new Date()) {
              setIsPro(false);
            } else {
              setIsPro(true);
            }
          }
        }
      }
    });

    return () => unsubscribe();
  }, []); */

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

  // --- ALL BULLETPROOF USEMEMO HOOKS ---

  // Calculate Daily Quote (Changes every day, stays same all day)
  const dailyQuote = useMemo(() => {
    if (!MONEY_QUOTES || MONEY_QUOTES.length === 0) return null;
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);

    // Pick the quote that matches the day of the year (loops if > 366)
    const quoteIndex = dayOfYear % MONEY_QUOTES.length;
    return MONEY_QUOTES[quoteIndex];
  }, []);

  // Calculate "Wow" Insights for the first launch
  const wowInsights = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return null;
    const debitTxns = transactions.filter(t => t.type === 'debit');
    if (debitTxns.length === 0) return null;
    const totalSpend = debitTxns.reduce((a, b) => a + b.amount, 0);

    // 1. Late Night Spending (After 9 PM)
    const lateNightTxns = debitTxns.filter(t => t.date.getHours() >= 21 || t.date.getHours() <= 4);
    const dayTxns = debitTxns.filter(t => t.date.getHours() > 4 && t.date.getHours() < 21);
    const avgLate = lateNightTxns.length > 0 ? lateNightTxns.reduce((a, b) => a + b.amount, 0) / lateNightTxns.length : 0;
    const avgDay = dayTxns.length > 0 ? dayTxns.reduce((a, b) => a + b.amount, 0) / dayTxns.length : 0;
    const lateNightPct = avgDay > 0 ? Math.round(((avgLate - avgDay) / avgDay) * 100) : 0;

    // 2. Worst Day of the Week
    const dayTotals: { [key: string]: number } = {};
    debitTxns.forEach(t => { const d = t.date.getDay(); dayTotals[d] = (dayTotals[d] || 0) + t.amount; });
    const maxDayIndex = Object.keys(dayTotals).sort((a, b) => dayTotals[b] - dayTotals[a])[0];
    const dayNames = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
    const maxDayName = dayNames[maxDayIndex];
    const maxDayPct = totalSpend > 0 ? Math.round((dayTotals[maxDayIndex] / totalSpend) * 100) : 0;

    // 3. Overspend Forecast
    const overspendAmount = (monthlyForecast?.projectedSpend || 0) - (transactions.filter(t => t.type === 'credit' && t.date.getMonth() === new Date().getMonth()).reduce((a, b) => a + b.amount, 0));

    return { lateNightPct, maxDayName, maxDayPct, overspendAmount };
  }, [transactions, monthlyForecast]);

  const avgAmount = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return 0;
    return transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length;
  }, [transactions]);

  const monthlyWeeklyData = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Helper function to get the Monday of any given date
    const getMonday = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    // We will group transactions by their Monday date
    const weeksMap: { [key: string]: { day: string; amount: number }[] } = {};

    transactions.forEach(t => {
      const txnDate = new Date(t.date);
      // Only look at spending in the current month and year
      if (t.type === 'debit' && txnDate.getMonth() === currentMonth && txnDate.getFullYear() === currentYear) {

        // Find the Monday of the week this transaction belongs to
        const monday = getMonday(txnDate);
        const weekKey = monday.toISOString(); // Use Monday's date as a unique key

        // If this week doesn't exist in our map yet, create it
        if (!weeksMap[weekKey]) {
          weeksMap[weekKey] = [
            { day: 'Mon', amount: 0 }, { day: 'Tue', amount: 0 }, { day: 'Wed', amount: 0 },
            { day: 'Thu', amount: 0 }, { day: 'Fri', amount: 0 }, { day: 'Sat', amount: 0 }, { day: 'Sun', amount: 0 }
          ];
        }

        // Map Sunday (0) to index 6, Monday (1) to index 0, etc.
        const mapIndex = (txnDate.getDay() + 6) % 7;

        // Add the amount to the correct day
        weeksMap[weekKey][mapIndex].amount += Math.round(t.amount * 100) / 100;
      }
    });

    // Sort the weeks by their Monday date (oldest to newest)
    const sortedWeekKeys = Object.keys(weeksMap).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // Get the Monday of the current week so we don't show future empty weeks
    const currentMonday = getMonday(now);

    // Convert the map into an array and filter out future weeks
    return sortedWeekKeys
      .filter(weekKey => new Date(weekKey) <= currentMonday)
      .map((weekKey, index) => ({
        weekNum: index + 1,
        data: weeksMap[weekKey]
      }));
  }, [transactions]);

  const globalMaxSpend = useMemo(() => {
    let max = 0;
    if (Array.isArray(monthlyWeeklyData)) {
      monthlyWeeklyData.forEach(week => {
        week.data.forEach(day => {
          if (day.amount > max) max = day.amount;
        });
      });
    }
    // Ensure max is never exactly 0 to avoid division by zero errors in the chart UI
    return max > 0 ? max : 1;
  }, [monthlyWeeklyData]);

  const recurringCharges = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return { knownSubscriptions: [], repetitivePayments: [], totalSubsCost: 0, totalRepetitiveCost: 0 };
    const result = detectSubscriptionLeaks(transactions) || { knownSubscriptions: [], repetitivePayments: [] };
    const knownSubs = result.knownSubscriptions || [];
    const repetitivePays = result.repetitivePayments || [];
    const totalSubsCost = knownSubs.reduce((sum: number, l: any) => sum + l.amount, 0);
    const totalRepetitiveCost = repetitivePays.reduce((sum: number, l: any) => sum + l.amount, 0);
    return { knownSubscriptions: knownSubs, repetitivePayments: repetitivePays, totalSubsCost, totalRepetitiveCost };
  }, [transactions]);

  const behavioralProfile = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return { persona: { name: 'The Balanced Spender', desc: 'You have a healthy mix of discipline and spontaneity.', icon: '⚖️', color: C.accent }, heatmap: [] };
    }
    const debitTxns = transactions.filter(t => t.type === 'debit');
    const catTotals: { [key: string]: number } = {};
    debitTxns.forEach(t => { catTotals[t.category || 'Other'] = (catTotals[t.category || 'Other'] || 0) + t.amount; });
    const topCat = Object.keys(catTotals).sort((a, b) => catTotals[b] - catTotals[a])[0];

    let persona = { name: 'The Balanced Spender', desc: 'You have a healthy mix of discipline and spontaneity.', icon: 'scale-balance', color: C.accent };
    if (scores.impulse > 60 && scores.volatility > 60) {
      persona = { name: 'The Midnight Impulser', desc: 'High volatility and late-night triggers. You act fast and feel it later.', icon: 'flash-alert', color: C.danger };
    } else if (scores.discipline > 70 && scores.savingsRate > 50) {
      persona = { name: 'The Stealth Saver', desc: 'Highly disciplined. You crush your savings goals without thinking twice.', icon: 'shield-check', color: C.success };
    } else if (recurringCharges.knownSubscriptions.length >= 4) {
      persona = { name: 'The Subscription Hoarder', desc: 'You have 4+ active recurring subscriptions. Time to audit and cancel the unused ones!', icon: 'package-variant-closed', color: C.purple };
    } else if (topCat === 'Food' && scores.impulse > 50) {
      persona = { name: 'The Foodie Impulser', desc: 'Food is your top category, and your impulse score is high. Those late-night deliveries add up!', icon: 'food-apple-outline', color: C.warning };
    } else if (scores.impulse > 40 && scores.discipline < 50) {
      persona = { name: 'The Weekend Warrior', desc: 'You stay disciplined during the week, but cut loose on the weekends.', icon: 'party-popper', color: C.warning };
    }

    const days: { date: Date; amount: number; isImpulsive: boolean }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dayTxns = transactions.filter(t => new Date(t.date).toDateString() === date.toDateString() && t.type === 'debit');
      const amount = dayTxns.reduce((a, b) => a + b.amount, 0);
      const isImpulsive = dayTxns.some(t => t.date.getHours() >= 22 || t.date.getHours() <= 4 || t.amount > avgAmount * 1.5);
      days.push({ date, amount, isImpulsive });
    }
    return { persona, heatmap: days };
  }, [scores, transactions, avgAmount, recurringCharges]);

  const monthlyForecast = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return { projectedSpend: 0, overspendRisk: 0, riskLevel: 'Low', riskColor: C.success };
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const monthTxns = transactions.filter(t => t.type === 'debit' && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear());
    const spentSoFar = monthTxns.reduce((a, b) => a + b.amount, 0);
    const monthlyIncome = transactions.filter(t => t.type === 'credit' && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear()).reduce((a, b) => a + b.amount, 0);
    const avgDailySpend = dayOfMonth > 0 ? spentSoFar / dayOfMonth : 0;
    const projectedSpend = avgDailySpend * daysInMonth;
    const riskRatio = monthlyIncome > 0 ? (projectedSpend / monthlyIncome) : 0;
    const overspendRisk = Math.max(0, Math.min(100, Math.round(riskRatio * 100)));
    let riskLevel = 'Low';
    let riskColor = C.success;
    if (overspendRisk > 85) { riskLevel = 'High'; riskColor = C.danger; }
    else if (overspendRisk > 65) { riskLevel = 'Moderate'; riskColor = C.warning; }
    return { projectedSpend: Math.round(projectedSpend), overspendRisk, riskLevel, riskColor };
  }, [transactions]);

  const behaviorFeed = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return [];
    const insights: { icon: string; title: string; text: string; color: string }[] = [];
    const debitTxns = transactions.filter(t => t.type === 'debit');
    const weekendTxns = debitTxns.filter(t => t.date.getDay() === 0 || t.date.getDay() === 6);
    const weekendSpend = weekendTxns.reduce((a, b) => a + b.amount, 0);
    const totalSpend = debitTxns.reduce((a, b) => a + b.amount, 0);
    if (totalSpend > 0 && weekendSpend / totalSpend > 0.4) {
      insights.push({ icon: 'calendar-star', title: 'WEEKEND WARRIOR', text: `You spend ${Math.round((weekendSpend / totalSpend) * 100)}% of your money on weekends. Watch out for impulse food delivery!`, color: C.warning });
    }
    const lateNightTxns = debitTxns.filter(t => t.date.getHours() >= 22 || t.date.getHours() <= 4);
    if (lateNightTxns.length > 2) {
      insights.push({ icon: 'weather-night', title: 'LATE NIGHT CRAVINGS', text: `We detected ${lateNightTxns.length} transactions between 10 PM and 4 AM. These are highly likely to be impulsive.`, color: C.purple });
    }
    const catTotals: { [key: string]: number } = {};
    debitTxns.forEach(t => { catTotals[t.category || 'Other'] = (catTotals[t.category || 'Other'] || 0) + t.amount; });
    const topCat = Object.keys(catTotals).sort((a, b) => catTotals[b] - catTotals[a])[0];
    if (topCat && catTotals[topCat] > 0) {
      insights.push({ icon: 'tag-arrow-up', title: 'TOP CATEGORY', text: `${topCat} is your highest spending category at ₹${Math.round(catTotals[topCat]).toLocaleString('en-IN')}. Consider setting a budget for this.`, color: C.accent });
    }
    const avgAmt = debitTxns.length > 0 ? totalSpend / debitTxns.length : 0;
    const highValueTxns = debitTxns.filter(t => t.amount > avgAmt * 3);
    if (highValueTxns.length > 0) {
      insights.push({ icon: 'alert-circle-outline', title: 'UNUSUAL SPENDING', text: `You made ${highValueTxns.length} transactions significantly larger than your average of ₹${Math.round(avgAmt)}.`, color: C.danger });
    }
    return insights;
  }, [transactions]);

  const unlockedStreaks = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return ['late_night', 'weekend'];
    const unlocked = ['late_night', 'weekend'];
    const debitTxns = transactions.filter(t => t.type === 'debit');
    const hasMerchant = (keywords: string[]) => {
      return debitTxns.some(t => {
        const m = (t.merchant || '').toUpperCase();
        return keywords.some(k => m.includes(k));
      });
    };
    if (hasMerchant(['SWIGGY', 'ZOMATO', 'DOMINOS', 'EATS', 'PIZZA'])) unlocked.push('food_delivery');
    if (hasMerchant(['AMAZON', 'FLIPKART', 'MYNTRA', 'AJIO', 'NYKAA'])) unlocked.push('online_shopping');
    if (hasMerchant(['MCDONALD', 'KFC', 'BURGER', 'SUBWAY', 'WENDYS'])) unlocked.push('fast_food');
    if (hasMerchant(['UBER', 'OLA', 'RAPIDO', 'LYFT'])) unlocked.push('ride_hailing');
    if (hasMerchant(['STARBUCKS', 'CCD', 'CAFE', 'COFFEE', 'COSTA'])) unlocked.push('coffee');
    return Array.from(new Set(unlocked));
  }, [transactions]);

  const streakData = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return {};
    const debitTxns = transactions.filter(t => t.type === 'debit');
    if (debitTxns.length === 0) return {};
    const totalSpend = debitTxns.reduce((a, b) => a + b.amount, 0);
    const avgAmt = totalSpend / debitTxns.length;
    const results: { [key: string]: number } = {};
    (activeStreaks || ['late_night']).forEach(streakId => {
      let streak = 0;
      let checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);
      checkDate.setDate(checkDate.getDate() - 1);
      while (true) {
        const dateStr = checkDate.toDateString();
        const dayTxns = debitTxns.filter(t => new Date(t.date).toDateString() === dateStr);
        let broken = false;
        if (dayTxns.length > 0) {
          if (streakId === 'late_night') broken = dayTxns.some(t => { const h = new Date(t.date).getHours(); return h >= 22 || h <= 6; });
          else if (streakId === 'weekend') { const day = checkDate.getDay(); if (day === 0 || day === 6) broken = dayTxns.some(t => t.amount > avgAmt * 1.5); }
          else if (streakId === 'food_delivery') broken = dayTxns.some(t => { const m = (t.merchant || '').toUpperCase(); return m.includes('SWIGGY') || m.includes('ZOMATO') || m.includes('DOMINOS') || m.includes('EATS') || m.includes('PIZZA'); });
          else if (streakId === 'online_shopping') broken = dayTxns.some(t => { const m = (t.merchant || '').toUpperCase(); return m.includes('AMAZON') || m.includes('FLIPKART') || m.includes('MYNTRA') || m.includes('AJIO') || m.includes('NYKAA'); });
          else if (streakId === 'fast_food') broken = dayTxns.some(t => { const m = (t.merchant || '').toUpperCase(); return m.includes('MCDONALD') || m.includes('KFC') || m.includes('BURGER') || m.includes('SUBWAY') || m.includes('WENDYS'); });
          else if (streakId === 'ride_hailing') broken = dayTxns.some(t => { const m = (t.merchant || '').toUpperCase(); return m.includes('UBER') || m.includes('OLA') || m.includes('RAPIDO') || m.includes('LYFT'); });
          else if (streakId === 'coffee') broken = dayTxns.some(t => { const m = (t.merchant || '').toUpperCase(); return m.includes('STARBUCKS') || m.includes('CCD') || m.includes('CAFE') || m.includes('COFFEE') || m.includes('COSTA'); });
        }
        if (broken) break;
        else { streak++; checkDate.setDate(checkDate.getDate() - 1); if (streak > 365) break; }
      }
      results[streakId] = streak;
    });
    return results;
  }, [transactions, activeStreaks]);

  // Calculate Monthly Wrap Data (Fixed to exclude "Worth It" purchases)
  const monthlyWrapData = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0 || !behavioralProfile) {
      return { totalSpend: 0, topCat: 'N/A', biggestImpulse: undefined, persona: { name: 'Loading...', desc: '', icon: 'progress-clock', color: C.accent } };
    }
    const now = new Date();
    const debitTxns = transactions.filter(t => t.type === 'debit' && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear());
    const totalSpend = debitTxns.reduce((a, b) => a + b.amount, 0);

    const catTotals: { [key: string]: number } = {};
    debitTxns.forEach(t => { catTotals[t.category || 'Other'] = (catTotals[t.category || 'Other'] || 0) + t.amount; });
    const topCat = Object.keys(catTotals).sort((a, b) => catTotals[b] - catTotals[a])[0] || 'N/A';

    // FIX: Only look for impulses in transactions that are NOT marked "Worth It"
    const liberalTxns = debitTxns.filter(t => !worthItTxnIds.includes(t.id!));
    const liberalTotalSpend = liberalTxns.reduce((a, b) => a + b.amount, 0);
    const avgLiberalAmt = liberalTxns.length > 0 ? liberalTotalSpend / liberalTxns.length : 0;

    // Find biggest impulse (late night or > 1.5x liberal average)
    const impulseTxns = liberalTxns.filter(t => t.date.getHours() >= 22 || t.date.getHours() <= 4 || t.amount > avgLiberalAmt * 1.5);
    const biggestImpulse = impulseTxns.sort((a, b) => b.amount - a.amount)[0];

    return { totalSpend, topCat, biggestImpulse, persona: behavioralProfile.persona };
  }, [transactions, behavioralProfile, worthItTxnIds]); // Added worthItTxnIds to dependencies

  // --- FUNCTIONS START HERE ---
  const loadSavedData = async () => {
    try {
      const raw = await SmsModule.loadData(STORAGE_KEY);
      if (!raw) {
        // If it's the user's first launch, default them to Liberal Mode
        setMode('liberal');
        await saveState({ mode: 'liberal' });
        return null;
      }
      const parsed = JSON.parse(raw);
      // FIX: If old data has no mode, default to liberal
      if (!parsed.mode) {
        parsed.mode = 'liberal';
        setMode('liberal');
        await saveState({ mode: 'liberal' }); // Save it so it doesn't happen again
      } else {
        setMode(parsed.mode);
      }
      if (parsed.userLabels) setUserLabels(parsed.userLabels);
      if (parsed.labeledTxnIds) setLabeledTxnIds(parsed.labeledTxnIds);
      if (parsed.worthItTxnIds) setWorthItTxnIds(parsed.worthItTxnIds);
      if (parsed.goals) setGoals(parsed.goals);
      if (parsed.activeStreaks) setActiveStreaks(parsed.activeStreaks);
      if (parsed.manualCategories) setManualCategories(parsed.manualCategories);
      if (parsed.emergencyTxnIds) setEmergencyTxnIds(parsed.emergencyTxnIds);

      if (Array.isArray(parsed.transactions)) {
        const hydratedTxns = parsed.transactions.map((t: any) => ({
          ...t,
          date: new Date(t.date)
        }));
        setTransactions(hydratedTxns);
      }

      if (parsed.scores) setScores(parsed.scores);
      return parsed;
    } catch (e) {
      console.warn("Failed to load saved data", e);
      return null;
    }
  };

  const saveState = async (overrides: any = {}) => {
    const payload = {
      mode: overrides.mode ?? mode,
      userLabels: overrides.userLabels ?? userLabels,
      labeledTxnIds: overrides.labeledTxnIds ?? labeledTxnIds,
      worthItTxnIds: overrides.worthItTxnIds ?? worthItTxnIds,
      goals: overrides.goals ?? goals,
      transactions: overrides.transactions ?? transactions,
      scores: overrides.scores ?? scores,
      activeStreaks: overrides.activeStreaks ?? activeStreaks,
      manualCategories: overrides.manualCategories ?? manualCategories,
      emergencyTxnIds: overrides.emergencyTxnIds ?? emergencyTxnIds,
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
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS //
      ]);

      if (
        granted[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
        granted[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED
      ) {
        setHasPermission(true);
        // FIX: Default to Liberal Mode if they don't have one set yet
        if (!mode) {
          setMode('liberal');
          await saveState({ mode: 'liberal' });
        }
        fetchSMS(savedStateRef.current);
      } else {
        Alert.alert("Permission Denied", "Q cannot function without SMS access. Exiting.");
        setTimeout(() => BackHandler.exitApp(), 1500);
      }
    } catch (err) {}
  };

  // Function to prompt user to enable Notification Access
  const requestNotificationAccess = async () => {
    Alert.alert(
      "Enable Smart Tracking",
      "To catch UPI and banking app transactions automatically, allow Q to access notifications.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => NativeModules.SmsModule.openNotificationSettings() }
      ]
    );
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
      const randomQuote = MONEY_QUOTES[Math.floor(Math.random() * MONEY_QUOTES.length)];
      setMorningQuote(randomQuote);

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
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTransactions(parsedTxns);      syncToCloud(parsedTxns);

      const debitTxns = parsedTxns.filter(t => t.type === 'debit');
      if (debitTxns.length === 0) return;

      const worthIt = saved?.worthItTxnIds ?? worthItTxnIds;
      const liberalTxns = debitTxns.filter(t => !worthIt.includes(t.id!));
      const emergencies = saved?.emergencyTxnIds ?? emergencyTxnIds;
      const discipline = calculateDisciplineScore(debitTxns);
      const impulse = calculateImpulseIndex(liberalTxns, monthlyCredit);
      const volatility = calculateVolatilityScore(debitTxns);

      const now = new Date();
      const monthlyDebit = debitTxns.filter(t => t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear()).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const monthlyCredit = parsedTxns.filter(t => t.type === 'credit' && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear()).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const savingsRate = monthlyCredit > 0 ? Math.max(0, Math.min(100, ((monthlyCredit - monthlyDebit) / monthlyCredit) * 100)) : 0;

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true })
      ]).start();

      saveState({
        transactions: parsedTxns,
        scores: { discipline, impulse, volatility, wellness, savingsRate }
      });

    } catch (e) {
      console.error("Failed to read SMS", e);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    await fetchSMS(savedStateRef.current);
    setIsRefreshing(false);
  };

  const handleLabelTransaction = (txn: ParsedTransaction, isImpulsive: boolean) => {
    const features = model.extractFeatures(txn, avgAmount);
    const newLabel: UserLabel = { txnFeatures: features, isImpulsive: isImpulsive ? 1 : 0 };
    const updatedLabels = [...userLabels, newLabel];
    const updatedLabeledIds = [...labeledTxnIds, txn.id!];
    const updatedWorthIt = isImpulsive ? worthItTxnIds.filter(id => id !== txn.id!) : [...worthItTxnIds, txn.id!];

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setUserLabels(updatedLabels);
    setLabeledTxnIds(updatedLabeledIds);
    setWorthItTxnIds(updatedWorthIt);
    model.train(updatedLabels);

    const debitTxns = transactions.filter(t => t.type === 'debit');
    const liberalTxns = debitTxns.filter(t => !updatedWorthIt.includes(t.id!));
    const newImpulse = calculateImpulseIndex(liberalTxns);
    const newWellness = calculateWellnessScore(scores.discipline, newImpulse, scores.volatility);
    setScores({ ...scores, impulse: newImpulse, wellness: newWellness });
    saveState({ userLabels: updatedLabels, labeledTxnIds: updatedLabeledIds, worthItTxnIds: updatedWorthIt });
  };

  const handleSetCategory = (txnId: string, newCategory: string) => {
    const updated = { ...manualCategories, [txnId]: newCategory };
    setManualCategories(updated);
    saveState({ manualCategories: updated });
    setTransactions(prev => prev.map(t => t.id === txnId ? { ...t, category: newCategory } : t));
  };

  const syncToCloud = async (txns: ParsedTransaction[]) => {
    // Use the fake test user ID for now, or the real Firebase UID later
    const userId = session?.uid || 'test-user-123';

    try {
      const batch = firestore().batch();

      txns.forEach(t => {
        const docRef = firestore().collection('transactions').doc(`${userId}_${t.date.getTime()}_${t.amount}_${t.merchant}`);
        batch.set(docRef, {
          user_id: userId,
          amount: t.amount,
          merchant: t.merchant,
          category: t.category,
          txn_date: t.date.toISOString(),
          type: t.type
        }, { merge: true }); // merge: true prevents duplicates!
      });

      await batch.commit();
      console.log('☁️ Synced transactions to Firebase!');
    } catch (e) {
      console.warn('Failed to sync to cloud', e);
    }
  };

  const handleStartTrial = async () => {
    setIsSubscribing(true);
    try {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7); // 7 days from now

      await supabase
        .from('profiles')
        .upsert({
          id: session?.user?.id,
          subscription_status: 'trialing',
          trial_end_date: trialEnd.toISOString()
        });

      setIsPro(true);
      Alert.alert("Pro Unlocked! 🎉", "Your 7-day free trial has started. Enjoy Q Pro!");
    } catch (e) {
      Alert.alert("Error", "Failed to start trial.");
    } finally {
      setIsSubscribing(false);
    }
  };
  const handleDepositFunds = () => {
    if (!depositAmount || !depositGoalId) return;

    const updatedGoals = goals.map(g =>
      g.id === depositGoalId
        ? { ...g, current: g.current + parseFloat(depositAmount) }
        : g
    );

    setGoals(updatedGoals);
    saveState({ goals: updatedGoals });

    setDepositGoalId(null);
    setDepositAmount('');
    triggerHaptic(30); //Satisfying click!
  };

  // Load pending purchases on mount
  useEffect(() => {
    const loadPending = async () => {
      // FIXED: Added SmsModule.
      const raw = await SmsModule.loadData('pending_purchases');
      if (raw) setPendingPurchases(JSON.parse(raw));
    };
    loadPending();
  }, []);

  const addPendingPurchase = async () => {
    if (!pauseName) return;
    const newPurchase = {
      id: Date.now().toString(),
      name: pauseName,
      amount: parseFloat(pauseAmount) || 0,
      unlockTime: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
    };
    const updated = [newPurchase, ...pendingPurchases];
    setPendingPurchases(updated);
    // FIXED: Added SmsModule.
    await SmsModule.saveData('pending_purchases', JSON.stringify(updated));
    setPauseName('');
    setPauseAmount('');
    setShowPauseModal(false);
  };

  const resolvePurchase = async (id: string, bought: boolean) => {
    const purchase = pendingPurchases.find(p => p.id === id);
    if (bought) {
      Alert.alert("Enjoy it! 🛍️", `You waited 24 hours. Go ahead and buy ${purchase?.name}.`);
    } else {
      Alert.alert("Huge win! 🎉", `You resisted the impulse and saved ₹${purchase?.amount}. Your brain is adapting!`);
    }
    const updated = pendingPurchases.filter(p => p.id !== id);
    setPendingPurchases(updated);
    // FIXED: Added SmsModule.
    await SmsModule.saveData('pending_purchases', JSON.stringify(updated));
  };

  const handleEmergencyOverride = () => {
    if (!emergencyTxnId) return;
    const updated = [...emergencyTxnIds, emergencyTxnId];
    setEmergencyTxnIds(updated);
    saveState({ emergencyTxnIds: updated });

    const debitTxns = transactions.filter(t => t.type === 'debit');
    const newLiberalTxns = debitTxns.filter(t => !worthItTxnIds.includes(t.id!) && !updated.includes(t.id!));
    const newImpulse = calculateImpulseIndex(newLiberalTxns, monthlyCredit);
    const newWellness = calculateWellnessScore(scores.discipline, newImpulse, scores.volatility);
    setScores({ ...scores, impulse: newImpulse, wellness: newWellness });

    setEmergencyTxnId(null);
    setEmergencyReason('');
    setShowEmergencyModal(false);
    Vibration.vibrate(30);
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

    setNewGoalName('');
    setNewGoalTarget('');
    setNewGoalCurrent('');
    setShowAddGoalModal(false);
    triggerHaptic(30); //Satisfying click!
  };

  // Listen for transaction notifications from the Android Service
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('transaction_notification', (notificationText: string) => {
      console.log("Received Notification:", notificationText);

      // Use your existing parser on the notification text
      const parsedTxn = parseBankSMS(notificationText);

      if (parsedTxn && parsedTxn.amount > 0) {
        setTransactions(prev => {
          // PREVENT DUPLICATES! Check if we already logged this in the last 2 minutes
          const isDuplicate = prev.some(t =>
            t.amount === parsedTxn.amount &&
            t.merchant === parsedTxn.merchant &&
            (Math.abs(new Date(t.date).getTime() - Date.now()) < 120000) // 2 mins
          );

          if (!isDuplicate) {
            const newTxn = {
              ...parsedTxn,
              id: `${Date.now()}_${parsedTxn.amount}_${parsedTxn.merchant}_${parsedTxn.type}`,
              date: new Date()
            };
            const updated = [newTxn, ...prev];

            // Save to storage immediately
            saveState({ transactions: updated });
            // Sync to Supabase
            syncToCloud([newTxn]);
            return updated;
          }
          return prev;
        });
      }
    });

    return () => subscription.remove();
  }, []);

  //TEMPORARILY BYPASS LOGIN TO TEST THE APP
  if (!session) {
      // return <AuthScreen />;
      setSession({ uid: 'test-user-123' } as any); // Fake a login so you can get into the app!
  }

  if (!hasPermission) {
    return (
      <View style={styles.darkContainer}>
      <StatusBar barStyle="light-content" />
        <View style={styles.onboardingContent}>
          <Text style={styles.logo}>Q</Text>
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
        <ActivityIndicator color={C.accent} size="large" style={{ marginTop: 100 }} />
      </View>
    );
  }

return (
    <View style={styles.darkContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#060608" />

      {activeTab === 'dashboard' ? (
        <FlatList
          data={[]}
          renderItem={null}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={C.accent}
            />
          }
          ListEmptyComponent={() => (
            <View style={{ marginTop: 20 }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          )}
          ListHeaderComponent={() => (
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
              {/* Header */}
              <View style={styles.headerRow}>
                <View>
                  <TouchableOpacity onPress={() => { setEmergencyTxnId('test_emergency_123'); setShowEmergencyModal(true); }} style={{ backgroundColor: '#EF4444', padding: 8, borderRadius: 8, marginBottom: 10 }}>
                    <Text style={{ color: '#FFF', fontSize: 12 }}>Test Emergency Modal</Text>
                  </TouchableOpacity>
                  <Text style={styles.greeting}>
                    {(() => {
                      const h = new Date().getHours();
                      if (h < 12) return 'Good morning';
                      if (h < 17) return 'Good afternoon';
                      if (h < 22) return 'Good evening';
                      return 'Working late?';
                    })()}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity style={styles.wrapButton} activeOpacity={0.8} onPress={() => setShowMonthlyWrap(true)}>
                    <Icon name="gift-outline" size={16} color={C.textPrimary} />
                    <Text style={styles.wrapButtonText}>Wrap</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.syncPill} activeOpacity={0.8} onPress={resetAppData}>
                    <View style={styles.syncDot} />
                    <Text style={styles.syncText}>Reset</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Financial Wellness Card */}
              <WellnessCard scores={scores} />

              {/* Financial Persona Card */}
              <View style={[styles.glassCardHeavy, { padding: 20, marginBottom: 14, flexDirection: 'row', alignItems: 'center' }]}>
                <View style={[
                  styles.personaIconBadge,
                  {
                    backgroundColor: `${behavioralProfile.persona.color}20`,
                    borderColor: `${behavioralProfile.persona.color}50`,
                    shadowColor: behavioralProfile.persona.color,
                  },
                ]}>
                  <Icon name={behavioralProfile.persona.icon} size={28} color={behavioralProfile.persona.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.personaLabel}>YOUR FINANCIAL PERSONA</Text>
                  <Text style={[styles.personaName, { color: behavioralProfile.persona.color }]}>{behavioralProfile.persona.name}</Text>
                  <Text style={styles.personaDesc}>{behavioralProfile.persona.desc}</Text>
                </View>
              </View>

              {/* Dynamic Discipline Streaks Card */}
              <View style={[styles.glassCard, { padding: 20, marginBottom: 14 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="fire" size={16} color={C.warning} />
                    <Text style={styles.cardHeaderTitle}>DISCIPLINE STREAKS</Text>
                  </View>
                  <TouchableOpacity style={styles.wrapButton} activeOpacity={0.8} onPress={() => setShowStreakModal(true)}>
                    <Text style={styles.wrapButtonText}>Manage</Text>
                  </TouchableOpacity>
                </View>

                {activeStreaks.length === 0 ? (
                  <Text style={{ color: C.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 10, lineHeight: 19 }}>
                    No habits selected. Tap "Manage" to choose which bad habits you want to break!
                  </Text>
                ) : (
                  activeStreaks.map(id => {
                    const config = {
                      late_night: { icon: 'weather-night', name: 'Late Night Spending', desc: 'No transactions 10PM-6AM' },
                      weekend: { icon: 'party-popper', name: 'Weekend Splurging', desc: 'No large purchases on Sat/Sun' },
                      food_delivery: { icon: 'food-apple-outline', name: 'Food Delivery', desc: 'No Swiggy/Zomato/Eats' },
                      online_shopping: { icon: 'shopping-outline', name: 'Online Shopping', desc: 'No Amazon/Flipkart' }
                    }[id];

                    if (!config) return null;

                    return (
                      <View key={id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                        <View style={[styles.insightIconBadge, { backgroundColor: `${C.warning}20`, marginRight: 12 }]}>
                           <Icon name={config.icon} size={16} color={C.warning} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.textPrimary, fontSize: 15, fontWeight: '700' }}>{streakData[id] || 0} Days</Text>
                          <Text style={{ color: C.textSecondary, fontSize: 12 }}>{config.name}</Text>
                        </View>
                        <Text style={{ color: C.textSecondary, fontSize: 11, textAlign: 'right', flex: 0.5 }}>{config.desc}</Text>
                      </View>
                    );
                  })
                )}
              </View>

              {/* The 24-Hour Rule Card */}
              <View style={[styles.glassCard, { padding: 20, marginBottom: 14 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="timer-sand" size={16} color={C.accent} />
                    <Text style={styles.cardHeaderTitle}>THE 24-HOUR RULE</Text>
                  </View>
                  <TouchableOpacity style={styles.wrapButton} activeOpacity={0.8} onPress={() => setShowPauseModal(true)}>
                    <Text style={styles.wrapButtonText}>+ Add</Text>
                  </TouchableOpacity>
                </View>

                {pendingPurchases.length === 0 ? (
                  <Text style={{ color: C.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 10, lineHeight: 19 }}>
                    Want to buy something? Add it here instead of buying it instantly. If you still want it in 24 hours, go for it!
                  </Text>
                ) : (
                  pendingPurchases.map(p => {
                    const timeLeft = p.unlockTime - Date.now();
                    const isUnlocked = timeLeft <= 0;
                    const hoursLeft = Math.max(0, Math.ceil(timeLeft / (1000 * 60 * 60)));

                    return (
                      <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{ color: C.textPrimary, fontSize: 15, fontWeight: '600' }}>{p.name}</Text>
                          <Text style={{ color: C.textSecondary, fontSize: 12, marginTop: 2 }}>
                            {isUnlocked ? 'Timer up! Did you buy it?' : `${hoursLeft}h left to decide`}
                          </Text>
                        </View>
                        {isUnlocked ? (
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={() => resolvePurchase(p.id, true)} style={{ backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                              <Text style={{ color: C.success, fontSize: 11, fontWeight: '700' }}>Bought</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => resolvePurchase(p.id, false)} style={{ backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                              <Text style={{ color: C.danger, fontSize: 11, fontWeight: '700' }}>Resisted</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <Icon name="lock" size={22} color={C.accent} />
                        )}
                      </View>
                    );
                  })
                )}
              </View>

              {/* Behavioral Heatmap */}
              <View style={[styles.glassCard, { padding: 20, marginBottom: 14 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={styles.cardHeaderTitle}>30-DAY BEHAVIOR MAP</Text>
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
                    let bgColor = 'rgba(255,255,255,0.05)';
                    if (day.amount > 0 && !day.isImpulsive) bgColor = 'rgba(56,189,248,0.3)';
                    if (day.amount > 0 && day.isImpulsive) bgColor = C.danger;
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

              {/* Digital Subscriptions Card */}
              <View style={[styles.glassCard, { padding: 20, marginBottom: 14, borderColor: 'rgba(56,189,248,0.22)' }]}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTitleWithIcon}>
                    <View style={[styles.iconBadge, { backgroundColor: 'rgba(56,189,248,0.14)' }]}>
                      <Icon name="movie-open-outline" size={16} color={C.accent} />
                    </View>
                    <Text style={[styles.cardHeaderTitle, { marginBottom: 0, color: C.accent }]}>SUBSCRIPTIONS</Text>
                  </View>
                  {recurringCharges.knownSubscriptions.length > 0 && (
                    <Text style={styles.cardTopRowValue}>₹{recurringCharges.totalSubsCost.toLocaleString('en-IN')}/mo</Text>
                  )}
                </View>

                {recurringCharges.knownSubscriptions.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                    <Icon name="check-circle-outline" size={32} color={C.success} style={{ marginBottom: 8 }} />
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

              {/* Repetitive Payments Card */}
              {recurringCharges.repetitivePayments.length > 0 && (
                <View style={[styles.glassCard, { padding: 20, marginBottom: 14, borderColor: 'rgba(245,158,11,0.22)' }]}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardTitleWithIcon}>
                      <View style={[styles.iconBadge, { backgroundColor: 'rgba(245,158,11,0.14)' }]}>
                        <Icon name="alert-circle-outline" size={16} color={C.warning} />
                      </View>
                      <Text style={[styles.cardHeaderTitle, { marginBottom: 0, color: C.warning }]}>REPETITIVE PAYMENTS</Text>
                    </View>
                    <Text style={[styles.cardTopRowValue, { color: C.warning }]}>₹{recurringCharges.totalRepetitiveCost.toLocaleString('en-IN')}/mo</Text>
                  </View>
                  <Text style={{ color: C.textSecondary, fontSize: 13, marginBottom: 14, lineHeight: 18 }}>
                    We detected {recurringCharges.repetitivePayments.length} recurring charges (bills, rent, gyms, etc). Tap to view dates.
                  </Text>

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
                <View style={{ marginBottom: 14 }}>
                  <Text style={styles.cardHeaderTitle}>AI BEHAVIOR FEED</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingRight: 20, paddingTop: 8 }}
                  >
                    {behaviorFeed.map((insight, i) => (
                      <View key={i} style={[styles.insightCard, { borderColor: `${insight.color}30` }]}>
                        <View style={[styles.insightIconBadge, { backgroundColor: `${insight.color}20` }]}>
                          <Icon name={insight.icon} size={16} color={insight.color} />
                        </View>
                        <Text style={[styles.insightTitle, { color: insight.color }]}>{insight.title}</Text>
                        <Text style={styles.insightText}>{insight.text}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* AI Monthly Forecast Card */}
              <View style={[styles.glassCard, { padding: 20, marginBottom: 14 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View style={[styles.iconBadge, { backgroundColor: 'rgba(56,189,248,0.14)', marginRight: 12 }]}>
                    <Icon name="chart-line" size={16} color={C.accent} />
                  </View>
                  <View>
                    <Text style={styles.cardHeaderTitle}>NEXT MONTH FORECAST</Text>
                    <Text style={styles.subtleText}>Based on your current spending velocity</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 4 }}>Projected Spend</Text>
                    <Text style={{ color: C.textPrimary, fontSize: 22, fontWeight: '800', fontFamily: Typography.fontFamilyBold }}>
                      ₹{(monthlyForecast?.projectedSpend || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 4 }}>Overspend Risk</Text>
                    <Text style={{ color: monthlyForecast?.riskColor || C.accent, fontSize: 22, fontWeight: '800', fontFamily: Typography.fontFamilyBold }}>
                      {monthlyForecast?.overspendRisk || 0}%
                    </Text>
                  </View>
                </View>

                <View style={styles.riskBarBackground}>
                  <View style={[
                    styles.riskBarFill,
                    {
                      width: `${monthlyForecast?.overspendRisk || 0}%`,
                      backgroundColor: monthlyForecast?.riskColor || C.accent
                    }
                  ]} />
                </View>

                <Text style={{ color: monthlyForecast?.riskColor || C.accent, fontSize: 11, fontWeight: '700', marginTop: 8, textAlign: 'right', fontFamily: Typography.fontFamilyBold }}>
                  {(monthlyForecast?.riskLevel || 'LOW').toUpperCase()} RISK
                </Text>
              </View>

              {/* Savings Goals Card */}
              <View style={[styles.glassCard, { padding: 20, marginBottom: 14 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={styles.cardHeaderTitle}>SAVINGS VAULT</Text>
                  <TouchableOpacity onPress={() => setShowAddGoalModal(true)}>
                    <Text style={{ color: C.accent, fontSize: 12, fontWeight: 'bold' }}>+ New Goal</Text>
                  </TouchableOpacity>
                </View>

                {goals.length === 0 ? (
                  <Text style={{ color: C.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 10 }}>
                    No goals yet. Tap "+ New Goal" to start your vault!
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
                        <View style={styles.goalProgressBg}>
                          <View style={[styles.goalProgressFill, { width: `${pct}%`, backgroundColor: goal.color }]} />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                          <Text style={styles.goalDeadline}>{Math.round(pct)}% complete</Text>
                          <TouchableOpacity
                            style={[styles.depositButton, { borderColor: `${goal.color}50` }]}
                            onPress={() => setDepositGoalId(goal.id)}
                          >
                            <Text style={[styles.depositButtonText, { color: goal.color }]}>+ Deposit</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Premium Weekly Spending Chart */}
              <View style={[styles.glassCard, { padding: 20, marginBottom: 14 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={styles.cardHeaderTitle}>WEEKLY SPENDING</Text>
                  <Text style={styles.subtleText}>
                    Total: ₹{Math.round(monthlyWeeklyData[activeWeekIndex]?.data.reduce((a, b) => a + b.amount, 0) || 0).toLocaleString('en-IN')}
                  </Text>
                </View>

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

                {monthlyWeeklyData[activeWeekIndex] && (
                  <PremiumChart
                    data={monthlyWeeklyData[activeWeekIndex].data}
                    activeDay={activeDay}
                    setActiveDay={setActiveDay}
                    maxValue={globalMaxSpend}
                  />
                )}
              </View>
            </Animated.View>
          )}
        />
      ) : activeTab === 'transactions' ? (
        <TransactionsScreen
          transactions={transactions}
          mode={mode}
          userLabels={userLabels}
          labeledTxnIds={labeledTxnIds}
          worthItTxnIds={worthItTxnIds}
          avgAmount={avgAmount}
          model={model}
          handleLabelTransaction={handleLabelTransaction}
          onSetCategory={handleSetCategory}
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

                {/* NEW: Daily Money Quote */}
                {morningQuote && (
                  <View style={styles.quoteBox}>
                    <Text style={styles.quoteText}>"{morningQuote.split(' - ')[0]}"</Text>
                    <Text style={styles.quoteAuthor}>- {morningQuote.split(' - ')[1]}</Text>
                  </View>
                )}

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

      {/* 24-Hour Rule Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showPauseModal}
        onRequestClose={() => setShowPauseModal(false)}
      >
        <View style={styles.briefingOverlay}>
          <View style={styles.briefingCard}>
            <Text style={styles.briefingTitle}>Cooling Off Chamber</Text>
            <Text style={{ color: C.textSecondary, fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
              Lock this purchase away for 24 hours. Let the impulse fade.
            </Text>

            <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 8, alignSelf: 'flex-start' }}>WHAT DO YOU WANT TO BUY?</Text>
            <TextInput
              style={styles.goalInput}
              placeholder="e.g. New Sony Headphones"
              placeholderTextColor="#555"
              value={pauseName}
              onChangeText={setPauseName}
            />

            <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 8, marginTop: 16, alignSelf: 'flex-start' }}>PRICE (₹)</Text>
            <TextInput
              style={styles.goalInput}
              placeholder="e.g. 15000"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={pauseAmount}
              onChangeText={setPauseAmount}
            />

            <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginTop: 24 }}>
              <TouchableOpacity
                style={[styles.briefingButton, { backgroundColor: 'rgba(255,255,255,0.1)', flex: 1 }]}
                onPress={() => setShowPauseModal(false)}
              >
                <Text style={[styles.briefingButtonText, { color: C.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.briefingButton, { flex: 1 }]}
                onPress={addPendingPurchase}
              >
                <Text style={styles.briefingButtonText}>Lock for 24h 🔒</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manage Streaks Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showStreakModal}
        onRequestClose={() => setShowStreakModal(false)}
      >
        <View style={styles.briefingOverlay}>
          <View style={[styles.briefingCard, { maxHeight: '85%', padding: 24 }]}>
            <Text style={styles.briefingTitle}>Your Habit Tracker</Text>
            <Text style={{ color: C.textSecondary, fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
              We unlock streaks based on your actual spending habits. Break the chain!
            </Text>

            {/* WRAPPED IN SCROLLVIEW SO YOU CAN SCROLL */}
            <ScrollView style={{ width: '100%', maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {[
                { id: 'late_night', icon: '🌙', name: 'Late Night Spending', desc: 'No transactions 10PM-6AM' },
                { id: 'weekend', icon: '🎉', name: 'Weekend Splurging', desc: 'No large purchases on Sat/Sun' },
                { id: 'food_delivery', icon: '🛵', name: 'Food Delivery', desc: 'No Swiggy/Zomato/Eats' },
                { id: 'online_shopping', icon: '📦', name: 'Online Shopping', desc: 'No Amazon/Flipkart/Myntra' },
                { id: 'fast_food', icon: '🍔', name: 'Fast Food', desc: 'No McDonalds/KFC/Burger' },
                { id: 'ride_hailing', icon: '🚗', name: 'Ride Hailing', desc: 'No Uber/Ola/Rapido' },
                { id: 'coffee', icon: '☕', name: 'Coffee Shops', desc: 'No Starbucks/CCD/Cafe' }
              ].map(habit => {
                const isActive = activeStreaks.includes(habit.id);
                const isUnlocked = unlockedStreaks.includes(habit.id);

                return (
                  <TouchableOpacity
                    key={habit.id}
                    style={[
                      styles.habitRow,
                      isActive && isUnlocked && { borderColor: C.accent, backgroundColor: 'rgba(56,189,248,0.08)' },
                      !isUnlocked && { opacity: 0.4 }
                    ]}
                    disabled={!isUnlocked}
                    onPress={() => {
                      if (isActive) {
                        setActiveStreaks(activeStreaks.filter(id => id !== habit.id));
                        saveState({ activeStreaks: activeStreaks.filter(id => id !== habit.id) });
                      } else {
                        setActiveStreaks([...activeStreaks, habit.id]);
                        saveState({ activeStreaks: [...activeStreaks, habit.id] });
                      }
                    }}
                  >
                    <Text style={{ fontSize: 24, marginRight: 14 }}>{habit.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.textPrimary, fontSize: 15, fontWeight: '600' }}>{habit.name}</Text>
                      <Text style={{ color: C.textSecondary, fontSize: 12 }}>
                        {isUnlocked ? habit.desc : '🔒 Locked - Not detected in your history'}
                      </Text>
                    </View>
                    {isActive && isUnlocked && <Text style={{ color: C.accent, fontSize: 18, fontWeight: 'bold' }}>✓</Text>}
                    {!isUnlocked && <Text style={{ color: C.textSecondary, fontSize: 18, fontWeight: 'bold' }}>🔒</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.briefingButton, { marginTop: 24 }]}
              onPress={() => setShowStreakModal(false)}
            >
              <Text style={styles.briefingButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Deposit Funds Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={depositGoalId !== null}
        onRequestClose={() => setDepositGoalId(null)}
      >
        <View style={styles.briefingOverlay}>
          <View style={styles.briefingCard}>
            <Text style={styles.briefingTitle}>Move to Vault</Text>
            <Text style={{ color: C.textSecondary, fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
              Lock away funds for this goal so you aren't tempted to spend them.
            </Text>

            <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 8, alignSelf: 'flex-start' }}>AMOUNT TO DEPOSIT (₹)</Text>
            <TextInput
              style={styles.goalInput}
              placeholder="e.g. 500"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={depositAmount}
              onChangeText={setDepositAmount}
            />

            <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginTop: 24 }}>
              <TouchableOpacity
                style={[styles.briefingButton, { backgroundColor: 'rgba(255,255,255,0.1)', flex: 1 }]}
                onPress={() => setDepositGoalId(null)}
              >
                <Text style={[styles.briefingButtonText, { color: C.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.briefingButton, { flex: 1 }]}
                onPress={handleDepositFunds}
              >
                <Text style={styles.briefingButtonText}>Lock Funds 🔒</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* "Wow" Initial Insights Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showWowModal && wowInsights !== null}
        onRequestClose={() => setShowWowModal(false)}
      >
        <View style={[styles.briefingOverlay, { backgroundColor: 'rgba(0,0,0,0.95)' }]}>
          <View style={[styles.briefingCard, { padding: 32, width: '100%' }]}>

            <Text style={{ fontSize: 44, marginBottom: 16, textAlign: 'center' }}>🧠</Text>
            <Text style={[styles.briefingTitle, { fontSize: 26, marginBottom: 8 }]}>We decoded your money.</Text>
            <Text style={{ color: C.textSecondary, fontSize: 14, marginBottom: 28, textAlign: 'center', fontFamily: Typography.fontFamilyRegular }}>
              Here is what your spending history is hiding from you:
            </Text>

            {/* Insight 1 */}
            {wowInsights?.lateNightPct > 0 && (
              <View style={styles.wowInsightRow}>
                <Text style={styles.wowIcon}>🌙</Text>
                <Text style={styles.wowText}>
                  You spend <Text style={{ color: C.warning, fontWeight: '900' }}>{wowInsights.lateNightPct}% more</Text> per transaction after 9 PM.
                </Text>
              </View>
            )}

            {/* Insight 2 */}
            {wowInsights?.maxDayPct > 0 && (
              <View style={styles.wowInsightRow}>
                <Text style={styles.wowIcon}>📅</Text>
                <Text style={styles.wowText}>
                  <Text style={{ color: C.accent, fontWeight: '900' }}>{wowInsights.maxDayName}</Text> account for {wowInsights.maxDayPct}% of your total spending.
                </Text>
              </View>
            )}

            {/* Insight 3 */}
            {wowInsights?.overspendAmount > 0 && (
              <View style={styles.wowInsightRow}>
                <Text style={styles.wowIcon}>📈</Text>
                <Text style={styles.wowText}>
                  If you repeat last month's pattern, you'll overspend by <Text style={{ color: C.danger, fontWeight: '900' }}>₹{Math.round(wowInsights.overspendAmount).toLocaleString('en-IN')}</Text>.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.briefingButton, { marginTop: 32 }]}
              onPress={() => setShowWowModal(false)}
            >
              <Text style={styles.briefingButtonText}>See my Dashboard</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      <WowModal
        visible={showWowModal}
        onClose={() => setShowWowModal(false)}
        transactions={transactions}
        scores={scores}
        recurringCharges={recurringCharges}
        monthlyForecast={monthlyForecast}
      />

      <MonthlyWrapModal
        visible={showMonthlyWrap}
        onClose={() => setShowMonthlyWrap(false)}
        scores={scores}
        wrapData={monthlyWrapData}
        wellnessColor={getDynamicScoreColor(scores.wellness, 'higher_is_better')}
      />
      {/* PREMIUM FLOATING BOTTOM NAVIGATION */}
      <View style={styles.bottomNavContainer}>
        <TouchableOpacity
          style={styles.tabButton}
          activeOpacity={0.7}
          onPress={() => setActiveTab('dashboard')}
        >
          <Icon name="view-dashboard-outline" size={24} color={activeTab === 'dashboard' ? C.accent : C.textSecondary} />
          <Text style={[styles.tabLabel, { color: activeTab === 'dashboard' ? C.accent : C.textSecondary }]}>Home</Text>
          {activeTab === 'dashboard' && <View style={styles.activeDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          activeOpacity={0.7}
          onPress={() => setActiveTab('transactions')}
        >
          <Icon name="swap-horizontal" size={24} color={activeTab === 'transactions' ? C.accent : C.textSecondary} />
          <Text style={[styles.tabLabel, { color: activeTab === 'transactions' ? C.accent : C.textSecondary }]}>Spend</Text>
          {activeTab === 'transactions' && <View style={styles.activeDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          activeOpacity={0.7}
          onPress={() => setActiveTab('budgets')}
        >
          <Icon name="chart-pie" size={24} color={activeTab === 'budgets' ? C.accent : C.textSecondary} />
          <Text style={[styles.tabLabel, { color: activeTab === 'budgets' ? C.accent : C.textSecondary }]}>Budget</Text>
          {activeTab === 'budgets' && <View style={styles.activeDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          activeOpacity={0.7}
          onPress={() => setActiveTab('coach')}
        >
          <Icon name="robot-outline" size={24} color={activeTab === 'coach' ? C.accent : C.textSecondary} />
          <Text style={[styles.tabLabel, { color: activeTab === 'coach' ? C.accent : C.textSecondary }]}>Coach</Text>
          {activeTab === 'coach' && <View style={styles.activeDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          activeOpacity={0.7}
          onPress={() => setActiveTab('settings')}
        >
          <Icon name="cog-outline" size={24} color={activeTab === 'settings' ? C.accent : C.textSecondary} />
          <Text style={[styles.tabLabel, { color: activeTab === 'settings' ? C.accent : C.textSecondary }]}>More</Text>
          {activeTab === 'settings' && <View style={styles.activeDot} />}
        </TouchableOpacity>
      {showEmergencyModal && (
        <Modal transparent animationType="fade" visible={showEmergencyModal}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <View style={{ backgroundColor: '#121212', borderRadius: 24, padding: 28, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ color: '#EF4444', fontSize: 18, fontWeight: '800', marginBottom: 8 }}>EMERGENCY OVERRIDE</Text>
              <Text style={{ color: '#A0A0B0', fontSize: 14, marginBottom: 20 }}>
                Q won't count this against your behavioral scores or streaks.
              </Text>
              <TextInput
                placeholder="Brief reason (e.g., Medical, Repair)"
                placeholderTextColor="#555"
                value={emergencyReason}
                onChangeText={setEmergencyReason}
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, color: '#FFF', fontSize: 15, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => { setShowEmergencyModal(false); setEmergencyTxnId(null); }}
                  style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 16, alignItems: 'center' }}
                >
                  <Text style={{ color: '#A0A0B0', fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleEmergencyOverride}
                  style={{ flex: 1, backgroundColor: '#EF4444', borderRadius: 14, padding: 16, alignItems: 'center' }}
                >
                  <Text style={{ color: '#FFF', fontWeight: '800' }}>Unlock</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  darkContainer: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20, paddingTop: 50 },
  onboardingContent: { flex: 1, justifyContent: 'center' },
  logo: { color: C.textPrimary, fontSize: 36, fontWeight: '900', marginBottom: 20, letterSpacing: -0.5, fontFamily: Typography.fontFamilyBold },
  onboardingTitle: { color: C.textPrimary, fontSize: 30, fontWeight: '800', marginBottom: 12, lineHeight: 36, letterSpacing: -0.5, fontFamily: Typography.fontFamilyBold },
  onboardingSubtext: { color: C.textSecondary, fontSize: 16, lineHeight: 24, fontFamily: Typography.fontFamilyRegular },
  primaryButton: {
    backgroundColor: C.accent, padding: 18, borderRadius: 18, alignItems: 'center', marginBottom: 20,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  primaryButtonText: { color: '#001018', fontSize: 16, fontWeight: '800', fontFamily: Typography.fontFamilyBold },

  // Dashboard Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  greeting: { color: C.textSecondary, fontSize: 14, marginBottom: 4, fontFamily: Typography.fontFamilyRegular },
  headerTitle: { color: C.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, fontFamily: Typography.fontFamilyBold },
  syncPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass,
    borderWidth: 1, borderColor: C.border, borderTopColor: C.glassHighlight,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  syncDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success, marginRight: 6 },
  syncText: { color: C.textSecondary, fontSize: 12, fontWeight: '600', fontFamily: Typography.fontFamilyMedium },

  wrapButton: {
    backgroundColor: 'rgba(56,189,248,0.1)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.4)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  wrapButtonText: { color: C.accent, fontSize: 12, fontWeight: '700', fontFamily: Typography.fontFamilyBold },

  // Glass Cards -- Real depth via shadow, plus a lighter top border
  glassCard: {
    backgroundColor: C.glass,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16, // <--- Reduced to 16
    padding: 18,      // <--- Reduced to 18
  },
  glassCardHeavy: {
    backgroundColor: C.card,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: C.borderStrong,
    marginBottom: 16, // <--- Reduced to 16
    padding: 20,      // <--- Reduced to 20
  },
  cardHeaderTitle: { color: C.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginBottom: 18, fontFamily: Typography.fontFamilyBold },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitleWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTopRowValue: { color: C.accent, fontSize: 14, fontWeight: '700', fontFamily: Typography.fontFamilyBold },
  subtleText: { color: C.textSecondary, fontSize: 12, fontFamily: Typography.fontFamilyRegular },

  iconBadge: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconBadgeGlyph: { fontSize: 16 },

  ringWrap: {
    width: 108, height: 108, justifyContent: 'center', alignItems: 'center', marginRight: 20,
    shadowColor: '#38BDF8', // Neon glow behind the ring
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },

  // Meters
  meterContainer: { marginBottom: 16 },
  meterLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  meterLabel: { color: C.textSecondary, fontSize: 13, fontFamily: Typography.fontFamilyMedium },
  meterValue: { color: C.textPrimary, fontSize: 13, fontWeight: '700', fontFamily: Typography.fontFamilyBold },
  meterBackground: { height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  meterFill: { height: '100%', borderRadius: 999 },

  // Persona
  personaIconBadge: {
    width: 56, height: 56, borderRadius: 18, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  personaLabel: { color: C.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4, fontFamily: Typography.fontFamilyBold },
  personaName: { fontSize: 18, fontWeight: '800', marginBottom: 4, fontFamily: Typography.fontFamilyBold },
  personaDesc: { color: C.textSecondary, fontSize: 12, lineHeight: 17, fontFamily: Typography.fontFamilyRegular },

  // Heatmap
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between' },
  heatmapCell: { width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  heatmapLegend: { color: C.textSecondary, fontSize: 10, fontWeight: '600', fontFamily: Typography.fontFamilyMedium },
  heatmapSelectedText: { color: C.textPrimary, fontSize: 12, fontWeight: '700', fontFamily: Typography.fontFamilyBold },

  // Subscription Leaks
  leakRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  leakMerchant: { color: C.textPrimary, fontSize: 15, fontWeight: '600', fontFamily: Typography.fontFamilyMedium },
  leakCount: { color: C.textSecondary, fontSize: 11, marginTop: 2, fontFamily: Typography.fontFamilyRegular },
  leakAmount: { color: C.textPrimary, fontSize: 15, fontWeight: '700', fontFamily: Typography.fontFamilyBold },

  // Charts
  chartContainer: { flexDirection: 'row', justifyContent: 'space-between', height: 140, alignItems: 'flex-end', marginTop: 20 },
  chartBarWrapper: { alignItems: 'center', width: 38, height: '100%', justifyContent: 'flex-end' },
  barTooltip: {
    position: 'absolute', top: 0, backgroundColor: C.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    zIndex: 10, minWidth: 50, left: -6, alignItems: 'center',
    shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  barTooltipText: { color: '#001018', fontSize: 11, fontWeight: '800', flexWrap: 'nowrap', fontFamily: Typography.fontFamilyBold },
  chartBarBg: { width: 14, height: '75%', justifyContent: 'flex-end', borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)' },
  chartBarFill: { width: '100%' },
  chartDayLabel: { color: C.textSecondary, fontSize: 10, marginTop: 8, fontFamily: Typography.fontFamilyMedium },

  // Mode Selection
  modeCard: {
    backgroundColor: C.glass, borderWidth: 1.5, padding: 24, borderRadius: 24, marginBottom: 16,
    borderTopColor: C.glassHighlight,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 5,
  },
  modeTitle: { color: C.textPrimary, fontSize: 19, fontWeight: '800', marginBottom: 8, letterSpacing: -0.2, fontFamily: Typography.fontFamilyBold },
  modeText: { color: C.textSecondary, fontSize: 14, lineHeight: 20, fontFamily: Typography.fontFamilyRegular },

  // Tab Bar
  tabBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 84,
    backgroundColor: 'rgba(6,6,8,0.96)', flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: C.border, paddingBottom: 20, paddingTop: 12,
  },
  tabButton: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 },
  tabActivePill: {
    position: 'absolute', top: 4, width: 44, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(56,189,248,0.12)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.2)'
  },
  tabIcon: { color: C.textSecondary, fontSize: 22 },
  tabIconActive: { color: C.accent, fontSize: 22, textShadowColor: C.accent, textShadowOffset: {width: 0, height: 0}, textShadowRadius: 12 },
  tabLabel: { color: 'transparent', fontSize: 10, fontWeight: '700', height: 12, fontFamily: Typography.fontFamilyBold },
  tabLabelActive: { color: C.accent },

  // AI Morning Briefing Modal
  briefingOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  briefingCard: {
    width: '100%', backgroundColor: C.glassStrong, borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.28)', borderTopColor: 'rgba(56,189,248,0.45)',
    borderRadius: 32, padding: 32, alignItems: 'center',
    shadowColor: C.accent, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.3, shadowRadius: 32, elevation: 12,
  },
  briefingIconRing: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(56,189,248,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  briefingIconGlyph: { fontSize: 28 },
  briefingTitle: {
    color: C.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 16, letterSpacing: -0.3, fontFamily: Typography.fontFamilyBold,
  },
  briefingText: {
    color: C.textPrimary, fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 28, fontFamily: Typography.fontFamilyRegular,
  },
  briefingButton: {
    backgroundColor: C.accent, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16, width: '100%', alignItems: 'center',
    shadowColor: C.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  briefingButtonText: { color: '#001018', fontSize: 16, fontWeight: '800', fontFamily: Typography.fontFamilyBold },

  // AI Behavior Feed
  insightCard: {
    width: 260, backgroundColor: C.glass, borderWidth: 1, borderTopColor: C.glassHighlight,
    borderRadius: 24, padding: 20, marginRight: 12,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 5,
  },
  insightIconBadge: { width: 32, height: 32, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  insightTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8, fontFamily: Typography.fontFamilyBold },
  insightText: { color: C.textPrimary, fontSize: 13, lineHeight: 19, fontFamily: Typography.fontFamilyRegular },

  // Forecast Card
  riskBarBackground: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 12 },
  riskBarFill: { height: '100%', borderRadius: 4 },

  // Savings Goals
  goalRow: { marginBottom: 18 },
  goalName: { color: C.textPrimary, fontSize: 14, fontWeight: '700', fontFamily: Typography.fontFamilyMedium },
  goalMeta: { color: C.textSecondary, fontSize: 12, fontFamily: Typography.fontFamilyRegular },
  goalProgressBg: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginVertical: 6 },
  goalProgressFill: { height: '100%', borderRadius: 4 },
  goalDeadline: { color: C.textSecondary, fontSize: 11, fontFamily: Typography.fontFamilyRegular },
  goalInput: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: C.textPrimary, fontSize: 15, fontFamily: Typography.fontFamilyRegular,
  },
  depositButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.03)' },
  depositButtonText: { fontSize: 11, fontWeight: '700', fontFamily: Typography.fontFamilyBold },

  // Week Selector
  weekChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginRight: 10,
  },
  weekChipActive: { backgroundColor: 'rgba(56,189,248,0.15)', borderColor: 'rgba(56,189,248,0.4)' },
  weekChipText: { color: C.textSecondary, fontSize: 12, fontWeight: '600', fontFamily: Typography.fontFamilyMedium },
  weekChipTextActive: { color: C.accent, fontWeight: '700', fontFamily: Typography.fontFamilyBold },

  // Habit Tracker
  habitRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16,
    borderWidth: 1, borderColor: C.border, borderRadius: 16, marginBottom: 10,
  },

  // Monthly Wrap
  wrapStatRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)'
  },
  wrapStatLabel: { color: C.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, fontFamily: Typography.fontFamilyBold },
  wrapStatValue: { color: C.textPrimary, fontSize: 14, fontWeight: '700', fontFamily: Typography.fontFamilyBold },
  // "Wow" Insights
  wowInsightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  wrapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 980,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  wrapButtonText: {
    color: C.textPrimary,
    fontSize: 12.5,
    fontWeight: '600',
  },
  wowIcon: { fontSize: 24, marginRight: 16 },
  wowText: { flex: 1, color: C.textPrimary, fontSize: 15, lineHeight: 22, fontFamily: Typography.fontFamilyMedium },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    height: 70,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: 'rgba(20, 20, 25, 0.8)', // Dark glass
    borderRadius: 35, // Fully rounded pill shape
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 15, // Android shadow
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.accent,
    marginTop: 4,
    shadowColor: C.accent, // Glow effect
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
});

export default App;