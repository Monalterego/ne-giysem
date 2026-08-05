import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WardrobeStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../store/useUserStore';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import type { ClothingCategory, Fabric, Season, WardrobeItem } from '../../types';
import { CATEGORY_META, CATEGORY_ORDER, catLabel, subcatLabel } from '../../constants/categories';
import { uuidv4 } from '../../utils/uuid';
import { base64Decode } from '../../utils/base64';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';
import { Feather } from '@expo/vector-icons';
import { analyzeClothingImage } from '../../utils/visionAnalysis';
import { t } from '../../i18n';

type Props = NativeStackScreenProps<WardrobeStackParamList, 'UploadDetail'>;

const CATEGORIES = CATEGORY_ORDER.map((cat) => ({
  label: CATEGORY_META[cat].label,
  value: cat,
}));

const FABRIC_GROUPS: { groupLabel: string; items: { label: string; value: Fabric }[] }[] = [
  {
    groupLabel: 'Doğal',
    items: [
      { label: 'Pamuk',  value: 'pamuk'  },
      { label: 'Keten',  value: 'keten'  },
      { label: 'Yün',    value: 'yun'    },
      { label: 'Kaşmir', value: 'kasmir' },
      { label: 'İpek',   value: 'ipek'   },
      { label: 'Deri',   value: 'deri'   },
    ],
  },
  {
    groupLabel: 'Diğer',
    items: [
      { label: 'Polyester', value: 'polyester' },
      { label: 'Viskon',    value: 'viskon'    },
      { label: 'Saten',     value: 'saten'     },
      { label: 'Kadife',    value: 'kadife'    },
      { label: 'Şifon',     value: 'sifon'     },
      { label: 'Denim',     value: 'denim'     },
      { label: 'Triko',     value: 'triko'     },
      { label: 'Karışım',   value: 'karisim'   },
    ],
  },
];

const SEASONS: { label: string; value: Season }[] = [
  { label: 'İlkbahar', value: 'spring' },
  { label: 'Yaz', value: 'summer' },
  { label: 'Sonbahar', value: 'fall' },
  { label: 'Kış', value: 'winter' },
];

export default function UploadDetailScreen({ route, navigation }: Props) {
  const { processedBase64, originalUri, existingItem } = route.params as {
    processedBase64?: string;
    originalUri?: string;
    existingItem?: WardrobeItem;
  };
  const isEditMode = !!existingItem;

  const user       = useUserStore((s) => s.user);
  const addItem    = useWardrobeStore((s) => s.addItem);
  const updateItem = useWardrobeStore((s) => s.updateItem);

  const [category,    setCategory]    = useState<ClothingCategory | null>(existingItem?.category ?? null);
  const [subCategory, setSubCategory] = useState<string | undefined>(existingItem?.subCategory ?? undefined);
  const [fabric,      setFabric]      = useState<Fabric>(existingItem?.fabric ?? 'unknown');
  const [itemPattern, setItemPattern] = useState<string | undefined>(existingItem?.pattern ?? undefined);
  const [seasons,     setSeasons]     = useState<Season[]>(existingItem?.seasons ?? []);
  const [itemColors,  setItemColors]  = useState<string[]>(existingItem?.colors ?? []);
  const [aiDetails, setAiDetails] = useState<{
    itemName?: string; fit?: string; neckline?: string;
    sleeveLength?: string; details?: string[]; signals?: string[];
  } | null>(existingItem?.itemName ? {
    itemName: existingItem.itemName,
    fit: existingItem.fit,
    neckline: existingItem.neckline,
    sleeveLength: existingItem.sleeveLength,
    details: existingItem.details,
    signals: existingItem.signals,
  } : null);
  const [saving,      setSaving]      = useState(false);
  const [analyzing,   setAnalyzing]   = useState(!isEditMode);
  const [aiDetected,  setAiDetected]  = useState(false);
  // Vision analizi başarısız — hiçbir alan otomatik doldurulmadı, kullanıcı elle seçmeli
  const [aiFailed,    setAiFailed]    = useState(false);

  // AI'nın seçtiği kategori — "AI seçti" rozeti ve riskli-sınır onayı için
  const aiCategoryRef     = useRef<string | null>(null);
  // Onay Alert'i onaylanınca ikinci handleSave girişinde tekrar sormasın diye
  const skipCategoryConfirm = useRef(false);

  useEffect(() => {
    if (isEditMode || !processedBase64) return;
    let cancelled = false;
    analyzeClothingImage(processedBase64)
      .then((result) => {
        if (cancelled) return;
        if (result.failed) {
          // Analiz başarısız — HİÇBİR alanı otomatik doldurma, kullanıcı kendi seçsin
          setAiFailed(true);
        } else {
          aiCategoryRef.current = result.category;
          setCategory(result.category);
          if (result.subcategory) setSubCategory(result.subcategory);
          if (result.seasons.length > 0) setSeasons(result.seasons);
          if (result.colors.length > 0) setItemColors(result.colors);
          if (result.fabric) setFabric(result.fabric as Fabric);
          if (result.pattern) setItemPattern(result.pattern);
          setAiDetails({
            itemName:     result.itemName,
            fit:          result.fit,
            neckline:     result.neckline,
            sleeveLength: result.sleeveLength,
            details:      result.details,
            signals:      result.signals,
          });
        }
        setAiDetected(true);
      })
      .catch(() => {
        // Beklenmedik hata — burada da sessiz kalma, kullanıcıya "sen seç" de
        if (!cancelled) { setAiFailed(true); setAiDetected(true); }
      })
      .finally(() => {
        if (!cancelled) setAnalyzing(false);
      });
    return () => { cancelled = true; };
  }, [processedBase64, isEditMode]);

  const handleCategoryChange = (cat: ClothingCategory) => {
    setCategory(cat);
    setSubCategory(undefined);
  };

  const toggleSeason = (season: Season) => {
    setSeasons((prev) =>
      prev.includes(season) ? prev.filter((s) => s !== season) : [...prev, season],
    );
  };

  const handleSave = async () => {
    if (!category) {
      Alert.alert(t('uploadDetail.categorySelectTitle'), t('uploadDetail.categorySelectMsg'));
      return;
    }
    if (!user) return;

    // Üst↔elbise en sık karışan ve en yıkıcı vision hatası. AI bu ikisinden birini seçtiyse
    // ve kullanıcı değiştirmediyse, kaydetmeden önce tek bir onay iste.
    const riskyType = category === 'upper' || category === 'dress_jumpsuit';
    const stillAiChoice = aiCategoryRef.current === category;
    if (riskyType && stillAiChoice && !skipCategoryConfirm.current) {
      const isDress = category === 'dress_jumpsuit';
      Alert.alert(
        isDress ? t('uploadDetail.isDressTitle') : t('uploadDetail.isUpperTitle'),
        isDress ? t('uploadDetail.isDressMsg') : t('uploadDetail.isUpperMsg'),
        [
          { text: t('uploadDetail.willFix'), style: 'cancel' },
          { text: t('uploadDetail.correctSave'), onPress: () => { skipCategoryConfirm.current = true; handleSave(); } },
        ],
      );
      return;
    }

    setSaving(true);

    try {
      const uuid = uuidv4();
      const basePath = `${user.id}/${uuid}`;

      // Depolama boyutunu düşür — 1400px PNG ~3MB, 1000px ~1MB. Şeffaflık korunur (PNG kalır).
      let uploadBase64 = processedBase64;
      try {
        const shrunk = await ImageManipulator.manipulateAsync(
          `data:image/jpeg;base64,${processedBase64}`,
          [{ resize: { width: 1000 } }],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        if (shrunk.base64) uploadBase64 = shrunk.base64;
      } catch {
        // küçültme başarısızsa orijinali kullan
      }

      // base64 → Uint8Array (native-uyumlu, atob/Blob yok)
      const bytes = base64Decode(uploadBase64);

      // Tek yükleme — original ve processed aynı veri olduğu için iki kopya gereksizdi
      const { error: procError } = await supabase.storage
        .from('wardrobe-items')
        .upload(`${basePath}.jpg`, bytes, { contentType: 'image/jpeg', upsert: true });
      if (procError) throw new Error(procError.message);

      const { data: { publicUrl } } = supabase.storage
        .from('wardrobe-items')
        .getPublicUrl(`${basePath}.jpg`);
      const originalImageUrl  = publicUrl;
      const processedImageUrl = publicUrl;

      // ── Thumbnail (400px) — liste ekranlarında kullanılır, egress'i ~10x düşürür
      let thumbUrl: string | null = null;
      try {
        const thumb = await ImageManipulator.manipulateAsync(
          `data:image/jpeg;base64,${processedBase64}`,
          [{ resize: { width: 400 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        if (thumb.base64) {
          const thumbBytes = base64Decode(thumb.base64);
          const { error: thumbErr } = await supabase.storage
            .from('wardrobe-items')
            .upload(`${basePath}_thumb.jpg`, thumbBytes, {
              contentType: 'image/jpeg',
              upsert: true,
            });
          if (!thumbErr) {
            const { data } = supabase.storage
              .from('wardrobe-items')
              .getPublicUrl(`${basePath}_thumb.jpg`);
            thumbUrl = data.publicUrl;
          }
        }
      } catch {
        // thumbnail üretilemezse sorun değil — ekranlar asıl görsele düşer
      }

      // wardrobe_items tablosuna kaydet
      const now = new Date().toISOString();
      const { error: dbError } = await supabase.from('wardrobe_items').insert({
        id: uuid,
        user_id: user.id,
        category,
        subcategory:         subCategory           ?? null,
        colors:              itemColors,
        pattern:             itemPattern           ?? null,
        season:              seasons,
        fabric,
        item_name:           aiDetails?.itemName   ?? null,
        fit:                 aiDetails?.fit        ?? null,
        neckline:            aiDetails?.neckline   ?? null,
        sleeve_length:       aiDetails?.sleeveLength ?? null,
        details:             aiDetails?.details    ?? null,
        signals:             aiDetails?.signals    ?? [],
        image_url:           originalImageUrl,
        processed_image_url: processedImageUrl,
        thumb_url:           thumbUrl,
        created_at:          now,
      });
      if (dbError) throw new Error(dbError.message);

      // Yerel store'a ekle
      addItem({
        id: uuid,
        userId: user.id,
        category,
        subCategory,
        colors:       itemColors,
        pattern:      itemPattern,
        seasons,
        fabric,
        itemName:     aiDetails?.itemName,
        fit:          aiDetails?.fit,
        neckline:     aiDetails?.neckline,
        sleeveLength: aiDetails?.sleeveLength,
        details:      aiDetails?.details,
        signals:      aiDetails?.signals ?? [],
        originalImageUrl,
        processedImageUrl,
        thumbUrl: thumbUrl ?? undefined,
        createdAt: now,
      });

      navigation.navigate('WardrobeList');
    } catch (err: any) {
      Alert.alert(t('combos.errorTitle'), err.message ?? t('uploadDetail.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!category) {
      Alert.alert(t('uploadDetail.categorySelectTitle'), t('uploadDetail.categorySelectMsg'));
      return;
    }
    if (!existingItem) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('wardrobe_items')
        .update({ category, subcategory: subCategory ?? null, colors: itemColors, season: seasons, fabric })
        .eq('id', existingItem.id);
      if (error) throw new Error(error.message);

      updateItem({ ...existingItem, category, subCategory, colors: itemColors, seasons, fabric });
      navigation.navigate('WardrobeList');
    } catch (err: any) {
      Alert.alert(t('combos.errorTitle'), err.message ?? t('uploadDetail.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.back}>{t('auth.backArrow')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEditMode ? t('uploadDetail.editTitle') : t('uploadDetail.addTitle')}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Zarif mesaj — sadece ekleme modunda */}
        {!isEditMode && (
          <Text style={styles.zarifMesaj}>
            {t('uploadDetail.hint')}
          </Text>
        )}

        {/* İşlenmiş görsel */}
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri: isEditMode
                ? existingItem!.processedImageUrl
                : `data:image/jpeg;base64,${processedBase64}`,
            }}
            style={styles.image}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={150}
          />
        </View>

        {/* AI analiz banner */}
        {analyzing && (
          <View style={styles.aiBanner}>
            <ActivityIndicator size="small" color={colors.text} />
            <Text style={styles.aiBannerText}>{t('uploadDetail.aiAnalyzing')}</Text>
          </View>
        )}
        {!analyzing && aiDetected && (
          <View style={[styles.aiBanner, styles.aiBannerDone]}>
            <Feather name={aiFailed ? 'alert-circle' : 'zap'} size={14} color={aiFailed ? colors.error : colors.text} />
            <Text style={[styles.aiBannerText, aiFailed && styles.aiBannerWarn]}>
              {aiFailed ? t('uploadDetail.aiFailed') : t('uploadDetail.aiFilled')}
            </Text>
          </View>
        )}

        {/* AI Detay Kartı — yeni ekleme ve detay içeren düzenleme modunda göster */}
        {aiDetails && (aiDetails.itemName || aiDetails.fit || aiDetails.neckline || aiDetails.sleeveLength || aiDetails.details?.length) ? (
          <View style={styles.detailCard}>
            {aiDetails.itemName ? (
              <Text style={styles.detailName}>{aiDetails.itemName}</Text>
            ) : null}
            <View style={styles.detailRow}>
              {aiDetails.fit ? (
                <View style={styles.detailPill}>
                  <Text style={styles.detailPillLabel}>{t('uploadDetail.fit')}</Text>
                  <Text style={styles.detailPillValue}>{aiDetails.fit}</Text>
                </View>
              ) : null}
              {aiDetails.neckline ? (
                <View style={styles.detailPill}>
                  <Text style={styles.detailPillLabel}>{t('uploadDetail.neckline')}</Text>
                  <Text style={styles.detailPillValue}>{aiDetails.neckline}</Text>
                </View>
              ) : null}
              {aiDetails.sleeveLength ? (
                <View style={styles.detailPill}>
                  <Text style={styles.detailPillLabel}>{t('uploadDetail.sleeve')}</Text>
                  <Text style={styles.detailPillValue}>{aiDetails.sleeveLength}</Text>
                </View>
              ) : null}
            </View>
            {aiDetails.details && aiDetails.details.length > 0 ? (
              <View style={styles.detailTagsRow}>
                {aiDetails.details.map((d) => (
                  <View key={d} style={styles.detailTag}>
                    <Text style={styles.detailTagText}>{d}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Kategori */}
        <Text style={styles.sectionTitle}>
          {t('uploadDetail.category')} <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map(({ value }) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, category === value && styles.chipSelected]}
              onPress={() => handleCategoryChange(value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, category === value && styles.chipTextSelected]}>
                {catLabel(value)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Alt Kategori — kategori seçilince görünür */}
        {category && CATEGORY_META[category].subcategories.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              {t('uploadDetail.subcategory')}{' '}
              <Text style={styles.optional}>{t('uploadDetail.optional')}</Text>
            </Text>
            <View style={styles.chipRow}>
              {CATEGORY_META[category].subcategories.map(({ value }) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, subCategory === value && styles.chipSelected]}
                  onPress={() => setSubCategory(subCategory === value ? undefined : value)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, subCategory === value && styles.chipTextSelected]}>
                    {subcatLabel(value)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Kumaş */}
        <Text style={styles.sectionTitle}>{t('uploadDetail.fabric')}</Text>
        {FABRIC_GROUPS.map(({ groupLabel, items }) => (
          <View key={groupLabel}>
            <Text style={styles.fabricGroupLabel}>
              {t(groupLabel === 'Doğal' ? 'fabricGroup.natural' : 'fabricGroup.other')}
            </Text>
            <View style={styles.chipRow}>
              {items.map(({ value }) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, fabric === value && styles.chipSelected]}
                  onPress={() => setFabric(value)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, fabric === value && styles.chipTextSelected]}>
                    {t(`fabric.${value}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        <TouchableOpacity
          style={[styles.chip, fabric === 'bilmiyorum' && styles.chipSelected]}
          onPress={() => setFabric('bilmiyorum')}
          activeOpacity={0.75}
        >
          <Text style={[styles.chipText, fabric === 'bilmiyorum' && styles.chipTextSelected]}>
            {t('fabric.bilmiyorum')}
          </Text>
        </TouchableOpacity>

        {/* Mevsim */}
        <Text style={styles.sectionTitle}>
          {t('uploadDetail.season')}{' '}
          <Text style={styles.optional}>{t('uploadDetail.multiSelect')}</Text>
        </Text>
        <View style={styles.chipRow}>
          {SEASONS.map(({ value }) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, seasons.includes(value) && styles.chipSelected]}
              onPress={() => toggleSeason(value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, seasons.includes(value) && styles.chipTextSelected]}>
                {t(`season.${value}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Kategori doğrulama özeti — kaydetmeden önce mutlaka görünür */}
        {category && (
          <View style={styles.confirmCard}>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>{t('uploadDetail.category')}</Text>
              <View style={styles.confirmValueWrap}>
                <Text style={styles.confirmValue}>
                  {catLabel(category)}
                  {subCategory ? ` · ${subcatLabel(subCategory)}` : ''}
                </Text>
                {aiCategoryRef.current === category && (
                  <Text style={styles.aiTag}>{t('uploadDetail.aiChose')}</Text>
                )}
              </View>
            </View>
            <Text style={styles.confirmHint}>
              {t('uploadDetail.confirmHint')}
            </Text>
          </View>
        )}

        {/* Kaydet / Güncelle butonu */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={isEditMode ? handleUpdate : handleSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>{isEditMode ? t('uploadDetail.update') : t('uploadDetail.addToWardrobe')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  confirmCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confirmLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  confirmValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  confirmValue: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  aiTag: {
    ...typography.caption,
    color: colors.textTertiary,
    backgroundColor: colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  confirmHint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
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
  title: {
    ...typography.h3,
    color: colors.text,
  },
  headerRight: {
    width: 60,
  },
  content: {
    paddingHorizontal: layout.screenPaddingH,
    paddingBottom: spacing.xxl,
  },
  imageContainer: {
    height: 220,
    marginVertical: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  sectionTitle: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  required: {
    color: colors.accent,
  },
  optional: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  fabricGroupLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  zarifMesaj: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  chipText: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.white,
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiBannerDone: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  aiBannerText: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
    flex: 1,
  },
  aiBannerWarn: {
    color: colors.error,
  },
  // ─── AI Detay Kartı ──────────────────────────────────────────────────────────
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailName: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailPillLabel: {
    ...typography.caption,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
  },
  detailPillValue: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  detailTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  detailTag: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailTagText: {
    ...typography.caption,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
  },
  saveBtn: {
    height: 54,
    borderRadius: radius.sm,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    ...shadows.card,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
});
