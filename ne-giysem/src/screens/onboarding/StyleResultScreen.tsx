import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList, StyleEntry } from '../../navigation/types';
import { useUserStore } from '../../store/useUserStore';
import type { UserState } from '../../store/useUserStore';
import { supabase } from '../../lib/supabase';
import { colors, fonts, typography, spacing, radius, layout } from '../../constants/theme';
import { STYLE_DATA_MAP } from '../../constants/styles';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'StyleResult'>;

const PROXY_URL = 'https://bdvrgbylirftuxmrpbea.supabase.co/functions/v1/anthropic-proxy';

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

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
  const profileLine = entries
    .map((e) => `${e.name} (%${e.weight})`)
    .join(' · ');

  const prompt = `Kullanıcının stil profili: ${profileLine}

Şunları döndür (sadece JSON, başka metin yazma):
{
  "dnaName": "2-3 kelimelik şık İngilizce isim — tek stil için o stili temsil eden, çoklu için kombinasyonu temsil eden",
  "traits": ["4 adet kısa Türkçe stil özelliği"]
}`;

  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
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

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function StyleResultScreen({ route, navigation }: Props) {
  const { selectedStyles } = route.params;
  const setStyleProfile = useUserStore((s: UserState) => s.setStyleProfile);
  const setOnboarded    = useUserStore((s: UserState) => s.setOnboarded);
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
      message: `Stil DNA'm: ${dnaName || primary.name} (${breakdown}) — Sestina ile keşfettim!`,
    });
  };

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe}>

        <Text style={styles.badge}>STİL DNA KARTIN</Text>

        {/* DNA Kartı */}
        <View style={styles.card}>

          {aiLoading ? (
            <ActivityIndicator color="rgba(255,255,255,0.5)" size="small" style={styles.nameSpinner} />
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

          {/* Trait badge'leri */}
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
              ? <ActivityIndicator color={colors.black} />
              : <Text style={styles.primaryBtnText}>Dolabımı Oluştur →</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.75}>
            <Feather name="share-2" size={14} color="rgba(255,255,255,0.4)" />
            <Text style={styles.shareBtnText}>Paylaş</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: colors.black,
  },
  safe: {
    flex: 1,
    paddingHorizontal: layout.screenPaddingH,
    justifyContent: 'center',
  },

  // Başlık badge
  badge: {
    ...typography.label,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  // Kart
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  nameSpinner: {
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    height: 48,
  },
  dnaName: {
    ...typography.hero,
    color: colors.white,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  breakdown: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },

  // Renk paleti
  paletteRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  paletteCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  paletteLabel: {
    ...typography.label,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: spacing.lg,
  },

  // Trait badge'leri
  traitsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  traitTag: {
    paddingVertical: spacing.xs,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  traitText: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.7)',
  },
  traitsPlaceholder: {
    height: 32,
    justifyContent: 'center',
  },

  // Aksiyonlar
  actions: {
    gap: spacing.sm,
  },
  primaryBtn: {
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.black,
  },
  shareBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  shareBtnText: {
    ...typography.body,
    color: 'rgba(255,255,255,0.4)',
  },
});
