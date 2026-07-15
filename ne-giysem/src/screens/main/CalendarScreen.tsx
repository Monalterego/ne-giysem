import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../../navigation/types';
import { useUserStore } from '../../store/useUserStore';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import type { WornEntry, PlannedEntry } from '../../store/useWardrobeStore';
import type { WardrobeItem } from '../../types';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';
import { t } from '../../i18n';

type Props = NativeStackScreenProps<HomeStackParamList, 'Calendar'>;

export default function CalendarScreen({ navigation }: Props) {
  const user  = useUserStore((s) => s.user);
  const items = useWardrobeStore((s) => s.items);
  const fetchWornHistory  = useWardrobeStore((s) => s.fetchWornHistory);
  const fetchPlannedRange = useWardrobeStore((s) => s.fetchPlannedRange);
  const removePlan        = useWardrobeStore((s) => s.removePlan);

  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [entries, setEntries] = useState<WornEntry[]>([]);
  const [planned, setPlanned] = useState<PlannedEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [lightboxItemId, setLightboxItemId] = useState<string | null>(null);

  // Ay değişince o ayın tamamını çek (giyilen + planlanan)
  useEffect(() => {
    if (!user?.id) return;
    const from = new Date(year, month, 1, 0, 0, 0);
    const to   = new Date(year, month + 1, 0, 23, 59, 59);
    let cancelled = false;
    fetchWornHistory(user.id, from, to).then((data) => {
      if (!cancelled) setEntries(data);
    });
    fetchPlannedRange(user.id, from, to).then((data) => {
      if (!cancelled) setPlanned(data);
    });
    return () => { cancelled = true; };
  }, [year, month, user?.id]);

  // Girişleri güne göre grupla (yerel tarih)
  const byDay = useMemo(() => {
    const m = new Map<number, WornEntry[]>();
    for (const e of entries) {
      const d = new Date(e.wornAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        m.set(day, [...(m.get(day) ?? []), e]);
      }
    }
    return m;
  }, [entries, year, month]);

  // Planlananları güne göre grupla — plannedFor 'YYYY-MM-DD' string, YEREL tarih olarak parse edilir
  const plannedByDay = useMemo(() => {
    const m = new Map<number, PlannedEntry[]>();
    for (const p of planned) {
      const [py, pm, pd] = p.plannedFor.split('-').map(Number);
      if (py === year && pm - 1 === month) m.set(pd, [...(m.get(pd) ?? []), p]);
    }
    return m;
  }, [planned, year, month]);

  // Parça id'lerini gerçek parçalara çöz — silinmişler elenir
  const resolveItems = useCallback((ids: string[]): WardrobeItem[] =>
    ids
      .map((id) => items.find((i) => i.id === id))
      .filter((i): i is WardrobeItem => Boolean(i)),
  [items]);

  // Izgara matematiği — Pazartesi ilk gün
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const goToMonth = (delta: number) => {
    const d  = new Date(year, month + delta, 1);
    const ny = d.getFullYear();
    const nm = d.getMonth();
    setYear(ny);
    setMonth(nm);
    // Yeni ay bugünün ayıysa bugünü seç, değilse seçimi kaldır
    if (ny === today.getFullYear() && nm === today.getMonth()) setSelectedDay(today.getDate());
    else setSelectedDay(null);
  };

  // Bir girişler listesinin ilk çözülebilir parçasının fotoğrafı (thumbnail)
  // — hem giyilen (WornEntry) hem planlanan (PlannedEntry) için çalışır (ikisi de items içerir)
  const firstThumbOf = (list: { items: string[] }[]): string | null => {
    for (const e of list) {
      const resolved = resolveItems(e.items);
      if (resolved.length && resolved[0].processedImageUrl) return resolved[0].processedImageUrl;
    }
    return null;
  };

  const selectedEntries = selectedDay !== null ? (byDay.get(selectedDay) ?? []) : [];
  const selectedPlanned = selectedDay !== null ? (plannedByDay.get(selectedDay) ?? []) : [];

  const handleItemPress = (item: WardrobeItem) => {
    if (/^data:image\//i.test(item.processedImageUrl ?? '')) return;
    setLightboxItemId(item.id);
  };

  const handleRemovePlan = (p: PlannedEntry) => {
    Alert.alert(
      t('calendar.removePlanTitle'),
      t('calendar.removePlanMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const ok = await removePlan(p.id);
            if (ok) setPlanned((prev) => prev.filter((x) => x.id !== p.id));
          },
        },
      ],
    );
  };
  const selectedLightboxItem = useMemo(
    () => (lightboxItemId ? items.find((i) => i.id === lightboxItemId) ?? null : null),
    [lightboxItemId, items],
  );

  const weekdayKeys = ['wd0', 'wd1', 'wd2', 'wd3', 'wd4', 'wd5', 'wd6'];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Başlık */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.back}>{t('auth.backArrow')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('calendar.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Ay gezinme */}
        <View style={styles.monthNav}>
          <TouchableOpacity
            onPress={() => goToMonth(-1)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="chevron-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{t(`calendar.m${month}`)} {year}</Text>
          <TouchableOpacity
            onPress={() => goToMonth(1)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="chevron-right" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Gün başlıkları */}
        <View style={styles.weekRow}>
          {weekdayKeys.map((k) => (
            <View key={k} style={styles.weekCell}>
              <Text style={styles.weekLabel}>{t(`calendar.${k}`)}</Text>
            </View>
          ))}
        </View>

        {/* Izgara */}
        <View style={styles.grid}>
          {cells.map((day, idx) => {
            if (day === null) return <View key={`e${idx}`} style={styles.dayCell} />;
            const wornList    = byDay.get(day);
            const plannedList = plannedByDay.get(day);
            const isWornDay    = !!wornList?.length;
            const isPlannedDay = !!plannedList?.length;
            // Giyilen thumb önceliklidir; yoksa planlanan thumb'ı gösterilir
            const thumb = (isWornDay ? firstThumbOf(wornList!) : null)
                       ?? (isPlannedDay ? firstThumbOf(plannedList!) : null);
            const selected = day === selectedDay;
            const todayCell = isToday(day);
            // Planlı ama giyilmemiş → kesikli çerçeve ile ayırt et
            const plannedOnly = isPlannedDay && !isWornDay;
            return (
              <TouchableOpacity
                key={day}
                style={styles.dayCell}
                onPress={() => setSelectedDay(day)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.dayInner,
                    plannedOnly && styles.dayPlanned,
                    todayCell && styles.dayToday,
                    selected && styles.daySelected,
                  ]}
                >
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.dayThumb} resizeMode="cover" />
                  ) : null}
                  {thumb && !selected ? (
                    <View style={styles.dayNumBackdrop}>
                      <Text style={[styles.dayNum, styles.dayNumOnThumb]}>{day}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.dayNum, selected && styles.dayNumSelected]}>{day}</Text>
                  )}
                  {isWornDay ? <View style={styles.dayDot} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Seçili günün kombinleri */}
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>{t('calendar.wornOutfits')}</Text>

          {entries.length === 0 ? (
            <Text style={styles.emptyText}>{t('calendar.emptyMonth')}</Text>
          ) : selectedEntries.length === 0 ? (
            <Text style={styles.emptyText}>{t('calendar.noOutfitOnDay')}</Text>
          ) : (
            selectedEntries.map((entry, i) => {
              const resolved = resolveItems(entry.items);
              return (
                <View key={i} style={styles.comboCard}>
                  {resolved.length === 0 ? (
                    <Text style={styles.deletedText}>{t('calendar.deletedItem')}</Text>
                  ) : (
                    <View style={styles.comboImagesRow}>
                      {resolved.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.comboImgWrap}
                          onPress={() => handleItemPress(item)}
                          activeOpacity={0.85}
                        >
                          <Image
                            source={{ uri: item.processedImageUrl }}
                            style={styles.comboImg}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <View style={styles.comboFooter}>
                    <Text style={styles.comboScore}>{entry.score}% {t('calendar.score')}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Seçili günün planlanan kombinleri */}
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>{t('calendar.plannedOutfits')}</Text>

          {selectedPlanned.length === 0 ? (
            <Text style={styles.emptyText}>{t('calendar.noPlannedOnDay')}</Text>
          ) : (
            selectedPlanned.map((p) => {
              const resolved = resolveItems(p.items);
              return (
                <View key={p.id} style={styles.comboCard}>
                  <View style={styles.plannedHeader}>
                    <Text style={styles.comboScore}>{p.score}% {t('calendar.score')}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemovePlan(p)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="x" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {resolved.length === 0 ? (
                    <Text style={styles.deletedText}>{t('calendar.deletedItem')}</Text>
                  ) : (
                    <View style={styles.comboImagesRow}>
                      {resolved.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.comboImgWrap}
                          onPress={() => handleItemPress(item)}
                          activeOpacity={0.85}
                        >
                          <Image
                            source={{ uri: item.processedImageUrl }}
                            style={styles.comboImg}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Parça lightbox */}
      <Modal visible={lightboxItemId !== null} transparent animationType="fade" onRequestClose={() => setLightboxItemId(null)}>
        <TouchableOpacity style={styles.lightboxOverlay} activeOpacity={1} onPress={() => setLightboxItemId(null)}>
          <View style={styles.lightboxContainer}>
            {selectedLightboxItem?.processedImageUrl && (
              <Image source={{ uri: selectedLightboxItem.processedImageUrl }} style={styles.lightboxImage} resizeMode="contain" />
            )}
            <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxItemId(null)} activeOpacity={0.8}>
              <Feather name="x" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  back: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
    width: 60,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  headerRight: {
    width: 60,
  },
  scroll: {
    paddingBottom: spacing.xl,
  },

  // Ay gezinme
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.lg,
  },
  monthLabel: {
    ...typography.h3,
    color: colors.text,
  },

  // Gün başlıkları
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: layout.screenPaddingH,
    marginBottom: spacing.xs,
  },
  weekCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
  },
  weekLabel: {
    ...typography.caption,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
  },

  // Izgara
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: layout.screenPaddingH,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 3,
  },
  dayInner: {
    flex: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  dayPlanned: {
    borderStyle: 'dashed',
    borderColor: colors.textSecondary,
    borderWidth: 1.5,
  },
  dayToday: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  daySelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  dayThumb: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  dayNum: {
    ...typography.caption,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  dayNumBackdrop: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,10,0.62)',   // yarı saydam koyu hap — fotoğraftan bağımsız okunurluk
  },
  dayNumOnThumb: {
    color: colors.white,
  },
  dayNumSelected: {
    color: colors.white,
  },
  dayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.white,
  },

  // Seçili günün kombinleri
  listSection: {
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.lg,
  },
  listTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  comboCard: {
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.subtle,
  },
  comboImagesRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  comboImgWrap: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  comboImg: {
    width: '100%',
    height: '100%',
  },
  comboFooter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'flex-end',
  },
  comboScore: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  plannedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  deletedText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontStyle: 'italic',
    padding: spacing.md,
  },

  bottomPad: {
    height: spacing.md,
  },

  // Parça lightbox
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxContainer: {
    width: '88%',
    aspectRatio: 0.8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#ECECEC',
    borderRadius: radius.lg,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
  },
  lightboxClose: {
    position: 'absolute',
    top: -14,
    right: -14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
