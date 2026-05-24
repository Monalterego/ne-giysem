import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WardrobeStackParamList } from '../../navigation/types';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { useUserStore } from '../../store/useUserStore';
import { colors, fonts } from '../../constants/theme';

type Props = NativeStackScreenProps<WardrobeStackParamList, 'WardrobeList'>;

export default function WardrobeScreen({ navigation }: Props) {
  const items     = useWardrobeStore((s) => s.items);
  const isLoading = useWardrobeStore((s) => s.isLoading);
  const fetchItems = useWardrobeStore((s) => s.fetchItems);
  const user      = useUserStore((s) => s.user);

  useEffect(() => {
    if (user?.id) {
      fetchItems(user.id);
    }
  }, [user?.id]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>👗</Text>
          <Text style={styles.emptyTitle}>Henüz kıyafet eklemedin</Text>
          <Text style={styles.emptySubtitle}>
            Dolabını dijitalleştirmek için{'\n'}ilk kıyafetini ekle
          </Text>
          <TouchableOpacity
            style={styles.cta}
            onPress={() => navigation.navigate('Upload')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>+ Yeni Parça Ekle</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dolabım</Text>
        <Text style={styles.headerCount}>{items.length} parça</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('Upload')}
          activeOpacity={0.85}
        >
          <Text style={styles.addBtnText}>+ Yeni Parça</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <Image
              source={{ uri: item.processedImageUrl }}
              style={styles.gridImage}
              resizeMode="contain"
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // --- Boş durum ---
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 72,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: fonts.headingBold,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
  },
  cta: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaText: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  // --- Dolu durum ---
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: fonts.headingBold,
    color: colors.primary,
    flex: 1,
  },
  headerCount: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  addBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.accent,
  },
  addBtnText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  grid: {
    padding: 12,
  },
  gridItem: {
    flex: 1,
    margin: 6,
    aspectRatio: 3 / 4,
    borderRadius: 16,
    backgroundColor: colors.white,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
});
