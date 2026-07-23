import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Path, LinearGradient, Stop, Defs, Circle } from 'react-native-svg';

const C = {
  bg: "#080808", textPrimary: "#FFFFFF", textSecondary: "#B8B8B8", accent: "#38BDF8"
};

interface SvgAreaChartProps {
  data: { day: string; amount: number }[];
  activeDay: number | null;
  setActiveDay: (i: number | null) => void;
}

export default function SvgAreaChart({ data, activeDay, setActiveDay }: SvgAreaChartProps) {
  const CHART_WIDTH = Dimensions.get('window').width - 80; // Match card padding
  const CHART_HEIGHT = 160;
  const maxVal = Math.max(...data.map(d => Number(d.amount) || 0), 1);

  // Map data to X and Y coordinates
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * CHART_WIDTH;
    const y = CHART_HEIGHT - ((Number(d.amount) || 0) / maxVal) * (CHART_HEIGHT - 40) - 20;
    return { x, y, value: Number(d.amount) || 0, day: d.day };
  });

  // Build the smooth SVG Path using Cubic Bezier Curves
  let linePath = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    linePath += ` C ${midX},${p0.y} ${midX},${p1.y} ${p1.x},${p1.y}`;
  }

  // Build the Area Fill Path (Line path + down to bottom + close)
  const areaPath = `${linePath} L ${points[points.length - 1].x},${CHART_HEIGHT} L ${points[0].x},${CHART_HEIGHT} Z`;

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={C.accent} stopOpacity="0.4" />
            <Stop offset="100%" stopColor={C.accent} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Area Fill */}
        <Path d={areaPath} fill="url(#areaGradient)" />

        {/* Smooth Line */}
        <Path
          d={linePath}
          fill="none"
          stroke={C.accent}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data Points (Dots) */}
        {points.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={activeDay === i ? 6 : 4}
            fill={activeDay === i ? C.accent : C.bg}
            stroke={C.accent}
            strokeWidth={2}
          />
        ))}
      </Svg>

      {/* Interactive Touch Layer & Labels */}
      <View style={[styles.touchLayer, { width: CHART_WIDTH, height: CHART_HEIGHT }]}>
        {points.map((p, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.touchZone, { left: p.x - 25, top: p.y - 25 }]}
            onPress={() => setActiveDay(activeDay === i ? null : i)}
          >
            {activeDay === i && (
              <View style={styles.tooltip}>
                <Text style={styles.tooltipText}>₹{Math.round(p.value).toLocaleString('en-IN')}</Text>
                <View style={styles.tooltipArrow} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* X Axis Labels */}
      <View style={[styles.xAxis, { width: CHART_WIDTH }]}>
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
  touchLayer: {
    position: 'absolute',
    top: 10,
    flexDirection: 'row',
  },
  touchZone: {
    position: 'absolute',
    width: 50,
    height: 50,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  tooltip: {
    position: 'absolute',
    top: -20,
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
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12
  },
  xAxisLabel: {
    color: C.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    flex: 1
  },
  xAxisLabelActive: {
    color: C.accent,
    fontWeight: 'bold'
  }
});