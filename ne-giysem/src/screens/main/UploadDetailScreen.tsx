import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WardrobeStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../store/useUserStore';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import type { ClothingCategory, Fabric, Season, WardrobeItem } from '../../types';
import { CATEGORY_META, CATEGORY_ORDER } from '../../constants/categories';
import { colors, fonts, typography, spacing, radius, layout } from '../../constants/theme';
import { Feather } from '@expo/vector-icons';
import { analyzeClothingImage } from '../../utils/visionAnalysis';

type Props = NativeStackScreenProps<WardrobeStackParamList, 'UploadDetail'>;

const CATEGORIES = CATEGORY_ORDER.map((cat) => ({
  label: CATEGORY_META[cat].label,
  value: cat,
}));

const FABRICS: { label: string; value: Fabric }[] = [
  { label: 'Pamuk', value: 'cotton' },
  { label: 'Keten', value: 'linen' },
  { label: 'Denim', value: 'denim' },
  { label: 'Polyester', value: 'polyester' },
  { label: 'Bilmiyorum', value: 'unknown' },
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
  const [seasons,     setSeasons]     = useState<Season[]>(existingItem?.seasons ?? []);
  const [itemColors,  setItemColors]  = useState<string[]>(existingItem?.colors ?? []);
  const [aiDetails, setAiDetails] = useState<{
    itemName?: string; fit?: string; neckline?: string;
    sleeveLength?: string; details?: string[];
  } | null>(existingItem?.itemName ? {
    itemName: existingItem.itemName,
    fit: existingItem.fit,
    neckline: existingItem.neckline,
    sleeveLength: existingItem.sleeveLength,
    details: existingItem.details,
  } : null);
  const [saving,      setSaving]      = useState(false);
  const [analyzing,   setAnalyzing]   = useState(!isEditMode);
  const [aiDetected,  setAiDetected]  = useState(false);

  useEffect(() => {
    if (isEditMode || !processedBase64) return;
    let cancelled = false;
    analyzeClothingImage(processedBase64)
      .then((result) => {
        if (cancelled) return;
        setCategory(result.category);
        if (result.subcategory) setSubCategory(result.subcategory);
        if (result.seasons.length > 0) setSeasons(result.seasons);
        if (result.colors.length > 0) setItemColors(result.colors);
        setAiDetails({
          itemName:     result.itemName,
          fit:          result.fit,
          neckline:     result.neckline,
          sleeveLength: result.sleeveLength,
          details:      result.details,
        });
        setAiDetected(true);
      })
      .catch(() => {
        // Sessizce devam et — kullanıcı manuel doldurabilir
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
      Alert.alert('Kategori Seç', 'Lütfen kıyafetin kategorisini seç.');
      return;
    }
    if (!user) return;
    setSaving(true);

    try {
      const uuid = crypto.randomUUID();
      const basePath = `${user.id}/${uuid}`;

      // Orijinal görseli Storage'a yükle
      const origBlob = await fetch(originalUri).then((r) => r.blob());
      const { error: origError } = await supabase.storage
        .from('wardrobe-items')
        .upload(`${basePath}_original.jpg`, origBlob, { contentType: 'image/jpeg' });
      if (origError) throw new Error(origError.message);

      // Remove.bg çıktısını Storage'a yükle
      const procBlob = await fetch(`data:image/png;base64,${processedBase64}`).then((r) =>
        r.blob(),
      );
      const { error: procError } = await supabase.storage
        .from('wardrobe-items')
        .upload(`${basePath}.png`, procBlob, { contentType: 'image/png' });
      if (procError) throw new Error(procError.message);

      // Public URL'leri al
      const { data: { publicUrl: originalImageUrl } } = supabase.storage
        .from('wardrobe-items')
        .getPublicUrl(`${basePath}_original.jpg`);
      const { data: { publicUrl: processedImageUrl } } = supabase.storage
        .from('wardrobe-items')
        .getPublicUrl(`${basePath}.png`);

      // wardrobe_items tablosuna kaydet
      const now = new Date().toISOString();
      const { error: dbError } = await supabase.from('wardrobe_items').insert({
        id: uuid,
        user_id: user.id,
        category,
        subcategory:         subCategory           ?? null,
        colors:              itemColors,
        season:              seasons,
        fabric,
        item_name:           aiDetails?.itemName   ?? null,
        fit:                 aiDetails?.fit        ?? null,
        neckline:            aiDetails?.neckline   ?? null,
        sleeve_length:       aiDetails?.sleeveLength ?? null,
        details:             aiDetails?.details    ?? null,
        image_url:           originalImageUrl,
        processed_image_url: processedImageUrl,
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
        seasons,
        fabric,
        itemName:     aiDetails?.itemName,
        fit:          aiDetails?.fit,
        neckline:     aiDetails?.neckline,
        sleeveLength: aiDetails?.sleeveLength,
        details:      aiDetails?.details,
        originalImageUrl,
        processedImageUrl,
        createdAt: now,
      });

      navigation.navigate('WardrobeList');
    } catch (err: any) {
      Alert.alert('Hata', err.message ?? 'Kıyafet kaydedilemedi. Lütfen tekrar dene.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!category) {
      Alert.alert('Kategori Seç', 'Lütfen kıyafetin kategorisini seç.');
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
      Alert.alert('Hata', err.message ?? 'Güncelleme başarısız. Lütfen tekrar dene.');
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
          <Text style={styles.back}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEditMode ? 'Düzenle' : 'Detayları Gir'}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* İşlenmiş görsel */}
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri: isEditMode
                ? existingItem!.processedImageUrl
                : `data:image/png;base64,${processedBase64}`,
            }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        {/* AI analiz banner */}
        {analyzing && (
          <View style={styles.aiBanner}>
            <ActivityIndicator size="small" color={colors.text} />
            <Text style={styles.aiBannerText}>AI analiz ediyor…</Text>
          </View>
        )}
        {!analyzing && aiDetected && (
          <View style={[styles.aiBanner, styles.aiBannerDone]}>
            <Feather name="zap" size={14} color={colors.text} />
            <Text style={styles.aiBannerText}>AI tarafından dolduruldu · değiştirebilirsin</Text>
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
                  <Text style={styles.detailPillLabel}>Kesim</Text>
                  <Text style={styles.detailPillValue}>{aiDetails.fit}</Text>
                </View>
              ) : null}
              {aiDetails.neckline ? (
                <View style={styles.detailPill}>
                  <Text style={styles.detailPillLabel}>Yaka</Text>
                  <Text style={styles.detailPillValue}>{aiDetails.neckline}</Text>
                </View>
              ) : null}
              {aiDetails.sleeveLength ? (
                <View style={styles.detailPill}>
                  <Text style={styles.detailPillLabel}>Kol</Text>
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
          Kategori <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map(({ label, value }) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, category === value && styles.chipSelected]}
              onPress={() => handleCategoryChange(value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, category === value && styles.chipTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Alt Kategori — kategori seçilince görünür */}
        {category && CATEGORY_META[category].subcategories.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Alt Kategori{' '}
              <Text style={styles.optional}>(opsiyonel)</Text>
            </Text>
            <View style={styles.chipRow}>
              {CATEGORY_META[category].subcategories.map(({ label, value }) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, subCategory === value && styles.chipSelected]}
                  onPress={() => setSubCategory(subCategory === value ? undefined : value)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, subCategory === value && styles.chipTextSelected]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Kumaş */}
        <Text style={styles.sectionTitle}>Kumaş</Text>
        <View style={styles.chipRow}>
          {FABRICS.map(({ label, value }) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, fabric === value && styles.chipSelected]}
              onPress={() => setFabric(value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, fabric === value && styles.chipTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mevsim */}
        <Text style={styles.sectionTitle}>
          Mevsim{' '}
          <Text style={styles.optional}>(çoklu seçim)</Text>
        </Text>
        <View style={styles.chipRow}>
          {SEASONS.map(({ label, value }) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, seasons.includes(value) && styles.chipSelected]}
              onPress={() => toggleSeason(value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, seasons.includes(value) && styles.chipTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
            <Text style={styles.saveBtnText}>{isEditMode ? 'Güncelle' : 'Dolaba Ekle'}</Text>
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
