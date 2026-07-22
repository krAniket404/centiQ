import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';

const C = {
  bg: "#080808", textPrimary: "#FFFFFF", textSecondary: "#B8B8B8", accent: "#38BDF8"
};

interface PremiumChartProps {
  data: { day: string; amount: number }[];
  activeDay: number | null;
  setActiveDay: (i: number | null) => void;
}

export default function PremiumChart({ data, activeDay, setActiveDay }: PremiumChartProps) {
  const CHART_WIDTH = Dimensions.get('window').width - 92;
  const CHART_HEIGHT = 140;
  const maxVal = Math.max(...data.map(d => Number(d.amount) || 0), 1);

  // Map data to exact X and Y coordinates on the screen
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * CHART_WIDTH;
    const y = CHART_HEIGHT - ((Number(d.amount) || 0) / maxVal) * (CHART_HEIGHT - 30) - 15;
    return { x, y, value: Number(d.amount) || 0, day: d.day };
  });

  // 1. Draw the Area Fill (using many thin vertical bars to simulate a smooth polygon)
  const fillBars = [];
  const steps = 80;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const segmentIndex = Math.min(Math.floor(t * (points.length - 1)), points.length - 2);
    const localT = (t * (points.length - 1)) - segmentIndex;
    const p1 = points[segmentIndex];
    const p2 = points[segmentIndex + 1];
    const x = p1.x + (p2.x - p1.x) * localT;
    const y = p1.y + (p2.y - p1.y) * localT;

    fillBars.push(
      <View
        key={`fill-${i}`}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: (CHART_WIDTH / steps) + 2, // Overlap slightly to avoid gaps
          height: CHART_HEIGHT - y + 5,
          backgroundColor: 'rgba(56,189,248,0.15)', // Translucent blue fill
        }}
      />
    );
  }

  // 2. Draw the Smooth Line (using rotated Views to connect the dots)
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
          top: p1.y - 2, // Center the 4px line on the point
          width: length,
          height: 4,
          backgroundColor: C.accent,
          borderRadius: 2,
          transform: [{ rotate: `${angle}deg` }],
          transformOrigin: 'left center',
          shadowColor: C.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 6,
          elevation: 5,
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Faint horizontal grid lines */}
      <View style={[styles.gridLine, { top: 15 }]} />
      <View style={[styles.gridLine, { top: CHART_HEIGHT / 2 }]} />
      <View style={[styles.gridLine, { bottom: 15 }]} />

      <View style={{ width: CHART_WIDTH, height: CHART_HEIGHT }}>
        {/* Render Area Fill */}
        {fillBars}
        {/* Render Lines */}
        {lines}

        {/* Data Points (Dots) */}
        {points.map((p, i) => (
          <TouchableOpacity
            key={`dot-${i}`}
            style={[styles.dotWrapper, { left: p.x - 25, top: p.y - 25, width: 50, height: 50 }]}
            onPress={() => setActiveDay(activeDay === i ? null : i)}
            activeOpacity={1}
          >
            {activeDay === i && (
              <View style={styles.tooltip}>
                {/* Fixed number formatting here */}
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

      {/* X Axis Labels */}
      <View style={styles.xAxis}>
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
    alignItems: 'center'
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)'
  },
  dotWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center'
  },
  tooltip: {
    position: 'absolute',
    top: -32,
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
    marginTop: 16,
    width: '100%'
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