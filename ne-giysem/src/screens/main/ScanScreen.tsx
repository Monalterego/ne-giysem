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
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ScanStackParamList } from '../../navigation/types';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';
import { scrapeProductImage } from '../../utils/urlScraper';
import { supabase } from '../../lib/supabase';
import { t } from '../../i18n';

type Props = NativeStackScreenProps<ScanStackParamList, 'ScanHome'>;

const BG_PROXY_URL = 'https://bdvrgbylirftuxmrpbea.supabase.co/functions/v1/bg-removal-proxy';

async function removeBackground(imageBase64: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(BG_PROXY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image_b64: imageBase64 }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error ?? `Arka plan kaldırma hatası: ${res.status}`);
  }
  const json = await res.json();
  return (json as any).result_b64 as string;
}

async function processBase64(base64: string): Promise<string> {
  if (Platform.OS === 'web') return base64;
  return removeBackground(base64);
}

export default function ScanScreen({ navigation }: Props) {
  const [urlInput,     setUrlInput]     = useState('');
  const [loading,      setLoading]      = useState(false);
  const [loadingUri,   setLoadingUri]   = useState<string | null>(null);
  const [loadingStep,  setLoadingStep]  = useState('');

  const handlePick = async (source: 'camera' | 'gallery') => {
    let result: ImagePicker.ImagePickerResult;

    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('errors.permissionTitle'), t('errors.cameraPermission'));
        return;
      }
      result = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: true });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('errors.permissionTitle'), t('errors.galleryPermission'));
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, base64: true });
    }

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const uri   = asset.uri;
    const base64Input = asset.base64;
    if (!base64Input) {
      Alert.alert(t('combos.errorTitle'), t('errors.imageReadFailed'));
      return;
    }

    setLoadingUri(uri);
    setLoadingStep(Platform.OS === 'web' ? t('scan.preparingImage') : t('scan.removingBg'));
    setLoading(true);

    try {
      const processedBase64 = await processBase64(base64Input);
      navigation.navigate('StoreResult', { processedBase64, originalUri: uri });
    } catch (err: any) {
      Alert.alert(t('combos.errorTitle'), err.message ?? t('errors.imageProcessFailed'));
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
      setLoadingStep(t('scan.readingProduct'));
      const imageBase64 = await scrapeProductImage(url);
      setLoadingStep(Platform.OS === 'web' ? t('scan.preparingImage') : t('scan.removingBg'));
      const processedBase64 = await processBase64(imageBase64);
      navigation.navigate('StoreResult', { processedBase64, originalUri: url });
    } catch (err: any) {
      Alert.alert(t('combos.errorTitle'), err.message ?? t('errors.productImageFailed'));
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
            <Text style={styles.title}>{t('scan.title')}</Text>
            <Text style={styles.subtitle}>
              {t('scan.subtitle')}
            </Text>
          </View>

          {/* Kamera */}
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.iconBox}>
                <Feather name="camera" size={20} color={colors.text} />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{t('scan.cameraTitle')}</Text>
                <Text style={styles.cardDesc}>
                  {t('scan.cameraDesc')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => handlePick('camera')}
              activeOpacity={0.85}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>{t('scan.takePhoto')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('common.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* URL */}
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.iconBox}>
                <Feather name="link" size={20} color={colors.text} />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{t('scan.urlTitle')}</Text>
                <Text style={styles.cardDesc}>
                  {t('scan.urlDesc')}
                </Text>
              </View>
              <View style={styles.soonBadge}>
                <Text style={styles.soonText}>{t('scan.soon')}</Text>
              </View>
            </View>
            <TextInput
              style={[styles.urlInput, styles.inputDisabled]}
              placeholder={t('scan.urlPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              keyboardType="url"
              autoCorrect={false}
              editable={false}
            />
            <Text style={styles.comingSoonNote}>
              {t('scan.urlNote')}
            </Text>
            <TouchableOpacity
              style={[styles.secondaryBtn, styles.btnDisabled]}
              activeOpacity={1}
              disabled={true}
            >
              <Text style={styles.secondaryBtnText}>{t('scan.analyze')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('common.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Galeri */}
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.iconBox}>
                <Feather name="image" size={20} color={colors.text} />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{t('scan.galleryTitle')}</Text>
                <Text style={styles.cardDesc}>
                  {t('scan.galleryDesc')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => handlePick('gallery')}
              activeOpacity={0.85}
              disabled={loading}
            >
              <Text style={styles.secondaryBtnText}>{t('scan.pickFromGallery')}</Text>
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
            <ActivityIndicator color={colors.textSecondary} size="large" />
            <Text style={styles.loadingText}>{loadingStep}</Text>
            <Text style={styles.loadingSubText}>{t('scan.comparingWardrobe')}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: layout.screenPaddingH,
    paddingBottom: spacing.lg,
  },

  // Başlık
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Kart
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadows.subtle,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs - 2,
  },
  cardDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // "Yakında" badge
  soonBadge: {
    paddingVertical: spacing.xs - 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  soonText: {
    ...typography.label,
    color: colors.textSecondary,
  },

  comingSoonNote: {
    ...typography.caption,
    color: colors.textTertiary,
    lineHeight: 17,
  },

  // URL input
  urlInput: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...typography.bodySmall,
    color: colors.text,
    backgroundColor: colors.background,
  },
  inputDisabled: {
    opacity: 0.4,
    backgroundColor: colors.surface,
  },

  // Birincil buton — siyah
  primaryBtn: {
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // İkincil buton — beyaz + border
  secondaryBtn: {
    height: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  secondaryBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  btnDisabled: {
    opacity: 0.4,
  },

  // Ayırıcı
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.caption,
    color: colors.textTertiary,
  },

  bottomPad: {
    height: spacing.md,
  },

  // Yükleniyor overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(250,250,248,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  loadingPreview: {
    width: 160,
    height: 200,
    borderRadius: radius.md,
    opacity: 0.45,
  },
  loadingBox: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  loadingText: {
    ...typography.h3,
    color: colors.text,
  },
  loadingSubText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
