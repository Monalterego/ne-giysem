import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PurchasesPackage } from 'react-native-purchases';
import type { RootStackParamList } from '../../navigation/types';
import { usePlanStore } from '../../store/usePlanStore';
import { loadPaywallPackages, purchase, purchasesAvailable } from '../../lib/purchases';
import type { PaywallPackages } from '../../lib/purchases';
import { formatIstanbulDay, restoreWithFeedback, wardrobeLimitMessage } from '../../lib/premiumGate';
import { PRIVACY_URL, TERMS_URL, manageSubscriptionUrl } from '../../constants/premium';
import { colors, fonts, typography, spacing, radius, layout } from '../../constants/theme';
import { getLocale, t } from '../../i18n';
import { upper } from '../../utils/text';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

// Karşılaştırma tablosu — CLAUDE.md Monetizasyon (fiyat İÇERMEZ; fiyatlar mağazadan)
const COMPARE_ROWS = ['Wardrobe', 'Tryon', 'Scan', 'Calendar'] as const;

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

export default function PaywallScreen({ route, navigation }: Props) {
  const reason = route.params?.reason ?? 'generic';
  // fullScreenModal içinde native SafeAreaView iOS'ta 0 inset verebiliyor (X çentiğin
  // altında kalıyordu) → kök sağlayıcının inset'leri elle uygulanır
  const insets = useSafeAreaInsets();
  const usage  = usePlanStore((s) => s.usage);

  // Android geri tuşu paywall'ı kapatsın (satın alma sürerken de — sonuç yine işlenir)
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation.canGoBack()) navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [navigation]));
  const plan   = usePlanStore((s) => s.plan);
  const syncAfterPurchase = usePlanStore((s) => s.syncAfterPurchase);

  const available = purchasesAvailable();
  const [pkgs,     setPkgs]     = useState<PaywallPackages | null>(null);
  const [loading,  setLoading]  = useState(available);
  const [selected, setSelected] = useState<'annual' | 'monthly'>('annual');   // yıllık varsayılan
  const [busy,     setBusy]     = useState(false);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    if (!available) return;
    setLoading(true);
    const result = await loadPaywallPackages();
    setPkgs(result);
    // Yıllık paket yoksa aylığa düş
    if (result && !result.annual && result.monthly) setSelected('monthly');
    setLoading(false);
  }, [available]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { usePlanStore.getState().refresh(); }, []);

  const { perMonth, savePercent } = useMemo(() => annualMath(pkgs), [pkgs]);
  const selectedPkg: PurchasesPackage | null =
    (selected === 'annual' ? pkgs?.annual : pkgs?.monthly) ?? null;
  const hasPackages = !!(pkgs?.annual || pkgs?.monthly);

  // Giriş noktasına göre üstteki açıklama
  const reasonText = useMemo(() => {
    switch (reason) {
      case 'wardrobe':
        // Dolap banner'ıyla aynı metin (sayılar get_usage'tan); okunamadıysa sayısız genel metin
        return wardrobeLimitMessage(usage) ?? t('premium.reasonWardrobeGeneric');
      case 'scan': {
        const date = formatIstanbulDay(usage?.scan.reset_at);
        const limit = usage?.scan.limit ?? 3;
        return date
          ? t('premium.reasonScan', { limit, date })
          : t('premium.reasonScanNoDate', { limit });
      }
      case 'planning': return t('premium.reasonPlanning');
      case 'tryon':    return t('premium.reasonTryon', { limit: usage?.tryon.limit ?? 3 });
      default:         return null;
    }
  }, [reason, usage]);

  const handleSubscribe = async () => {
    if (!selectedPkg || busy) return;
    setBusy(true);
    const outcome = await purchase(selectedPkg);
    if (outcome === 'success') {
      // Webhook'u bekleme: sunucu senkronu + get_usage
      const fresh = await syncAfterPurchase();
      setBusy(false);
      if (fresh?.plan === 'premium') Alert.alert(t('premium.successTitle'), t('premium.successBody'));
      else Alert.alert(t('premium.syncDelayed'));
      navigation.goBack();
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
    if (usePlanStore.getState().plan === 'premium') navigation.goBack();
  };

  const autoRenew = Platform.OS === 'android' ? t('premium.autoRenewAndroid') : t('premium.autoRenewIos');

  return (
    <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('premium.close')}
        >
          <Feather name="x" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>{upper(t('premium.eyebrow'))}</Text>
        <Text style={styles.title}>{t('premium.title')}</Text>
        <Text style={styles.subtitle}>{t('premium.subtitle')}</Text>

        {reasonText && (
          <View style={styles.reasonBox}>
            <Feather name="info" size={16} color={colors.text} />
            <Text style={styles.reasonText}>{reasonText}</Text>
          </View>
        )}

        {/* Ücretsiz / Premium karşılaştırması */}
        <View style={styles.table}>
          <View style={[styles.row, styles.headRow]}>
            <Text style={[styles.cellFeature, styles.headText]}>{upper(t('premium.compareFeature'))}</Text>
            <Text style={[styles.cell, styles.headText]}>{upper(t('premium.compareFree'))}</Text>
            <Text style={[styles.cell, styles.headText, styles.cellStrong]}>{upper(t('premium.comparePremium'))}</Text>
          </View>
          {COMPARE_ROWS.map((r, i) => (
            <View key={r} style={[styles.row, i < COMPARE_ROWS.length - 1 && styles.rowDivider]}>
              <Text style={styles.cellFeature}>{t(`premium.row${r}`)}</Text>
              <Text style={styles.cell}>{t(`premium.row${r}Free`)}</Text>
              <Text style={[styles.cell, styles.cellStrong]}>{t(`premium.row${r}Premium`)}</Text>
            </View>
          ))}
        </View>

        {/* Paketler */}
        {plan === 'premium' ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>{t('premium.alreadyPremium')}</Text>
            <Text style={styles.noticeText}>{t('premium.alreadyPremiumBody')}</Text>
            <TouchableOpacity onPress={() => Linking.openURL(manageSubscriptionUrl())} activeOpacity={0.7}>
              <Text style={styles.linkText}>{t('premium.manage')}</Text>
            </TouchableOpacity>
          </View>
        ) : !available ? (
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
                title={t('premium.annual')}
                price={`${pkgs.annual.product.priceString} ${t('premium.perYear')}`}
                note={[
                  perMonth ? t('premium.annualEquivalent', { price: perMonth }) : null,
                  savePercent ? t('premium.savePercent', { percent: savePercent }) : null,
                ].filter(Boolean).join(' · ') || null}
                badge={upper(t('premium.bestValue'))}
              />
            )}
            {pkgs?.monthly && (
              <PackageCard
                selected={selected === 'monthly'}
                onPress={() => setSelected('monthly')}
                title={t('premium.monthly')}
                price={`${pkgs.monthly.product.priceString} ${t('premium.perMonth')}`}
                note={null}
                badge={null}
              />
            )}
          </View>
        )}

        {/* Yasal */}
        <Text style={styles.legal}>{autoRenew}</Text>
        <View style={styles.legalLinks}>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)} activeOpacity={0.7}>
            <Text style={styles.legalLink}>{t('premium.terms')}</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)} activeOpacity={0.7}>
            <Text style={styles.legalLink}>{t('premium.privacy')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Alt aksiyonlar */}
      {plan !== 'premium' && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cta, (!selectedPkg || busy) && styles.ctaDisabled]}
            onPress={handleSubscribe}
            disabled={!selectedPkg || busy}
            activeOpacity={0.85}
          >
            {busy
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.ctaText}>{t('premium.subscribe')}</Text>}
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: layout.screenPaddingH - spacing.sm,
    paddingTop: spacing.xs,
  },
  // En az 44x44 dokunma alanı (HIG)
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: layout.screenPaddingH,
    paddingBottom: spacing.xl,
  },
  eyebrow: { ...typography.label, color: colors.textSecondary, marginTop: spacing.sm },
  title: { ...typography.h1, color: colors.text, marginTop: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },

  reasonBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  reasonText: { ...typography.body, color: colors.text, flex: 1 },

  table: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  headRow: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headText: { ...typography.label, color: colors.textSecondary },
  cellFeature: { ...typography.body, color: colors.text, flex: 1.2 },
  cell: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, textAlign: 'center' },
  cellStrong: { color: colors.text, fontFamily: fonts.bodySemiBold },

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
  noticeTitle: { ...typography.h3, color: colors.text },
  noticeText: { ...typography.body, color: colors.textSecondary },
  linkText: { ...typography.body, color: colors.text, fontFamily: fonts.bodySemiBold, textDecorationLine: 'underline' },
  loader: { marginTop: spacing.xl },

  legal: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.lg },
  legalLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  legalLink: { ...typography.caption, color: colors.text, textDecorationLine: 'underline' },
  legalDot: { ...typography.caption, color: colors.textTertiary },

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
});
