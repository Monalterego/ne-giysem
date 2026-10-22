import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { ScanStackParamList } from '../../navigation/types';
import { usePlanStore } from '../../store/usePlanStore';
import { guardScan } from '../../lib/premiumGate';
import { ensureAiDecision, openAiConsent } from '../../lib/aiConsent';
import { useConsentStore, aiStatus } from '../../store/useConsentStore';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';
import { scrapeProductImage } from '../../utils/urlScraper';
import { toUploadJpeg, alertAfterPicker } from '../../utils/imageNormalize';
import { callEdge, edgeError, EdgeError, isAiConsentError } from '../../lib/edgeFunctions';
import { friendlyError } from '../../utils/errorMessage';
import { t } from '../../i18n';
import { upper } from '../../utils/text';

type Props = NativeStackScreenProps<ScanStackParamList, 'ScanHome'>;

async function removeBackground(imageBase64: string): Promise<string> {
  const res = await callEdge('bg-removal-proxy', { image_b64: imageBase64 });
  if (!res.ok) throw await edgeError(res);
  const json = await res.json();
  const out = (json as any)?.result_b64;
  // Boş sonuç sessizce "başarı" sayılmasın
  if (typeof out !== 'string' || !out) throw new Error('bg-removal: result_b64 yok');
  return out;
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

  // Ücretsiz plan: bu ayki kalan "Uyar mı?" hakkı (limit null = sınırsız → gösterilmez)
  const scanUsage = usePlanStore((s) => s.usage?.scan ?? null);
  const scanLeft  = scanUsage && scanUsage.limit !== null
    ? Math.max(0, scanUsage.limit - scanUsage.used)
    : null;
  useFocusEffect(useCallback(() => { usePlanStore.getState().refresh(); }, []));

  // Tarama yapay zekâ olmadan çalışmaz: ilk taramadan önce izin ekranı; reddedildiyse kapalı
  const aiDeclined = useConsentStore((s) => aiStatus(s.records) === 'declined');
  const ensureAi = async (): Promise<boolean> => (await ensureAiDecision()) === 'granted';

  const handlePick = async (source: 'camera' | 'gallery') => {
    if (!(await ensureAi())) return;
    // Ön kontrol (hak harcamaz) — hak bittiyse kamera/galeri hiç açılmaz
    if (!(await guardScan())) return;

    let result: ImagePicker.ImagePickerResult;

    // Picker base64 yalnız web'de (manipulator yok); native'de tek kaynak toUploadJpeg
    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.8,
      base64: Platform.OS === 'web',
      exif: false,
    };
    try {
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('errors.permissionTitle'), t('errors.cameraPermission'));
          return;
        }
        result = await ImagePicker.launchCameraAsync(pickerOptions);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('errors.permissionTitle'), t('errors.galleryPermission'));
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      }
    } catch (err) {
      console.warn(`[Scan] ${source} picker açılamadı:`, err);
      alertAfterPicker(t('combos.errorTitle'), t('errors.imageReadFailed'));
      return;
    }

    if (result.canceled) return;   // kullanıcı vazgeçti — mesaj gerekmez
    const asset = result.assets?.[0];
    if (!asset) {
      console.warn(`[Scan] ${source}: canceled=false ama asset yok`);
      alertAfterPicker(t('combos.errorTitle'), t('errors.imageReadFailed'));
      return;
    }
    const uri = asset.uri;

    setLoadingUri(uri);
    setLoadingStep(t('scan.preparingImage'));
    setLoading(true);

    try {
      let base64Input: string;
      if (Platform.OS === 'web') {
        if (!asset.base64) throw new Error('web: picker base64 dönmedi');
        base64Input = asset.base64;
      } else {
        base64Input = (await toUploadJpeg(uri, asset.width, asset.height)).base64;
        setLoadingStep(t('scan.removingBg'));
      }
      const processedBase64 = await processBase64(base64Input);
      navigation.navigate('StoreResult', { processedBase64, originalUri: uri });
    } catch (err) {
      console.warn(`[Scan] ${source} hazırlama/arka plan başarısız:`, err);
      // 403: izin başka yerde geri çekilmiş → durumu tazele, ekran "kapalı"ya döner
      if (isAiConsentError(err)) useConsentStore.getState().refresh();
      alertAfterPicker(t('combos.errorTitle'), friendlyError(err));
    } finally {
      setLoading(false);
      setLoadingUri(null);
      setLoadingStep('');
    }
  };

  const handleUrlAnalyze = async () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!(await ensureAi())) return;
    if (!(await guardScan())) return;
    setLoading(true);
    setLoadingUri(null);
    try {
      setLoadingStep(t('scan.readingProduct'));
      const scraped = await scrapeProductImage(url);
      // Ürün görselleri boyut/format açısından kontrolsüz → aynı normalizasyon
      const imageBase64 = Platform.OS === 'web'
        ? scraped
        : (await toUploadJpeg(`data:image/jpeg;base64,${scraped}`)).base64;
      setLoadingStep(Platform.OS === 'web' ? t('scan.preparingImage') : t('scan.removingBg'));
      const processedBase64 = await processBase64(imageBase64);
      navigation.navigate('StoreResult', { processedBase64, originalUri: url });
    } catch (err) {
      console.warn('[Scan] url akışı başarısız:', err);
      // fetch-product kodları → anlamlı mesaj; diğerleri (oturum, sınır, boyut,
      // zaman aşımı) friendlyError; teknik mesaj gösterilmez
      let msg = t('errors.productImageFailed');
      if (err instanceof EdgeError) {
        if (err.code === 'og-image-not-found') msg = t('errors.productImageNotFound');
        else if (err.code === 'invalid-url' || err.code === 'blocked-host' || err.code === 'too-many-redirects') {
          msg = t('errors.productUrlInvalid');
        } else if (err.code === 'upstream-error' || err.code === 'not-an-image') {
          msg = t('errors.productImageFailed');
        } else {
          msg = friendlyError(err);
        }
      }
      Alert.alert(t('combos.errorTitle'), msg);
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
            {scanLeft !== null && scanUsage?.limit != null && (
              <Text style={styles.scanQuota}>
                {t('premium.scanRemaining', { left: scanLeft, limit: scanUsage.limit })}
              </Text>
            )}
          </View>

          {aiDeclined ? (
            // Yapay zekâ izni yok → tarama kapalı; nedeni ve açma yolu
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.iconBox}>
                  <Feather name="lock" size={20} color={colors.text} />
                </View>
                <View style={styles.cardTextWrap}>
                  <Text style={styles.cardTitle}>{t('scan.disabledTitle')}</Text>
                  <Text style={styles.cardDesc}>{t('scan.disabledBody')}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => openAiConsent()}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>{t('scan.enableAi')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <>
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
                <Text style={styles.soonText}>{upper(t('scan.soon'))}</Text>
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
          </>
          )}

          <View style={styles.bottomPad} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Yükleniyor overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          {loadingUri && (
            <Image source={{ uri: loadingUri }} style={styles.loadingPreview} contentFit="contain" />
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
  scanQuota: {
    ...typography.bodySmall,
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
    marginTop: spacing.sm,
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
    ...StyleSheet.absoluteFill,
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
