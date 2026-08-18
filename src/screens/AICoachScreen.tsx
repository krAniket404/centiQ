import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, NativeModules, ScrollView, Modal } from 'react-native';
import { ParsedTransaction } from '../lib/smsParser';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { SmsModule } = NativeModules;
const SESSIONS_STORAGE_KEY = 'centiq_chat_sessions_v2'; // New key to reset old chats

const C = {
  bg: "#080808", glass: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)",
  textPrimary: "#FFFFFF", textSecondary: "#B8B8B8", accent: "#38BDF8", success: "#10B981", warning: "#F59E0B", danger: "#EF4444"
};

interface Message { role: 'user' | 'assistant'; content: string; }
interface ChatSession { id: string; title: string; messages: Message[]; updatedAt: number; }
interface Props {
  transactions: ParsedTransaction[];
  scores: { discipline: number; impulse: number; volatility: number; wellness: number; savingsRate: number };
}

const SUGGESTED_QUESTIONS = [
  { text: "Roast my spending habits", icon: "fire" },
  { text: "Why is my impulse score high?", icon: "flash-outline" },
  { text: "Give me a harsh saving tip", icon: "piggy-bank-outline" },
  { text: "What is my financial persona?", icon: "incognito" },
  { text: "How much did I waste on food?", icon: "food-apple-outline" },
  { text: "Tell me a finance joke", icon: "emoticon-lol-outline" }
];

// PASTE YOUR GEMINI API KEY HERE
const API_KEY = 'GEMINI_API_HERE';

export default function AICoachScreen({ transactions, scores }: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const raw = await SmsModule.loadData(SESSIONS_STORAGE_KEY);
        if (raw) setSessions(JSON.parse(raw));
      } catch (e) {} finally { setIsFetchingData(false); }
    };
    loadSessions();
  }, []);

  useEffect(() => {
    if (sessions.length > 0) SmsModule.saveData(SESSIONS_STORAGE_KEY, JSON.stringify(sessions)).catch(() => {});
  }, [sessions]);

  const startNewChat = () => { setActiveSessionId(null); setMessages([]); setShowHistory(false); };
  const openChat = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) { setActiveSessionId(id); setMessages(session.messages); setShowHistory(false); }
  };
  const deleteChat = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) startNewChat();
  };

  // 1. Fast Local Brain (Funny & Sarcastic)
  const getLocalResponse = (userText: string): string | null => {
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

    if (msg.includes('roast')) return `Your spending habits? Let's just say your wallet is crying right now. You dropped ₹${Math.round(totalSpend).toLocaleString('en-IN')} overall. Your favorite hobby seems to be making ${topCat} richer by ₹${topCatAmount.toLocaleString('en-IN')}. Stop swiping your card like it's a magic wand! 🔥`;
    if (msg.includes('discipline') || msg.includes('improve')) return `Your Discipline score is ${scores.discipline}/100. To improve it, stop pretending you "need" another hoodie. Try making your weekly spending consistent instead of splurging every payday like a monarch on payday. 👑`;
    if (msg.includes('impulse') || msg.includes('impulsive')) {
      if (scores.impulse > 60) return `Your Impulse Index is ${scores.impulse}/100. High. Did you buy a samosa at 2 AM again? I see you. Try the 24-hour rule: wait a day before buying anything non-essential over ₹500. Your future self will thank you. 🛑`;
      return `Your Impulse Index is ${scores.impulse}/100. Surprisingly decent. Did someone steal your phone? Keep logging those 'Worth It' purchases so I know you're still human.`;
    }
    if (msg.includes('volatility')) return `Your Spending Volatility is ${scores.volatility}/100. This measures how wildly your spending swings. ${scores.volatility > 60 ? "Yours swings more than a pendulum. Calm down." : "Yours is steady. Boring, but good for your bank account."} 📉`;
    if (msg.includes('persona')) return `Based on your data, you've been assigned a Financial Persona. Check the top of your Dashboard to see if you're a 'Midnight Impulser' or a 'Stealth Saver'. Spoiler: you're probably the impulsive one. 🎭`;
    if (msg.includes('unusual') || msg.includes('anomaly')) {
      const avgAmt = debitTxns.length > 0 ? totalSpend / debitTxns.length : 0;
      const highValueTxns = debitTxns.filter(t => t.amount > avgAmt * 3);
      if (highValueTxns.length > 0) return `Yes, I detected ${highValueTxns.length} transactions significantly larger than your average. The largest was ₹${Math.round(highValueTxns[0].amount)}. Did you accidentally buy a Rolex or just forgot you had a budget? ⌚`;
      return "Good news! I haven't detected any statistically unusual transactions. You're consistently broke in a very predictable way. 📊";
    }
    if (msg.includes('save this month') || msg.includes('saved this month') || msg.includes('savings')) {
      if (savedThisMonth >= 0) return `So far this month, you've saved ₹${savedThisMonth.toLocaleString('en-IN')}. That's a savings rate of ${Math.round(scores.savingsRate)}%. Don't spend it all at once on a new keyboard. 💰`;
      return `Uh oh! You are currently over budget for this month by ₹${Math.abs(savedThisMonth).toLocaleString('en-IN')}. Time to embrace the ramen noodle diet. 🍜`;
    }
    if (msg.includes('category') || msg.includes('spend') || msg.includes('food') || msg.includes('shopping')) return `Looking at your debits, your kryptonite is ${topCat}. You've blown approximately ₹${topCatAmount.toLocaleString('en-IN')} there. If you cut back by just 15%, you'd actually have money for retirement. Just saying. 🛍️`;
    if (msg.includes('weekend')) return `You tend to overspend on weekends. Try setting a strict 'weekend cash envelope'. Once the cash is gone, you stay home. No more 2 AM Swiggy sessions. 🛵`;
    if (msg.includes('harsh') || msg.includes('tip') || msg.includes('advice') || msg.includes('save money')) return "Harsh tip? Okay. You don't need another subscription. Cancel Netflix, make your own coffee, and stop buying things you'll use once. Automate your savings so the money disappears before you can spend it on dumb stuff. 💸";
    if (msg.includes('joke')) return "Why did the wallet go to therapy? Because it felt empty inside. Just like yours will if you don't start budgeting. 🤡";
    if (msg.includes('wellness') || msg.includes('score')) return `Your Financial Wellness Score is ${scores.wellness}/100. This is a composite of your discipline, impulse control, and volatility. ${scores.wellness >= 70 ? "Show off." : "Yikes. Let's work on that."}`;
    if (/\b(hi|hello|hey)\b/i.test(userText)) return "Hey there. Ready to face the financial truth? Ask me to roast your spending or check your impulse score. 👋";

    return null; // Fallback to Gemini
  };

  // 2. Gemini AI Brain (For everything else & humor)
  const getGeminiResponse = async (userText: string): Promise<string> => {
    try {
      const prompt = `
        You are a hilarious, slightly sarcastic, but highly intelligent behavioral finance coach.
        The user asked: "${userText}"
        If the question is not about finance, answer it anyway, but find a way to make a joke about their spending habits, saving money, or being broke.
        Keep it under 50 words. Use emojis. Do not use markdown.
      `;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 800 }
        })
      });

      const data = await response.json();
      if (data.candidates && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
      }
      return "My brain short-circuited. Try asking me something else.";
    } catch (e) {
      return "I'm having trouble connecting to my cloud brain. Ask me about your scores instead!";
    }
  };

  const sendMessage = async (textToSend?: string) => {
    const messageText = textToSend || inputText;
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: messageText };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    // Try local brain first
    const localResponse = getLocalResponse(messageText);

    setTimeout(async () => {
      let botResponse = "";

      if (localResponse) {
        botResponse = localResponse;
      } else {
        // Fallback to Gemini for general knowledge/humor
        botResponse = await getGeminiResponse(messageText);
      }

      const aiMessage: Message = { role: 'assistant', content: botResponse };
      const finalMessages = [...newMessages, aiMessage];
      setMessages(finalMessages);
      setIsLoading(false);

      // Save or Update Session
      if (activeSessionId) {
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: finalMessages, updatedAt: Date.now() } : s));
      } else {
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: messageText.substring(0, 30) + (messageText.length > 30 ? '...' : ''),
          messages: finalMessages,
          updatedAt: Date.now()
        };
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
      }
    }, 800);
  };

  useEffect(() => {
    if (flatListRef.current) setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, isLoading]);

  if (isFetchingData) return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={C.accent} size="large" /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1, marginTop: 20 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.iconButton}>
          <Icon name="history" size={22} color={C.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Q Coach</Text>
        <TouchableOpacity onPress={startNewChat} style={styles.iconButton}>
          <Icon name="pencil-plus-outline" size={22} color={C.textSecondary} />
        </TouchableOpacity>
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyStateAvatar}>
            <Icon name="robot-outline" size={40} color={C.accent} />
          </View>
          <Text style={styles.emptyStateTitle}>Meet your Q Coach</Text>
          <Text style={styles.emptyStateText}>Sarcastic, funny, and knows your spending habits better than you do.</Text>

          <View style={styles.suggestionsWrapper}>
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <TouchableOpacity key={i} style={styles.suggestedChip} onPress={() => sendMessage(q.text)}>
                <Icon name={q.icon} size={14} color={C.accent} style={{ marginRight: 6 }} />
                <Text style={styles.suggestedChipText}>{q.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={[styles.messageBubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              <Text style={item.role === 'user' ? styles.userText : styles.aiText}>{item.content}</Text>
            </View>
          )}
        />
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={C.accent} size="small" />
        </View>
      )}

      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Ask me anything..."
          placeholderTextColor={C.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={() => sendMessage()} disabled={isLoading}>
          <Icon name="send" size={18} color="#001018" />
        </TouchableOpacity>
      </View>

      <Modal animationType="slide" transparent={true} visible={showHistory} onRequestClose={() => setShowHistory(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chat History</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)} style={{ padding: 8 }}>
                <Icon name="close" size={22} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
            {sessions.length === 0 ? (
              <Text style={{ color: C.textSecondary, textAlign: 'center', marginTop: 40 }}>No past chats yet.</Text>
            ) : (
              <FlatList
                data={sessions}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.historyRow} onPress={() => openChat(item.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.historyDate}>{new Date(item.updatedAt).toLocaleString()}</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteChat(item.id)}><Text style={styles.deleteText}>Delete</Text></TouchableOpacity>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 },
  iconButton: { padding: 8 },
  headerTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },

  // Empty State
  emptyStateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyStateAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(56,189,248,0.1)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyStateTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyStateText: { color: C.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 30 },

  // Suggestions
  suggestionsWrapper: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  suggestedChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 980, paddingVertical: 10, paddingHorizontal: 14 },
  suggestedChipText: { color: C.textPrimary, fontSize: 13, fontWeight: '600' },
  suggestedChipText: { color: C.accent, fontSize: 13 },
  messageBubble: { maxWidth: '85%', padding: 14, borderRadius: 16, marginBottom: 12, flexShrink: 1 },
  userBubble: { backgroundColor: C.accent, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: C.glass, borderWidth: 1, borderColor: C.border, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  userText: { color: '#001018', fontSize: 14, fontWeight: '500' },
  aiText: { color: C.textPrimary, fontSize: 14, lineHeight: 20 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  loadingText: { color: C.textSecondary, fontSize: 12, marginLeft: 8, fontStyle: 'italic' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.border, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 90 },  input: { flex: 1, color: C.textPrimary, fontSize: 14, maxHeight: 80, paddingVertical: 8 },
  sendButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendText: { color: '#001018', fontSize: 20, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: C.border, paddingTop: 24, paddingBottom: 40, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 20 },
  modalTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '800' },
  closeButton: { color: C.textSecondary, fontSize: 20, fontWeight: 'bold', padding: 8 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', marginHorizontal: 24 },
  historyTitle: { color: C.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  historyDate: { color: C.textSecondary, fontSize: 12 },
  deleteText: { color: C.danger, fontSize: 12, fontWeight: '700' }
});