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
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../store/useUserStore';
import type { UserState } from '../../store/useUserStore';
import { t } from '../../i18n';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { generateCombos } from '../../utils/comboEngine';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';

// ─── Sabit eşlemeler ──────────────────────────────────────────────────────────

const BODY_TYPE_TR: Record<string, string> = {
  hourglass: 'Kum Saati', pear: 'Armut', apple: 'Elma',
  rectangle: 'Dikdörtgen', triangle: 'Üçgen',
};
const SKIN_TONE_TR: Record<string, string> = {
  very_light: 'Çok Açık', light: 'Açık', wheat: 'Buğday',
  medium: 'Orta', tan: 'Bronz', dark: 'Koyu',
};
const HAIR_COLOR_TR: Record<string, string> = {
  black: 'Siyah', dark_brown: 'Koyu Kahve', brown: 'Kahve',
  light_brown: 'Açık Kahve', honey: 'Bal', red: 'Kızıl', gray: 'Gri', colored: 'Renkli',
};
const HAIR_LENGTH_TR: Record<string, string> = {
  short: 'Kısa', medium: 'Orta', long: 'Uzun', very_long: 'Çok Uzun',
};
const HAIR_TYPE_TR: Record<string, string> = {
  straight: 'Düz', wavy: 'Dalgalı', curly: 'Kıvırcık', afro: 'Afro',
};

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const user                      = useUserStore((s: UserState) => s.user);
  const logout                    = useUserStore((s: UserState) => s.logout);
  const setUser                   = useUserStore((s: UserState) => s.setUser);
  const setOnboarded              = useUserStore((s: UserState) => s.setOnboarded);
  const setPhysicalProfile        = useUserStore((s: UserState) => s.setPhysicalProfile);
  const setAvatarUrl              = useUserStore((s: UserState) => s.setAvatarUrl);
  const setTargetOnboardingScreen = useUserStore((s: UserState) => s.setTargetOnboardingScreen);
  const locale                    = useUserStore((s: UserState) => s.locale);
  const setUserLocale             = useUserStore((s: UserState) => s.setUserLocale);
  const items    = useWardrobeStore((s) => s.items);
  const setItems = useWardrobeStore((s) => s.setItems);

  const combos = useMemo(() => generateCombos(items, 50), [items]);
  const avgScore = combos.length > 0
    ? Math.round(combos.reduce((sum, c) => sum + c.score, 0) / combos.length)
    : 0;

  const [styleEntries,  setStyleEntries]  = useState<{ name: string; weight: number }[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('style_profiles')
      .select('styles')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.styles) setStyleEntries(data.styles);
      })
      .finally(() => setLoadingStyles(false));
  }, [user?.id]);

  // Fiziki profil store'da yoksa Supabase'den çek ve store'a yaz
  useEffect(() => {
    if (!user || user.height != null) return;
    supabase
      .from('profiles')
      .select('height, age, body_type, skin_tone, hair_color, hair_length, hair_type')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.height != null) {
          setPhysicalProfile({
            height:     data.height      ?? undefined,
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

  const hasPhysProfile = (user?.height ?? null) !== null;

  const physItems = [
    { label: 'Boy',          value: user?.height   ? `${user.height} cm`                      : null },
    { label: 'Yaş',          value: user?.age      ? `${user.age}`                            : null },
    { label: 'Vücut Tipi',   value: user?.bodyType   ? BODY_TYPE_TR[user.bodyType]   ?? user.bodyType   : null },
    { label: 'Ten Rengi',    value: user?.skinTone   ? SKIN_TONE_TR[user.skinTone]   ?? user.skinTone   : null },
    { label: 'Saç Rengi',    value: user?.hairColor  ? HAIR_COLOR_TR[user.hairColor] ?? user.hairColor  : null },
    { label: 'Saç Uzunluğu', value: user?.hairLength ? HAIR_LENGTH_TR[user.hairLength] ?? user.hairLength : null },
    { label: 'Saç Tipi',     value: user?.hairType   ? HAIR_TYPE_TR[user.hairType]   ?? user.hairType   : null },
  ];

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handlePickAvatar = async () => {
    if (!user) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekiyor', 'Fotoğraflara erişim için izin vermeniz gerekiyor.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const ext  = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      const fetchRes    = await fetch(asset.uri);
      const arrayBuffer = await fetchRes.arrayBuffer();
      const bytes       = new Uint8Array(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, bytes, { contentType: `image/${ext}`, upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
    } catch {
      Alert.alert('Hata', 'Fotoğraf yüklenemedi. Lütfen tekrar dene.');
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
      Alert.alert('Hata', 'İsim boş bırakılamaz.');
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: trimmed })
      .eq('id', user.id);
    setSavingName(false);
    if (error) {
      Alert.alert('Hata', 'İsim güncellenemedi. Tekrar dene.');
      return;
    }
    setUser({ ...user, name: trimmed });
    setEditingName(false);
  };

  const handleLogout = () => {
    supabase.auth.signOut()
      .catch((err) => console.warn('[ProfileScreen] signOut exception:', err))
      .finally(() => {
        setItems([]);
        logout();
      });
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
          <Text style={styles.sectionLabel}>KOMBİNLERİ KENDİNDE GÖR</Text>
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
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarPickerImage} resizeMode="contain" />
              ) : (
                <Feather name="user" size={48} color={colors.border} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.7} disabled={uploadingAvatar}>
              <Text style={styles.avatarPickerBtn}>
                {user?.avatarUrl ? 'Fotoğrafı Değiştir' : 'Fotoğraf Ekle'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.avatarPickerHint}>
              📸 En iyi sonuç için: boydan (tam vücut), tek başına, düz dururken, sade arka planlı bir fotoğraf yükle.
            </Text>
          </View>
        </View>

        {/* 2 ── STİL DNA ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>STİL DNA</Text>
          {loadingStyles ? (
            <ActivityIndicator color={colors.textTertiary} size="small" />
          ) : styleEntries.length === 0 ? (
            <View style={styles.emptyDna}>
              <Text style={styles.emptyMuted}>Stil profili henüz oluşturulmadı.</Text>
              <TouchableOpacity
                style={styles.styleBtn}
                onPress={() => {
                  setTargetOnboardingScreen('StyleChoice');
                  setOnboarded(false);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.styleBtnText}>Stilini Belirle →</Text>
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
            </View>
          )}
        </View>

        {/* 3 ── İstatistikler ── */}
        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{items.length}</Text>
            <Text style={styles.statLabel}>Parça</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{combos.length}</Text>
            <Text style={styles.statLabel}>Kombin</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{avgScore}%</Text>
            <Text style={styles.statLabel}>Ort. Uyum</Text>
          </View>
        </View>

        {/* 4 ── FİZİKSEL BİLGİLERİM ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionLabel}>FİZİKSEL BİLGİLERİM</Text>
            {hasPhysProfile && (
              <TouchableOpacity
                onPress={() => {
                  setTargetOnboardingScreen('PhysicalProfile');
                  setOnboarded(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.editLink}>Düzenle</Text>
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
              <Text style={styles.emptyMuted}>Fiziksel profilin eksik.</Text>
              <TouchableOpacity
                style={styles.styleBtn}
                onPress={() => {
                  setTargetOnboardingScreen('PhysicalProfile');
                  setOnboarded(false);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.styleBtnText}>Profili Tamamla →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* DİL / LANGUAGE */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('settings.language').toUpperCase()}</Text>
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

        {/* 5 ── HESAP ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>HESAP</Text>

          {!editingName ? (
            <TouchableOpacity
              style={styles.listItem}
              onPress={() => {
                setNameInput(user.name);
                setEditingName(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.listItemText}>Profilimi Düzenle</Text>
              <Feather name="chevron-right" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.nameEditWrap}>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Adın"
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
                    <Text style={styles.saveBtnText}>Kaydet</Text>
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
                <Text style={styles.physEditLink}>Fiziksel bilgileri düzenle →</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.listDivider} />

          <TouchableOpacity style={styles.listItem} onPress={handleLogout} activeOpacity={0.7}>
            <Text style={[styles.listItemText, styles.logoutText]}>Çıkış Yap</Text>
          </TouchableOpacity>
        </View>

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
  listItemText: {
    ...typography.body,
    color: colors.text,
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

  bottomPad: {
    height: spacing.md,
  },
});
