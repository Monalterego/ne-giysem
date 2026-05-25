import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../constants/theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'StyleChoice'>;

const PATHS = [
  {
    icon: '🎯',
    title: 'Tarzımı Biliyorum',
    description: 'Stil kategorilerinden direkt seçim yap',
    accentColor: colors.accent,
    route: 'StyleSelect' as const,
  },
  {
    icon: '🧩',
    title: 'Keşfetmek İstiyorum',
    description: 'Quiz ile tarzını bul, 8 soruda profilini çıkar',
    accentColor: colors.secondary,
    route: 'StyleQuiz' as const,
  },
  {
    icon: '✨',
    title: 'İlham Ver',
    description: 'Görselleri beğen/geç — 15 swipe ile stil DNA\'n hazır',
    accentColor: '#6C5CE7',
    route: 'StyleExplore' as const,
  },
];

export default function StyleChoiceScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Stilini Tanıyalım</Text>
          <Text style={styles.subtitle}>Sana en uygun yolu seç</Text>
        </View>

        {/* Path cards */}
        {PATHS.map((path, index) => (
          <TouchableOpacity
            key={index}
            style={styles.card}
            onPress={() => navigation.navigate(path.route)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconBox, { backgroundColor: `${path.accentColor}14` }]}>
              <Text style={styles.iconText}>{path.icon}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{path.title}</Text>
              <Text style={styles.cardDesc}>{path.description}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Footer hint */}
        <Text style={styles.hint}>
          Her üç yol da aynı çıktıyı üretir → Stil DNA Kartın
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.headingBold,
    color: colors.primary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 14,
    backgroundColor: colors.white,
    boxShadow: '0 2px 8px rgba(26,26,46,0.04)',
    elevation: 2,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  iconText: {
    fontSize: 24,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.muted,
    lineHeight: 18,
  },
  chevron: {
    fontSize: 22,
    color: '#CCCCCC',
    marginLeft: 8,
  },
  hint: {
    marginTop: 16,
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#BBBBBB',
    textAlign: 'center',
    lineHeight: 18,
  },
});
