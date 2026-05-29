import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WardrobeStackParamList } from '../../navigation/types';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';

type Props = NativeStackScreenProps<WardrobeStackParamList, 'Upload'>;

const REMOVEBG_API_KEY = process.env.EXPO_PUBLIC_REMOVEBG_API_KEY ?? '';

async function removeBackground(imageUri: string): Promise<string> {
  const formData = new FormData();
  formData.append('image_file', {
    uri: imageUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as any);
  formData.append('size', 'auto');

  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: {
      'X-Api-Key': REMOVEBG_API_KEY,
      Accept: 'application/json',
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.errors?.[0]?.title ?? `Remove.bg hatası: ${res.status}`);
  }

  const json = await res.json();
  return json.data.result_b64 as string;
}

export default function UploadScreen({ navigation }: Props) {
  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [processedBase64, setProcessedBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pick = async (source: 'camera' | 'gallery') => {
    let result: ImagePicker.ImagePickerResult;

    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Kamera kullanmak için izin ver.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Galeriye erişmek için izin ver.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    }

    if (result.canceled || !result.assets?.[0]) return;

    const uri = result.assets[0].uri;
    setOriginalUri(uri);
    setProcessedBase64(null);
    setLoading(true);

    try {
      if (Platform.OS === 'web') {
        // Web'de Remove.bg'yi atla — orijinal görseli base64'e çevir
        const res = await fetch(uri);
        const blob = await res.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const data = reader.result as string;
            resolve(data.includes(',') ? data.split(',')[1] : data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        setProcessedBase64(base64);
      } else {
        const base64 = await removeBackground(uri);
        setProcessedBase64(base64);
      }
    } catch (err: any) {
      Alert.alert('Hata', err.message ?? 'Arkaplan silinemedi. Lütfen tekrar dene.');
      setOriginalUri(null);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!processedBase64 || !originalUri) return;
    navigation.navigate('UploadDetail', { processedBase64, originalUri });
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
        <Text style={styles.title}>Kıyafet Ekle</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Seçim ekranı */}
      {!originalUri && !loading && (
        <View style={styles.pickContainer}>
          <Text style={styles.hint}>Kıyafetini nasıl eklemek istersin?</Text>

          <TouchableOpacity
            style={styles.pickCard}
            onPress={() => pick('camera')}
            activeOpacity={0.85}
          >
            <Feather name="camera" size={28} color={colors.text} />
            <View style={styles.pickCardText}>
              <Text style={styles.pickCardTitle}>Kamera ile Çek</Text>
              <Text style={styles.pickCardSub}>Şu an elindeki kıyafeti fotoğrafla</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pickCard, styles.pickCardSecondary]}
            onPress={() => pick('gallery')}
            activeOpacity={0.85}
          >
            <Feather name="image" size={28} color={colors.text} />
            <View style={styles.pickCardText}>
              <Text style={styles.pickCardTitle}>Galeriden Seç</Text>
              <Text style={styles.pickCardSub}>Telefonundaki fotoğraflardan seç</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>En iyi sonuç için</Text>
            <Text style={styles.tipText}>• Düz ve tek renkli bir zemin kullan</Text>
            <Text style={styles.tipText}>• Kıyafeti düz ve gergin tut</Text>
            <Text style={styles.tipText}>• Yeterli ışık olduğundan emin ol</Text>
          </View>
        </View>
      )}

      {/* Yükleniyor */}
      {loading && originalUri && (
        <View style={styles.loadingContainer}>
          <Image source={{ uri: originalUri }} style={styles.previewImage} resizeMode="contain" />
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>Arkaplan siliniyor…</Text>
          </View>
        </View>
      )}

      {/* Sonuç */}
      {processedBase64 && !loading && (
        <View style={styles.resultContainer}>
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: `data:image/png;base64,${processedBase64}` }}
              style={styles.previewImage}
              resizeMode="contain"
            />
            <View style={styles.badge}>
              <Feather name="check" size={12} color={colors.white} />
              <Text style={styles.badgeText}>
                {Platform.OS === 'web' ? 'BG Temizlendi (Web Modu)' : 'BG Temizlendi'}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => { setOriginalUri(null); setProcessedBase64(null); }}
              activeOpacity={0.75}
            >
              <Text style={styles.secondaryBtnText}>Yeniden Seç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Devam Et →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  // --- Seçim ekranı ---
  pickContainer: {
    flex: 1,
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.xl,
  },
  hint: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  pickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  pickCardSecondary: {
    backgroundColor: colors.surface,
  },
  pickCardText: {
    flex: 1,
  },
  pickCardTitle: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    marginBottom: 2,
  },
  pickCardSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  tipBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipTitle: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  tipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  // --- Yükleniyor ---
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '80%',
    height: '60%',
  },
  loadingOverlay: {
    position: 'absolute',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
  },
  loadingText: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  // --- Sonuç ---
  resultContainer: {
    flex: 1,
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  imageWrapper: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.success,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badgeText: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  primaryBtn: {
    flex: 2,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
});
