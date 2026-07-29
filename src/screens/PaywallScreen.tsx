import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

const C = {
  bg: "#080808", glass: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)",
  textPrimary: "#FFFFFF", textSecondary: "#8A8E93", accent: "#38BDF8", success: "#10B981"
};

interface Props {
  onClose: () => void;
  onSubscribe: () => void;
  loading: boolean;
}

export default function PaywallScreen({ onClose, onSubscribe, loading }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Unlock CentiQ Pro</Text>
      <Text style={styles.subtext}>Upgrade to access the AI Coach and unlock Liberal Mode to train your personal Machine Learning model.</Text>

      <View style={styles.featuresContainer}>
        <View style={styles.featureRow}>
          <Text style={styles.checkIcon}>✨</Text>
          <View>
            <Text style={styles.featureTitle}>AI Coach</Text>
            <Text style={styles.featureDesc}>Chat with your offline financial assistant.</Text>
          </View>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.checkIcon}>❤️‍🔥</Text>
          <View>
            <Text style={styles.featureTitle}>Liberal Mode</Text>
            <Text style={styles.featureDesc}>Exclude "Worth It" purchases from your Impulse Score.</Text>
          </View>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.checkIcon}>📊</Text>
          <View>
            <Text style={styles.featureTitle}>Advanced Insights</Text>
            <Text style={styles.featureDesc}>Anomaly detection & ML Impulse probability badges.</Text>
          </View>
        </View>
      </View>

      <View style={styles.priceCard}>
        <Text style={styles.price}>₹99<Text style={styles.pricePeriod}>/month</Text></Text>
        <Text style={styles.trialText}>Start your 7-day free trial. No card required.</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={onSubscribe} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#001018" />
        ) : (
          <Text style={styles.buttonText}>Start Free Trial</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>Maybe later</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 24, paddingTop: 60 },
  headerTitle: { color: C.textPrimary, fontSize: 32, fontWeight: '900', letterSpacing: -0.5, marginBottom: 12 },
  subtext: { color: C.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 40 },
  featuresContainer: { marginBottom: 40 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  checkIcon: { fontSize: 20, marginRight: 16 },
  featureTitle: { color: C.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  featureDesc: { color: C.textSecondary, fontSize: 13, lineHeight: 18 },
  priceCard: { backgroundColor: C.glass, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24 },
  price: { color: C.textPrimary, fontSize: 42, fontWeight: '900' },
  pricePeriod: { color: C.textSecondary, fontSize: 16, fontWeight: '500' },
  trialText: { color: C.success, fontSize: 13, fontWeight: '600', marginTop: 8 },
  button: { backgroundColor: C.accent, paddingVertical: 18, borderRadius: 16, alignItems: 'center', shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  buttonText: { color: '#001018', fontSize: 16, fontWeight: '800' },
  closeButton: { alignItems: 'center', marginTop: 16 },
  closeButtonText: { color: C.textSecondary, fontSize: 14, fontWeight: '600' }
});