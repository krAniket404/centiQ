import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

const C = {
  bg: "#080808", glass: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)",
  textPrimary: "#FFFFFF", textSecondary: "#8A8E93", accent: "#38BDF8"
};

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      // This instantly creates a real user in Supabase without email/password
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      // The app will automatically detect the session and go to the Dashboard!
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logo}>Centi<Text style={{ color: C.accent }}>Q</Text></Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Understand your money habits.</Text>
        <Text style={styles.subtext}>Not just where you spend, but why. Connect your SMS to unlock your behavioral profile.</Text>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#001018" />
          ) : (
            <Text style={styles.buttonText}>Get Started →</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', paddingHorizontal: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logo: { color: C.textPrimary, fontSize: 42, fontWeight: '900' },
  content: { backgroundColor: C.glass, borderWidth: 1, borderColor: C.border, borderRadius: 24, padding: 28 },
  title: { color: C.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 12, letterSpacing: -0.3 },
  subtext: { color: C.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 32 },
  button: { backgroundColor: C.accent, paddingVertical: 16, borderRadius: 14, alignItems: 'center', shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  buttonText: { color: '#001018', fontSize: 16, fontWeight: '800' }
});