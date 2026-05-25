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
import { colors, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../store/useUserStore';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
          {/* Header */}
          <Text style={styles.title}>Hesap Oluştur</Text>
          <Text style={styles.subtitle}>60 saniyede kişisel stiline kavuş</Text>

          {/* Social buttons — kapsam dışı (V2) */}
          <TouchableOpacity style={[styles.socialBtn, styles.socialBtnDisabled]} activeOpacity={1}>
            <Text style={styles.socialIcon}>🍎</Text>
            <Text style={[styles.socialText, styles.socialTextDisabled]}>Apple ile devam et</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.socialBtn, styles.socialBtnDisabled]} activeOpacity={1}>
            <Text style={styles.socialIcon}>🌐</Text>
            <Text style={[styles.socialText, styles.socialTextDisabled]}>Google ile devam et</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>veya</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Ad */}
          <TextInput
            style={styles.input}
            placeholder="Adın"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
          />

          {/* Email / password */}
          <TextInput
            style={styles.input}
            placeholder="E-posta"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Şifre"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          {/* Hata mesajı */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Signup CTA */}
          <TouchableOpacity
            style={[styles.primaryBtn, (!name.trim() || !email || !password || loading) && styles.primaryBtnDisabled]}
            onPress={handleSignup}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.primaryBtnText}>Kayıt Ol</Text>
            }
          </TouchableOpacity>

          {/* Login link */}
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
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.headingBold,
    color: colors.primary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.muted,
    marginBottom: 32,
  },
  socialBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 10,
    backgroundColor: colors.white,
  },
  socialIcon: {
    fontSize: 18,
  },
  socialText: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#BBBBBB',
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.primary,
    marginBottom: 12,
    backgroundColor: colors.white,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginHint: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  loginLink: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.accent,
  },
  socialBtnDisabled: {
    opacity: 0.4,
  },
  socialTextDisabled: {
    color: colors.muted,
  },
  errorText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.accent,
    marginBottom: 10,
    textAlign: 'center',
  },
});
