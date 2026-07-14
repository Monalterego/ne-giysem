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
import { analyzeStoreItem } from '../../utils/comboEngine';
import type { StoreAnalysis } from '../../utils/comboEngine';
import type { WardrobeItem, ClothingCategory } from '../../types';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';
import { Feather } from '@expo/vector-icons';
import { t } from '../../i18n';
import { catLabel } from '../../constants/categories';

type Props = NativeStackScreenProps<ScanStackParamList, 'StoreResult'>;

// VisionResult'ı lokal motor için WardrobeItem şekline dönüştürür
function visionToWardrobeItem(v: VisionResult, processedBase64: string): WardrobeItem {
  const uri = `data:image/png;base64,${processedBase64}`;
  return {
    id: 'scanned',
    userId: '',
    originalImageUrl: uri,
    processedImageUrl: uri,
    category:    v.category,
    subCategory: v.subcategory,
    colors:      v.colors,
    pattern:     v.pattern,
    fabric:      v.fabric as WardrobeItem['fabric'],
    fit:         v.fit,
    neckline:    v.neckline,
    sleeveLength: v.sleeveLength,
    details:     v.details,
    itemName:    v.itemName,
    seasons:     v.seasons,
    createdAt:   new Date().toISOString(),
  };
}

function verdictColor(verdict: string): string {
  if (verdict === 'Zaten benzeri var')           return colors.accent;
  if (verdict === 'Eksik parçaları tamamlıyor') return colors.text;
  return colors.success;
}

// Motorun ürettiği Türkçe verdict → çeviri anahtarı (verdictColor Türkçe string'le çalışmaya devam eder)
function verdictKey(verdict: string): string {
  if (verdict === 'Zaten benzeri var')           return 'verdict.has_similar';
  if (verdict === 'Eksik parçaları tamamlıyor') return 'verdict.fills_gaps';
  return 'verdict.great_fit';
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
        {catLabel(vision.category)}
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
              {catLabel(item.category)}
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
  const items   = useWardrobeStore((s) => s.items);
  const weather = useWardrobeStore((s) => s.weather);
  const user    = useUserStore((s) => s.user);

  const [analyzing, setAnalyzing]             = useState(true);
  const [visionResult, setVisionResult]       = useState<VisionResult | null>(null);
  const [smartAnalyzing, setSmartAnalyzing]   = useState(false);
  const [compatibility, setCompatibility]     = useState<StoreAnalysis | null>(null);

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

  // 2. Dolap uyum analizi — senkron lokal motor, sıfır network
  useEffect(() => {
    if (!visionResult || !items.length) return;
    setSmartAnalyzing(true);
    const scannedItem = visionToWardrobeItem(visionResult, processedBase64);
    const result = analyzeStoreItem(
      scannedItem, items,
      weather ?? undefined,
      user?.styleProfile ?? undefined,
    );
    setCompatibility(result);
    setSmartAnalyzing(false);
  }, [visionResult, items, weather]);

  const scannedUri = `data:image/png;base64,${processedBase64}`;

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
        <Text style={styles.headerTitle}>{t('storeResult.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Taranan ürün görseli */}
        <View style={styles.productImageWrap}>
          <Image source={{ uri: scannedUri }} style={styles.productImage} resizeMode="contain" />
          <View style={styles.productBadge}>
            <Text style={styles.productBadgeText}>{t('storeResult.scannedProduct')}</Text>
          </View>
        </View>

        {/* Adım 1: Vision analiz bannerı */}
        {analyzing && (
          <View style={styles.analyzingBannerPurple}>
            <ActivityIndicator size="small" color={colors.text} />
            <Text style={styles.analyzingText}>{t('storeResult.detectingCategory')}</Text>
          </View>
        )}

        {/* AI Detay Kartı */}
        {visionResult && <AIDetailCard vision={visionResult} />}

        {/* Dolap boşsa */}
        {!items.length ? (
          <View style={styles.emptyCard}>
            <Feather name="shopping-bag" size={36} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>{t('storeResult.emptyWardrobe')}</Text>
            <Text style={styles.emptyDesc}>
              {t('storeResult.emptyDesc')}
            </Text>
          </View>
        ) : (
          <>
            {/* Adım 2: Dolap analiz bannerı */}
            {smartAnalyzing && (
              <View style={styles.analyzingBannerBlue}>
                <ActivityIndicator size="small" color={colors.textSecondary} />
                <Text style={styles.analyzingText}>{t('storeResult.analyzingWardrobe')}</Text>
              </View>
            )}

            {compatibility && (
              <>
                {/* Verdict */}
                <View style={[styles.verdictBadge, { backgroundColor: verdictColor(compatibility.verdict) }]}>
                  <Text style={styles.verdictText}>{t(verdictKey(compatibility.verdict))}</Text>
                  <Text style={styles.verdictScore}>{t('storeResult.compatScore', { score: compatibility.avgScore })}</Text>
                </View>

                {/* Uyum gerekçeleri geçici gizlendi (i18n bekliyor) — motor üretmeye devam ediyor */}

                {/* Kombin Önerileri */}
                {compatibility.combos.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>{t('storeResult.comboSuggestions')}</Text>
                    {compatibility.combos.map((comboItems, i) => (
                      <WardrobeComboCard key={i} items={comboItems} />
                    ))}
                  </>
                )}

                {/* Eksik parçalar geçici gizlendi (i18n bekliyor) */}
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

  // ── Ürün görseli ──
  productImageWrap: {
    height: 280,
    margin: spacing.md,
    borderRadius: radius.lg,
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
    bottom: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(10,10,10,0.65)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  productBadgeText: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // ── Analiz bannerları ──
  analyzingBannerPurple: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  analyzingBannerBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  analyzingText: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },

  // ── AI Detay Kartı ──
  aiDetailCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  aiDetailName: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  aiDetailCategory: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
  },
  aiDetailPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  aiDetailPill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiDetailPillText: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
  },
  aiDetailTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  aiDetailTag: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiDetailTagText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // ── Section title ──
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },

  // ── Boş dolap ──
  emptyCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  emptyDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // ── Verdict ──
  verdictBadge: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  verdictText: {
    ...typography.h3,
    color: colors.white,
    textAlign: 'center',
  },
  verdictScore: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // ── Gerekçeler ──
  reasonsCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  reasonBullet: {
    ...typography.body,
    color: colors.accent,
    lineHeight: 22,
  },
  reasonText: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },

  // ── Kombin kartı ──
  comboCard: {
    marginHorizontal: spacing.md,
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
    alignItems: 'center',
    gap: spacing.xs,
  },
  comboImg: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  comboImgLabel: {
    ...typography.caption,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
  },

  // ── Eksik parçalar ──
  missingCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  missingPlus: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.success,
  },
  missingText: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },

  bottomPad: {
    height: spacing.md,
  },
});
