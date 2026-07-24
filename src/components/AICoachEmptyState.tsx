// src/components/AICoachEmptyState.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../theme/scoreColor';

const SUGGESTED_PROMPTS = [
  'How much did I spend on food this week?',
  'Am I overspending compared to last month?',
  'Why is my impulse index high?',
  'What should I cut back on?',
];

export default function AICoachEmptyState({ onSelectPrompt }: { onSelectPrompt: (prompt: string) => void }) {
  return (
    <View>
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>
          Hi! I can see your behavioral scores and recent transactions. Ask me anything about your spending, or try one of these:
        </Text>
      </View>

      <View style={styles.chips}>
        {SUGGESTED_PROMPTS.map((prompt) => (
          <TouchableOpacity key={prompt} style={styles.chip} onPress={() => onSelectPrompt(prompt)}>
            <Text style={styles.chipText}>{prompt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 16,
    marginBottom: 16,
    maxWidth: '88%',
  },
  bubbleText: { color: '#FFFFFF', fontSize: 14, lineHeight: 21 },
  chips: { gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.3)',
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  chipText: { color: C.accent, fontSize: 13 },
});