// src/components/GlowBackdrop.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function GlowBackdrop({ color, size = 220 }: { color: string; size?: number }) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        { alignItems: 'center', justifyContent: 'center' },
      ]}
    >
      <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: 0.10 }]} />
      <View style={[styles.ring, { width: size * 0.7, height: size * 0.7, borderRadius: (size * 0.7) / 2, backgroundColor: color, opacity: 0.14, position: 'absolute' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute' },
});