import React, { useState } from 'react';
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
import type { ClothingCategory, Fabric, Season } from '../../types';
import { colors, fonts } from '../../constants/theme';

type Props = NativeStackScreenProps<WardrobeStackParamList, 'UploadDetail'>;

const CATEGORIES: { label: string; value: ClothingCategory }[] = [
  { label: 'Üst', value: 'upper' },
  { label: 'Alt', value: 'lower' },
  { label: 'Dış', value: 'outer' },
  { label: 'Ayakkabı', value: 'shoes' },
  { label: 'Aksesuar', value: 'accessory' },
];

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
  const { processedBase64, originalUri } = route.params;
  const user = useUserStore((s) => s.user);
  const addItem = useWardrobeStore((s) => s.addItem);

  const [category, setCategory] = useState<ClothingCategory | null>(null);
  const [fabric, setFabric] = useState<Fabric>('unknown');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [saving, setSaving] = useState(false);

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
        colors: [],
        season: seasons,
        fabric,
        image_url: originalImageUrl,
        processed_image_url: processedImageUrl,
        created_at: now,
      });
      if (dbError) throw new Error(dbError.message);

      // Yerel store'a ekle
      addItem({
        id: uuid,
        userId: user.id,
        category,
        colors: [],
        seasons,
        fabric,
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
        <Text style={styles.title}>Detayları Gir</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* İşlenmiş görsel */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: `data:image/png;base64,${processedBase64}` }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        {/* Kategori */}
        <Text style={styles.sectionTitle}>
          Kategori <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map(({ label, value }) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, category === value && styles.chipSelected]}
              onPress={() => setCategory(value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, category === value && styles.chipTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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

        {/* Kaydet butonu */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>Dolaba Ekle</Text>
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
  title: {
    fontSize: 17,
    fontFamily: fonts.headingBold,
    color: colors.primary,
  },
  headerRight: {
    width: 60,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  imageContainer: {
    height: 220,
    marginVertical: 20,
    borderRadius: 20,
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
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
    marginBottom: 10,
    marginTop: 4,
  },
  required: {
    color: colors.accent,
  },
  optional: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },
  chipTextSelected: {
    color: colors.white,
  },
  saveBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
});
