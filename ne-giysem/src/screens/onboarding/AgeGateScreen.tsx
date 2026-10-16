import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { deleteAccount } from '../../lib/socialAuth';
import { clearLocalSession } from '../../lib/session';
import { useUserStore } from '../../store/useUserStore';
import type { UserState } from '../../store/useUserStore';
import { colors, fonts, typography, spacing, radius, layout } from '../../constants/theme';
import { t } from '../../i18n';

/**
 * "18 yaşından büyüğüm" kapısı — RootNavigator, oturum açık ve
 * user.ageConfirmedAt boşken (undefined/null) bunu gösterir. Böylece e-posta,
 * Apple ve Google girişlerinin hepsi (ve onaydan önce kayıt olmuş eski
 * kullanıcılar) tek yerden geçer. undefined → önce DB'den okunur.
 */
export default function AgeGateScreen() {
  const user        = useUserStore((s: UserState) => s.user);
  const setConsents = useUserStore((s: UserState) => s.setConsents);

  const [loading, setLoading] = useState(user?.ageConfirmedAt === undefined);
  const [checked, setChecked] = useState(false);
  const [saving,  setSaving]  = useState(false);

  // Onay durumu henüz okunmadıysa DB'den al (rıza zamanı da aynı sorguda)
  useEffect(() => {
    if (!user || user.ageConfirmedAt !== undefined) { setLoading(false); return; }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('age_confirmed_at, sensitive_consent_at')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // Okunamazsa onay ekranını göster — yeniden onaylamak zararsız
          console.warn('[AgeGate] onay okunamadı:', error.message);
          setConsents({ ageConfirmedAt: null });
        } else {
          setConsents({
            ageConfirmedAt:     data?.age_confirmed_at ?? null,
            sensitiveConsentAt: data?.sensitive_consent_at ?? null,
          });
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id, user?.ageConfirmedAt]);

  const handleConfirm = async () => {
    if (!user || !checked) return;
    setSaving(true);
    const at = new Date().toISOString();
    const { error } = await supabase.from('profiles').update({ age_confirmed_at: at }).eq('id', user.id);
    setSaving(false);
    if (error) {
      Alert.alert(t('combos.errorTitle'), t('ageGate.saveError'));
      return;
    }
    setConsents({ ageConfirmedAt: at });   // RootNavigator kapıyı kaldırır
  };

  // 18 yaşından küçük: uygulama kullanılamaz → hesap ve veriler silinir.
  // Silme Profil'deki "Hesabımı Sil" ile aynı akış (Apple hesabında Apple ekranı açılır).
  // Başarısız/iptal → yine de oturum kapatılır (kullanıcı uygulamada kalamaz), loglanır.
  const handleUnder18 = () => {
    Alert.alert(t('ageGate.under18Title'), t('ageGate.under18Body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('ageGate.under18Confirm'), style: 'destructive', onPress: runUnder18Delete },
    ]);
  };

  const runUnder18Delete = async () => {
    setSaving(true);
    try {
      const r = await deleteAccount();
      if (r === 'deleted') {
        Alert.alert(t('profile.deleteAccountDone'));
        clearLocalSession();
        return;
      }
      console.warn('[AgeGate] 18 yaş altı hesap silme iptal edildi (Apple ekranı) — oturum kapatılıyor');
    } catch (err) {
      console.warn('[AgeGate] 18 yaş altı hesap silinemedi — oturum kapatılıyor:', err);
    } finally {
      setSaving(false);
    }
    await supabase.auth.signOut().catch((e) => console.warn('[AgeGate] signOut:', e));
    clearLocalSession();
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator color={colors.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('ageGate.title')}</Text>
        <Text style={styles.body}>{t('ageGate.body')}</Text>

        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setChecked((v) => !v)}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
        >
          <View style={[styles.checkbox, checked && styles.checkboxOn]}>
            {checked && <Feather name="check" size={14} color={colors.white} />}
          </View>
          <Text style={styles.checkText}>{t('ageGate.checkbox')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, (!checked || saving) && styles.primaryBtnDisabled]}
          onPress={handleConfirm}
          disabled={!checked || saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.primaryBtnText}>{t('ageGate.continue')}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={handleUnder18} activeOpacity={0.7} disabled={saving}>
          <Text style={styles.secondaryBtnText}>{t('ageGate.under18')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingH,
    gap: spacing.lg,
  },
  title: { ...typography.h1, color: colors.text },
  body: { ...typography.body, color: colors.textSecondary },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 22, height: 22, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.black, borderColor: colors.black },
  checkText: { ...typography.body, color: colors.text, flex: 1 },
  primaryBtn: {
    height: 48, borderRadius: radius.sm, backgroundColor: colors.black,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { ...typography.body, fontFamily: fonts.bodyBold, color: colors.white },
  secondaryBtn: { alignSelf: 'center', paddingVertical: spacing.sm },
  secondaryBtnText: { ...typography.bodySmall, color: colors.textSecondary },
});
