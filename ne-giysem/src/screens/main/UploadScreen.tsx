import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WardrobeStackParamList } from '../../navigation/types';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';
import { callEdge, edgeError, isAiConsentError } from '../../lib/edgeFunctions';
import { friendlyError } from '../../utils/errorMessage';
import { toUploadJpeg, alertAfterPicker } from '../../utils/imageNormalize';
import { ensureAiDecision, openAiConsent } from '../../lib/aiConsent';
import { useConsentStore, aiStatus } from '../../store/useConsentStore';
import { t } from '../../i18n';
import PhotoGuideModal from '../../components/PhotoGuideModal';
// Statik import — Metro dinamik yolu çözemez
import garmentDoTop from '../../../assets/guide/garment_do_top.jpg';
import garmentDoBottom from '../../../assets/guide/garment_do_bottom.jpg';
import garmentDoDress from '../../../assets/guide/garment_do_dress.jpg';
import garmentDontFolded from '../../../assets/guide/garment_dont_folded.jpg';
import garmentDontCrumpled from '../../../assets/guide/garment_dont_crumpled.jpg';
import garmentDontOverlap from '../../../assets/guide/garment_dont_overlap.jpg';
import garmentDontDark from '../../../assets/guide/garment_dont_dark.jpg';

type Props = NativeStackScreenProps<WardrobeStackParamList, 'Upload'>;

async function removeBackground(imageBase64: string): Promise<string> {
  const res = await callEdge('bg-removal-proxy', { image_b64: imageBase64 });
  if (!res.ok) throw await edgeError(res);

  const json = await res.json();
  const out = (json as any)?.result_b64;
  // Boş sonuç sessizce "başarı" sayılmasın — sonuç ekranı boş kalırdı
  if (typeof out !== 'string' || !out) throw new Error('bg-removal: result_b64 yok');
  return out;
}

export default function UploadScreen({ navigation }: Props) {
  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [processedBase64, setProcessedBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  // Yapay zekâ izni yok → fotoğraf olduğu gibi, otomatik tanıma yok (elle akış)
  const [manual, setManual] = useState(false);
  const aiDeclined = useConsentStore((s) => aiStatus(s.records) === 'declined');

  const pick = async (source: 'camera' | 'gallery') => {
    // İlk eklemeden önce yapay zekâ izni (karar verildiyse ekran açılmaz).
    // Karar verilmeden kapandıysa hiçbir şey yapma.
    const decision = await ensureAiDecision();
    if (decision === 'dismissed') return;
    const useAi = decision === 'granted';

    let result: ImagePicker.ImagePickerResult;

    // Picker base64 İSTENMEZ: galeride tam çözünürlüklü (HEIC/12–48 MP) olabilir ve
    // eskiden manipulate başarısız olunca bu ham base64 doğrudan Poof'a gidiyordu.
    // Tek kaynak toUploadJpeg (JPEG, uzun kenar ≤ 1400, boyut tavanı).
    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.8,
      base64: Platform.OS === 'web',   // web'de manipulator yok → picker çıktısı kullanılır
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
      console.warn(`[Upload] ${source} picker açılamadı:`, err);
      alertAfterPicker(t('combos.errorTitle'), t('errors.imageReadFailed'));
      return;
    }

    if (result.canceled) return;   // kullanıcı vazgeçti — mesaj gerekmez
    const asset = result.assets?.[0];
    if (!asset) {
      console.warn(`[Upload] ${source}: canceled=false ama asset yok`);
      alertAfterPicker(t('combos.errorTitle'), t('errors.imageReadFailed'));
      return;
    }
    console.log(`[Upload] ${source} asset`, {
      w: asset.width, h: asset.height, mime: asset.mimeType ?? '?', size: asset.fileSize ?? '?', ai: useAi,
    });

    // Hazırlanırken önizleme + bekleme göster (büyük galeri görseli birkaç saniye sürebilir)
    setOriginalUri(asset.uri);
    setProcessedBase64(null);
    setManual(!useAi);
    setLoading(true);

    let uri = asset.uri;
    let base64Input: string;
    try {
      if (Platform.OS === 'web') {
        // Web: arka plan kaldırma yok, picker'ın base64'ü olduğu gibi
        if (!asset.base64) throw new Error('web: picker base64 dönmedi');
        base64Input = asset.base64;
      } else {
        const normalized = await toUploadJpeg(asset.uri, asset.width, asset.height);
        uri = normalized.uri;
        base64Input = normalized.base64;
      }
    } catch (err) {
      console.warn(`[Upload] ${source} görsel hazırlanamadı:`, err);
      setLoading(false);
      setOriginalUri(null);
      alertAfterPicker(t('combos.errorTitle'), friendlyError(err));
      return;
    }
    setOriginalUri(uri);

    // İzin yok: arka plan kaldırılmaz, fotoğraf olduğu gibi kaydedilir
    if (!useAi) {
      setProcessedBase64(base64Input);
      setLoading(false);
      return;
    }

    try {
      // Web: Remove.bg atla, picker'dan gelen base64'ü direkt kullan
      const processed = Platform.OS === 'web' ? base64Input : await removeBackground(base64Input);
      setProcessedBase64(processed);
    } catch (err) {
      // İzin başka cihazda geri çekilmiş olabilir (sunucu 403) → elle akışa düş
      if (isAiConsentError(err)) {
        console.warn('[Upload] bg-removal 403 ai-consent-required → elle akış');
        useConsentStore.getState().refresh();
        setManual(true);
        setProcessedBase64(base64Input);
      } else {
        console.warn(`[Upload] ${source} bg-removal başarısız (b64=${base64Input.length}):`, err);
        setOriginalUri(null);
        alertAfterPicker(t('combos.errorTitle'), friendlyError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!processedBase64 || !originalUri) return;
    navigation.navigate('UploadDetail', { processedBase64, originalUri, manual });
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
          <TouchableOpacity onPress={() => setGuideVisible(true)} activeOpacity={0.7}>
            <Text style={styles.guideLink}>{t('upload.photoGuideLink')}</Text>
          </TouchableOpacity>

          {/* İzin verilmedi: ne olduğunu söyle, istersen aç */}
          {aiDeclined && (
            <View style={styles.manualBox}>
              <Text style={styles.tipText}>{t('upload.manualNote')}</Text>
              <TouchableOpacity onPress={() => openAiConsent()} activeOpacity={0.7}>
                <Text style={styles.guideLinkLeft}>{t('upload.enableAi')}</Text>
              </TouchableOpacity>
            </View>
          )}

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
          <Image source={{ uri: originalUri }} style={styles.previewImage} contentFit="contain" />
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>{manual ? t('scan.preparingImage') : t('scan.removingBg')}</Text>
          </View>
        </View>
      )}

      {/* Sonuç */}
      {processedBase64 && !loading && (
        <View style={styles.resultContainer}>
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: `data:image/jpeg;base64,${processedBase64}` }}
              style={styles.previewImage}
              contentFit="contain"
            />
            {manual ? (
              <View style={[styles.badge, styles.badgeMuted]}>
                <Text style={[styles.badgeText, styles.badgeTextMuted]}>{t('upload.asIs')}</Text>
              </View>
            ) : (
              <View style={styles.badge}>
                <Feather name="check" size={12} color={colors.white} />
                <Text style={styles.badgeText}>
                  {Platform.OS === 'web' ? t('upload.bgCleanedWeb') : t('upload.bgCleaned')}
                </Text>
              </View>
            )}
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

      <PhotoGuideModal
        visible={guideVisible}
        onClose={() => setGuideVisible(false)}
        title={t('upload.photoGuideTitle')}
        intro={t('upload.photoGuideIntro')}
        dos={[t('upload.guideDoFlat'), t('upload.guideDoLegs'), t('upload.guideDoPlain'),
              t('upload.guideDoLight'), t('upload.guideDoSingle')]}
        // Katlanmış paça en sık vision hatası (tulum/şort → "üst") — listenin başında
        donts={[t('upload.guideDontFolded'), t('upload.guideDontCrumpled'), t('upload.guideDontOverlap'),
                t('upload.guideDontDark'), t('upload.guideDontCrop')]}
        examples={[
          { source: garmentDoTop,        ok: true,  label: t('upload.exampleTop') },
          { source: garmentDoBottom,     ok: true,  label: t('upload.exampleBottom') },
          { source: garmentDoDress,      ok: true,  label: t('upload.exampleDress') },
          { source: garmentDontFolded,   ok: false, label: t('upload.exampleFolded') },
          { source: garmentDontCrumpled, ok: false, label: t('upload.exampleCrumpled') },
          { source: garmentDontOverlap,  ok: false, label: t('upload.exampleOverlap') },
          { source: garmentDontDark,     ok: false, label: t('upload.exampleDark') },
        ]}
      />
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
  guideLink: {
    ...typography.bodySmall,
    color: colors.text,
    textDecorationLine: 'underline',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  manualBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: spacing.xs,
  },
  guideLinkLeft: {
    ...typography.bodySmall,
    color: colors.text,
    textDecorationLine: 'underline',
  },
  badgeMuted: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeTextMuted: {
    color: colors.text,
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
