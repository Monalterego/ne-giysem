import React, { useEffect, useRef, useState } from 'react';
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
import { friendlyError } from '../../utils/errorMessage';
import { toUploadJpeg, alertAfterPicker } from '../../utils/imageNormalize';
import { analyzeClothingImage } from '../../utils/visionAnalysis';
import type { VisionResult } from '../../utils/visionAnalysis';
import { uuidv4 } from '../../utils/uuid';
import { ensureAiDecision, openAiConsent, withAiReconsent } from '../../lib/aiConsent';
import { requestPackshot, cutoutToJpegBase64 } from '../../lib/garmentImage';
import type { PackshotOutcome } from '../../lib/garmentImage';
import { startAnalysis, discardAnalysis } from '../../lib/pendingAnalysis';
import { clearCutoutCache } from '../../../modules/garment-cutout';
import { useConsentStore, aiStatus } from '../../store/useConsentStore';
import type { ImageSource } from '../../types';
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

// Sonuç ekranındaki açıklama: packshot neden yok
type ResultNote = 'quota' | 'failed' | null;

// Kaydedilecek görsel + kaynağı
type Chosen = { base64: string; source: ImageSource };

export default function UploadScreen({ navigation, route }: Props) {
  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [originalBase64, setOriginalBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  // Yapay zekâ izni yok → otomatik tanıma ve packshot yok (görsel yine cihazda kesilir)
  const [manual, setManual] = useState(false);
  // Packshot başarılı → yan yana karşılaştırma; kullanıcı seçince chosen dolar
  const [packshotBase64, setPackshotBase64] = useState<string | null>(null);
  const [cutoutBase64, setCutoutBase64] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [note, setNote] = useState<ResultNote>(null);
  // UploadDetail'in erken başlatılan analizi bulması için (lib/pendingAnalysis)
  const analysisKey = useRef<string | null>(null);
  // Her seçim yeni bir çalıştırma; geç dönen eski sonuç yok sayılır
  const runId = useRef(0);
  const aiDeclined = useConsentStore((s) => aiStatus(s.records) === 'declined');

  const reset = () => {
    runId.current += 1;
    setOriginalUri(null);
    setOriginalBase64(null);
    setPackshotBase64(null);
    setCutoutBase64(null);
    setChosen(null);
    setNote(null);
    analysisKey.current = null;
    discardAnalysis();
  };

  const pick = async (source: 'camera' | 'gallery') => {
    // İlk eklemeden önce yapay zekâ izni (karar verildiyse ekran açılmaz).
    // Karar verilmeden kapandıysa hiçbir şey yapma.
    const decision = await ensureAiDecision();
    if (decision === 'dismissed') return;
    const useAi = decision === 'granted';

    let result: ImagePicker.ImagePickerResult;

    // Picker base64 İSTENMEZ: galeride tam çözünürlüklü (HEIC/12–48 MP) olabilir ve
    // eskiden manipulate başarısız olunca bu ham base64 doğrudan arka plan servisine gidiyordu.
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
    reset();
    const run = runId.current;
    setOriginalUri(asset.uri);
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
    await prepare(run, source, uri, base64Input, useAi);
  };

  // "Uyar mı?" sonucundan "Dolaba ekle": görsel taramada normalize edildi, seçim adımı
  // atlanır; taramanın analizi devredilir (ikinci Claude çağrısı yok)
  const preset = route.params?.preset;
  useEffect(() => {
    if (!preset) return;
    navigation.setParams({ preset: undefined });   // geri / yeniden seçimde tekrar çalışmasın
    void (async () => {
      const decision = await ensureAiDecision();
      if (decision === 'dismissed') return;
      reset();
      const run = runId.current;
      setManual(decision !== 'granted');
      setLoading(true);
      await prepare(run, 'scan', preset.uri, preset.base64, decision === 'granted', preset.vision);
    })();
  }, [preset]);

  // Normalize edilmiş görsel → analiz + cihaz kesimi + packshot → yan yana / sonuç
  const prepare = async (
    run: number, source: string, uri: string, base64Input: string, useAi: boolean,
    presetVision?: VisionResult,
  ) => {
    setOriginalUri(uri);
    setOriginalBase64(base64Input);

    // Paralel: (1) Claude analizi orijinal üzerinde (izin varsa), (2) cihaz kesimi
    // (izin gerekmez, görsel cihazdan çıkmaz), (3) packshot (izin varsa; kota sunucuda).
    // Görsel storage'a geçici dosya olarak yazılmaz.
    const key = uuidv4();
    analysisKey.current = useAi ? key : null;
    if (useAi) {
      // İzin metni eskiyse güncel metin sorulur, onaylanırsa yeniden denenir
      startAnalysis(key, presetVision
        ? () => Promise.resolve(presetVision)
        : () => withAiReconsent(() => analyzeClothingImage(base64Input)));
    }
    const cutoutPromise = Platform.OS === 'web' ? Promise.resolve(null) : cutoutToJpegBase64(uri);
    const packshotPromise: Promise<PackshotOutcome> = useAi
      ? requestPackshot({ imageB64: base64Input })
      : Promise.resolve<PackshotOutcome>({ kind: 'failed', reason: 'no-ai' });

    const [cutout, packshot] = await Promise.all([cutoutPromise, packshotPromise]);
    // base64'ler alındı — kesim dosyaları cihazda kalmasın
    void clearCutoutCache();
    if (runId.current !== run) return;   // bu arada yeniden seçildi / vazgeçildi

    setCutoutBase64(cutout);
    console.log(`[Upload] ${source} packshot=${packshot.kind}${packshot.kind === 'failed' ? `:${packshot.reason}` : ''} cutout=${!!cutout}`);

    if (packshot.kind === 'ok') {
      setPackshotBase64(packshot.base64);   // yan yana karşılaştırma
    } else {
      // Packshot yok → cihaz kesimi, o da yoksa olduğu gibi (+ çekim ipucu)
      setChosen(cutout
        ? { base64: cutout, source: 'device_cutout' }
        : { base64: base64Input, source: 'original' });
      setNote(packshot.kind === 'quota' ? 'quota' : useAi ? 'failed' : null);
    }
    setLoading(false);
  };

  // Karşılaştırmada "Orijinali kullan": cihaz kesimi (0 kredi), yoksa olduğu gibi
  const chooseOriginal = () => {
    if (!originalBase64) return;
    setPackshotBase64(null);
    setNote(null);
    setChosen(cutoutBase64
      ? { base64: cutoutBase64, source: 'device_cutout' }
      : { base64: originalBase64, source: 'original' });
  };

  const goToDetail = (pick: Chosen) => {
    if (!originalUri) return;
    navigation.navigate('UploadDetail', {
      processedBase64: pick.base64,
      originalUri,
      manual,
      imageSource: pick.source,
      analysisKey: analysisKey.current ?? undefined,
    });
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
      {!originalUri && !loading && !chosen && !packshotBase64 && (
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
            <Text style={styles.loadingText}>{manual ? t('scan.removingBg') : t('upload.preparingStudio')}</Text>
          </View>
        </View>
      )}

      {/* Yan yana: stüdyo görseli (packshot) | orijinal — kullanıcı seçer */}
      {packshotBase64 && !chosen && !loading && originalUri && (
        <View style={styles.resultContainer}>
          <Text style={styles.compareTitle}>{t('upload.compareTitle')}</Text>
          <Text style={styles.compareBody}>{t('upload.compareBody')}</Text>
          <View style={styles.compareRow}>
            <View style={styles.compareCol}>
              <View style={styles.compareImageWrap}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${packshotBase64}` }}
                  style={styles.compareImage}
                  contentFit="contain"
                />
              </View>
              <Text style={styles.compareLabel}>{t('upload.compareStudio')}</Text>
            </View>
            <View style={styles.compareCol}>
              <View style={styles.compareImageWrap}>
                <Image source={{ uri: originalUri }} style={styles.compareImage} contentFit="contain" />
              </View>
              <Text style={styles.compareLabel}>{t('upload.compareOriginal')}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={chooseOriginal} activeOpacity={0.75}>
              <Text style={styles.secondaryBtnText}>{t('upload.useOriginal')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => goToDetail({ base64: packshotBase64, source: 'packshot' })}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{t('upload.usePackshot')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Sonuç: cihaz kesimi ya da olduğu gibi */}
      {chosen && !loading && (
        <View style={styles.resultContainer}>
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: `data:image/jpeg;base64,${chosen.base64}` }}
              style={styles.previewImage}
              contentFit="contain"
            />
            {chosen.source === 'original' ? (
              <View style={[styles.badge, styles.badgeMuted]}>
                <Text style={[styles.badgeText, styles.badgeTextMuted]}>{t('upload.asIs')}</Text>
              </View>
            ) : (
              <View style={styles.badge}>
                <Feather name="check" size={12} color={colors.white} />
                <Text style={styles.badgeText}>{t('upload.bgCleaned')}</Text>
              </View>
            )}
          </View>

          {note === 'quota' && <Text style={styles.noteText}>{t('upload.packshotQuotaNote')}</Text>}
          {note === 'failed' && <Text style={styles.noteText}>{t('upload.packshotFailedNote')}</Text>}
          {/* Kesim yapılamadı: çekim ipucu */}
          {chosen.source === 'original' && <Text style={styles.noteText}>{t('upload.asIsTip')}</Text>}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={reset} activeOpacity={0.75}>
              <Text style={styles.secondaryBtnText}>{t('upload.reselect')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => goToDetail(chosen)} activeOpacity={0.85}>
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
  noteText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  // --- Karşılaştırma ---
  compareTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  compareBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  compareRow: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  compareCol: {
    flex: 1,
    gap: spacing.xs,
  },
  compareImageWrap: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compareImage: {
    width: '100%',
    height: '100%',
  },
  compareLabel: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
    textAlign: 'center',
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
