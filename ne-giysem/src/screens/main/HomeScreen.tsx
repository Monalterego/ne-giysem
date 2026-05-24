import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/types';
import { useUserStore } from '../../store/useUserStore';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { generateCombos } from '../../utils/comboEngine';
import type { Combo, WardrobeItem } from '../../types';
import { colors, fonts } from '../../constants/theme';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Günaydın';
  if (h < 17) return 'İyi günler';
  return 'İyi akşamlar';
}

function getInitial(name: string, email: string): string {
  return (name || email).charAt(0).toUpperCase() || '?';
}

function getDisplayName(name: string, email: string): string {
  return name || email.split('@')[0] || '';
}

const SCORE_COLOR = (s: number) =>
  s >= 80 ? colors.success : s >= 65 ? colors.warning : colors.muted;

// ─── Alt bileşenler ───────────────────────────────────────────────────────────

function TodayComboCard({ combo }: { combo: Combo }) {
  return (
    <View style={styles.comboCard}>
      <View style={styles.comboImages}>
        {combo.items.map((item: WardrobeItem) => (
          <View key={item.id} style={styles.comboImageWrap}>
            <Image
              source={{ uri: item.processedImageUrl }}
              style={styles.comboImage}
              resizeMode="contain"
            />
          </View>
        ))}
        <View style={[styles.scorePill, { backgroundColor: SCORE_COLOR(combo.score) }]}>
          <Text style={styles.scorePillText}>{combo.score}%</Text>
        </View>
      </View>
      <View style={styles.comboFooter}>
        <Text style={styles.comboLabel}>{combo.label}</Text>
        <View style={styles.comboPill}>
          <Text style={styles.comboPillText}>Günün Seçimi</Text>
        </View>
      </View>
    </View>
  );
}

function EmptyComboCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.emptyCombo} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.emptyComboIcon}>✨</Text>
      <Text style={styles.emptyComboTitle}>Kombinin hazır değil</Text>
      <Text style={styles.emptyComboSub}>
        Üst, alt ve ayakkabı ekle — kombin otomatik oluşsun
      </Text>
      <View style={styles.emptyComboBtn}>
        <Text style={styles.emptyComboText}>Parça Ekle →</Text>
      </View>
    </TouchableOpacity>
  );
}

function QuickAction({
  emoji,
  label,
  onPress,
}: {
  emoji: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.quickActionEmoji}>{emoji}</Text>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: Props) {
  const user       = useUserStore((s) => s.user);
  const items      = useWardrobeStore((s) => s.items);
  const fetchItems = useWardrobeStore((s) => s.fetchItems);

  useEffect(() => {
    if (user?.id) fetchItems(user.id);
  }, [user?.id]);

  const combos     = useMemo(() => generateCombos(items), [items]);
  const todayCombo = combos[0] ?? null;
  const preview    = items.slice(0, 4);

  const displayName = getDisplayName(user?.name ?? '', user?.email ?? '');
  const initial     = getInitial(user?.name ?? '', user?.email ?? '');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Üst başlık ── */}
        <View style={styles.topBar}>
          <View style={styles.greetingWrap}>
            <Text style={styles.greeting}>
              {getGreeting()}{displayName ? `, ${displayName}` : ''}
            </Text>
            <Text style={styles.greetingSub}>Bugün ne giymek istersin?</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        </View>

        {/* ── Günün Kombini ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Günün Kombini</Text>
        </View>
        {todayCombo ? (
          <TodayComboCard combo={todayCombo} />
        ) : (
          <EmptyComboCard onPress={() => (navigation as any).navigate('Wardrobe', { screen: 'Upload' })} />
        )}

        {/* ── Hava Durumu ── */}
        <View style={styles.weatherCard}>
          <View style={styles.weatherLeft}>
            <Text style={styles.weatherIcon}>☀️</Text>
            <View>
              <Text style={styles.weatherCity}>İstanbul</Text>
              <Text style={styles.weatherTemp}>22°C · Açık</Text>
            </View>
          </View>
          <View style={styles.weatherDivider} />
          <Text style={styles.weatherTip}>Hafif kıyafetler ideal</Text>
        </View>

        {/* ── Hızlı Aksiyonlar ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
        </View>
        <View style={styles.quickRow}>
          <QuickAction
            emoji="📸"
            label="Yükle"
            onPress={() => (navigation as any).navigate('Wardrobe', { screen: 'Upload' })}
          />
          <QuickAction
            emoji="🛍️"
            label="Mağaza"
            onPress={() => navigation.navigate('Scan')}
          />
          <QuickAction
            emoji="✨"
            label="Kombin"
            onPress={() => navigation.navigate('Combos')}
          />
        </View>

        {/* ── Dolap Önizleme ── */}
        {preview.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Dolabım</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Wardrobe')}>
                <Text style={styles.seeAll}>Tümünü gör →</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.previewGrid}>
              {preview.map((item) => (
                <View key={item.id} style={styles.previewItem}>
                  <Image
                    source={{ uri: item.processedImageUrl }}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingBottom: 24,
  },

  // Üst başlık
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    backgroundColor: colors.white,
  },
  greetingWrap: {
    flex: 1,
  },
  greeting: {
    fontSize: 22,
    fontFamily: fonts.headingBold,
    color: colors.primary,
    marginBottom: 2,
  },
  greetingSub: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: fonts.headingBold,
    color: colors.primary,
  },
  seeAll: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.accent,
  },

  // Günün Kombini — dolu
  comboCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  comboImages: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  comboImageWrap: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  comboImage: {
    width: '100%',
    height: '100%',
  },
  scorePill: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  scorePillText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  comboFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  comboLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  comboPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.overlay,
  },
  comboPillText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },

  // Günün Kombini — boş
  emptyCombo: {
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: 28,
    alignItems: 'center',
  },
  emptyComboIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyComboTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyComboSub: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  emptyComboBtn: {
    paddingVertical: 9,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: colors.accent,
  },
  emptyComboText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // Hava durumu
  weatherCard: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#EBF4FF',
    borderWidth: 1,
    borderColor: '#C8DFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  weatherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weatherIcon: {
    fontSize: 28,
  },
  weatherCity: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  weatherTemp: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.muted,
    marginTop: 1,
  },
  weatherDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#C8DFFF',
  },
  weatherTip: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.secondary,
    lineHeight: 18,
  },

  // Hızlı aksiyonlar
  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  quickAction: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  quickActionEmoji: {
    fontSize: 26,
  },
  quickActionLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },

  // Dolap önizleme
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  previewItem: {
    width: '47%',
    aspectRatio: 3 / 4,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },

  bottomPad: {
    height: 12,
  },
});
