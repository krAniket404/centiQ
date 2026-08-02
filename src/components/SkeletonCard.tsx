import React, { useState, useEffect } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

export default function SkeletonCard() {
  const [opacity] = useState(new Animated.Value(0.3));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={styles.lineShort} />
      <View style={styles.lineLong} />
      <View style={styles.lineMedium} />
      <View style={styles.lineLong} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 28,
    padding: 24,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  lineShort: { width: '40%', height: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, marginBottom: 20 },
  lineLong: { width: '100%', height: 40, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, marginBottom: 12 },
  lineMedium: { width: '70%', height: 40, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, marginBottom: 12 },
});