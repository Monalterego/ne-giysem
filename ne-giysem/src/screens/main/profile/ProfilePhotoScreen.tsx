import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../../navigation/types';
import { supabase } from '../../../lib/supabase';
import { imageSource, useSignedImages } from '../../../lib/storageUrls';
import { recordSensitiveConsent, removeAvatarAndTryOns } from '../../../lib/privacyActions';
import { useUserStore } from '../../../store/useUserStore';
import PhotoGuideModal from '../../../components/PhotoGuideModal';
import SensitiveConsentModal from '../../../components/SensitiveConsentModal';
import { colors, fonts, typography, spacing, radius, layout } from '../../../constants/theme';
import { t } from '../../../i18n';
import SubScreenHeader from './SubScreenHeader';
// Statik import — Metro dinamik yolu çözemez
import avatarDo from '../../../../assets/guide/avatar_do.jpg';
import avatarDontBaggy from '../../../../assets/guide/avatar_dont_baggy.jpg';
import avatarDontBusy from '../../../../assets/guide/avatar_dont_busy.jpg';
import avatarDontAngle from '../../../../assets/guide/avatar_dont_angle.jpg';
import avatarDontDark from '../../../../assets/guide/avatar_dont_dark.jpg';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfilePhoto'>;

/** Sanal deneme fotoğrafı: ekle / değiştir / kaldır + çekim rehberi (Profil'den taşındı) */
export default function ProfilePhotoScreen({ navigation }: Props) {
  const user         = useUserStore((s) => s.user);
  const setAvatarUrl = useUserStore((s) => s.setAvatarUrl);
  const setConsents  = useUserStore((s) => s.setConsents);
  useSignedImages('avatars', [user?.avatarUrl]);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [guideVisible,    setGuideVisible]    = useState(false);
  const [consentVisible,  setConsentVisible]  = useState(false);
  const [consentSaving,   setConsentSaving]   = useState(false);
  const [privacyBusy,     setPrivacyBusy]     = useState(false);

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
            console.warn('[ProfilePhoto] removePhoto:', err);
            Alert.alert(t('combos.errorTitle'), t('profile.removePhotoError'));
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

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <SubScreenHeader title={t('profile.myPhoto')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('profile.photoIntro')}</Text>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.photoFrame}
            onPress={handlePickAvatar}
            activeOpacity={0.8}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? (
              <ActivityIndicator color={colors.textSecondary} />
            ) : user.avatarUrl ? (
              <Image source={imageSource('avatars', user.avatarUrl)} style={styles.photo} contentFit="contain" cachePolicy="memory-disk" transition={150} />
            ) : (
              <Feather name="user" size={48} color={colors.border} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handlePickAvatar}
            activeOpacity={0.85}
            disabled={uploadingAvatar || privacyBusy}
          >
            <Text style={styles.primaryBtnText}>
              {user.avatarUrl ? t('profile.changePhoto') : t('profile.addPhoto')}
            </Text>
          </TouchableOpacity>

          {user.avatarUrl && (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleRemovePhoto}
              activeOpacity={0.7}
              disabled={uploadingAvatar || privacyBusy}
            >
              {privacyBusy
                ? <ActivityIndicator color={colors.textSecondary} size="small" />
                : <Text style={styles.removeText}>{t('profile.removePhoto')}</Text>}
            </TouchableOpacity>
          )}

          <Text style={styles.hint}>{t('profile.avatarTip')}</Text>
          <TouchableOpacity onPress={() => setGuideVisible(true)} activeOpacity={0.7} style={styles.guideBtn}>
            <Text style={styles.guideLink}>{t('profile.photoGuideLink')}</Text>
          </TouchableOpacity>
        </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPaddingH, paddingBottom: spacing.xl },
  intro: { ...typography.body, color: colors.textSecondary },
  section: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  photoFrame: {
    width: 160,
    height: 240,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  photo: { width: '100%', height: '100%' },
  primaryBtn: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { ...typography.body, fontFamily: fonts.bodySemiBold, color: colors.white },
  secondaryBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  removeText: { ...typography.body, color: colors.error },
  hint: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  guideBtn: { minHeight: 44, justifyContent: 'center' },
  guideLink: { ...typography.bodySmall, color: colors.text, textDecorationLine: 'underline' },
});
