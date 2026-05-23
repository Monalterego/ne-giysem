import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function StyleResultScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>STİL DNA KARTIN</Text>
      <Text style={styles.title}>Stil Sonucun</Text>
      <Text style={styles.subtitle}>Profil oluşturuldu</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A2E', padding: 24 },
  label: { fontSize: 12, color: '#E94560', fontWeight: '700', letterSpacing: 2 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 8 },
});
