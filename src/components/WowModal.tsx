import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { ParsedTransaction } from '../lib/smsParser';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Theme, THEMES } from '../theme/themes';

const Typography = {
  fontFamilyRegular: 'lato_regular',
  fontFamilyMedium: 'lato_regular',
  fontFamilyBold: 'lato_bold',
};

function createStyles(C: Theme) {
  return StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.border, borderTopColor: C.glassHighlight,
    borderRadius: 32, alignItems: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.4, shadowRadius: 32, elevation: 12
  },
  headerBadge: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(56,189,248,0.1)',
    borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)', justifyContent: 'center', alignItems: 'center'
  },
  title: { color: C.textPrimary, fontWeight: '800', letterSpacing: -0.3, fontFamily: Typography.fontFamilyBold, textAlign: 'center' },
  subtitle: { color: C.textSecondary, fontSize: 13, marginBottom: 24, textAlign: 'center', fontFamily: Typography.fontFamilyRegular },
  insightRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 14, marginBottom: 12, width: '100%'
  },
  insightIconBadge: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  text: { flex: 1, color: C.textPrimary, fontSize: 14, lineHeight: 20, fontFamily: Typography.fontFamilyMedium },
  button: {
    backgroundColor: C.accent, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16, width: '100%', alignItems: 'center',
    shadowColor: C.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', fontFamily: Typography.fontFamilyBold }
});
}

interface Props {
  visible: boolean;
  onClose: () => void;
  transactions: ParsedTransaction[];
  scores: { discipline: number; impulse: number; volatility: number; wellness: number; savingsRate: number };
  recurringCharges: { knownSubscriptions: any[] };
  monthlyForecast: { projectedSpend: number } | undefined;
  theme: Theme;
}

export default function WowModal({ visible, onClose, transactions, scores, recurringCharges, monthlyForecast, theme }: Props) {
  const C = theme || THEMES.azure;
  const styles = useMemo(() => createStyles(C), [C]);
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
        icon: 'weather-night', score: pct,
        text: (<Text>You spend <Text style={{ color: C.warning, fontWeight: '900' }}>{pct}% more</Text> per transaction after 9 PM.</Text>)
      });
    }

    // 2. Weekend Warrior
    const weekendTxns = debitTxns.filter(t => t.date.getDay() === 0 || t.date.getDay() === 6);
    const weekendSpend = weekendTxns.reduce((a, b) => a + b.amount, 0);
    const weekendPct = totalSpend > 0 ? Math.round((weekendSpend / totalSpend) * 100) : 0;
    if (weekendPct > 35) {
      insights.push({
        icon: 'party-popper', score: weekendPct,
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
        icon: 'food-apple-outline', score: topCatPct,
        text: (<Text>You are a foodie: <Text style={{ color: C.warning, fontWeight: '900' }}>{topCatPct}%</Text> of your money went to food deliveries and dining.</Text>)
      });
    }

    // 4. Subscription Hoarder
    if (recurringCharges.knownSubscriptions.length >= 3) {
      insights.push({
        icon: 'package-variant-closed', score: recurringCharges.knownSubscriptions.length * 10,
        text: (<Text>You have <Text style={{ color: C.purple, fontWeight: '900' }}>{recurringCharges.knownSubscriptions.length} active subscriptions</Text> leaking money every month.</Text>)
      });
    }

    // 5. High Volatility (Erratic spending)
    if (scores.volatility > 0 && scores.volatility < 40) {
      insights.push({
        icon: 'chart-line-variant', score: 100 - scores.volatility,
        text: (<Text>Your spending is erratic. You go from spending nothing to massive splurges in just days.</Text>)
      });
    }

    // 6. The Anomaly
    const maxTxn = debitTxns.sort((a, b) => b.amount - a.amount)[0];
    if (maxTxn && maxTxn.amount > avgAmt * 3) {
      const anomalyPct = Math.round((maxTxn.amount / avgAmt) * 100);
      insights.push({
        icon: 'alert-circle-outline', score: anomalyPct,
        text: (<Text>Your largest purchase at {maxTxn.merchant || 'Unknown'} was <Text style={{ color: C.danger, fontWeight: '900' }}>{anomalyPct}% larger</Text> than your normal transaction.</Text>)
      });
    }

    // 7. Overspend Forecast
    const overspendAmount = (monthlyForecast?.projectedSpend || 0) - (transactions.filter(t => t.type === 'credit' && t.date.getMonth() === new Date().getMonth()).reduce((a, b) => a + b.amount, 0));
    if (overspendAmount > 1000) {
      insights.push({
        icon: 'trending-up', score: Math.round(overspendAmount / 100),
        text: (<Text>At this pace, you will overspend your income by <Text style={{ color: C.danger, fontWeight: '900' }}>₹{Math.round(overspendAmount).toLocaleString('en-IN')}</Text> this month.</Text>)
      });
    }

    return insights.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [transactions, recurringCharges, scores, monthlyForecast, C]);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible && wowInsights.length > 0}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.95)' }]}>
        <View style={styles.card}>

          <View style={styles.headerBadge}>
            <Icon name="brain" size={36} color={C.accent} />
          </View>

          <Text style={[styles.title, { fontSize: 24, marginBottom: 8, marginTop: 16 }]}>We decoded your money.</Text>
          <Text style={styles.subtitle}>
            Here is what your spending history is hiding from you:
          </Text>

          {wowInsights.map((insight, i) => (
            <View key={i} style={styles.insightRow}>
              <View style={styles.insightIconBadge}>
                <Icon name={insight.icon} size={20} color={C.textPrimary} />
              </View>
              <Text style={styles.text}>{insight.text}</Text>
            </View>
          ))}

          <TouchableOpacity style={[styles.button, { marginTop: 24 }]} onPress={onClose}>
            <Text style={styles.buttonText}>See my Dashboard</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}
