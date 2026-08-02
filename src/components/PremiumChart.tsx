import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';

const C = {
  bg: "#060606", textPrimary: "#FFFFFF", textSecondary: "#9A9AA0", accent: "#38BDF8"
};

interface PremiumChartProps {
  data: { day: string; amount: number }[];
  activeDay: number | null;
  setActiveDay: (i: number | null) => void;
  maxValue?: number;
}

export default function PremiumChart({ data, activeDay, setActiveDay, maxValue }: PremiumChartProps) {
  const CHART_WIDTH = Dimensions.get('window').width - 80 - 30;
  const CHART_HEIGHT = 150;
  const PADDING_TOP = 15;
  const PADDING_BOTTOM = 25;
  const USABLE_HEIGHT = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const rawMax = maxValue ? Math.max(maxValue, 1) : Math.max(...data.map(d => Number(d.amount) || 0), 1);
  const niceMax = Math.ceil(rawMax / 1000) * 1000;
  const maxVal = niceMax > 0 ? niceMax : 1000;

  const stepSize = maxVal >= 6000 ? 2000 : 1000;
  const gridValues = [];
  for (let v = stepSize; v <= maxVal; v += stepSize) {
    gridValues.push(v);
  }

  const points = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * CHART_WIDTH : CHART_WIDTH / 2;
    const y = PADDING_TOP + USABLE_HEIGHT - ((Number(d.amount) || 0) / maxVal) * USABLE_HEIGHT;
    return { x, y, value: Number(d.amount) || 0, day: d.day };
  });

  const fillBars = [];
  const steps = 80;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const segmentIndex = Math.min(Math.floor(t * (points.length - 1)), Math.max(0, points.length - 2));
    const localT = points.length > 1 ? (t * (points.length - 1)) - segmentIndex : 0;
    const p1 = points[segmentIndex] || points[0];
    const p2 = points[segmentIndex + 1] || points[0];
    const x = p1.x + (p2.x - p1.x) * localT;
    const y = p1.y + (p2.y - p1.y) * localT;

    const heightFraction = (CHART_HEIGHT - y) / CHART_HEIGHT;
    const opacity = 0.25 - (heightFraction * 0.20);

    fillBars.push(
      <View
        key={`fill-${i}`}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: (CHART_WIDTH / steps) + 2,
          height: CHART_HEIGHT - y,
          backgroundColor: `rgba(56,189,248,${opacity})`,
        }}
      />
    );
  }

  const lines = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    lines.push(
      <View
        key={`line-${i}`}
        style={{
          position: 'absolute',
          left: p1.x,
          top: p1.y - 1.5,
          width: length,
          height: 3,
          backgroundColor: C.accent,
          borderRadius: 1.5,
          transform: [{ rotate: `${angle}deg` }],
          transformOrigin: 'left center',
          shadowColor: C.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.7,
          shadowRadius: 4,
          elevation: 4,
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={{ width: CHART_WIDTH, height: CHART_HEIGHT, marginLeft: 15 }}>

        {gridValues.map((val, i) => {
          const frac = 1 - (val / maxVal);
          const y = PADDING_TOP + (USABLE_HEIGHT * frac);
          return (
            <View key={`grid-${i}`} style={[styles.gridLine, { top: y }]}>
              <Text style={styles.gridLabel}>₹{val / 1000}k</Text>
            </View>
          );
        })}

        {fillBars}
        {lines}

        {points.map((p, i) => (
          <TouchableOpacity
            key={`dot-${i}`}
            style={[styles.dotWrapper, { left: p.x - 25, top: p.y - 25, width: 50, height: 50 }]}
            onPress={() => setActiveDay(activeDay === i ? null : i)}
            activeOpacity={1}
          >
            {activeDay === i && (
              <View style={styles.tooltip}>
                <Text style={styles.tooltipText}>₹{Math.round(p.value).toLocaleString('en-IN')}</Text>
                <View style={styles.tooltipArrow} />
              </View>
            )}
            <View style={[
              styles.dot,
              activeDay === i ? styles.dotActive : styles.dotInactive
            ]} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.xAxis, { width: CHART_WIDTH, marginLeft: 15 }]}>
        {data.map((d, i) => (
          <Text key={i} style={[styles.xAxisLabel, activeDay === i && styles.xAxisLabelActive]}>
            {d.day}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    alignItems: 'flex-start'
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)'
  },
  gridLabel: {
    position: 'absolute',
    left: -35,
    top: -6,
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    width: 30,
    textAlign: 'right',
  },
  dotWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center'
  },
  tooltip: {
    position: 'absolute',
    top: -38,
    backgroundColor: '#111111',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    zIndex: 10,
  },
  tooltipText: {
    color: C.accent,
    fontSize: 12,
    fontWeight: 'bold'
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -4,
    width: 8,
    height: 8,
    backgroundColor: '#111111',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(56,189,248,0.5)',
    transform: [{ rotate: '45deg' }]
  },
  dotInactive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.bg,
    borderWidth: 2,
    borderColor: C.accent
  },
  dotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.accent,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12
  },
  xAxisLabel: {
    color: C.textSecondary,
    fontSize: 11,
    width: 38,
    textAlign: 'center'
  },
  xAxisLabelActive: {
    color: C.accent,
    fontWeight: 'bold'
  }
});