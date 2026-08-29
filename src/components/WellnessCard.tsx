import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CircularScoreCard from './CircularScoreCard';
import { getScoreColor as getDynamicScoreColor } from '../theme/scoreColor';
import AnimatedNumber from './AnimatedNumber';
import { Theme, THEMES } from '../theme/themes';

const Typography = {
  fontFamilyRegular: 'lato_regular',
  fontFamilyMedium: 'lato_regular',
  fontFamilyBold: 'lato_bold',
};

function createStyles(C: Theme) {
  return StyleSheet.create({
  glassCardHeavy: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.08)', borderTopColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1, borderRadius: 32,
    shadowColor: "#000", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.4, shadowRadius: 32, elevation: 8,
  },
  cardHeaderTitle: { color: C.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginBottom: 18, fontFamily: Typography.fontFamilyBold },
  ringWrap: {
    width: 108, height: 108, justifyContent: 'center', alignItems: 'center', marginRight: 20,
    shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 10,
  },
  meterContainer: { marginBottom: 16 },
  meterLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  meterLabel: { color: C.textSecondary, fontSize: 13, fontFamily: Typography.fontFamilyMedium },
  meterValue: { color: C.textPrimary, fontSize: 13, fontWeight: '700', fontFamily: Typography.fontFamilyBold },
  meterBackground: { height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  meterFill: { height: '100%', borderRadius: 999 },
});
}

interface Props {
  scores: { discipline: number; impulse: number; volatility: number; wellness: number; savingsRate: number };
  theme: Theme;
}

export default function WellnessCard({ scores, theme }: Props) {
  const C = theme || THEMES.azure;
  const styles = useMemo(() => createStyles(C), [C]);
  return (
    <View style={[styles.glassCardHeavy, { padding: 24, marginBottom: 18, backgroundColor: C.glassStrong, borderColor: C.border }]}>
      <Text style={[styles.cardHeaderTitle, { marginBottom: 22, color: C.textSecondary }]}>FINANCIAL WELLNESS</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Left Side: Circle */}
        <View style={styles.ringWrap}>
          <CircularScoreCard score={scores.wellness} label="Score" color={getDynamicScoreColor(scores.wellness, 'higher_is_better', C)} size={100} />
        </View>

        {/* Right Side: Meters */}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={styles.meterContainer}>
            <View style={styles.meterLabelRow}>
              <Text style={[styles.meterLabel, { color: C.textSecondary }]}>Discipline</Text>
              <Text style={[styles.meterValue, { color: C.textPrimary }]}>
                <AnimatedNumber value={scores.discipline} duration={1000} />/100
              </Text>
            </View>
            <View style={styles.meterBackground}>
              <View style={[styles.meterFill, { width: `${scores.discipline}%`, backgroundColor: getDynamicScoreColor(scores.discipline, 'higher_is_better', C) }]} />
            </View>
          </View>

          <View style={styles.meterContainer}>
            <View style={styles.meterLabelRow}>
              <Text style={[styles.meterLabel, { color: C.textSecondary }]}>Impulse Index</Text>
              <Text style={[styles.meterValue, { color: C.textPrimary }]}>
                <AnimatedNumber value={scores.impulse} duration={1200} />/100
              </Text>
            </View>
            <View style={styles.meterBackground}>
              <View style={[styles.meterFill, { width: `${scores.impulse}%`, backgroundColor: getDynamicScoreColor(scores.impulse, 'lower_is_better', C) }]} />
            </View>
          </View>

          <View style={styles.meterContainer}>
            <View style={styles.meterLabelRow}>
              <Text style={[styles.meterLabel, { color: C.textSecondary }]}>Volatility</Text>
              <Text style={[styles.meterValue, { color: C.textPrimary }]}>
                <AnimatedNumber value={scores.volatility} duration={1400} />/100
              </Text>
            </View>
            <View style={styles.meterBackground}>
              <View style={[styles.meterFill, { width: `${scores.volatility}%`, backgroundColor: getDynamicScoreColor(scores.volatility, 'lower_is_better', C) }]} />
            </View>
          </View>

          <View style={styles.meterContainer}>
            <View style={styles.meterLabelRow}>
              <Text style={[styles.meterLabel, { color: C.textSecondary }]}>Savings Rate</Text>
              <Text style={[styles.meterValue, { color: C.textPrimary }]}>
                <AnimatedNumber value={Math.round(scores.savingsRate)} duration={1600} />/100
              </Text>
            </View>
            <View style={styles.meterBackground}>
              <View style={[styles.meterFill, { width: `${scores.savingsRate}%`, backgroundColor: getDynamicScoreColor(scores.savingsRate, 'higher_is_better', C) }]} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
