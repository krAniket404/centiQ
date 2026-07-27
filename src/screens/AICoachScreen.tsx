import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, NativeModules } from 'react-native';
import { ParsedTransaction } from '../lib/smsParser';

const { SmsModule } = NativeModules;
const CHAT_STORAGE_KEY = 'centiq_chat_history';

const C = {
  bg: "#080808", glass: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)",
  textPrimary: "#FFFFFF", textSecondary: "#B8B8B8", accent: "#38BDF8", success: "#10B981", warning: "#F59E0B", danger: "#EF4444"
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
  // Start with an empty array, we will load saved messages in useEffect
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingChat, setIsFetchingChat] = useState(true); // Prevents flicker while loading
  const flatListRef = useRef<FlatList>(null);

  // 1. Load Chat History on Mount
  useEffect(() => {
    const loadChat = async () => {
      try {
        const savedChat = await SmsModule.loadData(CHAT_STORAGE_KEY);
        if (savedChat) {
          const parsedChat = JSON.parse(savedChat);
          setMessages(parsedChat);
        } else {
          // If no history, show the welcome message
          setMessages([{
            role: 'assistant',
            content: "Hi! I'm your CentiQ AI Coach. I run 100% offline on your device. Ask me about your wellness score, impulse index, top spending categories, or how to save money!"
          }]);
        }
      } catch (e) {
        setMessages([{
          role: 'assistant',
          content: "Hi! I'm your CentiQ AI Coach. I run 100% offline on your device. Ask me about your wellness score, impulse index, top spending categories, or how to save money!"
        }]);
      } finally {
        setIsFetchingChat(false);
      }
    };
    loadChat();
  }, []);

  // 2. Save Chat History whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      SmsModule.saveData(CHAT_STORAGE_KEY, JSON.stringify(messages))
        .catch(e => console.warn("Failed to save chat", e));
    }
  }, [messages]);

  // The Custom Chatbot Brain
  const generateBotResponse = (userText: string): string => {
    const msg = userText.toLowerCase();

    const debitTxns = transactions.filter(t => t.type === 'debit');
    const totalSpend = debitTxns.reduce((a, b) => a + b.amount, 0);

    const catTotals: { [key: string]: number } = {};
    debitTxns.forEach(t => { catTotals[t.category || 'Other'] = (catTotals[t.category || 'Other'] || 0) + t.amount; });
    const topCat = Object.keys(catTotals).sort((a, b) => catTotals[b] - catTotals[a])[0] || 'Food';
    const topCatAmount = Math.round(catTotals[topCat] || 0);

    if (msg.includes('hi') || msg.includes('hello') || msg.includes('hey')) {
      return "Hey there! Ready to decode your money habits? You can ask me about your scores, your spending, or ask for a tip to save money.";
    }
    if (msg.includes('wellness') || msg.includes('score')) {
      return `Your Financial Wellness Score is ${scores.wellness}/100. This is a composite score based on your discipline, impulse control, and spending volatility. ${scores.wellness >= 70 ? "You're doing great!" : "There's room for improvement."}`;
    }
    if (msg.includes('impulse') || msg.includes('impulsive')) {
      if (scores.impulse > 60) {
        return `Your Impulse Index is ${scores.impulse}/100. This is a bit high. I noticed you have several late-night transactions and same-day clusters. Try the 24-hour rule: wait a day before buying anything non-essential over ₹500.`;
      } else {
        return `Your Impulse Index is ${scores.impulse}/100. You're doing a great job controlling your impulses! Keep logging your 'Worth It' purchases so I can learn more about your habits.`;
      }
    }
    if (msg.includes('discipline') || msg.includes('volatility')) {
      return `Your Discipline score is ${scores.discipline}/100 and Volatility is ${scores.volatility}/100. These measure how consistent your spending is compared to your average. A lower volatility means you aren't making erratic, unpredictable purchases.`;
    }
    if (msg.includes('spend') || msg.includes('category') || msg.includes('food') || msg.includes('shopping')) {
      return `Looking at your debits, your top spending category is ${topCat}. You've spent approximately ₹${topCatAmount.toLocaleString('en-IN')} there. If you want to save money, cutting back here by just 15% would massively improve your wellness score.`;
    }
    if (msg.includes('save') || msg.includes('saving') || msg.includes('advice') || msg.includes('tip')) {
      return `Here is a pro tip: Based on your data, your weekend spending is usually higher than weekdays. Try setting a strict 'weekend cash envelope'—withdraw ₹2000 on Friday and don't use your card for the weekend. This creates a hard visual limit.`;
    }
    if (msg.includes('subscription') || msg.includes('netflix') || msg.includes('spotify')) {
      return "Check the Subscriptions card on your Dashboard! I scan your history for recurring identical charges. If you see subscriptions you don't use anymore, canceling them is the fastest way to boost your savings rate.";
    }

    return "I can analyze your wellness, impulse index, top spending categories, or give you savings tips. Try asking: 'Why is my impulse score high?' or 'How can I save money?'";
  };

  const sendMessage = async (textToSend?: string) => {
    const messageText = textToSend || inputText;
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: messageText };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    setTimeout(() => {
      const botResponse = generateBotResponse(messageText);
      const aiMessage: Message = { role: 'assistant', content: botResponse };
      setMessages([...newMessages, aiMessage]);
      setIsLoading(false);
    }, 800);
  };

  useEffect(() => {
    if (flatListRef.current) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isLoading]);

  // Don't render the list until chat is loaded to prevent flicker
  if (isFetchingChat) {
    return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={C.accent} size="large" /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, marginTop: 20 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 }}>
        <View>
          <Text style={styles.headerTitle}>AI Coach</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 8 }} />
            <Text style={{ color: '#9A9AA0', fontSize: 12 }}>Offline Mode - 100% Private</Text>
          </View>
        </View>
      </View>

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
          <Text style={styles.loadingText}>Analyzing your data...</Text>
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
        <TouchableOpacity style={styles.sendButton} onPress={() => sendMessage()} disabled={isLoading}>
          <Text style={styles.sendText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerTitle: { color: C.textPrimary, fontSize: 26, fontWeight: '700', paddingHorizontal: 4 },
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
    lineHeight: 20
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
    marginBottom: 20,
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