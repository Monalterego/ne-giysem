import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { imageSource, useSignedImages } from '../../lib/storageUrls';
import { clearLocalSession } from '../../lib/session';
import { deleteAccount } from '../../lib/socialAuth';
import { useFavoritesStore, resolveFavorites } from '../../store/useFavoritesStore';
import { useUserStore } from '../../store/useUserStore';
import type { UserState } from '../../store/useUserStore';
import { t } from '../../i18n';
import { upper } from '../../utils/text';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { usePlanStore, premiumExpired } from '../../store/usePlanStore';
import { formatLocalDay, restoreWithFeedback } from '../../lib/premiumGate';
import { openPaywall } from '../../navigation/navigationRef';
import { manageSubscriptionUrl } from '../../constants/premium';
import { generateCombos } from '../../utils/comboEngine';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';
import PhotoGuideModal from '../../components/PhotoGuideModal';
import SensitiveConsentModal from '../../components/SensitiveConsentModal';
import { recordSensitiveConsent, removeAvatarAndTryOns, withdrawSensitiveConsent } from '../../lib/privacyActions';
// Statik import — Metro dinamik yolu çözemez
import avatarDo from '../../../assets/guide/avatar_do.jpg';
import avatarDontBaggy from '../../../assets/guide/avatar_dont_baggy.jpg';
import avatarDontBusy from '../../../assets/guide/avatar_dont_busy.jpg';
import avatarDontAngle from '../../../assets/guide/avatar_dont_angle.jpg';
import avatarDontDark from '../../../assets/guide/avatar_dont_dark.jpg';

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => upper(w[0] ?? ''))
    .join('');
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const user                      = useUserStore((s: UserState) => s.user);
  const setUser                   = useUserStore((s: UserState) => s.setUser);
  const setOnboarded              = useUserStore((s: UserState) => s.setOnboarded);
  const setPhysicalProfile        = useUserStore((s: UserState) => s.setPhysicalProfile);
  const setAvatarUrl              = useUserStore((s: UserState) => s.setAvatarUrl);
  const setConsents               = useUserStore((s: UserState) => s.setConsents);
  const clearSensitiveData        = useUserStore((s: UserState) => s.clearSensitiveData);
  const setTargetOnboardingScreen = useUserStore((s: UserState) => s.setTargetOnboardingScreen);
  const locale                    = useUserStore((s: UserState) => s.locale);
  const setUserLocale             = useUserStore((s: UserState) => s.setUserLocale);
  const items    = useWardrobeStore((s) => s.items);
  const navigation     = useNavigation<any>();
  const favorites      = useFavoritesStore((s) => s.favorites);
  const fetchFavorites = useFavoritesStore((s) => s.fetchFavorites);
  // Kombin > Favoriler listesiyle AYNI kural: parçası silinmiş favori sayılmaz
  const favoriteCount  = useMemo(() => resolveFavorites(favorites, items).length, [favorites, items]);
  // Avatar private storage'da — tek imza (1 createSignedUrls çağrısı, önbellekliyse 0)
  useSignedImages('avatars', [user?.avatarUrl]);

  // Abonelik kartı — plan + kullanım sunucudan; Profil her açıldığında tazele
  const plan    = usePlanStore((s) => s.plan);
  const usage   = usePlanStore((s) => s.usage);
  const expired = premiumExpired(usage);
  useEffect(() => { usePlanStore.getState().refresh(); }, []);
  const expiresDay  = formatLocalDay(usage?.premium_expires_at);
  // 'infinity' (süresiz) → tarih yok
  const subDateText = plan !== 'premium' ? null
    : !expiresDay ? t('premium.lifetime')
    : usage?.will_renew ? t('premium.renewsOn', { date: expiresDay })
    : t('premium.endsOn', { date: expiresDay });
  const expiredDate = expired ? expiresDay : null;

  // Favori sayısı için — Kombin sekmesi henüz hiç açılmamış olabilir
  useEffect(() => {
    if (user?.id) fetchFavorites(user.id);
  }, [user?.id]);

  // İstatistik ertelenmiş hesaplanıyor: render'ı bloke etmesin diye generateCombos
  // ekran çizildikten SONRA (useEffect) çalışır, sonuç state'e yazılır.
  const [comboStats, setComboStats] = useState<{ count: number; avgScore: number } | null>(null);

  useEffect(() => {
    if (!items.length) { setComboStats({ count: 0, avgScore: 0 }); return; }
    // Bir sonraki frame'de hesapla — ekran önce çizilsin, sonra sayı yerleşsin.
    const id = setTimeout(() => {
      const combos = generateCombos(items, 50);
      const avg = combos.length > 0
        ? Math.round(combos.reduce((sum, c) => sum + c.score, 0) / combos.length)
        : 0;
      setComboStats({ count: combos.length, avgScore: avg });
    }, 0);
    return () => clearTimeout(id);
  }, [items]);

  const [styleEntries,  setStyleEntries]  = useState<{ name: string; weight: number }[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(true);

  useEffect(() => {
    if (!user) return;
    // Sorgu builder'ı PromiseLike döner (.finally yok) → async/try-finally
    (async () => {
      try {
        const { data } = await supabase
          .from('style_profiles')
          .select('styles')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data?.styles) setStyleEntries(data.styles);
      } finally {
        setLoadingStyles(false);
      }
    })();
  }, [user?.id]);

  // Fiziki profil store'da yoksa Supabase'den çek ve store'a yaz
  // Alanlar artık tek tek boş bırakılabiliyor → "profil var" = herhangi bir alan dolu
  const physFields = [user?.height, user?.weight, user?.age, user?.bodyType, user?.skinTone,
                      user?.hairColor, user?.hairLength, user?.hairType];
  const hasPhysProfile = physFields.some((v) => v != null);

  useEffect(() => {
    if (!user || hasPhysProfile) return;
    supabase
      .from('profiles')
      .select('height, weight, age, body_type, skin_tone, hair_color, hair_length, hair_type')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && [data.height, data.weight, data.age, data.body_type, data.skin_tone,
                     data.hair_color, data.hair_length, data.hair_type].some((v) => v != null)) {
          setPhysicalProfile({
            height:     data.height      ?? undefined,
            weight:     data.weight      ?? undefined,
            age:        data.age         ?? undefined,
            bodyType:   data.body_type   ?? undefined,
            skinTone:   data.skin_tone   ?? undefined,
            hairColor:  data.hair_color  ?? undefined,
            hairLength: data.hair_length ?? undefined,
            hairType:   data.hair_type   ?? undefined,
          });
        }
      });
  }, [user?.id]);

  const physItems = [
    { label: t('profile.heightLabel'),     value: user?.height   ? `${user.height} cm` : null },
    { label: t('profile.ageLabel'),        value: user?.age      ? `${user.age}`       : null },
    { label: t('profile.bodyTypeLabel'),   value: user?.bodyType   ? t(`bodyType.${user.bodyType}`)     : null },
    { label: t('profile.skinToneLabel'),   value: user?.skinTone   ? t(`skinTone.${user.skinTone}`)     : null },
    { label: t('profile.hairColorLabel'),  value: user?.hairColor  ? t(`hairColor.${user.hairColor}`)   : null },
    { label: t('profile.hairLengthLabel'), value: user?.hairLength ? t(`hairLength.${user.hairLength}`) : null },
    { label: t('profile.hairTypeLabel'),   value: user?.hairType   ? t(`hairType.${user.hairType}`)     : null },
  ];

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [guideVisible,    setGuideVisible]    = useState(false);

  const [consentVisible, setConsentVisible] = useState(false);
  const [consentSaving,  setConsentSaving]  = useState(false);
  const [privacyBusy,    setPrivacyBusy]    = useState(false);

  // İlk avatar yüklemesinden önce açık rıza (geri çekildiyse yeniden)
  const handlePickAvatar = () => {
    if (!user) return;
    if (!user.sensitiveConsentAt) { setConsentVisible(true); return; }
    pickAndUploadAvatar();
  };

  const handleConsentAccept = async () => {
    if (!user) return;
    setConsentSaving(true);
    try {
      const at = await recordSensitiveConsent(user.id);
      setConsents({ sensitiveConsentAt: at });
      setConsentVisible(false);
      pickAndUploadAvatar();
    } catch {
      Alert.alert(t('combos.errorTitle'), t('consent.saveError'));
    } finally {
      setConsentSaving(false);
    }
  };

  // Fotoğrafı kaldır: dosya + avatar_url + avatarla üretilmiş try-on'lar (yapay manken kalır)
  const handleRemovePhoto = () => {
    if (!user) return;
    Alert.alert(t('profile.removePhotoTitle'), t('profile.removePhotoBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.removePhoto'),
        style: 'destructive',
        onPress: async () => {
          setPrivacyBusy(true);
          try {
            await removeAvatarAndTryOns(user.id, user.avatarUrl);
            setAvatarUrl(null);
          } catch (err) {
            console.warn('[ProfileScreen] removePhoto:', err);
            Alert.alert(t('combos.errorTitle'), t('profile.removePhotoError'));
          } finally {
            setPrivacyBusy(false);
          }
        },
      },
    ]);
  };

  // Rızayı geri çek: fiziksel profil NULL + avatar ve tüm try-on/manken dosyaları + rıza NULL
  const handleWithdrawConsent = () => {
    if (!user) return;
    Alert.alert(t('profile.withdrawConsentTitle'), t('profile.withdrawConsentBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.withdrawConsent'),
        style: 'destructive',
        onPress: async () => {
          setPrivacyBusy(true);
          try {
            await withdrawSensitiveConsent(user.id, user.avatarUrl);
            clearSensitiveData();
            Alert.alert(t('profile.withdrawConsentDone'));
          } catch (err) {
            console.warn('[ProfileScreen] withdrawConsent:', err);
            Alert.alert(t('combos.errorTitle'), t('profile.withdrawConsentError'));
          } finally {
            setPrivacyBusy(false);
          }
        },
      },
    ]);
  };

  const pickAndUploadAvatar = async () => {
    if (!user) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('profile.permissionTitle'), t('profile.permissionPhoto'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      // HEIC → JPEG. iPhone galerisi HEIC verir; FASHN okuyamaz, RN gösteremez.
      const normalized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      const path = `${user.id}/avatar.jpg`;

      const fetchRes    = await fetch(normalized.uri);
      const arrayBuffer = await fetchRes.arrayBuffer();
      const bytes       = new Uint8Array(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      // DB'ye URL değil bucket içi YOL yazılır (görüntülemede imzalanır).
      // ?v= sürümü: dosya adı sabit (upsert) — expo-image cacheKey'i (bucket/yol?v=)
      // değişsin, eski fotoğraf disk önbelleğinden gelmesin. Try-on cache anahtarı da
      // bu sürümden türetiliyor (CombosScreen modelVersion).
      const avatarRef = `${path}?v=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarRef })
        .eq('id', user.id);
      if (updateError) throw updateError;

      setAvatarUrl(avatarRef);
    } catch {
      Alert.alert(t('combos.errorTitle'), t('profile.photoUploadError'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const [editingName, setEditingName] = useState(false);
  const [nameInput,   setNameInput]   = useState(user?.name ?? '');
  const [savingName,  setSavingName]  = useState(false);

  const handleSaveName = async () => {
    if (!user) return;
    const trimmed = nameInput.trim();
    if (!trimmed) {
      Alert.alert(t('combos.errorTitle'), t('profile.nameEmpty'));
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: trimmed })
      .eq('id', user.id);
    setSavingName(false);
    if (error) {
      Alert.alert(t('combos.errorTitle'), t('profile.nameUpdateError'));
      return;
    }
    setUser({ ...user, name: trimmed });
    setEditingName(false);
  };

  // Çıkış ve hesap silme ortak yerel temizliği — iki yer de bunu çağırır
  const handleLogout = () => {
    supabase.auth.signOut()
      .catch((err) => console.warn('[ProfileScreen] signOut exception:', err))
      .finally(clearLocalSession);
  };

  const [deleting, setDeleting] = useState(false);

  const runDelete = async () => {
    setDeleting(true);
    try {
      const r = await deleteAccount();
      if (r === 'cancelled') return;   // Apple ekranında vazgeçti — sessizce kapat
      // Önce Alert, sonra temizlik: logout() ekranı söker; RootNavigator onboarding'e geçer
      Alert.alert(t('profile.deleteAccountDone'));
      clearLocalSession();
    } catch (err) {
      console.warn('[ProfileScreen] deleteAccount failed:', err);
      Alert.alert(t('combos.errorTitle'), t('profile.deleteAccountError'));
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAccount = () => {
    // Otomatik yenilenen abonelik hesap silmeyle iptal OLMAZ (mağaza faturalamaya devam eder)
    if (plan === 'premium' && usage?.will_renew) {
      Alert.alert(
        t('profile.deleteAccountTitle'),
        `${t('profile.deleteAccountBody')}\n\n${t('premium.deleteSubscriptionWarning')}`,
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('premium.manage'), onPress: () => Linking.openURL(manageSubscriptionUrl()) },
          { text: t('profile.deleteAccountConfirm'), style: 'destructive', onPress: runDelete },
        ],
      );
      return;
    }
    Alert.alert(t('profile.deleteAccountTitle'), t('profile.deleteAccountBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.deleteAccountConfirm'), style: 'destructive', onPress: runDelete },
    ]);
  };

  const [restoring, setRestoring] = useState(false);
  const handleRestore = async () => {
    setRestoring(true);
    await restoreWithFeedback();
    setRestoring(false);
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* 1 ── KOMBİNLERİ KENDİNDE GÖR ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{upper(t('profile.seeOnYourself'))}</Text>
          <View style={styles.avatarPickerSection}>
            <TouchableOpacity
              style={styles.avatarPickerCircle}
              onPress={handlePickAvatar}
              activeOpacity={0.8}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator color={colors.textSecondary} />
              ) : user?.avatarUrl ? (
                <Image source={imageSource('avatars', user.avatarUrl)} style={styles.avatarPickerImage} contentFit="contain" cachePolicy="memory-disk" transition={150} />
              ) : (
                <Feather name="user" size={48} color={colors.border} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.7} disabled={uploadingAvatar || privacyBusy}>
              <Text style={styles.avatarPickerBtn}>
                {user?.avatarUrl ? t('profile.changePhoto') : t('profile.addPhoto')}
              </Text>
            </TouchableOpacity>
            {user?.avatarUrl && (
              <TouchableOpacity onPress={handleRemovePhoto} activeOpacity={0.7} disabled={uploadingAvatar || privacyBusy}>
                <Text style={styles.avatarPickerBtn}>
                  {privacyBusy ? t('common.loading') : t('profile.removePhoto')}
                </Text>
              </TouchableOpacity>
            )}
            <Text style={styles.avatarPickerHint}>{t('profile.avatarTip')}</Text>
            <TouchableOpacity onPress={() => setGuideVisible(true)} activeOpacity={0.7}>
              <Text style={styles.guideLink}>{t('profile.photoGuideLink')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2 ── STİL DNA ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{upper(t('profile.styleDna'))}</Text>
          {loadingStyles ? (
            <ActivityIndicator color={colors.textTertiary} size="small" />
          ) : styleEntries.length === 0 ? (
            <View style={styles.emptyDna}>
              <Text style={styles.emptyMuted}>{t('profile.noStyleProfile')}</Text>
              <TouchableOpacity
                style={styles.styleBtn}
                onPress={() => {
                  setTargetOnboardingScreen('StyleChoice');
                  setOnboarded(false);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.styleBtnText}>{t('profile.setStyle')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.dnaList}>
              {styleEntries.map((entry, i) => (
                <View key={entry.name}>
                  <View style={styles.dnaRow}>
                    <Text style={styles.dnaName}>{entry.name}</Text>
                    <Text style={styles.dnaWeight}>{entry.weight}%</Text>
                  </View>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${entry.weight}%` }]} />
                  </View>
                  {i < styleEntries.length - 1 && <View style={styles.dnaSeparator} />}
                </View>
              ))}
              <TouchableOpacity
                style={styles.changeStyleBtn}
                onPress={() => {
                  Alert.alert(
                    t('profile.changeStyle'),
                    t('profile.changeStyleConfirm'),
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      {
                        text: t('common.done'),
                        onPress: () => {
                          setTargetOnboardingScreen('StyleChoice');
                          setOnboarded(false);
                        },
                      },
                    ],
                  );
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.changeStyleText}>{t('profile.changeStyle')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 3 ── İstatistikler ── */}
        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{items.length}</Text>
            <Text style={styles.statLabel}>{upper(t('profile.item'))}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{comboStats?.count ?? '…'}</Text>
            <Text style={styles.statLabel}>{upper(t('profile.combo'))}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{comboStats ? comboStats.avgScore + '%' : '…'}</Text>
            <Text style={styles.statLabel}>{upper(t('profile.avgFit'))}</Text>
          </View>
        </View>

        {/* 3b ── FAVORİ KOMBİNLERİM ── Kombin sekmesine favoriler açık şekilde gider */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.listItem}
            onPress={() => navigation.navigate('Combos', { occasion: 'favorites' })}
            activeOpacity={0.7}
          >
            <View style={styles.listItemLeft}>
              <Ionicons name="heart-outline" size={18} color={colors.text} />
              <Text style={styles.listItemText}>{t('profile.myFavorites')}</Text>
            </View>
            <View style={styles.listItemLeft}>
              {favoriteCount > 0 && <Text style={styles.listItemCount}>{favoriteCount}</Text>}
              <Feather name="chevron-right" size={16} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* 4 ── FİZİKSEL BİLGİLERİM ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionLabel}>{upper(t('profile.physicalInfo'))}</Text>
            {hasPhysProfile && (
              <TouchableOpacity
                onPress={() => {
                  setTargetOnboardingScreen('PhysicalProfile');
                  setOnboarded(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.editLink}>{t('common.edit')}</Text>
              </TouchableOpacity>
            )}
          </View>
          {hasPhysProfile ? (
            <View style={styles.physList}>
              {physItems.map(({ label, value }) =>
                value ? (
                  <View key={label} style={styles.physRow}>
                    <Text style={styles.physRowLabel}>{label}</Text>
                    <Text style={styles.physRowValue}>{value}</Text>
                  </View>
                ) : null,
              )}
            </View>
          ) : (
            <View style={styles.emptyDna}>
              <Text style={styles.emptyMuted}>{t('profile.physicalIncomplete')}</Text>
              <TouchableOpacity
                style={styles.styleBtn}
                onPress={() => {
                  setTargetOnboardingScreen('PhysicalProfile');
                  setOnboarded(false);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.styleBtnText}>{t('profile.completeProfile')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* DİL / LANGUAGE */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{upper(t('settings.language'))}</Text>
          <View style={styles.langRow}>
            <TouchableOpacity
              style={[styles.langBtn, locale === 'tr' && styles.langBtnActive]}
              onPress={() => setUserLocale('tr')}
              activeOpacity={0.7}
            >
              <Text style={[styles.langBtnText, locale === 'tr' && styles.langBtnTextActive]}>
                {t('settings.turkish')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langBtn, locale === 'en' && styles.langBtnActive]}
              onPress={() => setUserLocale('en')}
              activeOpacity={0.7}
            >
              <Text style={[styles.langBtnText, locale === 'en' && styles.langBtnTextActive]}>
                {t('settings.english')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ABONELİK — Hesap kartının üstünde; plan ve kullanım sunucudan (get_usage) */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{upper(t('premium.cardLabel'))}</Text>

          <View style={styles.subPlanRow}>
            <Text style={styles.subPlanName}>
              {plan === 'premium' ? t('premium.planPremium') : t('premium.planFree')}
            </Text>
            {plan === 'premium' && subDateText && (
              <Text style={styles.subPlanDate}>{subDateText}</Text>
            )}
          </View>

          {expired && (
            <Text style={styles.subNote}>
              {expiredDate
                ? t('premium.expiredNote', { date: expiredDate })
                : t('premium.expiredNoteNoDate')}
            </Text>
          )}

          {plan !== 'premium' && usage && (
            <View style={styles.subUsage}>
              {[
                { label: t('premium.usageWardrobe'), used: usage.wardrobe.used, limit: usage.wardrobe.limit },
                { label: t('premium.usageTryon'),    used: usage.tryon.used,    limit: usage.tryon.limit },
                { label: t('premium.usageScan'),     used: usage.scan.used,     limit: usage.scan.limit },
              ].map((r) => (
                <View key={r.label} style={styles.subUsageRow}>
                  <Text style={styles.subUsageLabel}>{r.label}</Text>
                  <Text style={styles.subUsageValue}>
                    {r.limit === null ? r.used : t('premium.usageValue', { used: r.used, limit: r.limit })}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {plan === 'premium' ? (
            <TouchableOpacity
              style={styles.listItem}
              onPress={() => Linking.openURL(manageSubscriptionUrl())}
              activeOpacity={0.7}
            >
              <Text style={styles.listItemText}>{t('premium.manage')}</Text>
              <Feather name="external-link" size={15} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.subCta} onPress={() => openPaywall()} activeOpacity={0.85}>
              <Text style={styles.subCtaText}>{t('premium.goPremium')}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.listDivider} />
          <TouchableOpacity
            style={styles.listItem}
            onPress={handleRestore}
            disabled={restoring}
            activeOpacity={0.7}
          >
            <Text style={styles.listItemText}>{t('premium.restore')}</Text>
            {restoring
              ? <ActivityIndicator color={colors.textSecondary} size="small" />
              : <Feather name="rotate-ccw" size={15} color={colors.textSecondary} />}
          </TouchableOpacity>
        </View>

        {/* 5 ── HESAP ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{upper(t('profile.account'))}</Text>

          {!editingName ? (
            <TouchableOpacity
              style={styles.listItem}
              onPress={() => {
                setNameInput(user.name);
                setEditingName(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.listItemText}>{t('profile.editProfile')}</Text>
              <Feather name="chevron-right" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.nameEditWrap}>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder={t('auth.namePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
              />
              <View style={styles.nameEditBtns}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setEditingName(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveName}
                  disabled={savingName}
                  activeOpacity={0.85}
                >
                  {savingName ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>{t('common.save')}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Fiziksel profil alt-linki — isim düzenleme alanının altında */}
              <TouchableOpacity
                onPress={() => {
                  setEditingName(false);
                  setTargetOnboardingScreen('PhysicalProfile');
                  setOnboarded(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.physEditLink}>{t('profile.editPhysical')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Hassas veri rızası verilmişse ya da hassas veri varsa geri çekilebilir */}
          {(user.sensitiveConsentAt || hasPhysProfile || user.avatarUrl) && (
            <>
              <View style={styles.listDivider} />
              <TouchableOpacity
                style={styles.listItem}
                onPress={handleWithdrawConsent}
                activeOpacity={0.7}
                disabled={privacyBusy}
              >
                <Text style={styles.listItemText}>{t('profile.withdrawConsent')}</Text>
                {privacyBusy
                  ? <ActivityIndicator color={colors.textSecondary} size="small" />
                  : <Feather name="chevron-right" size={16} color={colors.textSecondary} />}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.listDivider} />

          <TouchableOpacity style={styles.listItem} onPress={handleLogout} activeOpacity={0.7}>
            <Text style={[styles.listItemText, styles.logoutText]}>{t('profile.logout')}</Text>
          </TouchableOpacity>
        </View>

        {/* Hesap silme — kart dışında, ayrı: kolay bulunur ama yanlışlıkla basılmaz */}
        <TouchableOpacity
          style={styles.deleteAccountBtn}
          onPress={handleDeleteAccount}
          disabled={deleting}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteAccountText}>{t('profile.deleteAccount')}</Text>
        </TouchableOpacity>

        {/* 6 ── KİMLİK (en altta) ── */}
        <View style={styles.separator} />
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user.name)}</Text>
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

      <SensitiveConsentModal
        visible={consentVisible}
        saving={consentSaving}
        onAccept={handleConsentAccept}
        onCancel={() => setConsentVisible(false)}
      />

      <PhotoGuideModal
        visible={guideVisible}
        onClose={() => setGuideVisible(false)}
        title={t('profile.photoGuideTitle')}
        intro={t('profile.photoGuideIntro')}
        dos={[t('profile.guideDoFull'), t('profile.guideDoPose'),
              t('profile.guideDoPlain'), t('profile.guideDoFitted')]}
        donts={[t('profile.guideDontBaggy'), t('profile.guideDontBusy'),
                t('profile.guideDontAngle'), t('profile.guideDontDark')]}
        examples={[
          { source: avatarDo,        ok: true,  label: t('profile.exampleDo') },
          { source: avatarDontBaggy, ok: false, label: t('profile.exampleBaggy') },
          { source: avatarDontBusy,  ok: false, label: t('profile.exampleBusy') },
          { source: avatarDontAngle, ok: false, label: t('profile.exampleAngle') },
          { source: avatarDontDark,  ok: false, label: t('profile.exampleDark') },
        ]}
      />

      {/* Silme sürerken tüm ekran etkileşimi kilitli */}
      {deleting && (
        <View style={styles.blockingOverlay}>
          <View style={styles.blockingScrim} />
          <ActivityIndicator color={colors.text} size="large" />
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
  scroll: {
    paddingBottom: spacing.xl,
  },

  // Separator
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    paddingHorizontal: layout.screenPaddingH,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    ...typography.h3,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    letterSpacing: 1,
  },
  userName: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  userEmail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  // İstatistikler
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: layout.screenPaddingH,
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    ...shadows.subtle,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: spacing.xs,
    backgroundColor: colors.border,
  },
  statValue: {
    ...typography.h1,
    color: colors.text,
  },
  statLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },

  // Kartlar
  card: {
    marginHorizontal: layout.screenPaddingH,
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.subtle,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  langRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  langBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  langBtnActive: { backgroundColor: colors.text, borderColor: colors.text },
  langBtnText: { ...typography.body, color: colors.text },
  langBtnTextActive: { color: colors.background },
  emptyMuted: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  emptyDna: {
    gap: spacing.sm,
  },
  styleBtn: {
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.black,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  styleBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.white,
  },

  // Stil DNA
  dnaList: {
    gap: 0,
  },
  dnaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  dnaName: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  dnaWeight: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  progressBg: {
    height: 2,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.text,
    borderRadius: radius.full,
  },
  dnaSeparator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  changeStyleBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    alignSelf: 'center',
  },
  changeStyleText: {
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },

  // Hesap — liste item
  listDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  physEditLink: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  subPlanRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  subPlanName: {
    ...typography.h3,
    color: colors.text,
  },
  subPlanDate: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  subNote: {
    ...typography.bodySmall,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  subUsage: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  subUsageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subUsageLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  subUsageValue: {
    ...typography.bodySmall,
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
  },
  subCta: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  subCtaText: {
    ...typography.body,
    fontFamily: fonts.bodySemiBold,
    color: colors.white,
  },
  listItemText: {
    ...typography.body,
    color: colors.text,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listItemCount: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // İsim düzenleme
  nameEditWrap: {
    gap: spacing.sm,
  },
  nameInput: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.background,
  },
  nameEditBtns: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // Fotoğrafım
  avatarPickerSection: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarPickerCircle: {
    width: 130,
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPickerImage: {
    width: '100%',
    height: '100%',
  },
  avatarPickerHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
  },
  guideLink: {
    ...typography.bodySmall,
    color: colors.text,
    textDecorationLine: 'underline',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  avatarPickerBtn: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Fiziki profil — kart başlık satırı
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editLink: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Fiziki profil — liste satırları
  physList: {
    gap: spacing.sm,
  },
  physRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  physRowLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  physRowValue: {
    ...typography.body,
    color: colors.text,
  },

  // Çıkış Yap
  logoutBtn: {
    marginTop: spacing.xl,
    marginHorizontal: layout.screenPaddingH,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  logoutText: {
    ...typography.body,
    color: colors.error,
  },

  // Hesabımı Sil — çerçevesiz, sade metin
  deleteAccountBtn: {
    marginTop: spacing.lg,
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  deleteAccountText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
  blockingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockingScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    opacity: 0.8,
  },

  bottomPad: {
    height: spacing.md,
  },
});
