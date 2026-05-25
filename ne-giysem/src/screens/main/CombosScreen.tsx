import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { useUserStore } from '../../store/useUserStore';
import { generateCombos, missingCategories } from '../../utils/comboEngine';
import type { Combo } from '../../types';
import { colors, fonts } from '../../constants/theme';

const CATEGORY_LABEL: Record<string, string> = {
  upper: 'Üst',
  lower: 'Alt',
  shoes: 'Ayakkabı',
  outer: 'Dış',
  accessory: 'Aksesuar',
};

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

function ComboCard({ combo }: { combo: Combo }) {
  const handleWear = () => {
    Alert.alert('Kombin Seçildi 🎉', `"${combo.label}" kombinin bugünün seçimi!`);
  };

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
        <TouchableOpacity style={styles.wearBtn} onPress={handleWear} activeOpacity={0.85}>
          <Text style={styles.wearBtnText}>Bu Kombini Giy →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CombosScreen() {
  const items      = useWardrobeStore((s) => s.items);
  const isLoading  = useWardrobeStore((s) => s.isLoading);
  const fetchItems = useWardrobeStore((s) => s.fetchItems);
  const user       = useUserStore((s) => s.user);

  useEffect(() => {
    if (user?.id) {
      fetchItems(user.id);
    }
  }, [user?.id]);

  const combos  = useMemo(() => generateCombos(items), [items]);
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
          renderItem={({ item }) => <ComboCard combo={item} />}
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
  },
  wearBtnText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
});
