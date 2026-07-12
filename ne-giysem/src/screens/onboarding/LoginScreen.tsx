import React, { useState } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../store/useUserStore';
import { t } from '../../i18n';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setUser = useUserStore((s) => s.setUser);
  const setOnboarded = useUserStore((s) => s.setOnboarded);

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
