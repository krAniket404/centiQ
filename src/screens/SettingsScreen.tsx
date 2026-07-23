import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { NativeModules } from 'react-native';

const { SmsModule } = NativeModules;
const C = {
  bg: "#080808", glass: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.13)",
  textPrimary: "#FFFFFF", textSecondary: "#B8B8B8", accent: "#38BDF8", success: "#10B981", danger: "#EF4444"
};

interface Props {
  mode: 'strict' | 'liberal' | null;
  setMode: (mode: 'strict' | 'liberal') => void;
  resetAppData: () => void;
  userLabels: any[];
}

export default function SettingsScreen({ mode, setMode, resetAppData, userLabels }: Props) {
  const handleClearData = () => {
    Alert.alert(
      "Clear App Data",
      "Are you sure you want to wipe your local ML model and settings? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: () => resetAppData() }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Settings</Text>

      {/* Profile Card */}
      <View style={[styles.glassCard, { padding: 20, marginBottom: 16 }]}>
        <Text style={styles.cardHeaderTitle}>PROFILE</Text>
        <View style={styles.profileRow}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>C</Text>
          </View>
          <View>
            <Text style={styles.profileName}>CentiQ User</Text>
            <Text style={styles.profileMeta}>{userLabels.length} ML decisions logged</Text>
          </View>
        </View>
      </View>

      {/* Scoring Mode Card */}
      <View style={[styles.glassCard, { padding: 20, marginBottom: 16 }]}>
        <Text style={styles.cardHeaderTitle}>SCORING MODE</Text>
        <Text style={styles.subtext}>Switch between judgmental and forgiving behavioral analysis.</Text>

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'strict' && styles.modeButtonActive]}
            onPress={() => setMode('strict')}
          >
            <Text style={[styles.modeButtonText, mode === 'strict' && styles.modeButtonTextActive]}>Strict</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeButton, mode === 'liberal' && styles.modeButtonActive]}
            onPress={() => setMode('liberal')}
          >
            <Text style={[styles.modeButtonText, mode === 'liberal' && styles.modeButtonTextActive]}>Liberal</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Data Management Card */}
      <View style={[styles.glassCard, { padding: 20 }]}>
        <Text style={styles.cardHeaderTitle}>DATA & PRIVACY</Text>
        <Text style={styles.subtext}>Your SMS data is parsed locally on your device. Cloud sync only stores parsed amounts and merchants.</Text>

        <TouchableOpacity style={styles.dangerButton} onPress={handleClearData}>
          <Text style={styles.dangerButtonText}>Clear Local App Data</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: 20 },
  headerTitle: { color: C.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 16 },
  glassCard: { backgroundColor: C.glass, borderColor: C.border, borderWidth: 1, borderRadius: 20 },
  cardHeaderTitle: { color: C.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12 },
  subtext: { color: C.textSecondary, fontSize: 12, marginBottom: 16, lineHeight: 18 },

  // Profile
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatarBox: { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: C.accent, justifyContent: 'center', alignItems: 'center', marginRight: 12, backgroundColor: `${C.accent}18` },
  avatarText: { color: C.accent, fontSize: 18, fontWeight: 'bold' },
  profileName: { color: C.textPrimary, fontSize: 16, fontWeight: '600' },
  profileMeta: { color: C.textSecondary, fontSize: 12, marginTop: 2 },

  // Mode Toggle
  modeRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4 },
  modeButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  modeButtonActive: { backgroundColor: C.accent },
  modeButtonText: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },
  modeButtonTextActive: { color: '#001018', fontWeight: 'bold' },

  // Danger Zone
  dangerButton: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  dangerButtonText: { color: C.danger, fontSize: 14, fontWeight: 'bold' }
});