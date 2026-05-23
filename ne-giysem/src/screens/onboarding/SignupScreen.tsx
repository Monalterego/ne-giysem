import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kayıt Ol</Text>
      <Text style={styles.subtitle}>60 saniyede kişisel stiline kavuş</Text>
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('StyleChoice')}>
        <Text style={styles.buttonText}>Devam Et</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 8 },
  button: { marginTop: 32, backgroundColor: '#E94560', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
