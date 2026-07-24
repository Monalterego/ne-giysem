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
import * as ImageManipulator from 'expo-image-manipulator';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WardrobeStackParamList } from '../../navigation/types';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../utils/errorMessage';
import { t } from '../../i18n';

type Props = NativeStackScreenProps<WardrobeStackParamList, 'Upload'>;

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

export default function UploadScreen({ navigation }: Props) {
  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [processedBase64, setProcessedBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pick = async (source: 'camera' | 'gallery') => {
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

    // ⚠️ HEIC → JPEG + küçültme.
    //    iPhone galerisi HEIC verir, poof.bg kabul etmez (sadece PNG/JPG/WEBP).
    //    Ayrıca 12MP base64 ~8MB → yükleme timeout. 1400px + JPEG ile ~400KB'a iner.
    let uri = asset.uri;
    let base64Input: string | null | undefined = null;
    try {
      const normalized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1400 } }],   // yükseklik oranla ölçeklenir
        {
          compress: 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );
      uri = normalized.uri;
      base64Input = normalized.base64;
    } catch {
      // Normalizasyon başarısız → picker'ın kendi çıktısına düş (kamera yolu zaten JPEG)
      base64Input = asset.base64;
    }

    if (!base64Input) {
      Alert.alert(t('combos.errorTitle'), t('errors.imageReadFailed'));
      return;
    }

    setOriginalUri(uri);
    setProcessedBase64(null);
    setLoading(true);

    try {
      if (Platform.OS === 'web') {
        // Web: Remove.bg atla, picker'dan gelen base64'ü direkt kullan
        setProcessedBase64(base64Input);
      } else {
        const processed = await removeBackground(base64Input);
        setProcessedBase64(processed);
      }
    } catch (err) {
      Alert.alert(t('combos.errorTitle'), friendlyError(err));
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
          <Text style={styles.back}>{t('auth.backArrow')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('upload.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Seçim ekranı */}
      {!originalUri && !loading && (
        <View style={styles.pickContainer}>
          <Text style={styles.hint}>{t('upload.howToAdd')}</Text>

          <TouchableOpacity
            style={styles.pickCard}
            onPress={() => pick('camera')}
            activeOpacity={0.85}
          >
            <Feather name="camera" size={28} color={colors.text} />
            <View style={styles.pickCardText}>
              <Text style={styles.pickCardTitle}>{t('upload.cameraTitle')}</Text>
              <Text style={styles.pickCardSub}>{t('upload.cameraSub')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pickCard, styles.pickCardSecondary]}
            onPress={() => pick('gallery')}
            activeOpacity={0.85}
          >
            <Feather name="image" size={28} color={colors.text} />
            <View style={styles.pickCardText}>
              <Text style={styles.pickCardTitle}>{t('upload.galleryTitle')}</Text>
              <Text style={styles.pickCardSub}>{t('upload.gallerySub')}</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.photoTip}>{t('upload.photoTip')}</Text>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>{t('upload.tipTitle')}</Text>
            <Text style={styles.tipText}>{t('upload.tip1')}</Text>
            <Text style={styles.tipText}>{t('upload.tip2')}</Text>
            <Text style={styles.tipText}>{t('upload.tip3')}</Text>
          </View>
        </View>
      )}

      {/* Yükleniyor */}
      {loading && originalUri && (
        <View style={styles.loadingContainer}>
          <Image source={{ uri: originalUri }} style={styles.previewImage} resizeMode="contain" />
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>{t('scan.removingBg')}</Text>
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
                {Platform.OS === 'web' ? t('upload.bgCleanedWeb') : t('upload.bgCleaned')}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => { setOriginalUri(null); setProcessedBase64(null); }}
              activeOpacity={0.75}
            >
              <Text style={styles.secondaryBtnText}>{t('upload.reselect')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{t('physicalProfile.continue')}</Text>
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
  photoTip: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
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
