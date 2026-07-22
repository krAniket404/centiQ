// src/components/CircularScoreCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CircularScoreCardProps {
  score: number;
  label: string;
  color: string;
}

export default function CircularScoreCard({ score, label, color }: CircularScoreCardProps) {
  const size = 90;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;

  // Calculate rotation degrees (0-100 -> 0-360 degrees)
  const degrees = (score / 100) * 360;
  const isHalf = degrees > 180;

  return (
    <View style={styles.container}>
      <View style={[styles.circleWrapper, { width: size, height: size }]}>
        {/* Background Ring */}
        <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: '#2D2D44' }]} />

        {/* First Half (0 to 180 deg) */}
        <View style={[styles.halfCircleContainer, { width: size, height: size / 2, top: 0 }]}>
          <View
            style={[
              styles.halfCircle,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: strokeWidth,
                borderColor: color,
                top: 0,
                transform: [{ rotate: isHalf ? '180deg' : `${degrees}deg` }]
              }
            ]}
          />
        </View>

        {/* Second Half (180 to 360 deg) - Only render if > 180 */}
        {isHalf && (
          <View style={[styles.halfCircleContainer, { width: size, height: size / 2, bottom: 0 }]}>
            <View
              style={[
                styles.halfCircle,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderWidth: strokeWidth,
                  borderColor: color,
                  top: -size / 2,
                  transform: [{ rotate: `${degrees - 180}deg` }]
                }
              ]}
            />
          </View>
        )}

        {/* Center Text */}
        <View style={styles.textContainer}>
          <Text style={[styles.scoreText, { color }]}>{score}</Text>
        </View>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
  },
  circleWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
  },
  halfCircleContainer: {
    position: 'absolute',
    overflow: 'hidden',
    left: 0,
  },
  halfCircle: {
    position: 'absolute',
    left: 0,
    borderBottomWidth: 0,
  },
  textContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  label: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 6,
  },
});