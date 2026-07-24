import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CircularScoreCardProps {
  score: number;
  label: string;
  color: string;
  size?: number;
}

export default function CircularScoreCard({ score, label, color, size = 120 }: CircularScoreCardProps) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <View style={styles.container}>
      <View style={[styles.circleWrapper, { width: size, height: size }]}>
        <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: 'rgba(255,255,255,0.08)' }]} />

        <View style={[styles.halfCircleContainer, { width: size, height: size / 2, top: 0 }]}>
          <View
            style={[
              styles.halfCircle,
              {
                width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: color,
                top: 0,
                transform: [{ rotate: score > 50 ? '180deg' : `${(score / 100) * 360}deg` }],
                // NEON GLOW PROPERTIES ADDED HERE
                shadowColor: color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 8,
                elevation: 8,
              }
            ]}
          />
        </View>

        {score > 50 && (
          <View style={[styles.halfCircleContainer, { width: size, height: size / 2, bottom: 0 }]}>
            <View
              style={[
                styles.halfCircle,
                {
                  width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: color,
                  top: -size / 2,
                  transform: [{ rotate: `${((score - 50) / 100) * 360}deg` }],
                  // NEON GLOW PROPERTIES ADDED HERE
                  shadowColor: color,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 8,
                  elevation: 8,
                }
              ]}
            />
          </View>
        )}

        <View style={styles.textContainer}>
          <Text style={[styles.scoreText, { color }]}>{score}</Text>
          <Text style={styles.labelText}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', alignSelf: 'center' },
  circleWrapper: { justifyContent: 'center', alignItems: 'center', position: 'relative' },
  ring: { position: 'absolute' },
  halfCircleContainer: { position: 'absolute', overflow: 'hidden', left: 0 },
  halfCircle: { position: 'absolute', left: 0, borderBottomWidth: 0 },
  textContainer: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  scoreText: { fontSize: 30, fontWeight: '700' },
  labelText: { fontSize: 10.5, color: '#B8B8B8', marginTop: 2 }
});