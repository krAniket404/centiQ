import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { ParsedTransaction } from '../lib/smsParser';

const C = {
  bg: "#080808", glass: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)",
  textPrimary: "#FFFFFF", textSecondary: "#B8B8B8", accent: "#38BDF8", success: "#10B981"
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  transactions: ParsedTransaction[];
  scores: { discipline: number; impulse: number; volatility: number; wellness: number; savingsRate: number };
}

export default function AICoachScreen({ transactions, scores }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your CentiQ AI Coach. I can see your behavioral scores and recent transactions. Ask me anything about your spending habits!"
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // PASTE YOUR API KEY HERE
  const API_KEY = 'YOUR_GEMINI_API_KEY';

  const getContext = () => {
    const recentTxns = transactions.slice(0, 10).map(t =>
      `${t.type === 'credit' ? 'Income' : 'Spent'} ₹${t.amount} at ${t.merchant || t.bank} on ${t.date.toLocaleDateString()} (${t.category || 'Other'})`
    ).join(', ');

    return `
      User's Financial Data:
      - Wellness Score: ${scores.wellness}/100
      - Discipline Score: ${scores.discipline}/100
      - Impulse Index: ${scores.impulse}/100 (higher is worse)
      - Savings Rate: ${Math.round(scores.savingsRate)}%
      - Recent Transactions: ${recentTxns}

      Instruction: You are a helpful behavioral finance coach. Provide clear, structured, and detailed insights based on the user's data. Use bullet points if necessary. Do not use slang.
    `;
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: inputText };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    console.log("Attempting to use API Key:", API_KEY);

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`, {        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: getContext() }]
          },
          contents: newMessages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          })),
          generationConfig: { maxOutputTokens: 1600 }
        })
      });

      const data = await response.json();
      console.log("Gemini API Response:", JSON.stringify(data, null, 2));

      if (!response.ok) {
        throw new Error(data?.error?.message || 'Network response was not ok');
      }

      if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
        const aiText = data.candidates[0].content.parts[0].text;
        const aiMessage: Message = { role: 'assistant', content: aiText };
        setMessages([...newMessages, aiMessage]);
      } else {
        throw new Error('No candidates returned from API');
      }
    } catch (error: any) {
      console.error('AI Error Details:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error.message || "Couldn't connect to the AI. Check your Metro terminal for details."}`
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (flatListRef.current) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isLoading]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, marginTop: 20 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <Text style={styles.headerTitle}>AI Coach</Text>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={[
            styles.messageBubble,
            item.role === 'user' ? styles.userBubble : styles.aiBubble
          ]}>
            <Text style={item.role === 'user' ? styles.userText : styles.aiText}>
              {item.content}
            </Text>
          </View>
        )}
      />

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={C.accent} size="small" />
          <Text style={styles.loadingText}>Coach is thinking...</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask about your spending..."
          placeholderTextColor={C.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={isLoading}>
          <Text style={styles.sendText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerTitle: { color: C.textPrimary, fontSize: 26, fontWeight: '700', marginBottom: 20, paddingHorizontal: 4 },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: C.accent,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.border,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  userText: {
    color: '#001018',
    fontSize: 14,
    fontWeight: '500'
  },
  aiText: {
    color: C.textPrimary,
    fontSize: 14,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  loadingText: {
    color: C.textSecondary,
    fontSize: 12,
    marginLeft: 8,
    fontStyle: 'italic'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 100,
  },
  input: {
    flex: 1,
    color: C.textPrimary,
    fontSize: 14,
    maxHeight: 80,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendText: {
    color: '#001018',
    fontSize: 20,
    fontWeight: 'bold',
  }
});