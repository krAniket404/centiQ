import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { ParsedTransaction } from '../lib/smsParser';

const C = {
  bg: "#060608", glass: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)",
  textPrimary: "#FFFFFF", textSecondary: "#A0A0B0", accent: "#38BDF8",
  success: "#10B981", warning: "#F59E0B", danger: "#EF4444", purple: "#8B5CF6"
};

const Typography = {
  fontFamilyRegular: 'lato_regular',
  fontFamilyMedium: 'lato_regular',
  fontFamilyBold: 'lato_bold',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  transactions: ParsedTransaction[];
  scores: { discipline: number; impulse: number; volatility: number; wellness: number; savingsRate: number };
  recurringCharges: { knownSubscriptions: any[] };
  monthlyForecast: { projectedSpend: number } | undefined;
}

export default function WowModal({ visible, onClose, transactions, scores, recurringCharges, monthlyForecast }: Props) {
  const wowInsights = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return [];
    const debitTxns = transactions.filter(t => t.type === 'debit');
    if (debitTxns.length === 0) return [];
    const totalSpend = debitTxns.reduce((a, b) => a + b.amount, 0);
    const avgAmt = totalSpend / debitTxns.length;

    const insights: { icon: string; text: React.ReactNode; score: number }[] = [];

    // 1. Late Night Impulse (After 9 PM)
    const lateNightTxns = debitTxns.filter(t => t.date.getHours() >= 21 || t.date.getHours() <= 4);
    const dayTxns = debitTxns.filter(t => t.date.getHours() > 4 && t.date.getHours() < 21);
    const avgLate = lateNightTxns.length > 0 ? lateNightTxns.reduce((a, b) => a + b.amount, 0) / lateNightTxns.length : 0;
    const avgDay = dayTxns.length > 0 ? dayTxns.reduce((a, b) => a + b.amount, 0) / dayTxns.length : 0;
    if (avgDay > 0 && avgLate > avgDay) {
      const pct = Math.round(((avgLate - avgDay) / avgDay) * 100);
      insights.push({
        icon: '🌙', score: pct,
        text: (<Text>You spend <Text style={{ color: C.warning, fontWeight: '900' }}>{pct}% more</Text> per transaction after 9 PM.</Text>)
      });
    }

    // 2. Weekend Warrior
    const weekendTxns = debitTxns.filter(t => t.date.getDay() === 0 || t.date.getDay() === 6);
    const weekendSpend = weekendTxns.reduce((a, b) => a + b.amount, 0);
    const weekendPct = totalSpend > 0 ? Math.round((weekendSpend / totalSpend) * 100) : 0;
    if (weekendPct > 35) {
      insights.push({
        icon: '🎉', score: weekendPct,
        text: (<Text>Your weekends are dangerous: <Text style={{ color: C.accent, fontWeight: '900' }}>{weekendPct}%</Text> of your money is spent on Sat & Sun.</Text>)
      });
    }

    // 3. Foodie Trap
    const catTotals: { [key: string]: number } = {};
    debitTxns.forEach(t => { catTotals[t.category || 'Other'] = (catTotals[t.category || 'Other'] || 0) + t.amount; });
    const topCat = Object.keys(catTotals).sort((a, b) => catTotals[b] - catTotals[a])[0];
    const topCatPct = totalSpend > 0 ? Math.round((catTotals[topCat] / totalSpend) * 100) : 0;
    if (topCat === 'Food' && topCatPct > 30) {
      insights.push({
        icon: '🍔', score: topCatPct,
        text: (<Text>You are a foodie: <Text style={{ color: C.warning, fontWeight: '900' }}>{topCatPct}%</Text> of your money went to food deliveries and dining.</Text>)
      });
    }

    // 4. Subscription Hoarder
    if (recurringCharges.knownSubscriptions.length >= 3) {
      insights.push({
        icon: '📦', score: recurringCharges.knownSubscriptions.length * 10,
        text: (<Text>You have <Text style={{ color: C.purple, fontWeight: '900' }}>{recurringCharges.knownSubscriptions.length} active subscriptions</Text> leaking money every month.</Text>)
      });
    }

    // 5. High Volatility (Erratic spending)
    if (scores.volatility > 0 && scores.volatility < 40) {
      insights.push({
        icon: '📉', score: 100 - scores.volatility,
        text: (<Text>Your spending is erratic. You go from spending nothing to massive splurges in just days.</Text>)
      });
    }

    // 6. The Anomaly
    const maxTxn = debitTxns.sort((a, b) => b.amount - a.amount)[0];
    if (maxTxn && maxTxn.amount > avgAmt * 3) {
      const anomalyPct = Math.round((maxTxn.amount / avgAmt) * 100);
      insights.push({
        icon: '⚠️', score: anomalyPct,
        text: (<Text>Your largest purchase at {maxTxn.merchant || 'Unknown'} was <Text style={{ color: C.danger, fontWeight: '900' }}>{anomalyPct}% larger</Text> than your normal transaction.</Text>)
      });
    }

    // 7. Overspend Forecast
    const overspendAmount = (monthlyForecast?.projectedSpend || 0) - (transactions.filter(t => t.type === 'credit' && t.date.getMonth() === new Date().getMonth()).reduce((a, b) => a + b.amount, 0));
    if (overspendAmount > 1000) {
      insights.push({
        icon: '📈', score: Math.round(overspendAmount / 100),
        text: (<Text>At this pace, you will overspend your income by <Text style={{ color: C.danger, fontWeight: '900' }}>₹{Math.round(overspendAmount).toLocaleString('en-IN')}</Text> this month.</Text>)
      });
    }

    return insights.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [transactions, recurringCharges, scores, monthlyForecast]);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible && wowInsights.length > 0}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.95)' }]}>
        <View style={[styles.card, { padding: 32, width: '100%' }]}>

          <Text style={{ fontSize: 44, marginBottom: 16, textAlign: 'center' }}>🧠</Text>
          <Text style={[styles.title, { fontSize: 26, marginBottom: 8 }]}>We decoded your money.</Text>
          <Text style={styles.subtitle}>
            Here is what your spending history is hiding from you:
          </Text>

          {wowInsights.map((insight, i) => (
            <View key={i} style={styles.insightRow}>
              <Text style={styles.icon}>{insight.icon}</Text>
              <Text style={styles.text}>{insight.text}</Text>
            </View>
          ))}

          <TouchableOpacity style={[styles.button, { marginTop: 32 }]} onPress={onClose}>
            <Text style={styles.buttonText}>See my Dashboard</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderTopColor: 'rgba(255,255,255,0.2)', borderRadius: 32, alignItems: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.4, shadowRadius: 32, elevation: 12
  },
  title: { color: C.textPrimary, fontWeight: '800', letterSpacing: -0.3, fontFamily: Typography.fontFamilyBold },
  subtitle: { color: C.textSecondary, fontSize: 14, marginBottom: 28, textAlign: 'center', fontFamily: Typography.fontFamilyRegular },
  insightRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, marginBottom: 14, width: '100%'
  },
  icon: { fontSize: 24, marginRight: 16 },
  text: { flex: 1, color: C.textPrimary, fontSize: 15, lineHeight: 22, fontFamily: Typography.fontFamilyMedium },
  button: {
    backgroundColor: C.accent, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16, width: '100%', alignItems: 'center',
    shadowColor: C.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8
  },
  buttonText: { color: '#001018', fontSize: 16, fontWeight: '800', fontFamily: Typography.fontFamilyBold }
});