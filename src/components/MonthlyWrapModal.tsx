import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Share } from 'react-native';
import AnimatedNumber from './AnimatedNumber';

const C = {
  glass: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.12)", glassHighlight: "rgba(255,255,255,0.2)",
  textPrimary: "#FFFFFF", textSecondary: "#A0A0B0", accent: "#38BDF8", danger: "#EF4444"
};

const Typography = {
  fontFamilyRegular: 'lato_regular',
  fontFamilyMedium: 'lato_regular',
  fontFamilyBold: 'lato_bold',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  scores: { wellness: number };
  wrapData: { totalSpend: number; topCat: string; biggestImpulse: any; persona: { name: string } };
  wellnessColor: string;
}

export default function MonthlyWrapModal({ visible, onClose, scores, wrapData, wellnessColor }: Props) {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.96)' }]}>
        <View style={[styles.card, { padding: 28, width: '100%' }]}>

          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>📊</Text>
            <Text style={[styles.title, { marginBottom: 4 }]}>Monthly Wrap</Text>
            <Text style={styles.subtitle}>A snapshot of your spending behavior.</Text>
          </View>

          <View style={{ alignItems: 'center', marginBottom: 20, paddingVertical: 20, backgroundColor: 'rgba(56,189,248,0.05)', borderRadius: 20, width: '100%' }}>
            <Text style={{ color: C.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, fontFamily: Typography.fontFamilyBold }}>WELLNESS SCORE</Text>
            <Text style={{ color: wellnessColor, fontSize: 48, fontWeight: '900', fontFamily: Typography.fontFamilyBold }}>
              {scores.wellness}<Text style={{ fontSize: 20, color: C.textSecondary }}> /100</Text>
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: `${C.accent}10`, padding: 16, borderRadius: 16, marginBottom: 16, width: '100%' }}>
            <Text style={{ fontSize: 24, marginRight: 14 }}>🎭</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 2, fontFamily: Typography.fontFamilyBold }}>FINANCIAL PERSONA</Text>
              <Text style={{ color: C.accent, fontSize: 16, fontWeight: '800', fontFamily: Typography.fontFamilyBold }}>{wrapData.persona.name}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 16 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', padding: 16, borderRadius: 16, flex: 1, marginRight: 8 }}>
              <Text style={{ color: C.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6, fontFamily: Typography.fontFamilyBold }}>TOTAL SPENT</Text>
              <AnimatedNumber value={Math.round(wrapData.totalSpend)} duration={1500} style={{ color: C.textPrimary, fontSize: 18, fontWeight: '800', fontFamily: Typography.fontFamilyBold }} prefix="₹" />
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', padding: 16, borderRadius: 16, flex: 1, marginLeft: 8 }}>
              <Text style={{ color: C.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6, fontFamily: Typography.fontFamilyBold }}>TOP CATEGORY</Text>
              <Text style={{ color: C.textPrimary, fontSize: 18, fontWeight: '800', fontFamily: Typography.fontFamilyBold }}>{wrapData.topCat}</Text>
            </View>
          </View>

          {wrapData.biggestImpulse && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.08)', padding: 16, borderRadius: 16, width: '100%', marginBottom: 24 }}>
              <Text style={{ fontSize: 24, marginRight: 14 }}>🔥</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.danger, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 2, fontFamily: Typography.fontFamilyBold }}>BIGGEST IMPULSE</Text>
                <Text style={{ color: C.textPrimary, fontSize: 15, fontWeight: '700', fontFamily: Typography.fontFamilyBold }} numberOfLines={1}>
                  {wrapData.biggestImpulse.merchant}
                </Text>
                <Text style={{ color: C.textSecondary, fontSize: 12, marginTop: 2, fontFamily: Typography.fontFamilyRegular }}>₹{Math.round(wrapData.biggestImpulse.amount).toLocaleString('en-IN')}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, { marginBottom: 12 }]}
            onPress={async () => {
              await Share.share({
                message: `My CentiQ Monthly Wrap!\nWellness: ${scores.wellness}/100\nPersona: ${wrapData.persona.name}\nTotal Spent: ₹${Math.round(wrapData.totalSpend).toLocaleString('en-IN')}\nTop Category: ${wrapData.topCat}\n\nDecode your spending behavior with CentiQ.`
              });
            }}
          >
            <Text style={styles.buttonText}>Share to Instagram / WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ padding: 10, alignItems: 'center' }}
            onPress={onClose}
          >
            <Text style={{ color: C.textSecondary, fontSize: 14, fontWeight: '600', fontFamily: Typography.fontFamilyMedium }}>Close</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.border, borderTopColor: C.glassHighlight,
    borderRadius: 32, alignItems: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.4, shadowRadius: 32, elevation: 12
  },
  title: { color: C.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.3, fontFamily: Typography.fontFamilyBold },
  subtitle: { color: C.textSecondary, fontSize: 13, marginBottom: 24, textAlign: 'center', fontFamily: Typography.fontFamilyRegular },
  button: {
    backgroundColor: C.accent, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16, width: '100%', alignItems: 'center',
    shadowColor: C.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8
  },
  buttonText: { color: '#001018', fontSize: 16, fontWeight: '800', fontFamily: Typography.fontFamilyBold }
});