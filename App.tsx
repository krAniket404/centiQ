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
import { supabase } from './src/lib/supabase';
import { THEMES, Theme } from './src/theme/themes';

const { SmsModule } = NativeModules;
const STORAGE_KEY = 'centiq_state_v1';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

// Haptic Feedback Helper
const triggerHaptic = (ms: number = 15) => {
  Vibration.vibrate(ms);
};

export default function App() {
  // --- STATE ---
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
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));
  const [pendingPurchases, setPendingPurchases] = useState<any[]>([]);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseName, setPauseName] = useState('');
  const [pauseAmount, setPauseAmount] = useState('');
  const [activeStreaks, setActiveStreaks] = useState<string[]>(['late_night']);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);
  const [morningQuote, setMorningQuote] = useState<string | null>(null);
  const [showWowModal, setShowWowModal] = useState(false);
  const [manualCategories, setManualCategories] = useState<{[key: string]: string}>({});
  const [emergencyTxnIds, setEmergencyTxnIds] = useState<string[]>([]);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyTxnId, setEmergencyTxnId] = useState<string | null>(null);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [pinnedFeatures, setPinnedFeatures] = useState<string[]>(['wellness', 'persona', 'streaks', 'vault', 'heatmap', 'subs', 'repetitive', 'feed', 'forecast', 'goals', 'chart']);
  const [merchantMap, setMerchantMap] = useState<{[key: string]: string}>({});
  const [currentThemeId, setCurrentThemeId] = useState('azure');
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const theme = THEMES[currentThemeId] || THEMES.azure;
  const C = theme; // Backward compatibility for existing UI

  const [morningBriefing, setMorningBriefing] = useState<string | null>(null);
  const [showBriefing, setShowBriefing] = useState(false);
  const [isFetchingBriefing, setIsFetchingBriefing] = useState(false);
  const [expandedCharge, setExpandedCharge] = useState<string | null>(null);
  const [notifAccessEnabled, setNotifAccessEnabled] = useState<boolean>(true);

  // PASTE YOUR GEMINI API KEY HERE
  const API_KEY = 'YOUR_GEMINI_API_KEY';

  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [scores, setScores] = useState({ discipline: 0, impulse: 0, volatility: 0, wellness: 0, savingsRate: 0 });

  const [mode, setMode] = useState<'strict' | 'liberal' | null>(null);
  const [worthItTxnIds, setWorthItTxnIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'budgets' | 'coach' | 'settings'>('dashboard');
  const [activeDay, setActiveDay] = useState<number | null>(null);
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

  // --- EFFECTS ---

  useEffect(() => {
    if (isBiometricEnabled) {
      setIsLocked(true);
      handleBiometricUnlock();
    }
  }, [isBiometricEnabled]);

  const handleBiometricUnlock = async () => {
    try {
      const success = await SmsModule.authenticateUser();
      if (success) {
        setIsLocked(false);
      } else {
        // Fallback for user cancellation or other non-fatal errors
      }
    } catch (e) {
      // If error is related to cancel, we just stay locked and show a button
    }
  };

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
        duration: 1000,
        useNativeDriver: false,
      }).start();
    });
  }, [scores]);

  useEffect(() => {
    const checkNotifAccess = async () => {
      try {
        const enabled = await SmsModule.isNotificationServiceEnabled();
        setNotifAccessEnabled(enabled);
      } catch (e) {}
    };
    checkNotifAccess();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkNotifAccess();
    });
    return () => sub.remove();
  }, []);

  // Check for notification button clicks when app opens
  useEffect(() => {
    const checkPendingNotif = async () => {
      try {
        const result = await SmsModule.getPendingNotifLabel();
        if (result.status === 'found' && transactions.length > 0) {
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

    checkPendingNotif();

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
          setIsFetchingBriefing(true);
          setShowBriefing(true);
          await fetchMorningBriefing();
          await SmsModule.saveData('last_briefing_date', today);
        }
      } catch (e) {
        console.warn("Briefing check failed", e);
      }
    };

    if (hasPermission && mode) {
      checkDailyBriefing();
    }
  }, [hasPermission, mode, transactions]);

  // --- MEMOS ---

  const dailyQuote = useMemo(() => {
    if (!MONEY_QUOTES || MONEY_QUOTES.length === 0) return null;
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    const quoteIndex = dayOfYear % MONEY_QUOTES.length;
    return MONEY_QUOTES[quoteIndex];
  }, []);

  const avgAmount = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return 0;
    const debitTxns = transactions.filter(t => t.type === 'debit');
    return debitTxns.length > 0 ? debitTxns.reduce((sum, t) => sum + t.amount, 0) / debitTxns.length : 0;
  }, [transactions]);

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

  const wowInsights = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return null;
    const debitTxns = transactions.filter(t => t.type === 'debit');
    if (debitTxns.length === 0) return null;
    const totalSpend = debitTxns.reduce((a, b) => a + b.amount, 0);

    const lateNightTxns = debitTxns.filter(t => t.date.getHours() >= 21 || t.date.getHours() <= 4);
    const dayTxns = debitTxns.filter(t => t.date.getHours() > 4 && t.date.getHours() < 21);
    const avgLate = lateNightTxns.length > 0 ? lateNightTxns.reduce((a, b) => a + b.amount, 0) / lateNightTxns.length : 0;
    const avgDay = dayTxns.length > 0 ? dayTxns.reduce((a, b) => a + b.amount, 0) / dayTxns.length : 0;
    const lateNightPct = avgDay > 0 ? Math.round(((avgLate - avgDay) / avgDay) * 100) : 0;

    const dayTotals: { [key: string]: number } = {};
    debitTxns.forEach(t => { const d = t.date.getDay(); dayTotals[d] = (dayTotals[d] || 0) + t.amount; });
    const maxDayIndex = Object.keys(dayTotals).sort((a, b) => dayTotals[b] - dayTotals[a])[0];
    const dayNames = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
    const maxDayName = dayNames[maxDayIndex as any];
    const maxDayPct = totalSpend > 0 ? Math.round((dayTotals[maxDayIndex] / totalSpend) * 100) : 0;

    const overspendAmount = (monthlyForecast?.projectedSpend || 0) - (transactions.filter(t => t.type === 'credit' && t.date.getMonth() === new Date().getMonth()).reduce((a, b) => a + b.amount, 0));

    return { lateNightPct, maxDayName, maxDayPct, overspendAmount };
  }, [transactions, monthlyForecast]);

  const monthlyWeeklyData = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const getMonday = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const weeksMap: { [key: string]: { day: string; amount: number }[] } = {};

    transactions.forEach(t => {
      const txnDate = new Date(t.date);
      if (t.type === 'debit' && txnDate.getMonth() === currentMonth && txnDate.getFullYear() === currentYear) {
        const monday = getMonday(txnDate);
        const weekKey = monday.toISOString();

        if (!weeksMap[weekKey]) {
          weeksMap[weekKey] = [
            { day: 'Mon', amount: 0 }, { day: 'Tue', amount: 0 }, { day: 'Wed', amount: 0 },
            { day: 'Thu', amount: 0 }, { day: 'Fri', amount: 0 }, { day: 'Sat', amount: 0 }, { day: 'Sun', amount: 0 }
          ];
        }
        const mapIndex = (txnDate.getDay() + 6) % 7;
        weeksMap[weekKey][mapIndex].amount += Math.round(t.amount * 100) / 100;
      }
    });

    const sortedWeekKeys = Object.keys(weeksMap).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const currentMonday = getMonday(now);

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
    return max > 0 ? max : 1;
  }, [monthlyWeeklyData]);

  const recurringCharges = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return { knownSubscriptions: [], repetitivePayments: [], totalSubsCost: 0, totalRepetitiveCost: 0 };
    const result = detectSubscriptionLeaks(transactions, worthItTxnIds) || { knownSubscriptions: [], repetitivePayments: [] };
    const knownSubs = result.knownSubscriptions || [];
    const repetitivePays = result.repetitivePayments || [];
    const totalSubsCost = knownSubs.reduce((sum: number, l: any) => sum + l.amount, 0);
    const totalRepetitiveCost = repetitivePays.reduce((sum: number, l: any) => sum + l.amount, 0);
    return { knownSubscriptions: knownSubs, repetitivePayments: repetitivePays, totalSubsCost, totalRepetitiveCost };
  }, [transactions]);

  const behavioralProfile = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return { persona: { name: 'The Balanced Spender', desc: 'You have a healthy mix of discipline and spontaneity.', icon: 'scale-balance', color: C.accent }, heatmap: [] };
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
    const highValueTxns = debitTxns.filter(t => t.amount > avgAmount * 3);
    if (highValueTxns.length > 0) {
      insights.push({ icon: 'alert-circle-outline', title: 'UNUSUAL SPENDING', text: `You made ${highValueTxns.length} transactions significantly larger than your average of ₹${Math.round(avgAmount)}.`, color: theme.danger });
    }

    // Vault Automation: Surplus Detection (Fix #3)
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const isEndOfMonth = now.getDate() >= daysInMonth - 5;
    const surplus = (monthlyForecast?.projectedSpend || 0) < (transactions.filter(t => t.type === 'credit' && t.date.getMonth() === now.getMonth()).reduce((a, b) => a + b.amount, 0)) * 0.8;

    if (isEndOfMonth && monthlySpendTotal < (monthlyForecast?.projectedSpend || 0) * 0.9) {
        const remaining = Math.round((monthlyForecast?.projectedSpend || 0) - monthlySpendTotal);
        if (remaining > 1000) {
            insights.unshift({
                type: 'sweep',
                icon: 'snowflake',
                title: 'VAULT SWEEP',
                text: `You have ₹${remaining.toLocaleString('en-IN')} left in your budget! Sweep it into your 'Iceland Trip' vault? ❄️`,
                color: theme.accent,
                value: remaining
            });
        }
    }

    return insights;
  }, [transactions, avgAmount, theme, monthlyForecast, monthlySpendTotal]);

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

    (activeStreaks || []).forEach(streakId => {
      let streak = 0;
      let checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);

      while (true) {
        const dateStr = checkDate.toDateString();
        const dayTxns = debitTxns.filter(t => t.date.toDateString() === dateStr);

        let broken = false;
        if (dayTxns.length > 0) {
          if (streakId === 'late_night') {
            broken = dayTxns.some(t => {
              const h = t.date.getHours();
              return h >= 22 || h <= 6;
            });
          } else if (streakId === 'weekend') {
            const day = checkDate.getDay();
            if (day === 0 || day === 6) {
              broken = dayTxns.some(t => t.amount > avgAmt * 1.5);
            }
          } else if (streakId === 'food_delivery') {
            broken = dayTxns.some(t => {
              const m = (t.merchant || '').toUpperCase();
              return m.includes('SWIGGY') || m.includes('ZOMATO') || m.includes('DOMINOS') || m.includes('EATS') || m.includes('PIZZA');
            });
          } else if (streakId === 'online_shopping') {
            broken = dayTxns.some(t => {
              const m = (t.merchant || '').toUpperCase();
              return m.includes('AMAZON') || m.includes('FLIPKART') || m.includes('MYNTRA') || m.includes('AJIO') || m.includes('NYKAA');
            });
          } else if (streakId === 'fast_food') {
            broken = dayTxns.some(t => {
              const m = (t.merchant || '').toUpperCase();
              return m.includes('MCDONALD') || m.includes('KFC') || m.includes('BURGER') || m.includes('SUBWAY') || m.includes('WENDYS');
            });
          } else if (streakId === 'ride_hailing') {
            broken = dayTxns.some(t => {
              const m = (t.merchant || '').toUpperCase();
              return m.includes('UBER') || m.includes('OLA') || m.includes('RAPIDO') || m.includes('LYFT');
            });
          } else if (streakId === 'coffee') {
            broken = dayTxns.some(t => {
              const m = (t.merchant || '').toUpperCase();
              return m.includes('STARBUCKS') || m.includes('CCD') || m.includes('CAFE') || m.includes('COFFEE') || m.includes('COSTA');
            });
          }
        }

        if (broken) {
          break;
        } else {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
          if (streak > 365) break;
        }
      }
      results[streakId] = Math.max(0, streak - 1);
    });
    return results;
  }, [transactions, activeStreaks]);

  const monthlySpendTotal = useMemo(() => {
    const now = new Date();
    return transactions
      .filter(t => t.type === 'debit' && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear())
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

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

    const liberalTxns = debitTxns.filter(t => !worthItTxnIds.includes(t.id!) && !emergencyTxnIds.includes(t.id!));
    const liberalTotalSpend = liberalTxns.reduce((a, b) => a + b.amount, 0);
    const avgLiberalAmt = liberalTxns.length > 0 ? liberalTotalSpend / liberalTxns.length : 0;

    const impulseTxns = liberalTxns.filter(t => t.date.getHours() >= 22 || t.date.getHours() <= 4 || t.amount > avgLiberalAmt * 1.5);
    const biggestImpulse = impulseTxns.sort((a, b) => b.amount - a.amount)[0];

    return { totalSpend, topCat, biggestImpulse, persona: behavioralProfile.persona };
  }, [transactions, behavioralProfile, worthItTxnIds, emergencyTxnIds]);

  // --- HANDLERS ---

  const loadSavedData = async () => {
    try {
      const raw = await SmsModule.loadData(STORAGE_KEY);
      if (!raw) {
        setMode('liberal');
        await saveState({ mode: 'liberal' });
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!parsed.mode) {
        parsed.mode = 'liberal';
        setMode('liberal');
        await saveState({ mode: 'liberal' });
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
      if (parsed.pinnedFeatures) setPinnedFeatures(parsed.pinnedFeatures);
      if (parsed.merchantMap) setMerchantMap(parsed.merchantMap);
      if (parsed.currentThemeId) setCurrentThemeId(parsed.currentThemeId);
      if (parsed.isBiometricEnabled) setIsBiometricEnabled(parsed.isBiometricEnabled);

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
      pinnedFeatures: overrides.pinnedFeatures ?? pinnedFeatures,
      merchantMap: overrides.merchantMap ?? merchantMap,
      currentThemeId: overrides.currentThemeId ?? currentThemeId,
      isBiometricEnabled: overrides.isBiometricEnabled ?? isBiometricEnabled,
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
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      ]);

      if (
        granted[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
        granted[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED
      ) {
        setHasPermission(true);
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

  const checkBudgetAlerts = async (txns: ParsedTransaction[]) => {
    try {
      const rawBudgets = await SmsModule.loadData('budgets:v1');
      if (!rawBudgets) return;
      const budgets = JSON.parse(rawBudgets);

      const now = new Date();
      const spentByCategory: { [key: string]: number } = {};
      txns.filter(t => t.type === 'debit' && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear())
          .forEach(t => {
            const cat = t.category || 'Other';
            spentByCategory[cat] = (spentByCategory[cat] || 0) + t.amount;
          });

      for (const [cat, limit] of Object.entries(budgets)) {
        const spent = spentByCategory[cat] || 0;
        const pct = (spent / (limit as number)) * 100;

        // Alert thresholds
        const lastAlertKey = `last_alert_${cat}_${now.getMonth()}`;
        const lastAlertRaw = await SmsModule.loadData(lastAlertKey);
        const lastAlertPct = lastAlertRaw ? parseFloat(lastAlertRaw) : 0;

        let title = "";
        let msg = "";

        if (pct >= 100 && lastAlertPct < 100) {
            title = `⚠️ Budget Blown: ${cat}`;
            msg = `You've spent ₹${Math.round(spent)} against your ₹${limit} budget. Pause and breathe!`;
        } else if (pct >= 90 && lastAlertPct < 90) {
            title = `🔴 Critical: ${cat} Budget`;
            msg = `You are at 90% of your budget (₹${Math.round(spent)}/₹${limit}). Consider stopping for the month.`;
        } else if (pct >= 70 && lastAlertPct < 70) {
            title = `🟡 Warning: ${cat} Budget`;
            msg = `You've used 70% of your budget. Slow down!`;
        }

        // Special logic for "Other" (Fix #3)
        if (cat === 'Other' && pct >= 50 && lastAlertPct < 50) {
             title = `📦 Organize your 'Other' Spend`;
             msg = `Your 'Other' category is getting big (₹${Math.round(spent)}). Categorize items to see where your money is actually going!`;
        }

        if (title) {
            await SmsModule.saveData(lastAlertKey, pct.toString());
            await SmsModule.showNotification(title, msg);
        }
      }
    } catch (e) {
      console.warn("Budget alert check failed", e);
    }
  };

  const fetchSMS = async (saved?: any) => {
    try {
      const rawSmsList = await SmsModule.readBankSMS();
      const parsedTxns = backfillHistory(rawSmsList);

      // Use Merchant Map for auto-categorization (Fix #4)
      const currentMap = saved?.merchantMap ?? merchantMap;
      parsedTxns.forEach((txn) => {
        txn.id = `${txn.date.getTime()}_${txn.amount}_${txn.merchant}_${txn.type}`;
        if (currentMap[txn.merchant]) {
            txn.category = currentMap[txn.merchant];
        }
      });

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTransactions(parsedTxns);
      syncToCloud(parsedTxns);

      // Check budget alerts on refresh
      checkBudgetAlerts(parsedTxns);

      const debitTxns = parsedTxns.filter(t => t.type === 'debit');
      if (debitTxns.length === 0) return;

      const worthIt = saved?.worthItTxnIds ?? worthItTxnIds;
      const emergencies = saved?.emergencyTxnIds ?? emergencyTxnIds;
      const liberalTxns = debitTxns.filter(t => !worthIt.includes(t.id!) && !emergencies.includes(t.id!));

      const now = new Date();
      const monthlyDebit = debitTxns.filter(t => t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear()).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const monthlyCredit = parsedTxns.filter(t => t.type === 'credit' && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear()).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

      const discipline = calculateDisciplineScore(debitTxns, emergencies);
      const impulse = calculateImpulseIndex(liberalTxns, monthlyCredit, emergencies);
      const volatility = calculateVolatilityScore(debitTxns, emergencies);
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
    const liberalTxns = debitTxns.filter(t => !updatedWorthIt.includes(t.id!) && !emergencyTxnIds.includes(t.id!));
    const newImpulse = calculateImpulseIndex(liberalTxns, 0, emergencyTxnIds);
    const newWellness = calculateWellnessScore(scores.discipline, newImpulse, scores.volatility);
    setScores({ ...scores, impulse: newImpulse, wellness: newWellness });
    saveState({ userLabels: updatedLabels, labeledTxnIds: updatedLabeledIds, worthItTxnIds: updatedWorthIt });
  };

  const handleSetCategory = (txnId: string, newCategory: string) => {
    // 1. Find the merchant name for this txnId
    const targetTxn = transactions.find(t => t.id === txnId);
    if (!targetTxn) return;
    const merchantName = targetTxn.merchant;

    // 2. Update the merchantMap (Fix #4)
    const updatedMap = { ...merchantMap, [merchantName]: newCategory };
    setMerchantMap(updatedMap);

    // 3. Update all existing transactions with this merchant (Fix #4)
    const updatedTransactions = transactions.map(t =>
      t.merchant === merchantName ? { ...t, category: newCategory } : t
    );

    setTransactions(updatedTransactions);
    saveState({ merchantMap: updatedMap, transactions: updatedTransactions });

    // 4. Recalculate scores and check alerts
    const debitTxns = updatedTransactions.filter(t => t.type === 'debit');
    const worthIt = worthItTxnIds;
    const emergencies = emergencyTxnIds;
    const liberalTxns = debitTxns.filter(t => !worthIt.includes(t.id!) && !emergencies.includes(t.id!));

    const discipline = calculateDisciplineScore(debitTxns, emergencies);
    const impulse = calculateImpulseIndex(liberalTxns, 0, emergencies);
    const volatility = calculateVolatilityScore(debitTxns, emergencies);
    const wellness = calculateWellnessScore(discipline, impulse, volatility);

    setScores(prev => ({ ...prev, discipline, impulse, volatility, wellness }));

    // Check budget alerts after update
    checkBudgetAlerts(updatedTransactions);
  };

  const syncToCloud = async (txns: ParsedTransaction[]) => {
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
        }, { merge: true });
      });
      await batch.commit();
    } catch (e) {
      console.warn('Failed to sync to cloud', e);
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
    triggerHaptic(30);
  };

  useEffect(() => {
    const loadPending = async () => {
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
      unlockTime: Date.now() + (24 * 60 * 60 * 1000)
    };
    const updated = [newPurchase, ...pendingPurchases];
    setPendingPurchases(updated);
    await SmsModule.saveData('pending_purchases', JSON.stringify(updated));

    try {
        await SmsModule.scheduleRepeatingNotification(
            `vault_${newPurchase.id}`,
            6.0,
            "Cooling Off Check-in ❄️",
            `Do you still want to buy ${newPurchase.name}? Tap to decide.`
        );
    } catch (e) {}

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
    await SmsModule.saveData('pending_purchases', JSON.stringify(updated));

    try {
        await SmsModule.cancelNotification(`vault_${id}`);
    } catch (e) {}
  };

  const handleToggleEmergency = (txnId: string) => {
    const isEmergency = emergencyTxnIds.includes(txnId);
    let updated;
    if (isEmergency) {
      updated = emergencyTxnIds.filter(id => id !== txnId);
    } else {
      updated = [...emergencyTxnIds, txnId];
    }
    setEmergencyTxnIds(updated);
    saveState({ emergencyTxnIds: updated });

    const debitTxns = transactions.filter(t => t.type === 'debit');
    const worthIt = worthItTxnIds;
    const liberalTxns = debitTxns.filter(t => !worthIt.includes(t.id!) && !updated.includes(t.id!));

    const discipline = calculateDisciplineScore(debitTxns, updated);
    const impulse = calculateImpulseIndex(liberalTxns, 0, updated);
    const volatility = calculateVolatilityScore(debitTxns, updated);
    const wellness = calculateWellnessScore(discipline, impulse, volatility);

    setScores({ ...scores, discipline, impulse, volatility, wellness });
    Vibration.vibrate(20);
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
    triggerHaptic(30);
  };

  const togglePin = (featureId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const isPinned = pinnedFeatures.includes(featureId);
    let updated;
    if (isPinned) {
      updated = pinnedFeatures.filter(id => id !== featureId);
    } else {
      updated = [...pinnedFeatures, featureId];
    }
    setPinnedFeatures(updated);
    saveState({ pinnedFeatures: updated });
    triggerHaptic(10);
  };

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('transaction_notification', (notificationText: string) => {
      const parsedTxn = parseBankSMS(notificationText);
      if (parsedTxn && parsedTxn.amount > 0) {
        setTransactions(prev => {
          const isDuplicate = prev.some(t =>
            Math.abs(t.amount - parsedTxn.amount) < 0.01 &&
            (t.merchant === parsedTxn.merchant || parsedTxn.raw.includes(t.merchant)) &&
            (Math.abs(new Date(t.date).getTime() - Date.now()) < 300000)
          );
          if (!isDuplicate) {
            const newTxn: ParsedTransaction = {
              ...parsedTxn,
              id: `${Date.now()}_${parsedTxn.amount}_${parsedTxn.merchant}_${parsedTxn.type}`,
              date: new Date()
            };
            const updated = [newTxn, ...prev];
            const debitTxns = updated.filter(t => t.type === 'debit');
            const monthlyCredit = updated.filter(t => t.type === 'credit' && t.date.getMonth() === new Date().getMonth()).reduce((a, b) => a + b.amount, 0);
            const worthIt = worthItTxnIds;
            const emergencies = emergencyTxnIds;
            const liberalTxns = debitTxns.filter(t => !worthIt.includes(t.id!) && !emergencies.includes(t.id!));
            const discipline = calculateDisciplineScore(debitTxns, emergencies);
            const impulse = calculateImpulseIndex(liberalTxns, monthlyCredit, emergencies);
            const volatility = calculateVolatilityScore(debitTxns, emergencies);
            const wellness = calculateWellnessScore(discipline, impulse, volatility);
            setScores(prevScores => ({ ...prevScores, discipline, impulse, volatility, wellness }));
            saveState({
                transactions: updated,
                scores: { discipline, impulse, volatility, wellness, savingsRate: scores.savingsRate }
            });
            syncToCloud([newTxn]);
            return updated;
          }
          return prev;
        });
      }
    });
    return () => subscription.remove();
  }, [worthItTxnIds, emergencyTxnIds, scores.savingsRate]);

  useEffect(() => {
    loadSavedData().then(() => {
        checkPermission(savedStateRef.current);
    });
  }, []);

  if (!session) {
      setSession({ uid: 'test-user-123' } as any);
  }

  if (!hasPermission) {
    return (
      <View style={[styles.darkContainer, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
        <View style={styles.onboardingContent}>
          <Text style={[styles.logo, { color: theme.textPrimary }]}>Q</Text>
          <Text style={[styles.onboardingTitle, { color: theme.textPrimary }]}>Understand your money habits.</Text>
          <Text style={[styles.onboardingSubtext, { color: theme.textSecondary }]}>Not just where you spend, but why. Connect your SMS to unlock your behavioral profile.</Text>
        </View>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.accent }]} activeOpacity={0.85} onPress={requestPermission}>
          <Text style={[styles.primaryButtonText, { color: theme.bg }]}>Connect SMS</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!mode) {
    return (
      <View style={[styles.darkContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} size="large" style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <View style={[styles.darkContainer, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />

      {isLocked && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg, zIndex: 10000, justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
            <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: `${theme.accent}15`, justifyContent: 'center', alignItems: 'center', marginBottom: 30 }}>
                <Icon name="lock-outline" size={48} color={theme.accent} />
            </View>
            <Text style={{ color: theme.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 12, textAlign: 'center' }}>CentiQ is Locked</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 40, lineHeight: 20 }}>Please authenticate to access your financial behavioral profile.</Text>
            <TouchableOpacity
                style={{ backgroundColor: theme.accent, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16 }}
                onPress={handleBiometricUnlock}
            >
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>Unlock Now</Text>
            </TouchableOpacity>
        </View>
      )}

      {activeTab === 'dashboard' ? (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={C.accent}
            />
          }
          contentContainerStyle={{ paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        >
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
              {/* Header */}
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.greeting}>
                    {(() => {
                      const h = new Date().getHours();
                      if (h < 12) return 'Good morning';
                      if (h < 17) return 'Good afternoon';
                      if (h < 22) return 'Good evening';
                      return 'Working late?';
                    })()}
                  </Text>
                  <Text style={{ color: C.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                    MONTH SPEND: <Text style={{ color: C.accent }}>₹{monthlySpendTotal.toLocaleString('en-IN')}</Text>
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.syncPill, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }]}
                    activeOpacity={0.8}
                    onPress={() => setActiveTab('settings')}
                  >
                    <Icon name="tune-variant" size={18} color={C.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.wrapButton} activeOpacity={0.8} onPress={() => setShowMonthlyWrap(true)}>
                    <Icon name="gift-outline" size={16} color={C.textPrimary} />
                    <Text style={styles.wrapButtonText}>Wrap</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {transactions.length === 0 && !isRefreshing && (
                <View>
                    <SkeletonCard />
                    <SkeletonCard />
                </View>
              )}

              {!notifAccessEnabled && (
                <TouchableOpacity
                    onPress={requestNotificationAccess}
                    style={{ backgroundColor: 'rgba(56,189,248,0.1)', padding: 16, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)', flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                    <Icon name="bell-ring-outline" size={24} color={C.accent} />
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: C.textPrimary, fontSize: 14, fontWeight: '700' }}>Enable Smart Tracking</Text>
                        <Text style={{ color: C.textSecondary, fontSize: 12 }}>Capture transactions from GPay, PhonePe & more.</Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={C.textSecondary} />
                </TouchableOpacity>
              )}

              {/* Financial Wellness Card */}
              {pinnedFeatures.includes('wellness') && (
                <View style={{ marginBottom: 14 }}>
                  <TouchableOpacity
                    onPress={() => togglePin('wellness')}
                    style={{ position: 'absolute', right: 10, top: 10, zIndex: 10, opacity: 0.5 }}
                  >
                    <Icon name="close-circle-outline" size={18} color={C.textSecondary} />
                  </TouchableOpacity>
                  <WellnessCard scores={scores} theme={theme} />
                </View>
              )}

              {/* Financial Persona Card */}
              {pinnedFeatures.includes('persona') && (
                <View style={[styles.glassCardHeavy, { padding: 20, marginBottom: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.glassStrong, borderColor: theme.border }]}>
                  <TouchableOpacity
                    onPress={() => togglePin('persona')}
                    style={{ position: 'absolute', right: 10, top: 10, zIndex: 10, opacity: 0.5 }}
                  >
                    <Icon name="close-circle-outline" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
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
                    <Text style={[styles.personaLabel, { color: theme.textSecondary }]}>YOUR FINANCIAL PERSONA</Text>
                    <Text style={[styles.personaName, { color: behavioralProfile.persona.color }]}>{behavioralProfile.persona.name}</Text>
                    <Text style={[styles.personaDesc, { color: theme.textSecondary }]}>{behavioralProfile.persona.desc}</Text>
                  </View>
                </View>
              )}

              {/* Dynamic Discipline Streaks Card */}
              {pinnedFeatures.includes('streaks') && (
                <View style={[styles.glassCard, { padding: 20, marginBottom: 14 }]}>
                  <TouchableOpacity
                    onPress={() => togglePin('streaks')}
                    style={{ position: 'absolute', right: 10, top: 10, zIndex: 10, opacity: 0.5 }}
                  >
                    <Icon name="close-circle-outline" size={18} color={C.textSecondary} />
                  </TouchableOpacity>
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
                        online_shopping: { icon: 'shopping-outline', name: 'Online Shopping', desc: 'No Amazon/Flipkart' },
                        fast_food: { icon: 'food-apple-outline', name: 'Fast Food', desc: 'No McDonalds/KFC/Burger' },
                        ride_hailing: { icon: 'car', name: 'Ride Hailing', desc: 'No Uber/Ola/Rapido' },
                        coffee: { icon: 'coffee', name: 'Coffee', desc: 'No Starbucks/Cafe' }
                      }[id as keyof typeof streakData | string];

                      if (!config) return null;

                      return (
                        <View key={id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                          <View style={[styles.insightIconBadge, { backgroundColor: `${C.warning}20`, marginRight: 12 }]}>
                             <Icon name={(config as any).icon} size={16} color={C.warning} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: C.textPrimary, fontSize: 15, fontWeight: '700' }}>{streakData[id] || 0} Days</Text>
                            <Text style={{ color: C.textSecondary, fontSize: 12 }}>{(config as any).name}</Text>
                          </View>
                          <Text style={{ color: C.textSecondary, fontSize: 11, textAlign: 'right', flex: 0.5 }}>{(config as any).desc}</Text>
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              {/* The 24-Hour Rule Card */}
              {pinnedFeatures.includes('vault') && (
                <View style={[styles.glassCard, { padding: 20, marginBottom: 14 }]}>
                  <TouchableOpacity
                    onPress={() => togglePin('vault')}
                    style={{ position: 'absolute', right: 10, top: 10, zIndex: 10, opacity: 0.5 }}
                  >
                    <Icon name="close-circle-outline" size={18} color={C.textSecondary} />
                  </TouchableOpacity>
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
              )}

              {/* Behavioral Heatmap */}
              {pinnedFeatures.includes('heatmap') && (
                <View style={[styles.glassCard, { padding: 20, marginBottom: 14 }]}>
                  <TouchableOpacity
                    onPress={() => togglePin('heatmap')}
                    style={{ position: 'absolute', right: 10, top: 10, zIndex: 10, opacity: 0.5 }}
                  >
                    <Icon name="close-circle-outline" size={18} color={C.textSecondary} />
                  </TouchableOpacity>
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
              )}

              {/* Digital Subscriptions Card */}
              {pinnedFeatures.includes('subs') && (
                <View style={[styles.glassCard, { padding: 20, marginBottom: 14, borderColor: 'rgba(56,189,248,0.22)' }]}>
                  <TouchableOpacity
                    onPress={() => togglePin('subs')}
                    style={{ position: 'absolute', right: 10, top: 10, zIndex: 10, opacity: 0.5 }}
                  >
                    <Icon name="close-circle-outline" size={18} color={C.textSecondary} />
                  </TouchableOpacity>
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
                      {recurringCharges.knownSubscriptions.map((l: any, i: number) => (
                        <View key={i} style={styles.leakRow}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.leakMerchant}>{l.merchant}</Text>
                                {l.hasPriceIncrease && (
                                    <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                        <Text style={{ color: C.danger, fontSize: 8, fontWeight: '800' }}>PRICE UP</Text>
                                    </View>
                                )}
                                {l.isGhost && (
                                    <View style={{ backgroundColor: 'rgba(139,92,246,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                        <Text style={{ color: C.purple, fontSize: 8, fontWeight: '800' }}>GHOST</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.leakCount}>
                                {l.isGhost ? "No 'Worth It' tags in 60d" : `Charged ${l.count} times`}
                            </Text>
                          </View>
                          <Text style={styles.leakAmount}>₹{l.amount.toLocaleString('en-IN')}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}

              {/* Repetitive Payments Card */}
              {pinnedFeatures.includes('repetitive') && recurringCharges.repetitivePayments.length > 0 && (
                <View style={[styles.glassCard, { padding: 20, marginBottom: 14, borderColor: 'rgba(245,158,11,0.22)' }]}>
                  <TouchableOpacity
                    onPress={() => togglePin('repetitive')}
                    style={{ position: 'absolute', right: 10, top: 10, zIndex: 10, opacity: 0.5 }}
                  >
                    <Icon name="close-circle-outline" size={18} color={C.textSecondary} />
                  </TouchableOpacity>
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

                  {(showAllRepetitive ? recurringCharges.repetitivePayments : recurringCharges.repetitivePayments.slice(0, 3)).map((l: any, i: number) => {
                    const key = `${l.merchant}-${l.amount}`;
                    const isExpanded = expandedCharge === key;

                    return (
                      <View key={i} style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                        <TouchableOpacity
                          style={styles.leakRow}
                          activeOpacity={0.75}
                          onPress={() => setExpandedCharge(isExpanded ? null : key)}
                        >
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.leakMerchant}>{l.merchant}</Text>
                                {l.isGhost && (
                                    <View style={{ backgroundColor: 'rgba(139,92,246,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                        <Text style={{ color: C.purple, fontSize: 8, fontWeight: '800' }}>GHOST</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.leakCount}>
                                {l.isGhost ? "No 'Worth It' tags in 60d" : `Charged ${l.count} times · Tap to ${isExpanded ? 'hide' : 'expand'}`}
                            </Text>
                          </View>
                          <Text style={styles.leakAmount}>₹{l.amount.toLocaleString('en-IN')} total</Text>
                        </TouchableOpacity>

                        {isExpanded && (
                          <View style={styles.expandedList}>
                            {l.transactions.map((t: any, tIdx: number) => (
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

              {/* AI behavior feed ... (similarly for others) */}
              {pinnedFeatures.includes('feed') && behaviorFeed.length > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.cardHeaderTitle}>AI BEHAVIOR FEED</Text>
                    <TouchableOpacity onPress={() => togglePin('feed')} style={{ opacity: 0.5, marginRight: 10 }}>
                        <Icon name="close-circle-outline" size={16} color={C.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingRight: 20 }}
                  >
                    {behaviorFeed.map((insight, i) => (
                      <TouchableOpacity
                        key={i}
                        activeOpacity={0.8}
                        onPress={() => {
                            if ((insight as any).type === 'sweep') {
                                const amount = (insight as any).value;
                                const tripGoal = goals.find(g => g.name.toLowerCase().includes('trip') || g.name.toLowerCase().includes('iceland'));
                                if (tripGoal) {
                                    Alert.alert(
                                        "Vault Sweep",
                                        `Move ₹${amount.toLocaleString('en-IN')} surplus into your '${tripGoal.name}' vault?`,
                                        [
                                            { text: "Cancel", style: "cancel" },
                                            { text: "Sweep ❄️", onPress: () => {
                                                const updated = goals.map(g => g.id === tripGoal.id ? { ...g, current: g.current + amount } : g);
                                                setGoals(updated);
                                                saveState({ goals: updated });
                                                triggerHaptic(50);
                                                Alert.alert("Success", "Funds swept into vault! 🎉");
                                            }}
                                        ]
                                    );
                                } else {
                                    Alert.alert("No Vault Found", "Create a 'Trip' goal in your Savings Vault to use the sweep feature!");
                                }
                            }
                        }}
                        style={[styles.insightCard, { borderColor: `${insight.color}30` }]}
                      >
                        <View style={[styles.insightIconBadge, { backgroundColor: `${insight.color}20` }]}>
                          <Icon name={insight.icon} size={16} color={insight.color} />
                        </View>
                        <Text style={[styles.insightTitle, { color: insight.color }]}>{insight.title}</Text>
                        <Text style={[styles.insightText, { color: theme.textPrimary }]}>{insight.text}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* AI Monthly Forecast Card */}
              {pinnedFeatures.includes('forecast') && (
                <View style={[styles.glassCard, { padding: 20, marginBottom: 14 }]}>
                  <TouchableOpacity
                    onPress={() => togglePin('forecast')}
                    style={{ position: 'absolute', right: 10, top: 10, zIndex: 10, opacity: 0.5 }}
                  >
                    <Icon name="close-circle-outline" size={18} color={C.textSecondary} />
                  </TouchableOpacity>
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
              )}

              {/* Savings Goals Card */}
              {pinnedFeatures.includes('goals') && (
                <View style={[styles.glassCard, { padding: 20, marginBottom: 14 }]}>
                  <TouchableOpacity
                    onPress={() => togglePin('goals')}
                    style={{ position: 'absolute', right: 10, top: 10, zIndex: 10, opacity: 0.5 }}
                  >
                    <Icon name="close-circle-outline" size={18} color={C.textSecondary} />
                  </TouchableOpacity>
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
                    goals.map((goal: any) => {
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
              )}

              {/* Premium Weekly Spending Chart */}
              {pinnedFeatures.includes('chart') && (
                <View style={[styles.glassCard, { padding: 20, marginBottom: 14 }]}>
                  <TouchableOpacity
                    onPress={() => togglePin('chart')}
                    style={{ position: 'absolute', right: 10, top: 10, zIndex: 10, opacity: 0.5 }}
                  >
                    <Icon name="close-circle-outline" size={18} color={C.textSecondary} />
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={styles.cardHeaderTitle}>WEEKLY SPENDING</Text>
                    <Text style={styles.subtleText}>
                      Total: ₹{Math.round(monthlyWeeklyData[activeWeekIndex]?.data.reduce((a: any, b: any) => a + b.amount, 0) || 0).toLocaleString('en-IN')}
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
                      theme={theme}
                    />
                  )}
                </View>
              )}

              {/* Manage Dashboard Widgets Footer */}
              {pinnedFeatures.length < 11 && (
                <TouchableOpacity
                    onPress={() => setActiveTab('settings')}
                    style={[styles.glassCard, { padding: 16, alignItems: 'center', borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'transparent' }]}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Icon name="plus-circle-outline" size={16} color={C.textSecondary} />
                        <Text style={{ color: C.textSecondary, fontSize: 12, fontWeight: '700' }}>MANAGE DASHBOARD WIDGETS</Text>
                    </View>
                </TouchableOpacity>
              )}
            </Animated.View>
        </ScrollView>
      ) : activeTab === 'transactions' ? (
        <TransactionsScreen
          transactions={transactions}
          mode={mode}
          userLabels={userLabels}
          labeledTxnIds={labeledTxnIds}
          worthItTxnIds={worthItTxnIds}
          emergencyTxnIds={emergencyTxnIds}
          avgAmount={avgAmount}
          model={model}
          theme={theme}
          handleLabelTransaction={handleLabelTransaction}
          onSetCategory={handleSetCategory}
          handleToggleEmergency={handleToggleEmergency}
        />
      ) : activeTab === 'budgets' ? (
        <BudgetsScreen transactions={transactions} theme={theme} />
      ) : activeTab === 'coach' ? (
        <AICoachScreen transactions={transactions} scores={scores} theme={theme} />
      ) : (
        <SettingsScreen
          mode={mode}
          setMode={(m) => { setMode(m); saveState({ mode: m }); }}
          resetAppData={resetAppData}
          userLabels={userLabels}
          pinnedFeatures={pinnedFeatures}
          togglePin={togglePin}
          currentThemeId={currentThemeId}
          setTheme={(id) => { setCurrentThemeId(id); saveState({ currentThemeId: id }); }}
          isBiometricEnabled={isBiometricEnabled}
          setIsBiometricEnabled={(v) => { setIsBiometricEnabled(v); saveState({ isBiometricEnabled: v }); }}
          theme={theme}
        />
      )}

      {/* Modals */}
      <Modal animationType="slide" transparent visible={showBriefing} onRequestClose={() => setShowBriefing(false)}>
        <View style={styles.briefingOverlay}>
          <View style={styles.briefingCard}>
            <View style={styles.briefingIconRing}><Text style={styles.briefingIconGlyph}>☀️</Text></View>
            <Text style={styles.briefingTitle}>Good Morning</Text>
            {isFetchingBriefing ? <ActivityIndicator color={C.accent} size="large" /> : (
              <>
                <Text style={styles.briefingText}>{morningBriefing}</Text>
                {morningQuote && (
                  <View style={styles.quoteBox}>
                    <Text style={styles.quoteText}>"{morningQuote.split(' - ')[0]}"</Text>
                    <Text style={styles.quoteAuthor}>- {morningQuote.split(' - ')[1]}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.briefingButton} onPress={() => setShowBriefing(false)}><Text style={styles.briefingButtonText}>Let's go</Text></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={showAddGoalModal} onRequestClose={() => setShowAddGoalModal(false)}>
        <View style={styles.briefingOverlay}>
          <View style={styles.briefingCard}>
            <Text style={styles.briefingTitle}>Create a Goal</Text>
            <TextInput style={styles.goalInput} placeholder="Goal Name" placeholderTextColor="#555" value={newGoalName} onChangeText={setNewGoalName} />
            <TextInput style={styles.goalInput} placeholder="Target Amount" placeholderTextColor="#555" keyboardType="numeric" value={newGoalTarget} onChangeText={setNewGoalTarget} />
            <TextInput style={styles.goalInput} placeholder="Current Saved" placeholderTextColor="#555" keyboardType="numeric" value={newGoalCurrent} onChangeText={setNewGoalCurrent} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <TouchableOpacity style={[styles.briefingButton, { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={() => setShowAddGoalModal(false)}><Text style={styles.briefingButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.briefingButton, { flex: 1 }]} onPress={handleAddGoal}><Text style={styles.briefingButtonText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={showPauseModal} onRequestClose={() => setShowPauseModal(false)}>
        <View style={styles.briefingOverlay}>
          <View style={styles.briefingCard}>
            <Text style={styles.briefingTitle}>24-Hour Rule</Text>
            <TextInput style={styles.goalInput} placeholder="What to buy?" placeholderTextColor="#555" value={pauseName} onChangeText={setPauseName} />
            <TextInput style={styles.goalInput} placeholder="Price" placeholderTextColor="#555" keyboardType="numeric" value={pauseAmount} onChangeText={setPauseAmount} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <TouchableOpacity style={[styles.briefingButton, { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={() => setShowPauseModal(false)}><Text style={styles.briefingButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.briefingButton, { flex: 1 }]} onPress={addPendingPurchase}><Text style={styles.briefingButtonText}>Lock</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={showStreakModal} onRequestClose={() => setShowStreakModal(false)}>
        <View style={styles.briefingOverlay}>
          <View style={[styles.briefingCard, { maxHeight: '80%' }]}>
            <Text style={styles.briefingTitle}>Streaks</Text>
            <ScrollView style={{ width: '100%' }}>
              {['late_night', 'weekend', 'food_delivery', 'online_shopping', 'fast_food', 'ride_hailing', 'coffee'].map(id => (
                <TouchableOpacity key={id} style={[styles.habitRow, activeStreaks.includes(id) && { borderColor: C.accent }]} onPress={() => {
                  const updated = activeStreaks.includes(id) ? activeStreaks.filter(s => s !== id) : [...activeStreaks, id];
                  setActiveStreaks(updated); saveState({ activeStreaks: updated });
                }}>
                  <Text style={{ color: '#FFF' }}>{id.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.briefingButton} onPress={() => setShowStreakModal(false)}><Text style={styles.briefingButtonText}>Done</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <WowModal visible={showWowModal} onClose={() => setShowWowModal(false)} transactions={transactions} scores={scores} recurringCharges={recurringCharges} monthlyForecast={monthlyForecast} theme={theme} />
      <MonthlyWrapModal visible={showMonthlyWrap} onClose={() => setShowMonthlyWrap(false)} scores={scores} wrapData={monthlyWrapData} wellnessColor={getDynamicScoreColor(scores.wellness, 'higher_is_better', theme)} theme={theme} />

      <View style={styles.bottomNavContainer}>
        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('dashboard')}><Icon name="view-dashboard-outline" size={24} color={activeTab === 'dashboard' ? C.accent : C.textSecondary} /><Text style={[styles.tabLabel, { color: activeTab === 'dashboard' ? C.accent : C.textSecondary }]}>Home</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('transactions')}><Icon name="swap-horizontal" size={24} color={activeTab === 'transactions' ? C.accent : C.textSecondary} /><Text style={[styles.tabLabel, { color: activeTab === 'transactions' ? C.accent : C.textSecondary }]}>Spend</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('budgets')}><Icon name="chart-pie" size={24} color={activeTab === 'budgets' ? C.accent : C.textSecondary} /><Text style={[styles.tabLabel, { color: activeTab === 'budgets' ? C.accent : C.textSecondary }]}>Budget</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('coach')}><Icon name="robot-outline" size={24} color={activeTab === 'coach' ? C.accent : C.textSecondary} /><Text style={[styles.tabLabel, { color: activeTab === 'coach' ? C.accent : C.textSecondary }]}>Coach</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('settings')}><Icon name="cog-outline" size={24} color={activeTab === 'settings' ? C.accent : C.textSecondary} /><Text style={[styles.tabLabel, { color: activeTab === 'settings' ? C.accent : C.textSecondary }]}>More</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  darkContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 50 },
  onboardingContent: { flex: 1, justifyContent: 'center' },
  logo: { color: "#FFFFFF", fontSize: 36, fontWeight: '900', marginBottom: 20 },
  onboardingTitle: { color: "#FFFFFF", fontSize: 30, fontWeight: '800', marginBottom: 12 },
  onboardingSubtext: { color: "#E0E0E0", fontSize: 16, lineHeight: 24 },
  primaryButton: { padding: 18, borderRadius: 18, alignItems: 'center', marginBottom: 20 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  greeting: { color: "#E0E0E0", fontSize: 14, marginBottom: 4 },
  syncPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  wrapButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 980, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  wrapButtonText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: '600' },
  glassCard: { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderTopColor: "rgba(255,255,255,0.15)", marginBottom: 16, padding: 20 },
  glassCardHeavy: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 26, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderTopColor: "rgba(255,255,255,0.25)", marginBottom: 16, padding: 24 },
  cardHeaderTitle: { color: "#FFFFFF", fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginBottom: 18, opacity: 0.8 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitleWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTopRowValue: { fontSize: 14, fontWeight: '700' },
  subtleText: { color: "#E0E0E0", fontSize: 12 },
  iconBadge: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  personaIconBadge: { width: 56, height: 56, borderRadius: 18, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  personaLabel: { color: "#FFFFFF", fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4, opacity: 0.7 },
  personaName: { color: "#FFFFFF", fontSize: 18, fontWeight: '800', marginBottom: 4 },
  personaDesc: { color: "#E0E0E0", fontSize: 12, lineHeight: 17 },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between' },
  heatmapCell: { width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  heatmapLegend: { color: "#E0E0E0", fontSize: 10, fontWeight: '600' },
  heatmapSelectedText: { color: "#FFFFFF", fontSize: 12, fontWeight: '700' },
  leakRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  leakMerchant: { color: "#FFFFFF", fontSize: 15, fontWeight: '600' },
  leakCount: { color: "#E0E0E0", fontSize: 11, marginTop: 2 },
  leakAmount: { color: "#FFFFFF", fontSize: 15, fontWeight: '700' },
  expandedList: { paddingLeft: 10, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8 },
  expandedText: { color: "#E0E0E0", fontSize: 11, marginBottom: 4 },
  insightCard: { width: 260, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 24, padding: 20, marginRight: 12 },
  insightIconBadge: { width: 32, height: 32, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  insightTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  insightText: { color: "#FFFFFF", fontSize: 13, lineHeight: 19 },
  riskBarBackground: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 12 },
  riskBarFill: { height: '100%', borderRadius: 4 },
  goalRow: { marginBottom: 18 },
  goalName: { color: "#FFFFFF", fontSize: 14, fontWeight: '700' },
  goalMeta: { color: "#E0E0E0", fontSize: 12 },
  goalProgressBg: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginVertical: 6 },
  goalProgressFill: { height: '100%', borderRadius: 4 },
  goalDeadline: { color: "#E0E0E0", fontSize: 11 },
  goalInput: { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, color: "#FFFFFF", fontSize: 15, marginBottom: 12 },
  depositButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.03)' },
  depositButtonText: { fontSize: 11, fontWeight: '700' },
  weekChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginRight: 10 },
  weekChipActive: { backgroundColor: 'rgba(56,189,248,0.15)', borderColor: 'rgba(56,189,248,0.4)' },
  weekChipText: { color: "#E0E0E0", fontSize: 12, fontWeight: '600' },
  weekChipTextActive: { fontWeight: '700' },
  habitRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 16, marginBottom: 10 },
  briefingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  briefingCard: { width: '100%', backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: 'rgba(56,189,248,0.28)', borderRadius: 32, padding: 32, alignItems: 'center' },
  briefingIconRing: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(56,189,248,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  briefingIconGlyph: { fontSize: 28 },
  briefingTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: '800', marginBottom: 16 },
  briefingText: { color: "#FFFFFF", fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 28 },
  briefingButton: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16, width: '100%', alignItems: 'center' },
  briefingButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  quoteBox: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, marginBottom: 24, width: '100%' },
  quoteText: { color: "#FFFFFF", fontSize: 14, fontStyle: 'italic', textAlign: 'center' },
  quoteAuthor: { color: "#E0E0E0", fontSize: 12, textAlign: 'right', marginTop: 8 },
  bottomNavContainer: { position: 'absolute', bottom: 20, left: 20, right: 20, height: 70, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, backgroundColor: 'rgba(20, 20, 25, 0.9)', borderRadius: 35, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)' },
  tabButton: { flex: 1, justifyContent: 'center', alignItems: 'center', height: '100%' },
  tabLabel: { fontSize: 10, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' },
  activeDot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },
});
