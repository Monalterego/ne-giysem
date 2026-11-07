import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { PurchasesPackage } from 'react-native-purchases';
import { usePlanStore, hasAccess } from '../../store/usePlanStore';
import type { Limits } from '../../store/usePlanStore';
import { freeTrialDays, loadPaywallPackages, purchase, purchasesAvailable } from '../../lib/purchases';
import type { PaywallPackages } from '../../lib/purchases';
import { restoreWithFeedback } from '../../lib/premiumGate';
import { signOut, confirmDeleteAccount } from '../../lib/accountActions';
import { exportMyData } from '../../lib/privacyActions';
import { friendlyError } from '../../utils/errorMessage';
import { openLegal } from '../../constants/legal';
import { colors, fonts, typography, spacing, radius, layout } from '../../constants/theme';
import { getLocale, t } from '../../i18n';
import { upper } from '../../utils/text';

// ─── Hard paywall (gate) — Adım 15 ───────────────────────────────────────────
// Ücretsiz plan yok: erişimi (deneme / abonelik) olmayan kullanıcı onboarding'den sonra
// yalnızca bu ekranı görür (RootNavigator). Kapatılamaz; satın alma ya da geri yükleme
// sonrası plan güncellenince RootNavigator ana ekranlara geçer.
// Fiyat, tasarruf oranı ve deneme süresi mağazadan; limit sayıları app_limits'ten
// (get_limits) — kodda sayı yok.

const FEATURES = ['feature1', 'feature2', 'feature3', 'feature4', 'feature5'] as const;

/** Mağazanın döndürdüğü fiyat + para birimiyle biçimle; Intl yoksa null (gösterme) */
function formatPrice(amount: number, currency: string): string | null {
  try {
    return new Intl.NumberFormat(getLocale() === 'tr' ? 'tr-TR' : 'en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return null;
  }
}

/** Yıllık paketin aylık karşılığı ve aylığa göre tasarruf — hepsi mağaza fiyatlarından */
function annualMath(pkgs: PaywallPackages | null) {
  const annual  = pkgs?.annual?.product;
  const monthly = pkgs?.monthly?.product;
  if (!annual) return { perMonth: null, savePercent: null };
  const perMonth = formatPrice(annual.price / 12, annual.currencyCode);
  let savePercent: number | null = null;
  if (monthly && monthly.price > 0 && monthly.currencyCode === annual.currencyCode) {
    const pct = Math.round((1 - annual.price / (monthly.price * 12)) * 100);
    if (pct > 0) savePercent = pct;
  }
  return { perMonth, savePercent };
}

/** Tek satır limit özeti; sayılar app_limits'ten. null (sınırsız) → "sınırsız" */
function limitsLine(limits: Limits, withTrial: boolean): string {
  const n = (v: number | null) => (v === null ? t('paywall.unlimited') : String(v));
  const premium = t('paywall.limitsPremium', {
    packshot: n(limits.premium.packshot_monthly),
    tryon:    n(limits.premium.tryon_monthly),
    scan:     n(limits.premium.scan_monthly),
  });
  if (!withTrial) return premium;
  const trial = t('paywall.limitsTrial', {
    packshot: n(limits.trial.packshot),
    tryon:    n(limits.trial.tryon),
    scan:     n(limits.trial.scan),
  });
  return `${trial} · ${premium}`;
}

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const usage  = usePlanStore((s) => s.usage);
  const limits = usePlanStore((s) => s.limits);
  const syncAfterPurchase = usePlanStore((s) => s.syncAfterPurchase);

  const available = purchasesAvailable();
  const [pkgs,      setPkgs]      = useState<PaywallPackages | null>(null);
  const [trialDays, setTrialDays] = useState<number | null>(null);
  const [loading,   setLoading]   = useState(available);
  const [selected,  setSelected]  = useState<'annual' | 'monthly'>('annual');   // yıllık varsayılan
  const [busy,      setBusy]      = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  const load = useCallback(async () => {
    if (!available) return;
    setLoading(true);
    const result = await loadPaywallPackages();
    setPkgs(result);
    // Yıllık paket yoksa aylığa düş
    if (result && !result.annual && result.monthly) setSelected('monthly');
    setTrialDays(await freeTrialDays(result?.annual ?? null));
    setLoading(false);
  }, [available]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { usePlanStore.getState().loadLimits(); }, []);

  const { perMonth, savePercent } = useMemo(() => annualMath(pkgs), [pkgs]);
  const selectedPkg: PurchasesPackage | null =
    (selected === 'annual' ? pkgs?.annual : pkgs?.monthly) ?? null;
  const hasPackages = !!(pkgs?.annual || pkgs?.monthly);
  // Deneme yalnızca yıllıkta; mağaza bu kullanıcıya teklif etmiyorsa vaat edilmez
  const trialSelected = selected === 'annual' && trialDays !== null;

  // Neyin bittiğine göre başlık
  const ended = usage?.ended ?? null;
  const title = ended === 'trial' ? t('paywall.titleTrialEnded')
    : ended === 'subscription' ? t('paywall.titleExpired')
    : t('paywall.title');
  const subtitle = ended ? t('paywall.bodyExpired') : t('paywall.subtitle');

  const handleSubscribe = async () => {
    if (!selectedPkg || busy) return;
    setBusy(true);
    const outcome = await purchase(selectedPkg);
    if (outcome === 'success') {
      // Webhook'u bekleme: sunucu senkronu + get_usage. Erişim gelince RootNavigator geçer.
      await syncAfterPurchase();
      setBusy(false);
      if (!hasAccess(usePlanStore.getState().plan)) Alert.alert(t('premium.syncDelayed'));
      return;
    }
    setBusy(false);
    // Kullanıcı vazgeçti → hata DEĞİL, sessiz
    if (outcome === 'cancelled') return;
    if (outcome === 'pending')     Alert.alert(t('premium.pendingTitle'), t('premium.pending'));
    else if (outcome === 'network') Alert.alert(t('combos.errorTitle'), t('premium.network'));
    else if (outcome === 'unavailable') Alert.alert(t('premium.unavailable'));
    else Alert.alert(t('combos.errorTitle'), t('premium.purchaseFailed'));
  };

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    await restoreWithFeedback();
    setRestoring(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportMyData();
    } catch (err) {
      console.warn('[Paywall] exportMyData:', err);
      Alert.alert(t('combos.errorTitle'), friendlyError(err));
    } finally {
      setExporting(false);
    }
  };

  // CTA altı: deneme koşulları ya da otomatik yenileme
  const annualPrice = pkgs?.annual?.product.priceString ?? '';
  const legalText = trialSelected
    ? t(Platform.OS === 'android' ? 'paywall.trialTermsAndroid' : 'paywall.trialTermsIos',
        { days: trialDays, price: annualPrice })
    : t(Platform.OS === 'android' ? 'premium.autoRenewAndroid' : 'premium.autoRenewIos');

  return (
    <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>{upper(t('paywall.eyebrow'))}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Özellikler */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Feather name="check" size={16} color={colors.text} />
              <Text style={styles.featureText}>{t(`paywall.${f}`)}</Text>
            </View>
          ))}
        </View>

        {/* Limitler — tek satır, app_limits'ten */}
        {limits && (
          <Text style={styles.limits}>{limitsLine(limits, trialDays !== null)}</Text>
        )}

        {/* Paketler */}
        {!available ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{t('premium.unavailable')}</Text>
          </View>
        ) : loading ? (
          <ActivityIndicator color={colors.text} style={styles.loader} />
        ) : !hasPackages ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{t('premium.packagesFailed')}</Text>
            <TouchableOpacity onPress={load} activeOpacity={0.7}>
              <Text style={styles.linkText}>{t('premium.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.packages}>
            {pkgs?.annual && (
              <PackageCard
                selected={selected === 'annual'}
                onPress={() => setSelected('annual')}
                title={t('paywall.annual')}
                price={`${pkgs.annual.product.priceString} ${t('premium.perYear')}`}
                note={[
                  trialDays !== null ? t('paywall.trialBadge', { days: trialDays }) : null,
                  perMonth ? t('paywall.perMonth', { price: perMonth }) : null,
                ].filter(Boolean).join(' · ') || null}
                badge={upper(savePercent ? t('paywall.saveBadge', { percent: savePercent }) : t('premium.bestValue'))}
              />
            )}
            {pkgs?.monthly && (
              <PackageCard
                selected={selected === 'monthly'}
                onPress={() => setSelected('monthly')}
                title={t('paywall.monthly')}
                price={`${pkgs.monthly.product.priceString} ${t('premium.perMonth')}`}
                note={null}
                badge={null}
              />
            )}
          </View>
        )}

        {/* Yasal */}
        <Text style={styles.legal}>{legalText}</Text>
        <View style={styles.legalLinks}>
          <TouchableOpacity onPress={() => openLegal('terms')} activeOpacity={0.7}>
            <Text style={styles.legalLink}>{t('premium.terms')}</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity onPress={() => openLegal('privacy')} activeOpacity={0.7}>
            <Text style={styles.legalLink}>{t('premium.privacy')}</Text>
          </TouchableOpacity>
        </View>

        {/* Hesap — gate Profil'i kapattığı için burada (Apple 5.1.1(v), KVKK m. 11) */}
        <Text style={styles.accountTitle}>{upper(t('paywall.account'))}</Text>
        <View style={styles.accountLinks}>
          <TouchableOpacity onPress={handleExport} disabled={exporting} activeOpacity={0.7}>
            {exporting
              ? <ActivityIndicator color={colors.textSecondary} size="small" />
              : <Text style={styles.legalLink}>{t('privacy.exportData')}</Text>}
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity onPress={signOut} activeOpacity={0.7}>
            <Text style={styles.legalLink}>{t('profile.logout')}</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity
            onPress={() => confirmDeleteAccount(usage?.will_renew === true, setDeleting)}
            disabled={deleting}
            activeOpacity={0.7}
          >
            <Text style={[styles.legalLink, styles.danger]}>{t('profile.deleteAccount')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Alt aksiyonlar */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, (!selectedPkg || busy) && styles.ctaDisabled]}
          onPress={handleSubscribe}
          disabled={!selectedPkg || busy}
          activeOpacity={0.85}
        >
          {busy
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.ctaText}>
                {trialSelected ? t('paywall.ctaTrial', { days: trialDays }) : t('paywall.cta')}
              </Text>}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleRestore}
          disabled={restoring}
          activeOpacity={0.7}
          style={styles.restoreBtn}
        >
          {restoring
            ? <ActivityIndicator color={colors.textSecondary} size="small" />
            : <Text style={styles.restoreText}>{t('premium.restore')}</Text>}
        </TouchableOpacity>
      </View>

      {/* Silme sürerken tüm ekran etkileşimi kilitli */}
      {deleting && (
        <View style={styles.blockingOverlay}>
          <ActivityIndicator color={colors.text} size="large" />
        </View>
      )}
    </View>
  );
}

function PackageCard({
  selected, onPress, title, price, note, badge,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  price: string;
  note: string | null;
  badge: string | null;
}) {
  return (
    <TouchableOpacity
      style={[styles.pkg, selected && styles.pkgSelected]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <View style={styles.pkgBody}>
        <Text style={styles.pkgTitle}>{title}</Text>
        <Text style={styles.pkgPrice}>{price}</Text>
        {note && <Text style={styles.pkgNote}>{note}</Text>}
      </View>
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  eyebrow: { ...typography.label, color: colors.textSecondary, marginTop: spacing.sm },
  title: { ...typography.h1, color: colors.text, marginTop: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },

  features: { marginTop: spacing.lg, gap: spacing.sm },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureText: { ...typography.body, color: colors.text, flex: 1 },
  limits: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.md, lineHeight: 18 },

  packages: { marginTop: spacing.lg, gap: spacing.sm },
  pkg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    padding: spacing.md,
  },
  pkgSelected: { borderWidth: 2, borderColor: colors.text },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.text },
  radioDot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: colors.text },
  pkgBody: { flex: 1 },
  pkgTitle: { ...typography.h3, color: colors.text },
  pkgPrice: { ...typography.body, color: colors.text, marginTop: 2 },
  pkgNote: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  badge: {
    position: 'absolute',
    top: -10,
    right: spacing.md,
    backgroundColor: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: { ...typography.label, fontSize: 9, color: colors.white },

  noticeBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  noticeText: { ...typography.body, color: colors.textSecondary },
  linkText: { ...typography.body, color: colors.text, fontFamily: fonts.bodySemiBold, textDecorationLine: 'underline' },
  loader: { marginTop: spacing.xl },

  legal: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.lg },
  legalLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  legalLink: { ...typography.caption, color: colors.text, textDecorationLine: 'underline' },
  legalDot: { ...typography.caption, color: colors.textTertiary },
  danger: { color: colors.error },

  accountTitle: { ...typography.label, color: colors.textSecondary, marginTop: spacing.xl },
  accountLinks: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },

  footer: {
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  cta: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { ...typography.body, fontFamily: fonts.bodySemiBold, color: colors.white },
  restoreBtn: { alignItems: 'center', paddingVertical: spacing.sm + 2, minHeight: 40, justifyContent: 'center' },
  restoreText: { ...typography.bodySmall, color: colors.textSecondary, textDecorationLine: 'underline' },

  blockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    opacity: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
