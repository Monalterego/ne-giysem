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
import { fonts } from '../../constants/theme';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

const C = {
  bg:      '#FAFAF8',
  white:   '#FFFFFF',
  primary: '#1A1A1A',
  accent:  '#C9A96E',
  muted:   '#8A8A8A',
  border:  '#E8E4DE',
  surface: '#F5F2ED',
};

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
    return <Feather name="cloud-rain" size={22} color={C.muted} />;
  }
  if (d.includes('snow') || d.includes('kar')) {
    return <Feather name="cloud-snow" size={22} color={C.muted} />;
  }
  if (d.includes('cloud') || d.includes('bulut')) {
    return <Feather name="cloud" size={22} color={C.muted} />;
  }
  return <Feather name="sun" size={22} color={C.accent} />;
}

// ─── Alt bileşenler ───────────────────────────────────────────────────────────

function TodayComboCard({ combo }: { combo: Combo }) {
  return (
    <View style={styles.comboCard}>
      <Text style={styles.comboTag}>GÜNÜN KOMBİNİ</Text>
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
      <Feather name="plus-circle" size={32} color={C.border} style={{ marginBottom: 14 }} />
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

  const combos     = useMemo(() => generateCombos(items), [items]);
  const todayCombo = combos[0] ?? null;
  const preview    = items.slice(0, 4);

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
            <ActivityIndicator color={C.muted} size="small" style={{ flex: 1 }} />
          ) : weather ? (
            <>
              <View style={styles.weatherLeft}>
                <WeatherIcon description={weather.description} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.weatherCity}>İstanbul</Text>
                  <Text style={styles.weatherTemp}>{weather.temp}°C · {weather.description}</Text>
                </View>
              </View>
              <View style={styles.weatherDivider} />
              <Text style={styles.weatherTip}>{weather.recommendation}</Text>
            </>
          ) : (
            <View style={styles.weatherLeft}>
              <Feather name="thermometer" size={20} color={C.muted} />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.weatherCity}>İstanbul</Text>
                <Text style={styles.weatherTemp}>Hava durumu alınamadı</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Hızlı Aksiyonlar ── */}
        <View style={styles.quickRow}>
          <QuickAction
            icon={<Feather name="camera" size={20} color={C.primary} />}
            label="Yükle"
            onPress={() => (navigation as any).navigate('Wardrobe', { screen: 'Upload' })}
          />
          <QuickAction
            icon={<Feather name="shopping-bag" size={20} color={C.primary} />}
            label="Mağaza"
            onPress={() => navigation.navigate('Scan')}
          />
          <QuickAction
            icon={<Ionicons name="sparkles-outline" size={20} color={C.primary} />}
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
    backgroundColor: C.bg,
  },
  scroll: {
    paddingBottom: 24,
  },
  separator: {
    height: 1,
    backgroundColor: C.border,
  },

  // Header
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 20,
    backgroundColor: C.bg,
  },
  greetingWrap: {
    flex: 1,
  },
  greeting: {
    fontSize: 28,
    fontFamily: fonts.headingBold,
    color: C.primary,
    marginBottom: 5,
    lineHeight: 34,
  },
  greetingSub: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: C.muted,
    letterSpacing: 0.2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontFamily: fonts.bodyBold,
    color: C.white,
    letterSpacing: 0.5,
  },

  // Bölüm başlığı
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.headingBold,
    color: C.primary,
    letterSpacing: 0.3,
  },
  seeAll: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: C.accent,
    letterSpacing: 0.3,
  },

  // Günün kombini — dolu
  comboCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    backgroundColor: C.white,
    overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    elevation: 2,
  },
  comboTag: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    color: C.muted,
    letterSpacing: 2,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  comboImages: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    backgroundColor: C.bg,
  },
  comboImageWrap: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: C.white,
    overflow: 'hidden',
  },
  comboImage: {
    width: '100%',
    height: '100%',
  },
  comboFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  comboLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: C.primary,
  },
  comboRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  comboScore: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: C.primary,
  },
  comboAction: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: C.muted,
    letterSpacing: 0.2,
  },

  // Günün kombini — boş
  emptyCombo: {
    marginHorizontal: 20,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
    padding: 32,
    alignItems: 'center',
  },
  emptyComboTitle: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: C.primary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyComboSub: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyComboBtn: {
    paddingVertical: 9,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: C.primary,
  },
  emptyComboText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: C.white,
    letterSpacing: 0.3,
  },

  // Hava durumu
  weatherCard: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  weatherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherCity: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: C.primary,
  },
  weatherTemp: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: C.muted,
    marginTop: 2,
  },
  weatherDivider: {
    width: 1,
    height: 28,
    backgroundColor: C.border,
  },
  weatherTip: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.body,
    color: C.muted,
    lineHeight: 17,
    fontStyle: 'italic',
  },

  // Hızlı aksiyonlar
  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 24,
  },
  quickAction: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    elevation: 1,
  },
  quickActionLabel: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: C.muted,
    letterSpacing: 0.2,
  },

  // Dolap önizleme
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
  },
  previewItem: {
    width: '47%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
    elevation: 1,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },

  bottomPad: {
    height: 12,
  },
});
