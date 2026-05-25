import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { useUserStore } from '../../store/useUserStore';
import { generateCombos, missingCategories } from '../../utils/comboEngine';
import type { Occasion } from '../../utils/comboEngine';
import { supabase } from '../../lib/supabase';
import type { Combo } from '../../types';
import { colors, fonts } from '../../constants/theme';

const CATEGORY_LABEL: Record<string, string> = {
  upper: 'Üst',
  lower: 'Alt',
  shoes: 'Ayakkabı',
  outer: 'Dış',
  accessory: 'Aksesuar',
};

const OCCASIONS: { label: string; value: Occasion }[] = [
  { label: 'Tümü',   value: 'all'     },
  { label: 'Günlük', value: 'casual'  },
  { label: 'İş',     value: 'work'    },
  { label: 'Date',   value: 'date'    },
  { label: 'Spor',   value: 'sport'   },
  { label: 'Özel',   value: 'special' },
];

function ScoreBadge({ score }: { score: number }) {
  const bg =
    score >= 80 ? colors.success :
    score >= 65 ? colors.warning :
    colors.muted;
  return (
    <View style={[styles.scoreBadge, { backgroundColor: bg }]}>
      <Text style={styles.scoreBadgeText}>{score}%</Text>
    </View>
  );
}

function comboKey(combo: Combo): string {
  return combo.items.map((i) => i.id).sort().join('|');
}

function ComboCard({
  combo,
  isWorn,
  isSaving,
  onWear,
}: {
  combo: Combo;
  isWorn: boolean;
  isSaving: boolean;
  onWear: () => void;
}) {
  return (
    <View style={styles.card}>
      {/* Parça görselleri */}
      <View style={styles.imagesRow}>
        {combo.items.map((item) => (
          <View key={item.id} style={styles.itemImageWrap}>
            <Image
              source={{ uri: item.processedImageUrl }}
              style={styles.itemImage}
              resizeMode="contain"
            />
            <Text style={styles.itemLabel}>{CATEGORY_LABEL[item.category] ?? item.category}</Text>
          </View>
        ))}
        <ScoreBadge score={combo.score} />
      </View>

      {/* Etiket + buton */}
      <View style={styles.cardFooter}>
        <Text style={styles.comboLabel}>{combo.label}</Text>
        {isWorn ? (
          <View style={[styles.wearBtn, styles.wearBtnWorn]}>
            <Text style={[styles.wearBtnText, styles.wearBtnTextWorn]}>✓ Giyildi</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.wearBtn}
            onPress={onWear}
            activeOpacity={0.85}
            disabled={isSaving}
          >
            {isSaving
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={styles.wearBtnText}>Bu Kombini Giy →</Text>
            }
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function CombosScreen() {
  const items          = useWardrobeStore((s) => s.items);
  const isLoading      = useWardrobeStore((s) => s.isLoading);
  const fetchItems     = useWardrobeStore((s) => s.fetchItems);
  const wornComboKeys  = useWardrobeStore((s) => s.wornComboKeys);
  const markWorn       = useWardrobeStore((s) => s.markWorn);
  const fetchWornToday = useWardrobeStore((s) => s.fetchWornToday);
  const user           = useUserStore((s) => s.user);

  const [savingKey, setSavingKey]         = useState<string | null>(null);
  const [activeOccasion, setActiveOccasion] = useState<Occasion>('all');

  useEffect(() => {
    if (user?.id) {
      fetchItems(user.id);
      fetchWornToday(user.id);
    }
  }, [user?.id]);

  const handleWear = async (combo: Combo) => {
    if (!user) return;
    const key = comboKey(combo);
    setSavingKey(key);
    const now = new Date().toISOString();
    const payload = {
      user_id: user.id,
      items: combo.items.map((i) => i.id),
      score: combo.score,
      worn_at: now,
      created_at: now,
    };
    console.log('[handleWear] inserting to combos:', JSON.stringify(payload));
    const { error } = await supabase.from('combos').insert(payload);
    if (error) {
      console.error('[handleWear] combos insert error:', error);
    } else {
      markWorn(key);
    }
    setSavingKey(null);
  };

  const combos  = useMemo(() => generateCombos(items, 12, activeOccasion), [items, activeOccasion]);
  const missing = useMemo(() => missingCategories(items), [items]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kombinler</Text>
        {combos.length > 0 && (
          <Text style={styles.headerCount}>{combos.length} öneri</Text>
        )}
      </View>

      {/* Occasion chip'leri */}
      <ScrollView
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        style={{
          backgroundColor: '#FAFAFA',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexShrink: 0,
        }}
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          gap: 8,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {OCCASIONS.map(({ label, value }) => {
          const active = activeOccasion === value;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.occasionChip, active && styles.occasionChipActive]}
              onPress={() => setActiveOccasion(value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.occasionChipText, active && styles.occasionChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {combos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>✨</Text>
          <Text style={styles.emptyTitle}>Kombin üretilemedi</Text>
          {missing.length > 0 ? (
            <>
              <Text style={styles.emptySubtitle}>
                Kombin için dolabında şunlar gerekiyor:
              </Text>
              {missing.map((cat) => (
                <View key={cat} style={styles.missingRow}>
                  <Text style={styles.missingBullet}>•</Text>
                  <Text style={styles.missingText}>{cat}</Text>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.emptySubtitle}>
              Dolabına parça ekleyerek başla
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={combos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const key = comboKey(item);
            return (
              <ComboCard
                combo={item}
                isWorn={wornComboKeys.has(key)}
                isSaving={savingKey === key}
                onWear={() => handleWear(item)}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: fonts.headingBold,
    color: colors.primary,
    flex: 1,
  },
  headerCount: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  // --- Boş durum ---
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fonts.headingBold,
    color: colors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  missingBullet: {
    fontSize: 16,
    color: colors.accent,
  },
  missingText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },
  // --- Occasion filtresi ---
  occasionBar: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexGrow: 0,
  },
  occasionBarContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  occasionChip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  occasionChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  occasionChipText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },
  occasionChipTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },
  // --- Kombin listesi ---
  list: {
    padding: 16,
    gap: 16,
  },
  // --- Kombin kartı ---
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(26,26,46,0.06)',
    elevation: 2,
  },
  imagesRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  itemImageWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  itemImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  itemLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.muted,
  },
  scoreBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  scoreBadgeText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  comboLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  wearBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.primary,
    minWidth: 48,
    alignItems: 'center',
  },
  wearBtnWorn: {
    backgroundColor: colors.border,
  },
  wearBtnText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  wearBtnTextWorn: {
    color: colors.muted,
  },
});
