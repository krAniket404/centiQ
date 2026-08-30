import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Share, Dimensions, Animated, Pressable } from 'react-native';
import AnimatedNumber from './AnimatedNumber';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Theme } from '../theme/themes';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  scores: { wellness: number; discipline: number; impulse: number; volatility: number };
  wrapData: { totalSpend: number; topCat: string; biggestImpulse: any; persona: { name: string; icon: string; color: string; desc: string } };
  wellnessColor: string;
  theme: Theme;
}

export default function MonthlyWrapModal({ visible, onClose, scores, wrapData, wellnessColor, theme }: Props) {
  const [activeSlide, setActiveSlide] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const C = theme;

  const SLIDES = [
    { type: 'welcome', title: 'Your Month in Review', subtitle: 'Let\'s see how you did.' },
    { type: 'wellness', title: 'Financial Wellness', value: scores.wellness, label: 'SCORE' },
    { type: 'persona', title: 'The Identity', name: wrapData.persona.name, icon: wrapData.persona.icon, color: wrapData.persona.color },
    { type: 'insights', title: 'Top Spending', category: wrapData.topCat, amount: wrapData.totalSpend },
    { type: 'victory', title: 'Biggest Impulse', merchant: wrapData.biggestImpulse?.merchant, amount: wrapData.biggestImpulse?.amount }
  ];

  useEffect(() => {
    if (visible) {
      startProgress();
    } else {
      setActiveSlide(0);
      progressAnim.setValue(0);
    }
  }, [visible, activeSlide]);

  const startProgress = () => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false
    }).start(({ finished }) => {
      if (finished) {
        nextSlide();
      }
    });
  };

  const nextSlide = () => {
    if (activeSlide < SLIDES.length - 1) {
      setActiveSlide(activeSlide + 1);
    } else {
      onClose();
    }
  };

  const prevSlide = () => {
    if (activeSlide > 0) {
      setActiveSlide(activeSlide - 1);
    }
  };

  const handlePress = (evt: any) => {
    const x = evt.nativeEvent.locationX;
    if (x < width / 3) {
      prevSlide();
    } else {
      nextSlide();
    }
  };

  if (!visible) return null;

  const renderSlide = () => {
    const slide = SLIDES[activeSlide];

    switch (slide.type) {
      case 'welcome':
        return (
          <View style={styles.slideContent}>
            <Icon name="medal-outline" size={80} color={C.accent} style={{ marginBottom: 20 }} />
            <Text style={[styles.title, { color: C.textPrimary }]}>{slide.title}</Text>
            <Text style={[styles.subtitle, { color: C.textSecondary }]}>{slide.subtitle}</Text>
          </View>
        );
      case 'wellness':
        return (
          <View style={styles.slideContent}>
            <Text style={[styles.slideLabel, { color: C.textSecondary }]}>{slide.title}</Text>
            <Text style={[styles.giantValue, { color: wellnessColor }]}>{slide.value}</Text>
            <Text style={[styles.subtitle, { color: C.textSecondary }]}>You're performing better than 82% of users.</Text>
          </View>
        );
      case 'persona':
        return (
          <View style={styles.slideContent}>
            <View style={[styles.iconBox, { backgroundColor: `${slide.color}20`, borderColor: slide.color }]}>
                <Icon name={slide.icon as string} size={60} color={slide.color as string} />
            </View>
            <Text style={[styles.slideLabel, { color: C.textSecondary }]}>FINANCIAL PERSONA</Text>
            <Text style={[styles.title, { color: slide.color as string }]}>{slide.name}</Text>
            <Text style={[styles.subtitle, { color: C.textSecondary, textAlign: 'center' }]}>{wrapData.persona.desc}</Text>
          </View>
        );
      case 'insights':
        return (
          <View style={styles.slideContent}>
            <Text style={[styles.slideLabel, { color: C.textSecondary }]}>TOTAL SPENT</Text>
            <Text style={[styles.giantValue, { color: C.accent, fontSize: 48 }]}>₹{Math.round(slide.amount as number).toLocaleString('en-IN')}</Text>
            <View style={{ marginTop: 40, alignItems: 'center' }}>
                <Text style={[styles.slideLabel, { color: C.textSecondary }]}>TOP CATEGORY</Text>
                <Text style={[styles.title, { color: C.textPrimary }]}>{slide.category}</Text>
            </View>
          </View>
        );
      case 'victory':
        return (
          <View style={styles.slideContent}>
            {slide.merchant ? (
                <>
                    <Icon name="flash-alert" size={80} color={C.danger} style={{ marginBottom: 20 }} />
                    <Text style={[styles.slideLabel, { color: C.textSecondary }]}>BIGGEST IMPULSE</Text>
                    <Text style={[styles.title, { color: C.textPrimary, textAlign: 'center' }]}>{slide.merchant}</Text>
                    <Text style={[styles.giantValue, { color: C.danger, fontSize: 32, marginTop: 10 }]}>₹{Math.round(slide.amount as number).toLocaleString('en-IN')}</Text>
                </>
            ) : (
                <>
                    <Icon name="shield-check-outline" size={80} color={C.success} style={{ marginBottom: 20 }} />
                    <Text style={[styles.title, { color: C.success }]}>Unstoppable Discipline</Text>
                    <Text style={[styles.subtitle, { color: C.textSecondary }]}>No major impulsive spending detected this month!</Text>
                </>
            )}
            <TouchableOpacity
                style={[styles.shareBtn, { backgroundColor: C.accent }]}
                onPress={() => {
                  const shareMessage = `I just unlocked my CentiQ Monthly Wrap! 🚀\n\n💰 Wellness Score: ${scores.wellness}/100\n👤 Identity: ${wrapData.persona.name}\n💸 Total Spent: ₹${Math.round(wrapData.totalSpend).toLocaleString('en-IN')}\n🎯 Top Category: ${wrapData.topCat}\n\nTrack your money behavior with CentiQ!`;
                  Share.share({ message: shareMessage });
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon name="share-variant" size={20} color="#FFF" style={{ marginRight: 10 }} />
                    <Text style={{ color: '#FFF', fontWeight: '800' }}>Share Result</Text>
                </View>
            </TouchableOpacity>
          </View>
        );
      default: return null;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={[styles.container, { backgroundColor: C.bg }]} onPress={handlePress}>
        {/* Progress Bars */}
        <View style={styles.progressContainer}>
          {SLIDES.map((_, i) => (
            <View key={i} style={styles.progressBarBg}>
              <Animated.View
                style={[
                    styles.progressBarFill,
                    {
                        backgroundColor: C.accent,
                        width: i < activeSlide ? '100%' : i === activeSlide ? progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '0%'
                    }
                ]}
              />
            </View>
          ))}
        </View>

        {/* Close Button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Icon name="close" size={28} color="#FFF" />
        </TouchableOpacity>

        {renderSlide()}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 60 },
  progressContainer: { flexDirection: 'row', gap: 6, marginBottom: 40 },
  progressBarBg: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%' },
  closeBtn: { alignSelf: 'flex-end', padding: 10 },
  slideContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  slideLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5, marginBottom: 12 },
  subtitle: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  giantValue: { fontSize: 80, fontWeight: '900' },
  iconBox: { width: 120, height: 120, borderRadius: 30, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  shareBtn: { marginTop: 40, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16 }
});
