import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WardrobeStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../constants/theme';

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
      const base64 = await removeBackground(uri);
      setProcessedBase64(base64);
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
            <Text style={styles.pickCardIcon}>📷</Text>
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
            <Text style={styles.pickCardIcon}>🖼️</Text>
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
              <Text style={styles.badgeText}>✓  BG Temizlendi</Text>
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
  // --- Seçim ekranı ---
  pickContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  hint: {
    fontSize: 18,
    fontFamily: fonts.headingBold,
    color: colors.primary,
    marginBottom: 24,
    textAlign: 'center',
  },
  pickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 12,
  },
  pickCardSecondary: {
    backgroundColor: colors.background,
  },
  pickCardIcon: {
    fontSize: 32,
  },
  pickCardText: {
    flex: 1,
  },
  pickCardTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
    marginBottom: 2,
  },
  pickCardSub: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  tipBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipTitle: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.muted,
    marginBottom: 4,
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
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 16,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },
  // --- Sonuç ---
  resultContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  imageWrapper: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: 20,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.success,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },
  primaryBtn: {
    flex: 2,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
});
