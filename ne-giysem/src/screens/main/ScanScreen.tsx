import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ScanStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../constants/theme';
import { scrapeProductImage } from '../../utils/urlScraper';

type Props = NativeStackScreenProps<ScanStackParamList, 'ScanHome'>;

const REMOVEBG_API_KEY = process.env.EXPO_PUBLIC_REMOVEBG_API_KEY ?? '';

async function removeBackground(imageUri: string): Promise<string> {
  const formData = new FormData();
  formData.append('image_file', { uri: imageUri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  formData.append('size', 'auto');

  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': REMOVEBG_API_KEY, Accept: 'application/json' },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.errors?.[0]?.title ?? `Remove.bg hatası: ${res.status}`);
  }
  const json = await res.json();
  return json.data.result_b64 as string;
}

// Remove.bg JSON API — dosya URI yerine base64 kabul eder
async function removeBackgroundFromBase64(base64: string): Promise<string> {
  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: {
      'X-Api-Key': REMOVEBG_API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image_base64: base64, size: 'auto' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.errors?.[0]?.title ?? `Remove.bg hatası: ${res.status}`);
  }
  const json = await res.json();
  return (json as any).data.result_b64 as string;
}

// URL scraping'den gelen base64'ü işle
async function processBase64(base64: string): Promise<string> {
  if (Platform.OS === 'web') return base64; // web'de BG removal yok
  return removeBackgroundFromBase64(base64);
}

async function processImage(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    // Web'de Remove.bg'yi atla, base64'e çevir
    const res = await fetch(uri);
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const data = reader.result as string;
        resolve(data.includes(',') ? data.split(',')[1] : data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  return removeBackground(uri);
}

export default function ScanScreen({ navigation }: Props) {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUri, setLoadingUri] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState('');

  const handlePick = async (source: 'camera' | 'gallery') => {
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
    setLoadingUri(uri);
    setLoadingStep(Platform.OS === 'web' ? 'Görsel hazırlanıyor…' : 'Arkaplan siliniyor…');
    setLoading(true);

    try {
      const processedBase64 = await processImage(uri);
      navigation.navigate('StoreResult', { processedBase64, originalUri: uri });
    } catch (err: any) {
      Alert.alert('Hata', err.message ?? 'Görsel işlenemedi. Lütfen tekrar dene.');
    } finally {
      setLoading(false);
      setLoadingUri(null);
      setLoadingStep('');
    }
  };

  const handleUrlAnalyze = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setLoading(true);
    setLoadingUri(null);
    try {
      setLoadingStep('Ürün sayfası okunuyor…');
      const imageBase64 = await scrapeProductImage(url);
      setLoadingStep(Platform.OS === 'web' ? 'Görsel hazırlanıyor…' : 'Arkaplan siliniyor…');
      const processedBase64 = await processBase64(imageBase64);
      navigation.navigate('StoreResult', { processedBase64, originalUri: url });
    } catch (err: any) {
      Alert.alert('Hata', err.message ?? 'Ürün görseli alınamadı. Lütfen tekrar dene.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Başlık */}
          <View style={styles.header}>
            <Text style={styles.title}>Mağaza Tarama</Text>
            <Text style={styles.subtitle}>
              Mağazadaki ürünü fotoğrafla, dolabınla uyumunu gör
            </Text>
          </View>

          {/* Kamera seçeneği */}
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardIcon}>📷</Text>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>Mağazada Fotoğrafla</Text>
                <Text style={styles.cardDesc}>
                  Beğendiğin ürünün fotoğrafını çek, dolabınla anında karşılaştır
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => handlePick('camera')}
              activeOpacity={0.85}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>Fotoğraf Çek</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>veya</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* URL seçeneği */}
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardIcon}>🔗</Text>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>URL Yapıştır</Text>
                <Text style={styles.cardDesc}>
                  Zara, H&M, Mango gibi sitelerden ürün linki yapıştır
                </Text>
              </View>
            </View>
            <TextInput
              style={styles.urlInput}
              placeholder="https://www.zara.com/..."
              placeholderTextColor={colors.muted}
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              keyboardType="url"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.secondaryBtn, (!urlInput || loading) && styles.btnDisabled]}
              onPress={handleUrlAnalyze}
              activeOpacity={0.85}
              disabled={!urlInput || loading}
            >
              <Text style={styles.secondaryBtnText}>Analiz Et</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>veya</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Galeri seçeneği */}
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardIcon}>🖼️</Text>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>Görsel Yükle</Text>
                <Text style={styles.cardDesc}>
                  Telefonundaki ürün screenshot'ını galeriden seç
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => handlePick('gallery')}
              activeOpacity={0.85}
              disabled={loading}
            >
              <Text style={styles.secondaryBtnText}>Galeriden Seç</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Yükleniyor overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          {loadingUri && (
            <Image source={{ uri: loadingUri }} style={styles.loadingPreview} resizeMode="contain" />
          )}
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>{loadingStep}</Text>
            <Text style={styles.loadingSubText}>Dolabınla karşılaştırılıyor</Text>
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
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.headingBold,
    color: colors.primary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.muted,
    lineHeight: 20,
  },
  // Kartlar
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
    boxShadow: '0 1px 6px rgba(26,26,46,0.04)',
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardIcon: {
    fontSize: 28,
    marginTop: 2,
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.muted,
    lineHeight: 18,
  },
  // URL Input
  urlInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.primary,
    backgroundColor: colors.background,
  },
  // Butonlar
  primaryBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 8px rgba(233,69,96,0.25)',
    elevation: 3,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  secondaryBtn: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  // Ayırıcı
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  bottomPad: {
    height: 16,
  },
  // Yükleniyor
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(250,250,250,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  loadingPreview: {
    width: 180,
    height: 220,
    borderRadius: 16,
    opacity: 0.5,
  },
  loadingBox: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    paddingHorizontal: 36,
    paddingVertical: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 4px 12px rgba(26,26,46,0.08)',
    elevation: 4,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  loadingSubText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.muted,
  },
});
