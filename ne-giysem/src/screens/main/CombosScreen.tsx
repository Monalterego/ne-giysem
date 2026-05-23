import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CombosScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kombin Önerileri</Text>
      <Text style={styles.subtitle}>AI destekli kombinler</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 8 },
});
