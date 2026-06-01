import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/types';
import { useUserStore } from '../../store/useUserStore';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { generateCombos } from '../../utils/comboEngine';
import type { Combo, WardrobeItem } from '../../types';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

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

function WeatherIcon({ description }: { description?: string }) {
  const d = description?.toLowerCase() ?? '';
  if (d.includes('rain') || d.includes('yağ')) {
    return <Feather name="cloud-rain" size={20} color={colors.textSecondary} />;
  }
  if (d.includes('snow') || d.includes('kar')) {
    return <Feather name="cloud-snow" size={20} color={colors.textSecondary} />;
  }
  if (d.includes('cloud') || d.includes('bulut')) {
    return <Feather name="cloud" size={20} color={colors.textSecondary} />;
  }
  return <Feather name="sun" size={20} color={colors.accent} />;
}

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
      </View>
      <View style={styles.comboFooter}>
        <Text style={styles.comboLabel}>{combo.label}</Text>
        <View style={styles.comboRight}>
          <Text style={styles.comboScore}>{combo.score}%</Text>
          <Text style={styles.comboAction}>Günün Seçimi →</Text>
        </View>
      </View>
    </View>
  );
}

function EmptyComboCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.emptyCombo} onPress={onPress} activeOpacity={0.85}>
      <Feather name="plus-circle" size={28} color={colors.border} style={{ marginBottom: spacing.md }} />
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
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
      {icon}
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: Props) {
  const user           = useUserStore((s) => s.user);
  const items          = useWardrobeStore((s) => s.items);
  const fetchItems     = useWardrobeStore((s) => s.fetchItems);
  const weather        = useWardrobeStore((s) => s.weather);
  const weatherLoading = useWardrobeStore((s) => s.weatherLoading);
  const fetchWeather   = useWardrobeStore((s) => s.fetchWeather);

  useEffect(() => {
    if (user?.id) fetchItems(user.id);
    fetchWeather();
  }, [user?.id]);

  const todayCombo = useMemo(
    () => (items.length ? generateCombos(items, 1, 'gunluk')[0] ?? null : null),
    [items],
  );
  const preview        = items.slice(0, 4);

  const displayName = getDisplayName(user?.name ?? '', user?.email ?? '');
  const initial     = getInitial(user?.name ?? '', user?.email ?? '');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
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
        <View style={styles.separator} />

        {/* ── Günün Kombini ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Günün Kombini</Text>
        </View>
        {todayCombo ? (
          <TodayComboCard combo={todayCombo} />
        ) : (
          <EmptyComboCard
            onPress={() => (navigation as any).navigate('Wardrobe', { screen: 'Upload' })}
          />
        )}

        {/* ── Hava Durumu ── */}
        <View style={styles.weatherCard}>
          {weatherLoading ? (
            <ActivityIndicator color={colors.textSecondary} size="small" style={{ flex: 1 }} />
          ) : weather ? (
            <>
              <View style={styles.weatherLeft}>
                <WeatherIcon description={weather.description} />
                <View style={{ marginLeft: spacing.sm }}>
                  <Text style={styles.weatherCity}>İstanbul</Text>
                  <Text style={styles.weatherTemp}>{weather.temp}°C · {weather.description}</Text>
                </View>
              </View>
              <View style={styles.weatherDivider} />
              <Text style={styles.weatherTip}>{weather.recommendation}</Text>
            </>
          ) : (
            <View style={styles.weatherLeft}>
              <Feather name="thermometer" size={18} color={colors.textSecondary} />
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={styles.weatherCity}>İstanbul</Text>
                <Text style={styles.weatherTemp}>Hava durumu alınamadı</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Hızlı Aksiyonlar ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Keşfet</Text>
        </View>
        <View style={styles.quickRow}>
          <QuickAction
            icon={<Feather name="camera" size={18} color={colors.text} />}
            label="Yükle"
            onPress={() => (navigation as any).navigate('Wardrobe', { screen: 'Upload' })}
          />
          <QuickAction
            icon={<Feather name="shopping-bag" size={18} color={colors.text} />}
            label="Mağaza"
            onPress={() => navigation.navigate('Scan')}
          />
          <QuickAction
            icon={<Ionicons name="sparkles-outline" size={18} color={colors.text} />}
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
    paddingBottom: spacing.lg,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },

  // Header
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
  },
  greetingWrap: {
    flex: 1,
  },
  greeting: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  greetingSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // Bölüm başlığı
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  seeAll: {
    ...typography.caption,
    fontFamily: fonts.bodyMedium,
    color: colors.accent,
  },

  // Günün kombini — dolu
  comboCard: {
    marginHorizontal: layout.screenPaddingH,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  comboImages: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  comboImageWrap: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  comboImage: {
    width: '100%',
    height: '100%',
  },
  comboFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  comboLabel: {
    flex: 1,
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  comboRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  comboScore: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  comboAction: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Günün kombini — yükleniyor
  comboLoadingCard: {
    marginHorizontal: layout.screenPaddingH,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  comboLoadingText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Günün kombini — boş
  emptyCombo: {
    marginHorizontal: layout.screenPaddingH,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyComboTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyComboSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyComboBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.text,
  },
  emptyComboText: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // Hava durumu
  weatherCard: {
    marginHorizontal: layout.screenPaddingH,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  weatherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherCity: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  weatherTemp: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  weatherDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  weatherTip: {
    flex: 1,
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },

  // Hızlı aksiyonlar
  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: layout.screenPaddingH,
    gap: spacing.sm,
  },
  quickAction: {
    flex: 1,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
  },
  quickActionLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textSecondary,
  },

  // Dolap önizleme
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: layout.screenPaddingH,
    gap: spacing.sm,
  },
  previewItem: {
    width: '47%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.subtle,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },

  bottomPad: {
    height: spacing.md,
  },
});
