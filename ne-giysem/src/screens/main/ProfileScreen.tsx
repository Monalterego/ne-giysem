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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabase';
import { imageSource, useSignedImages } from '../../lib/storageUrls';
import { clearLocalSession } from '../../lib/session';
import { deleteAccount } from '../../lib/socialAuth';
import { exportMyData } from '../../lib/privacyActions';
import { friendlyError } from '../../utils/errorMessage';
import { useFavoritesStore, resolveFavorites } from '../../store/useFavoritesStore';
import { useUserStore } from '../../store/useUserStore';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { usePlanStore, premiumExpired } from '../../store/usePlanStore';
import type { Usage } from '../../store/usePlanStore';
import { formatLocalDay, restoreWithFeedback } from '../../lib/premiumGate';
import { openPaywall } from '../../navigation/navigationRef';
import { manageSubscriptionUrl } from '../../constants/premium';
import { openLegal } from '../../constants/legal';
import { generateCombos } from '../../utils/comboEngine';
import { colors, fonts, typography, spacing, radius, layout } from '../../constants/theme';
import { t } from '../../i18n';
import { upper } from '../../utils/text';
import { useStyleEntries } from './profile/useStyleEntries';
import { hasPhysicalProfile, useEnsurePhysicalProfile } from './profile/PhysicalInfoScreen';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => upper(w[0] ?? ''))
    .join('');
}

/** Ücretsiz plan tek satır kullanım özeti: "Dolap 23/50 · Deneme 1/3 · Tarama 0/3 (bu ay)" */
function usageLine(usage: Usage): string {
  const fmt = (used: number, limit: number | null) =>
    limit === null ? `${used}`
      : used > limit ? t('premium.usageOverLimit', { count: used, limit })   // "103 (sınır 50)" — 103/50 değil
      : t('premium.usageValue', { used, limit });
  return t('premium.usageLine', {
    wardrobe: fmt(usage.wardrobe.used, usage.wardrobe.limit),
    tryon:    fmt(usage.tryon.used, usage.tryon.limit),
    scan:     fmt(usage.scan.used, usage.scan.limit),
  });
}

// Tek satırlık ayar satırı (chevron'lu)
function Row({
  label, value, onPress, loading, danger, last, chevron = true,
}: {
  label: string;
  value?: string | null;
  onPress: () => void;
  loading?: boolean;
  danger?: boolean;
  last?: boolean;
  chevron?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowDivider]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <Text style={[styles.rowLabel, danger && styles.rowDanger]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
        {loading
          ? <ActivityIndicator color={colors.textSecondary} size="small" />
          : chevron && <Feather name="chevron-right" size={16} color={colors.textTertiary} />}
      </View>
    </TouchableOpacity>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function ProfileScreen({ navigation }: Props) {
  const user               = useUserStore((s) => s.user);
  const setUser            = useUserStore((s) => s.setUser);
  const locale             = useUserStore((s) => s.locale);
  const setUserLocale      = useUserStore((s) => s.setUserLocale);
  const items          = useWardrobeStore((s) => s.items);
  const favorites      = useFavoritesStore((s) => s.favorites);
  const fetchFavorites = useFavoritesStore((s) => s.fetchFavorites);
  // Kombin > Favoriler listesiyle AYNI kural: parçası silinmiş favori sayılmaz
  const favoriteCount  = useMemo(() => resolveFavorites(favorites, items).length, [favorites, items]);
  // Başlıktaki küçük avatar — private storage, tek imza
  useSignedImages('avatars', [user?.avatarUrl]);

  // ── Abonelik — plan + kullanım sunucudan; Profil her açıldığında tazele
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

  // Favori sayısı için — Kombin sekmesi henüz hiç açılmamış olabilir
  useEffect(() => {
    if (user?.id) fetchFavorites(user.id);
  }, [user?.id]);

  // İstatistik ertelenmiş: generateCombos ekran çizildikten SONRA çalışır
  const [comboStats, setComboStats] = useState<{ count: number; avgScore: number } | null>(null);
  useEffect(() => {
    if (!items.length) { setComboStats({ count: 0, avgScore: 0 }); return; }
    const id = setTimeout(() => {
      const combos = generateCombos(items, 50);
      const avg = combos.length > 0
        ? Math.round(combos.reduce((sum, c) => sum + c.score, 0) / combos.length)
        : 0;
      setComboStats({ count: combos.length, avgScore: avg });
    }, 0);
    return () => clearTimeout(id);
  }, [items]);

  // Stil DNA satırı: ağırlığa göre ilk 2 stil
  const { entries: styleEntries } = useStyleEntries(user?.id);
  const styleSummary = useMemo(
    () => [...styleEntries].sort((a, b) => b.weight - a.weight).slice(0, 2).map((e) => e.name).join(', '),
    [styleEntries],
  );

  const hasPhys = hasPhysicalProfile(user);
  useEnsurePhysicalProfile();   // "Eksik" değeri ve rıza satırı doğru görünsün

  // ── Verilerimi indir: JSON (fotoğraflar 1 saatlik linklerle) → paylaş menüsü
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      await exportMyData();
    } catch (err) {
      console.warn('[ProfileScreen] exportMyData:', err);
      Alert.alert(t('combos.errorTitle'), friendlyError(err));
    } finally {
      setExporting(false);
    }
  };

  // ── İsim düzenleme (başlıkta, yerinde)
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

  // ── Dil — iki seçenekli sayfa
  const handleLanguage = () => {
    Alert.alert(t('settings.language'), undefined, [
      { text: t('settings.turkish'), onPress: () => setUserLocale('tr') },
      { text: t('settings.english'), onPress: () => setUserLocale('en') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
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

  const statLine = [
    t('profile.statItems', { count: items.length }),
    t('profile.statCombos', { count: comboStats?.count ?? '…' }),
    t('profile.statAvgFit', { score: comboStats ? comboStats.avgScore : '…' }),
  ].join(' · ');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── BAŞLIK: avatar · ad · plan rozeti · tek satır istatistik ── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => navigation.navigate('ProfilePhoto')}
            activeOpacity={0.8}
            accessibilityLabel={t('profile.myPhoto')}
          >
            {user.avatarUrl ? (
              <Image source={imageSource('avatars', user.avatarUrl)} style={styles.avatarImg} contentFit="cover" contentPosition="top" cachePolicy="memory-disk" />
            ) : (
              <Text style={styles.avatarText}>{initials(user.name)}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.headerBody}>
            {editingName ? (
              <View style={styles.nameEditRow}>
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
                <TouchableOpacity style={styles.iconBtn} onPress={handleSaveName} disabled={savingName}>
                  {savingName
                    ? <ActivityIndicator color={colors.text} size="small" />
                    : <Feather name="check" size={18} color={colors.text} />}
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => setEditingName(false)}>
                  <Feather name="x" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.nameRow}
                onPress={() => { setNameInput(user.name); setEditingName(true); }}
                activeOpacity={0.7}
                accessibilityLabel={t('profile.editProfile')}
              >
                <Text style={styles.userName} numberOfLines={1}>{user.name || user.email}</Text>
                <Feather name="edit-2" size={13} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
            <View style={styles.badgeRow}>
              <View style={[styles.planBadge, plan === 'premium' && styles.planBadgePremium]}>
                <Text style={[styles.planBadgeText, plan === 'premium' && styles.planBadgeTextPremium]}>
                  {upper(plan === 'premium' ? t('premium.planPremium') : t('premium.badgeFree'))}
                </Text>
              </View>
              <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.statLine}>{statLine}</Text>

        {/* ── ABONELİK (kompakt) ── */}
        <View style={styles.card}>
          <View style={styles.subTop}>
            <Text style={styles.subPlan}>
              {plan === 'premium' ? t('premium.planPremium') : t('premium.planFree')}
            </Text>
            {subDateText && <Text style={styles.subMeta}>{subDateText}</Text>}
          </View>
          {expired ? (
            <Text style={styles.subMeta}>
              {expiresDay
                ? t('premium.expiredShort', { date: expiresDay })
                : t('premium.expiredNoteNoDate')}
            </Text>
          ) : null}
          {plan !== 'premium' && usage && (
            <Text style={styles.subMeta} numberOfLines={2}>{usageLine(usage)}</Text>
          )}
          {plan === 'premium' ? (
            <TouchableOpacity
              style={styles.subBtnOutline}
              onPress={() => Linking.openURL(manageSubscriptionUrl())}
              activeOpacity={0.8}
            >
              <Text style={styles.subBtnOutlineText}>{t('premium.manage')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.subBtn} onPress={() => openPaywall()} activeOpacity={0.85}>
              <Text style={styles.subBtnText}>{t('premium.goPremium')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── AYARLAR — tek satırlık liste ── */}
        <View style={styles.list}>
          <Row
            label={t('profile.myFavorites')}
            value={favoriteCount > 0 ? String(favoriteCount) : null}
            onPress={() => (navigation as any).navigate('Combos', { occasion: 'favorites' })}
          />
          <Row
            label={t('profile.styleDnaTitle')}
            value={styleSummary || t('profile.notSet')}
            onPress={() => navigation.navigate('ProfileStyle')}
          />
          <Row
            label={t('profile.physicalTitle')}
            value={hasPhys ? null : t('profile.incompleteShort')}
            onPress={() => navigation.navigate('ProfilePhysical')}
          />
          <Row
            label={t('profile.myPhoto')}
            value={user.avatarUrl ? t('profile.photoAdded') : t('profile.photoNone')}
            onPress={() => navigation.navigate('ProfilePhoto')}
          />
          <Row
            label={t('settings.language')}
            value={locale === 'tr' ? t('settings.turkish') : t('settings.english')}
            onPress={handleLanguage}
          />
          <Row
            label={t('premium.restore')}
            onPress={handleRestore}
            loading={restoring}
            chevron={false}
          />
          <Row
            label={t('privacy.title')}
            onPress={() => navigation.navigate('ProfilePrivacy')}
          />
          <Row
            label={t('privacy.exportData')}
            onPress={handleExport}
            loading={exporting}
            chevron={false}
          />
          <Row label={t('legal.privacy')} onPress={() => openLegal('privacy')} />
          <Row label={t('legal.terms')}   onPress={() => openLegal('terms')} />
          <Row label={t('profile.logout')} onPress={handleLogout} danger chevron={false} last />
        </View>

        {/* Hesap silme — liste dışında: kolay bulunur ama yanlışlıkla basılmaz */}
        <TouchableOpacity
          style={styles.deleteAccountBtn}
          onPress={handleDeleteAccount}
          disabled={deleting}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteAccountText}>{t('profile.deleteAccount')}</Text>
        </TouchableOpacity>
      </ScrollView>

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
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: layout.screenPaddingH, paddingTop: spacing.md, paddingBottom: spacing.xl },

  // Başlık
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { ...typography.h3, fontFamily: fonts.bodyBold, color: colors.white, letterSpacing: 1 },
  headerBody: { flex: 1, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  userName: { ...typography.h2, color: colors.text, flexShrink: 1 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  nameInput: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.white,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planBadge: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  planBadgePremium: { backgroundColor: colors.text, borderColor: colors.text },
  planBadgeText: { ...typography.label, fontSize: 9, color: colors.textSecondary },
  planBadgeTextPremium: { color: colors.white },
  email: { ...typography.caption, color: colors.textTertiary, flexShrink: 1 },
  statLine: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.md },

  // Abonelik kartı
  card: {
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  subTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  subPlan: { ...typography.h3, color: colors.text },
  subMeta: { ...typography.bodySmall, color: colors.textSecondary },
  subBtn: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  subBtnText: { ...typography.body, fontFamily: fonts.bodySemiBold, color: colors.white },
  subBtnOutline: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  subBtnOutlineText: { ...typography.body, fontFamily: fonts.bodySemiBold, color: colors.text },

  // Ayar listesi
  list: {
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 50,
    gap: spacing.md,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: { ...typography.body, color: colors.text },
  rowDanger: { color: colors.error },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  rowValue: { ...typography.bodySmall, color: colors.textSecondary, flexShrink: 1, textAlign: 'right' },

  // Hesabımı Sil — çerçevesiz, sade metin
  deleteAccountBtn: {
    marginTop: spacing.lg,
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  deleteAccountText: { fontFamily: fonts.body, fontSize: 14, color: colors.error, textAlign: 'center' },
  blockingOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  blockingScrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, opacity: 0.8 },
});
