import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { signIn, signUp } from '../lib/firebase';
import Logo from '../assets/logo.svg';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (isLogin: boolean) => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (e: any) {
      Alert.alert("Authentication Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Logo width={80} height={80} />
      <Text style={styles.subtitle}>Know why you spend, not just where.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={() => handleAuth(true)} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Log In</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkButton} onPress={() => handleAuth(false)} disabled={loading}>
        <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060608', justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 42, fontWeight: '800', color: '#38BDF8', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#A0A0B0', marginBottom: 40 },
  input: { width: '100%', height: 50, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 16, color: '#FFF', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  button: { width: '100%', height: 50, backgroundColor: '#38BDF8', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  linkButton: { padding: 10 },
  linkText: { color: '#A0A0B0', fontSize: 14 }
});