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
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { colors, fonts, typography, spacing, radius, layout } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../store/useUserStore';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const setUser = useUserStore((s) => s.setUser);

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
        setError('Profil güncellenemedi: ' + profileError.message);
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
          <Text style={styles.title}>Hesap Oluştur</Text>
          <Text style={styles.subtitle}>60 saniyede kişisel stiline kavuş</Text>

          {/* Sosyal butonlar — V2 */}
          <TouchableOpacity style={[styles.socialBtn, styles.socialBtnDisabled]} activeOpacity={1}>
            <Feather name="smartphone" size={16} color={colors.text} />
            <Text style={styles.socialText}>Apple ile devam et</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.socialBtn, styles.socialBtnDisabled]} activeOpacity={1}>
            <Feather name="globe" size={16} color={colors.text} />
            <Text style={styles.socialText}>Google ile devam et</Text>
          </TouchableOpacity>

          {/* Separator */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>veya</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Inputlar */}
          <TextInput
            style={styles.input}
            placeholder="Adın"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
          />
          <TextInput
            style={styles.input}
            placeholder="E-posta"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Şifre"
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
              : <Text style={styles.primaryBtnText}>Kayıt Ol</Text>
            }
          </TouchableOpacity>

          {/* Giriş Yap */}
          <View style={styles.loginRow}>
            <Text style={styles.loginHint}>Zaten hesabın var mı?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}> Giriş Yap</Text>
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
