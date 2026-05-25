import React, { useState, useEffect } from 'react';
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
import { analyzeClothingImage } from '../../utils/visionAnalysis';
import type { VisionResult } from '../../utils/visionAnalysis';
import { analyzeStoreCompatibility } from '../../utils/storeAnalysis';
import type { CompatibilityResult } from '../../utils/storeAnalysis';
import type { WardrobeItem, ClothingCategory } from '../../types';
import { colors, fonts } from '../../constants/theme';

type Props = NativeStackScreenProps<ScanStackParamList, 'StoreResult'>;

const CATEGORY_LABEL: Record<string, string> = {
  upper:          'Üst',
  lower:          'Alt',
  dress_jumpsuit: 'Elbise/Tulum',
  outer:          'Dış Giyim',
  shoes:          'Ayakkabı',
  bag:            'Çanta',
  accessory:      'Aksesuar',
};

function verdictColor(verdict: string): string {
  if (verdict === 'Zaten benzeri var')           return '#F59E0B';
  if (verdict === 'Eksik parçaları tamamlıyor') return colors.secondary;
  return colors.success;
}

// ─── AI Detay Kartı ──────────────────────────────────────────────────────────

function AIDetailCard({ vision }: { vision: VisionResult }) {
  const pills = [
    vision.fit          ? vision.fit          : null,
    vision.neckline     ? vision.neckline     : null,
    vision.sleeveLength ? vision.sleeveLength : null,
  ].filter((p): p is string => !!p);

  return (
    <View style={styles.aiDetailCard}>
      {vision.itemName && (
        <Text style={styles.aiDetailName}>{vision.itemName}</Text>
      )}
      <Text style={styles.aiDetailCategory}>
        {CATEGORY_LABEL[vision.category] ?? vision.category}
        {vision.subcategory ? ` · ${vision.subcategory}` : ''}
      </Text>
      {pills.length > 0 && (
        <View style={styles.aiDetailPills}>
          {pills.map((p) => (
            <View key={p} style={styles.aiDetailPill}>
              <Text style={styles.aiDetailPillText}>{p}</Text>
            </View>
          ))}
        </View>
      )}
      {vision.details && vision.details.length > 0 && (
        <View style={styles.aiDetailTags}>
          {vision.details.map((d) => (
            <View key={d} style={styles.aiDetailTag}>
              <Text style={styles.aiDetailTagText}>{d}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Kombin Kartı (dolap parçaları) ──────────────────────────────────────────

function WardrobeComboCard({ items }: { items: WardrobeItem[] }) {
  return (
    <View style={styles.comboCard}>
      <View style={styles.comboImagesRow}>
        {items.map((item) => (
          <View key={item.id} style={styles.comboImgWrap}>
            <Image
              source={{ uri: item.processedImageUrl }}
              style={styles.comboImg}
              resizeMode="contain"
            />
            <Text style={styles.comboImgLabel}>
              {CATEGORY_LABEL[item.category] ?? item.category}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function StoreResultScreen({ route, navigation }: Props) {
  const { processedBase64, originalUri } = route.params;
  const items = useWardrobeStore((s) => s.items);
  const user  = useUserStore((s) => s.user);

  const [analyzing, setAnalyzing]             = useState(true);
  const [visionResult, setVisionResult]       = useState<VisionResult | null>(null);
  const [smartAnalyzing, setSmartAnalyzing]   = useState(false);
  const [compatibility, setCompatibility]     = useState<CompatibilityResult | null>(null);

  // Kullanılmayan detectedCategory/detectedColors state'lerini basit şekilde saklıyoruz
  // — scannedItem artık gereksiz; sadece scannedUri gösterimi yeterli
  const [_detectedCategory, setDetectedCategory] = useState<ClothingCategory>('upper');

  // 1. Vision analizi
  useEffect(() => {
    let cancelled = false;
    analyzeClothingImage(processedBase64)
      .then((result) => {
        if (cancelled) return;
        setVisionResult(result);
        setDetectedCategory(result.category);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAnalyzing(false); });
    return () => { cancelled = true; };
  }, [processedBase64]);

  // 2. Dolap uyum analizi — vision hazır olunca başlar
  useEffect(() => {
    if (!visionResult || !items.length) return;
    let cancelled = false;
    setSmartAnalyzing(true);
    analyzeStoreCompatibility(visionResult, items)
      .then((result) => { if (!cancelled) setCompatibility(result); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSmartAnalyzing(false); });
    return () => { cancelled = true; };
  }, [visionResult]);

  const scannedUri = `data:image/png;base64,${processedBase64}`;

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

        {/* Adım 1: Vision analiz bannerı */}
        {analyzing && (
          <View style={styles.analyzingBannerPurple}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.analyzingText}>AI kategori tespiti yapılıyor…</Text>
          </View>
        )}

        {/* AI Detay Kartı */}
        {visionResult && <AIDetailCard vision={visionResult} />}

        {/* Dolap boşsa */}
        {!items.length ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>👗</Text>
            <Text style={styles.emptyTitle}>Dolabın henüz boş</Text>
            <Text style={styles.emptyDesc}>
              Dolabına parça ekledikçe uyum analizi burada gösterilecek.
            </Text>
          </View>
        ) : (
          <>
            {/* Adım 2: Dolap analiz bannerı */}
            {smartAnalyzing && (
              <View style={styles.analyzingBannerBlue}>
                <ActivityIndicator size="small" color={colors.secondary} />
                <Text style={styles.analyzingText}>Dolabın analiz ediliyor…</Text>
              </View>
            )}

            {compatibility && (
              <>
                {/* Verdict */}
                <View style={[styles.verdictBadge, { backgroundColor: verdictColor(compatibility.verdict) }]}>
                  <Text style={styles.verdictText}>{compatibility.verdict}</Text>
                </View>

                {/* Gerekçeler */}
                {compatibility.reasons.length > 0 && (
                  <View style={styles.reasonsCard}>
                    {compatibility.reasons.map((reason, i) => (
                      <View key={i} style={styles.reasonRow}>
                        <Text style={styles.reasonBullet}>•</Text>
                        <Text style={styles.reasonText}>{reason}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Kombin Önerileri */}
                {compatibility.combos.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Kombin Önerileri</Text>
                    {compatibility.combos.map((comboItems, i) => (
                      <WardrobeComboCard key={i} items={comboItems} />
                    ))}
                  </>
                )}

                {/* Eksik Parçalar */}
                {compatibility.missing.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Eksik Parçalar</Text>
                    <View style={styles.missingCard}>
                      {compatibility.missing.map((m, i) => (
                        <View key={i} style={styles.missingRow}>
                          <Text style={styles.missingPlus}>+</Text>
                          <Text style={styles.missingText}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
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

  // ── Ürün görseli ──
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

  // ── Analiz bannerları ──
  analyzingBannerPurple: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  analyzingBannerBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  analyzingText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },

  // ── AI Detay Kartı ──
  aiDetailCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 8,
  },
  aiDetailName: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  aiDetailCategory: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.secondary,
  },
  aiDetailPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  aiDetailPill: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  aiDetailPillText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.secondary,
  },
  aiDetailTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  aiDetailTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  aiDetailTagText: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: colors.secondary,
  },

  // ── Section title ──
  sectionTitle: {
    fontSize: 17,
    fontFamily: fonts.headingBold,
    color: colors.primary,
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },

  // ── Boş dolap ──
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

  // ── Verdict ──
  verdictBadge: {
    marginHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 18,
    alignItems: 'center',
  },
  verdictText: {
    fontSize: 18,
    fontFamily: fonts.headingBold,
    color: colors.white,
    textAlign: 'center',
  },

  // ── Gerekçeler ──
  reasonsCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  reasonBullet: {
    fontSize: 16,
    color: colors.accent,
    lineHeight: 20,
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.primary,
    lineHeight: 20,
  },

  // ── Kombin kartı ──
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
  },
  comboImgWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  comboImg: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  comboImgLabel: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.muted,
  },

  // ── Eksik parçalar ──
  missingCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  missingPlus: {
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    color: colors.success,
    lineHeight: 20,
  },
  missingText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.primary,
    lineHeight: 20,
  },

  bottomPad: {
    height: 16,
  },
});
