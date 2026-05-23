import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'StyleChoice'>;

export default function StyleChoiceScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stilini Tanıyalım</Text>
      <Text style={styles.subtitle}>Sana en uygun yolu seç</Text>
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('StyleSelect')}>
        <Text style={styles.buttonText}>Tarzımı Biliyorum</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 8 },
  button: { marginTop: 32, backgroundColor: '#1A1A2E', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
