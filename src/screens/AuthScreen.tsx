import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const C = {
  bg: "#060608", glass: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)",
  glassHighlight: "rgba(255,255,255,0.2)", textPrimary: "#FFFFFF", textSecondary: "#A0A0B0", accent: "#38BDF8"
};

const Typography = {
  fontFamilyRegular: 'lato_regular',
  fontFamilyMedium: 'lato_regular',
  fontFamilyBold: 'lato_bold',
};

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      // Instantly creates a real user in Supabase without email/password
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Background Ambient Orbs for depth */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>Centi<Text style={{ color: C.accent }}>Q</Text></Text>
        </View>

        <Text style={styles.title}>Understand your money habits.</Text>
        <Text style={styles.subtext}>
          Not just where you spend, but why. Connect your SMS to unlock your behavioral profile, train your personal AI, and stop impulsive spending.
        </Text>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#001018" />
          ) : (
            <Text style={styles.buttonText}>Get Started →</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.privacyText}>
          🔒 100% Private. Your SMS data is parsed locally on your device.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', paddingHorizontal: 24 },

  // Ambient Orbs
  orb1: {
    position: 'absolute', top: -100, left: -100, width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(56,189,248,0.08)'
  },
  orb2: {
    position: 'absolute', bottom: -80, right: -80, width: 250, height: 250, borderRadius: 125,
    backgroundColor: 'rgba(139,92,246,0.06)'
  },

  content: {
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.border, borderTopColor: C.glassHighlight,
    borderRadius: 32, padding: 32,
    shadowColor: "#000", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.4, shadowRadius: 32, elevation: 12
  },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logo: { color: C.textPrimary, fontSize: 48, fontWeight: '900', letterSpacing: -1, fontFamily: Typography.fontFamilyBold },

  title: { color: C.textPrimary, fontSize: 26, fontWeight: '800', marginBottom: 12, letterSpacing: -0.5, textAlign: 'center', fontFamily: Typography.fontFamilyBold },
  subtext: { color: C.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 32, textAlign: 'center', fontFamily: Typography.fontFamilyRegular },

  button: {
    backgroundColor: C.accent, paddingVertical: 16, borderRadius: 16, alignItems: 'center',
    shadowColor: C.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8
  },
  buttonText: { color: '#001018', fontSize: 16, fontWeight: '800', fontFamily: Typography.fontFamilyBold },

  privacyText: { color: C.textSecondary, fontSize: 12, marginTop: 20, textAlign: 'center', fontFamily: Typography.fontFamilyRegular }
});