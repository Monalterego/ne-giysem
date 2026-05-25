import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ScanStackParamList } from '../../navigation/types';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { useUserStore } from '../../store/useUserStore';
import { analyzeStoreItem } from '../../utils/comboEngine';
import { analyzeClothingImage } from '../../utils/visionAnalysis';
import type { WardrobeItem, Combo, ClothingCategory } from '../../types';
import { colors, fonts } from '../../constants/theme';

type Props = NativeStackScreenProps<ScanStackParamList, 'StoreResult'>;

const CATEGORY_LABEL: Record<string, string> = {
  upper: 'Üst',
  lower: 'Alt',
  shoes: 'Ayakkabı',
  outer: 'Dış',
  accessory: 'Aksesuar',
};

const SCANNED_ID = '__scanned__';

function scoreColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 65) return colors.warning;
  return colors.muted;
}

// ─── Mini kombin kartı ────────────────────────────────────────────────────────

function MiniComboCard({ combo, scannedUri }: { combo: Combo; scannedUri: string }) {
  return (
    <View style={styles.comboCard}>
      <View style={styles.comboImagesRow}>
        {combo.items.map((item: WardrobeItem) => {
          const uri = item.id === SCANNED_ID ? scannedUri : item.processedImageUrl;
          const isScanned = item.id === SCANNED_ID;
          return (
            <View key={item.id} style={[styles.comboImgWrap, isScanned && styles.comboImgScanned]}>
              <Image source={{ uri }} style={styles.comboImg} resizeMode="contain" />
              {isScanned && (
                <View style={styles.scannedTag}>
                  <Text style={styles.scannedTagText}>Taranan</Text>
                </View>
              )}
              <Text style={styles.comboImgLabel}>
                {CATEGORY_LABEL[item.category] ?? item.category}
              </Text>
            </View>
          );
        })}

        {/* Skor badge */}
        <View style={[styles.scoreBadge, { backgroundColor: scoreColor(combo.score) }]}>
          <Text style={styles.scoreBadgeText}>{combo.score}%</Text>
        </View>
      </View>

      <View style={styles.comboFooter}>
        <Text style={styles.comboLabel}>{combo.label}</Text>
      </View>
    </View>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function StoreResultScreen({ route, navigation }: Props) {
  const { processedBase64, originalUri } = route.params;
  const items = useWardrobeStore((s) => s.items);
  const user  = useUserStore((s) => s.user);

  const [detectedCategory, setDetectedCategory] = useState<ClothingCategory>('upper');
  const [detectedColors, setDetectedColors] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    analyzeClothingImage(processedBase64)
      .then((result) => {
        if (cancelled) return;
        setDetectedCategory(result.category);
        if (result.colors.length > 0) setDetectedColors(result.colors);
      })
      .catch(() => {
        // Sessizce devam et — varsayılan 'upper' kullanılır
      })
      .finally(() => {
        if (!cancelled) setAnalyzing(false);
      });
    return () => { cancelled = true; };
  }, [processedBase64]);

  const scannedUri = `data:image/png;base64,${processedBase64}`;

  // Taranan ürün için geçici WardrobeItem
  const scannedItem: WardrobeItem = useMemo(() => ({
    id: SCANNED_ID,
    userId: user?.id ?? '',
    originalImageUrl: originalUri,
    processedImageUrl: scannedUri,
    category: detectedCategory,
    colors: detectedColors,
    seasons: [],
    createdAt: new Date().toISOString(),
  }), [originalUri, scannedUri, user?.id, detectedCategory, detectedColors]);

  const analysis = useMemo(
    () => analyzeStoreItem(scannedItem, items),
    [scannedItem, items],
  );

  const { totalChecked, compatibleCount, avgScore, topCombos, sameCategory } = analysis;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Başlık */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.back}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Uyum Analizi</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Taranan ürün görseli */}
        <View style={styles.productImageWrap}>
          <Image source={{ uri: scannedUri }} style={styles.productImage} resizeMode="contain" />
          <View style={styles.productBadge}>
            <Text style={styles.productBadgeText}>Taranan Ürün</Text>
          </View>
        </View>

        {/* AI kategori analiz banner */}
        {analyzing && (
          <View style={styles.analyzingBanner}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.analyzingText}>AI kategori tespiti yapılıyor…</Text>
          </View>
        )}

        {/* Uyum Özeti */}
        <Text style={styles.sectionTitle}>Uyum Özeti</Text>

        {totalChecked === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>👗</Text>
            <Text style={styles.emptyTitle}>Dolabın henüz boş</Text>
            <Text style={styles.emptyDesc}>
              Dolabına parça ekledikçe uyum analizi burada gösterilecek.
            </Text>
          </View>
        ) : (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryHeadline}>
              Dolabındaki{' '}
              <Text style={styles.summaryAccent}>{totalChecked} parça</Text>
              {' '}incelendi
            </Text>

            {/* Skor çubuğu */}
            <View style={styles.scoreRow}>
              <View style={styles.scoreBarBg}>
                <View
                  style={[
                    styles.scoreBarFill,
                    { width: `${avgScore}%` as any, backgroundColor: scoreColor(avgScore) },
                  ]}
                />
              </View>
              <Text style={[styles.scoreLabel, { color: scoreColor(avgScore) }]}>
                {avgScore}%
              </Text>
            </View>

            <Text style={styles.summaryDetail}>
              <Text style={styles.summaryAccent}>{compatibleCount}</Text>
              {' '}parça ile uyumlu görünüyor
            </Text>
          </View>
        )}

        {/* Potansiyel Kombinler */}
        {topCombos.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Potansiyel Kombinler</Text>
            {topCombos.map((combo) => (
              <MiniComboCard key={combo.id} combo={combo} scannedUri={scannedUri} />
            ))}
          </>
        )}

        {/* Aynı işlev uyarısı */}
        {sameCategory > 0 && (
          <View style={styles.warningBox}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <View style={styles.warningText}>
              <Text style={styles.warningTitle}>Benzer Parça Uyarısı</Text>
              <Text style={styles.warningDesc}>
                Dolabında zaten{' '}
                <Text style={{ fontFamily: fonts.bodyBold }}>
                  {sameCategory} {(CATEGORY_LABEL[detectedCategory] ?? detectedCategory).toLowerCase()}
                </Text>
                {' '}var. Bu ürün benzer işlev görecek.
              </Text>
            </View>
          </View>
        )}

        {/* Kombin bulunamadı */}
        {totalChecked > 0 && topCombos.length === 0 && (
          <View style={styles.noCombosCard}>
            <Text style={styles.noCombosText}>
              Tam kombin için dolabına alt kıyafet ve ayakkabı eklemeyi dene.
            </Text>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  back: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.muted,
    width: 60,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fonts.headingBold,
    color: colors.primary,
  },
  headerRight: {
    width: 60,
  },
  scroll: {
    paddingBottom: 40,
  },

  // Ürün görseli
  productImageWrap: {
    height: 280,
    margin: 16,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(26,26,46,0.75)',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  productBadgeText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // AI banner
  analyzingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  analyzingText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },

  // Section title
  sectionTitle: {
    fontSize: 17,
    fontFamily: fonts.headingBold,
    color: colors.primary,
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 4,
  },

  // Uyum özeti kartı
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    boxShadow: '0 2px 8px rgba(26,26,46,0.05)',
    elevation: 2,
  },
  summaryHeadline: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.primary,
  },
  summaryAccent: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoreBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreLabel: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    minWidth: 44,
    textAlign: 'right',
  },
  summaryDetail: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.muted,
  },

  // Boş dolap
  emptyCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 28,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
  },

  // Kombin kartı
  comboCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    boxShadow: '0 1px 6px rgba(26,26,46,0.04)',
    elevation: 1,
  },
  comboImagesRow: {
    flexDirection: 'row',
    padding: 14,
    gap: 10,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  comboImgWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  comboImgScanned: {
    opacity: 1,
  },
  comboImg: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  scannedTag: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: colors.accent,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  scannedTagText: {
    fontSize: 9,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  comboImgLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.muted,
  },
  scoreBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  scoreBadgeText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  comboFooter: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  comboLabel: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },

  // Uyarı kutusu
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFCC80',
  },
  warningIcon: {
    fontSize: 20,
    marginTop: 1,
  },
  warningText: {
    flex: 1,
    gap: 3,
  },
  warningTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: '#7B4F00',
  },
  warningDesc: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: '#7B4F00',
    lineHeight: 18,
  },

  // Kombin yok
  noCombosCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noCombosText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.muted,
    lineHeight: 19,
    textAlign: 'center',
  },

  bottomPad: {
    height: 16,
  },
});
