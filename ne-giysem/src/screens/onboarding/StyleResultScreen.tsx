import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList, StyleEntry } from '../../navigation/types';
import { useUserStore } from '../../store/useUserStore';
import type { UserState } from '../../store/useUserStore';
import { supabase } from '../../lib/supabase';
import { colors, fonts } from '../../constants/theme';
import { STYLE_DATA_MAP } from '../../constants/styles';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'StyleResult'>;

const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

// Seçili stillerin paletlerini ağırlık sırasına göre birleştir, max 5 unique renk
function buildPalette(entries: StyleEntry[]): string[] {
  const seen   = new Set<string>();
  const result: string[] = [];
  for (const entry of entries) {
    const data = STYLE_DATA_MAP[entry.name];
    if (!data) continue;
    for (const hex of data.palette) {
      const key = hex.toLowerCase();
      if (!seen.has(key) && result.length < 5) {
        seen.add(key);
        result.push(hex);
      }
    }
  }
  return result;
}

async function fetchDnaFromClaude(
  entries: StyleEntry[],
): Promise<{ dnaName: string; traits: string[] }> {
  if (!API_KEY) throw new Error('API key eksik');

  const profileLine = entries
    .map((e) => `${e.name} (%${e.weight})`)
    .join(' · ');

  const prompt = `Kullanıcının stil profili: ${profileLine}

Şunları döndür (sadece JSON, başka metin yazma):
{
  "dnaName": "2-3 kelimelik şık İngilizce isim — tek stil için o stili temsil eden, çoklu için kombinasyonu temsil eden",
  "traits": ["4 adet kısa Türkçe stil özelliği"]
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 128,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();
  const text: string = (json as any)?.content?.[0]?.text ?? '';
  if (!text) throw new Error('Boş yanıt');

  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const raw   = JSON.parse(clean);

  return {
    dnaName: typeof raw.dnaName === 'string' ? raw.dnaName : '',
    traits: Array.isArray(raw.traits)
      ? (raw.traits as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 4)
      : [],
  };
}

export default function StyleResultScreen({ route }: Props) {
  const { selectedStyles } = route.params;
  const setOnboarded    = useUserStore((s: UserState) => s.setOnboarded);
  const setStyleProfile = useUserStore((s: UserState) => s.setStyleProfile);
  const user            = useUserStore((s: UserState) => s.user);

  const primary = selectedStyles[0];
  const palette = buildPalette(selectedStyles);

  const [dnaName,   setDnaName]   = useState<string>('');
  const [traits,    setTraits]    = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(true);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchDnaFromClaude(selectedStyles)
      .then(({ dnaName: name, traits: t }) => {
        if (cancelled) return;
        setDnaName(name || primary.name);
        setTraits(t);
      })
      .catch(() => {
        if (!cancelled) setDnaName(primary.name);
      })
      .finally(() => { if (!cancelled) setAiLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const breakdown = selectedStyles
    .map((s: StyleEntry) => `%${s.weight} ${s.name}`)
    .join(' · ');

  const handleStart = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('style_profiles')
      .upsert(
        { user_id: user.id, styles: selectedStyles, color_palette: {} },
        { onConflict: 'user_id' },
      );
    if (error) {
      Alert.alert('Hata', 'Stil profili kaydedilemedi. Lütfen tekrar dene.');
      setSaving(false);
      return;
    }
    setStyleProfile({ styles: selectedStyles, colorPalette: palette });
    setOnboarded(true);
  };

  const handleShare = async () => {
    await Share.share({
      message: `Stil DNA'm: ${dnaName || primary.name} (${breakdown}) — Ne Giysem? ile keşfettim! 👗`,
    });
  };

  return (
    <LinearGradient colors={['#1A1A2E', '#0F3460', '#1A1A2E']} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <Text style={styles.badge}>STİL DNA KARTIN</Text>

        {/* Kart */}
        <View style={styles.card}>
          {/* DNA İsmi */}
          {aiLoading ? (
            <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" style={styles.nameSpinner} />
          ) : (
            <Text style={styles.dnaName}>{dnaName}</Text>
          )}

          <Text style={styles.breakdown}>{breakdown}</Text>

          {/* Renk paleti */}
          <View style={styles.paletteRow}>
            {palette.map((hex, i) => (
              <View key={i} style={[styles.paletteCircle, { backgroundColor: hex }]} />
            ))}
          </View>
          <Text style={styles.paletteLabel}>RENK PALETİN</Text>

          {/* Trait tag'ler */}
          {!aiLoading && traits.length > 0 && (
            <View style={styles.traitsWrap}>
              {traits.map((t: string) => (
                <View key={t} style={styles.traitTag}>
                  <Text style={styles.traitText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
          {aiLoading && (
            <View style={styles.traitsPlaceholder}>
              <ActivityIndicator color="rgba(255,255,255,0.4)" size="small" />
            </View>
          )}
        </View>

        {/* Aksiyonlar */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleStart}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Dolabımı Oluştur →</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.75}>
            <Text style={styles.shareBtnText}>🤍  Paylaş</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  badge: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
    minHeight: 240,
  },
  nameSpinner: {
    marginBottom: 12,
    marginTop: 4,
    height: 34,
  },
  dnaName: {
    fontSize: 28,
    fontFamily: fonts.headingBold,
    color: colors.white,
    marginBottom: 8,
    textAlign: 'center',
  },
  breakdown: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 24,
    textAlign: 'center',
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  paletteCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  paletteLabel: {
    fontSize: 10,
    fontFamily: fonts.bodyMedium,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  traitsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  traitTag: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  traitText: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: 'rgba(255,255,255,0.75)',
  },
  traitsPlaceholder: {
    height: 32,
    justifyContent: 'center',
  },
  actions: {
    gap: 12,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 12px rgba(233,69,96,0.35)',
    elevation: 6,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  shareBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: 'rgba(255,255,255,0.5)',
  },
});
