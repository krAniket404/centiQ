import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, NativeModules, ScrollView } from 'react-native';
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

// The expanded list of suggested questions
const SUGGESTED_QUESTIONS = [
  "Why is my impulse score high?",
  "How can I save money?",
  "What is my financial persona?",
  "How do I improve my discipline?",
  "Are there any unusual transactions?",
  "How much did I save this month?",
  "What is my top spending category?",
  "Am I overspending on weekends?"
];

export default function AICoachScreen({ transactions, scores }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingChat, setIsFetchingChat] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // 1. Load Chat History on Mount
  useEffect(() => {
    const loadChat = async () => {
      try {
        const savedChat = await SmsModule.loadData(CHAT_STORAGE_KEY);
        if (savedChat) {
          setMessages(JSON.parse(savedChat));
        }
      } catch (e) {
        console.warn("Failed to load chat", e);
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
  //
  // FIX: intents are now checked from MOST specific to LEAST specific,
  // instead of the previous order which put the greeting check and the
  // generic wellness/"score" check FIRST. That caused two real bugs:
  //   1. `msg.includes('hi')` matched inside words like "high" and "this",
  //      hijacking real questions (e.g. "Why is my impulse score HIGH?")
  //      into the generic greeting response.
  //   2. `msg.includes('score')` alone matched ANY question mentioning a
  //      specific score ("discipline score", "impulse score"), so those
  //      always got the generic Wellness answer instead of their own.
  // Both are fixed by trying Discipline/Impulse/Volatility/etc. first, and
  // only falling through to the generic Wellness/score catch-all and the
  // greeting response if nothing more specific matched. Greeting matching
  // also now uses word-boundary regex so "hi" can't match inside "high"
  // or "this".
  const generateBotResponse = (userText: string): string => {
    const msg = userText.toLowerCase();

    const debitTxns = transactions.filter(t => t.type === 'debit');
    const totalSpend = debitTxns.reduce((a, b) => a + b.amount, 0);

    const catTotals: { [key: string]: number } = {};
    debitTxns.forEach(t => { catTotals[t.category || 'Other'] = (catTotals[t.category || 'Other'] || 0) + t.amount; });
    const topCat = Object.keys(catTotals).sort((a, b) => catTotals[b] - catTotals[a])[0] || 'Food';
    const topCatAmount = Math.round(catTotals[topCat] || 0);

    const now = new Date();
    const monthlyDebit = debitTxns.filter(t => t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear()).reduce((a, b) => a + b.amount, 0);
    const monthlyCredit = transactions.filter(t => t.type === 'credit' && t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear()).reduce((a, b) => a + b.amount, 0);
    const savedThisMonth = Math.round(monthlyCredit - monthlyDebit);

    const weekendTxns = debitTxns.filter(t => t.date.getDay() === 0 || t.date.getDay() === 6);
    const weekendSpend = weekendTxns.reduce((a, b) => a + b.amount, 0);

    // 1. Discipline / Improve -- checked BEFORE the generic wellness/score
    // catch-all, so "discipline score" no longer gets swallowed by it.
    if (msg.includes('discipline') || msg.includes('improve')) {
      return `Your Discipline score is ${scores.discipline}/100. To improve it, focus on making your weekly spending more consistent. Avoid weeks where you spend nothing followed by weeks where you splurge. Setting a strict weekly budget helps stabilize this metric.`;
    }
    // 2. Impulse
    if (msg.includes('impulse') || msg.includes('impulsive')) {
      if (scores.impulse > 60) {
        return `Your Impulse Index is ${scores.impulse}/100. This is a bit high. I noticed you have several late-night transactions and same-day clusters. Try the 24-hour rule: wait a day before buying anything non-essential over ₹500.`;
      } else {
        return `Your Impulse Index is ${scores.impulse}/100. You're doing a great job controlling your impulses! Keep logging your 'Worth It' purchases so I can learn more about your habits.`;
      }
    }
    // 3. Volatility -- previously had NO handler at all, even though it's
    // one of the four core scores. Checked here, before the generic catch-all.
    if (msg.includes('volatility') || msg.includes('volatile') || msg.includes('consistent') || msg.includes('consistency')) {
      return `Your Spending Volatility is ${scores.volatility}/100. This measures how much your week-to-week spending swings, rather than your monthly total. ${scores.volatility > 60 ? "Yours swings quite a bit -- try smoothing it out with a fixed weekly amount instead of one big monthly budget." : "Yours is fairly steady, which is a good sign."}`;
    }
    // 4. Persona
    if (msg.includes('persona')) {
      return `Based on your behavioral scores, the app has assigned you a specific Financial Persona (like 'The Midnight Impulser' or 'The Stealth Saver'). Check the top of your Dashboard to see your exact persona and what it means for your habits!`;
    }
    // 5. Unusual / Anomaly
    if (msg.includes('unusual') || msg.includes('anomaly')) {
      const avgAmt = debitTxns.length > 0 ? totalSpend / debitTxns.length : 0;
      const highValueTxns = debitTxns.filter(t => t.amount > avgAmt * 3);
      if (highValueTxns.length > 0) {
        return `Yes, I detected ${highValueTxns.length} transactions that were significantly larger than your average of ₹${Math.round(avgAmt)}. The largest was ₹${Math.round(highValueTxns[0].amount)} at ${highValueTxns[0].merchant}.`;
      }
      return "Good news! I haven't detected any statistically unusual transactions in your history. Your spending seems to be within your normal range.";
    }
    // 6. Saved this month
    if (msg.includes('save this month') || msg.includes('saved this month') || msg.includes('savings')) {
      if (savedThisMonth >= 0) {
        return `So far this month, you have saved ₹${savedThisMonth.toLocaleString('en-IN')} (Income minus Expenses). That's a savings rate of ${Math.round(scores.savingsRate)}%.`;
      } else {
        return `Uh oh! You are currently over budget for this month by ₹${Math.abs(savedThisMonth).toLocaleString('en-IN')}. Time to cut back on non-essential spending.`;
      }
    }
    // 7. Top Category
    if (msg.includes('category') || msg.includes('spend') || msg.includes('food') || msg.includes('shopping')) {
      return `Looking at your debits, your top spending category is ${topCat}. You've spent approximately ₹${topCatAmount.toLocaleString('en-IN')} there. If you want to save money, cutting back here by just 15% would massively improve your wellness score.`;
    }
    // 8. Weekend
    if (msg.includes('weekend')) {
      const pct = totalSpend > 0 ? Math.round((weekendSpend / totalSpend) * 100) : 0;
      if (pct > 40) {
        return `Yes, you tend to overspend on weekends. ${pct}% of your total spending happens on Saturday and Sunday. Try setting a strict 'weekend cash envelope'—withdraw ₹2000 on Friday and don't use your card for the weekend.`;
      }
      return `Your weekend spending looks fairly balanced. Only ${pct}% of your total spend happens on weekends, which means you distribute your purchases well throughout the week.`;
    }
    // 9. Tip / Advice -- FIX: previously only matched "tip" or "advice",
    // so the suggested question "How can I save money?" matched NOTHING
    // and silently fell through to the generic fallback. Added a
    // dedicated "save money" / "how...save" match.
    if (msg.includes('tip') || msg.includes('advice') || msg.includes('save money') || (msg.includes('how') && msg.includes('save'))) {
      return "Here is a pro tip: Automate your savings. The moment your salary hits your account, transfer 20% to a separate account you can't easily access. You can't spend what you don't see!";
    }
    // 10. Wellness -- generic catch-all, now checked AFTER all the
    // specific metrics above, so it only fires for genuinely general
    // questions like "how am I doing" or "what's my score" with no other
    // specific metric named.
    if (msg.includes('wellness') || msg.includes('score')) {
      return `Your Financial Wellness Score is ${scores.wellness}/100. This is a composite score based on your discipline, impulse control, and spending volatility. ${scores.wellness >= 70 ? "You're doing great!" : "There's room for improvement."}`;
    }
    // 11. Greeting -- moved to run LAST among real intents (right before
    // the fallback), and now uses word-boundary regex instead of raw
    // substring matching, so "hi" can no longer match inside "high" or
    // "this". Real questions get a real answer first; only a genuine
    // greeting with no other recognizable content lands here.
    if (/\b(hi|hello|hey)\b/i.test(userText)) {
      return "Hey there! Ready to decode your money habits? You can ask me about your scores, your spending, or ask for a tip to save money.";
    }

    // Fallback
    return "I can analyze your wellness, impulse index, persona, unusual transactions, or give you savings tips. Try asking one of the suggested questions below!";
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

      {/* Chat List or Empty State */}
      {messages.length === 0 ? (
        <View style={{ flex: 1, paddingHorizontal: 4 }}>
          <View style={styles.emptyStateBubble}>
            <Text style={styles.emptyStateText}>
              Hi! I'm your CentiQ AI Coach. I run 100% offline on your device. Ask me about your wellness score, impulse index, top spending categories, or how to save money!
            </Text>
          </View>
          <Text style={[styles.cardHeaderTitle, { marginTop: 20, marginBottom: 12 }]}>SUGGESTED QUESTIONS</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <TouchableOpacity key={i} style={styles.suggestedChip} onPress={() => sendMessage(q)}>
                <Text style={styles.suggestedChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
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
      )}

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
  cardHeaderTitle: { color: C.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

  // Empty State
  emptyStateBubble: {
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.border, borderRadius: 18, borderBottomLeftRadius: 4,
    padding: 16, maxWidth: '90%',
  },
  emptyStateText: { color: C.textPrimary, fontSize: 14, lineHeight: 21 },
  suggestedChip: {
    borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)', backgroundColor: 'rgba(56,189,248,0.08)',
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 10, alignSelf: 'flex-start',
  },
  suggestedChipText: { color: C.accent, fontSize: 13 },

  // Messages
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