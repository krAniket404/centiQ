import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

const C = {
  bg: "#080808", glass: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.13)",
  textPrimary: "#FFFFFF", textSecondary: "#B8B8B8", accent: "#38BDF8", success: "#10B981", danger: "#EF4444"
};

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    setLoading(true);

    try {
      if (isLogin) {
        // LOGIN
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Success! App will automatically switch to dashboard.
      } else {
        // SIGN UP
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // If Supabase instantly returns a session, great!
        if (data.session) {
          // Success!
        } else {
          // Fallback: Force login immediately just to be 100% sure
          const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) {
            // If force login fails (e.g. they DID have email confirm on), show this:
            Alert.alert('Almost there!', 'Account created. Please log in with your credentials.');
            setIsLogin(true); // Switch to login screen
          }
        }
      }
    } catch (error: any) {
      Alert.alert('Authentication Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Centi<Text style={{color: C.accent}}>Q</Text></Text>
      <Text style={styles.title}>{isLogin ? "Welcome back" : "Create account"}</Text>
      <Text style={styles.subtext}>{isLogin ? "Sign in to sync your financial OS" : "Start your behavioral finance journey"}</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor="#555"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#555"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#001018" />
        ) : (
          <Text style={styles.buttonText}>{isLogin ? "Sign in →" : "Create account →"}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={{ marginTop: 24 }}>
        <Text style={styles.switchText}>
          {isLogin ? "New here? " : "Already have an account? "}
          <Text style={{color: C.accent, fontWeight: 'bold'}}>{isLogin ? "Sign up" : "Sign in"}</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', paddingHorizontal: 24 },
  logo: { color: C.textPrimary, fontSize: 42, fontWeight: 'bold', marginBottom: 40, textAlign: 'center' },
  title: { color: C.textPrimary, fontSize: 26, fontWeight: 'bold', marginBottom: 8 },
  subtext: { color: C.textSecondary, fontSize: 14, marginBottom: 32 },
  inputContainer: { marginBottom: 20 },
  label: { color: C.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: C.glass, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: C.textPrimary, fontSize: 15 },
  button: { backgroundColor: C.accent, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#001018', fontSize: 16, fontWeight: 'bold' },
  switchText: { color: C.textSecondary, fontSize: 14, textAlign: 'center' }
});