import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../store/useUserStore';
import { isAppleAvailable, signInWithApple, signInWithGoogle, type SocialResult } from '../../lib/socialAuth';
import { t } from '../../i18n';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setUser = useUserStore((s) => s.setUser);
  const setOnboarded = useUserStore((s) => s.setOnboarded);

  const [appleReady, setAppleReady] = useState(false);
  useEffect(() => { isAppleAvailable().then(setAppleReady); }, []);

  // Apple/Google girişi sonrası ortak akış — Signup & Login'de aynı
  const finishSocial = async (res: SocialResult | null) => {
    if (!res) return;                       // kullanıcı iptal etti — sessiz
    const { user, fullName } = res;

    // 1) Profil (trigger ile oluşmuş olmalı)
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, height, age, body_type, skin_tone, hair_color, hair_length, hair_type, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    // 2) İsim boşsa ve elimizde varsa YAZ — Apple ismi SADECE ilk yetkilendirmede gelir
    let name = profile?.name ?? '';
    if (!name && fullName) {
      await supabase.from('profiles').update({ name: fullName }).eq('id', user.id);
      name = fullName;
    }

    // 3) Store
    setUser({
      id: user.id,
      email: user.email ?? '',
      name,
      isPremium: false,
      createdAt: user.created_at,
      avatarUrl:   profile?.avatar_url  ?? undefined,
      height:      profile?.height      ?? undefined,
      age:         profile?.age         ?? undefined,
      bodyType:    profile?.body_type   ?? undefined,
      skinTone:    profile?.skin_tone   ?? undefined,
      hairColor:   profile?.hair_color  ?? undefined,
      hairLength:  profile?.hair_length ?? undefined,
      hairType:    profile?.hair_type   ?? undefined,
    });

    // 4) Yeni mi, geri dönen mi? — style_profiles kaydı varsa geri dönen
    const { data: sp } = await supabase
      .from('style_profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (sp) setOnboarded(true);                       // geri dönen → Main
    else    navigation.navigate('StyleChoice');       // yeni → onboarding
  };

  const handleApple = async () => {
    setLoading(true); setError('');
    try { await finishSocial(await signInWithApple()); }
    catch (e: any) {
      setError(e?.message === 'NO_TOKEN' ? t('auth.socialNoToken') : t('auth.socialError'));
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true); setError('');
    try { await finishSocial(await signInWithGoogle()); }
    catch (e: any) {
      setError(e?.message === 'NO_TOKEN' ? t('auth.socialNoToken') : t('auth.socialError'));
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, height, age, body_type, skin_tone, hair_color, hair_length, hair_type, avatar_url')
        .eq('id', data.user.id)
        .maybeSingle();

      setUser({
        id: data.user.id,
        email: data.user.email ?? '',
        name: profile?.name ?? '',
        isPremium: false,
        createdAt: data.user.created_at,
        avatarUrl:   profile?.avatar_url  ?? undefined,
        height:      profile?.height      ?? undefined,
        age:         profile?.age         ?? undefined,
        bodyType:    profile?.body_type   ?? undefined,
        skinTone:    profile?.skin_tone   ?? undefined,
        hairColor:   profile?.hair_color  ?? undefined,
        hairLength:  profile?.hair_length ?? undefined,
        hairType:    profile?.hair_type   ?? undefined,
      });
      // Geri dönen kullanıcı — onboarding atlansın
      setOnboarded(true);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Geri */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>{t('auth.backArrow')}</Text>
          </TouchableOpacity>

          {/* Header */}
          <Text style={styles.title}>{t('auth.loginTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>

          {/* Sosyal butonlar — Apple/Google ile kayıt olanın şifresi yok, buradan girmeli */}
          {appleReady && (
            <TouchableOpacity style={styles.socialBtn} onPress={handleApple} activeOpacity={0.8} disabled={loading}>
              <Ionicons name="logo-apple" size={18} color={colors.text} />
              <Text style={styles.socialText}>{t('auth.appleContinue')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.socialBtn} onPress={handleGoogle} activeOpacity={0.8} disabled={loading}>
            <Ionicons name="logo-google" size={18} color={colors.text} />
            <Text style={styles.socialText}>{t('auth.googleContinue')}</Text>
          </TouchableOpacity>

          {/* Separator */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('common.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email */}
          <TextInput
            style={styles.input}
            placeholder={t('auth.email')}
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          {/* Şifre */}
          <TextInput
            style={styles.input}
            placeholder={t('auth.password')}
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          {/* Hata */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* CTA */}
          <TouchableOpacity
            style={[styles.primaryBtn, (!email || !password || loading) && styles.primaryBtnDisabled]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.primaryBtnText}>{t('auth.loginButton')}</Text>
            }
          </TouchableOpacity>

          {/* Kayıt linki */}
          <View style={styles.signupRow}>
            <Text style={styles.signupHint}>{t('auth.noAccount')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.signupLink}>{t('auth.signupLink')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  flex: {
    flex: 1,
  },
  container: {
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  backBtn: {
    marginBottom: spacing.lg,
  },
  backText: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },

  // Sosyal butonlar
  socialBtn: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.white,
  },
  socialText: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },

  // Separator
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
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

  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  primaryBtn: {
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  signupHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  signupLink: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyBold,
    color: colors.accent,
  },
});
