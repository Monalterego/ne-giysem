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
import { colors, fonts, typography, spacing, radius, layout } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../store/useUserStore';
import { isAppleAvailable, signInWithApple, signInWithGoogle, type SocialResult } from '../../lib/socialAuth';
import { t } from '../../i18n';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

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

  const handleSignup = async () => {
    if (!name.trim() || !email || !password) return;
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const trimmedName = name.trim();

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ name: trimmedName })
        .eq('id', data.user.id);
      if (profileError) {
        setError(t('auth.profileUpdateError') + profileError.message);
        setLoading(false);
        return;
      }

      setUser({
        id: data.user.id,
        email: data.user.email ?? '',
        name: trimmedName,
        isPremium: false,
        createdAt: data.user.created_at,
      });
      navigation.navigate('StyleChoice');
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
          {/* Başlık */}
          <Text style={styles.title}>{t('auth.createAccount')}</Text>
          <Text style={styles.subtitle}>60 saniyede kişisel stiline kavuş</Text>

          {/* Sosyal butonlar */}
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

          {/* Inputlar */}
          <TextInput
            style={styles.input}
            placeholder={t('auth.namePlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.email')}
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.password')}
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          {/* Hata */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Kayıt Ol */}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!name.trim() || !email || !password || loading) && styles.primaryBtnDisabled,
            ]}
            onPress={handleSignup}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.primaryBtnText}>{t('auth.signupButton')}</Text>
            }
          </TouchableOpacity>

          {/* Giriş Yap */}
          <View style={styles.loginRow}>
            <Text style={styles.loginHint}>{t('auth.haveAccount')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>{t('auth.loginLink')}</Text>
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
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },

  // Başlık
  title: {
    ...typography.h1,
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
  socialBtnDisabled: {
    opacity: 0.4,
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

  // Inputlar
  input: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
  },

  // Hata
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  // Kayıt Ol
  primaryBtn: {
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // Giriş Yap
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  loginHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  loginLink: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    textDecorationLine: 'underline',
  },
});
