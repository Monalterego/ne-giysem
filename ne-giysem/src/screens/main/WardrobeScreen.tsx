import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WardrobeStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabase';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { useUserStore } from '../../store/useUserStore';
import type { ClothingCategory, WardrobeItem } from '../../types';
import { colors, fonts } from '../../constants/theme';

type Props = NativeStackScreenProps<WardrobeStackParamList, 'WardrobeList'>;
type ViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'wardrobe_view_mode';

const FILTERS: { label: string; value: ClothingCategory | 'all' }[] = [
  { label: 'Tümü',     value: 'all'       },
  { label: 'Üst',      value: 'upper'     },
  { label: 'Alt',      value: 'lower'     },
  { label: 'Dış',      value: 'outer'     },
  { label: 'Ayakkabı', value: 'shoes'     },
  { label: 'Aksesuar', value: 'accessory' },
];

const CATEGORY_LABEL: Record<string, string> = {
  upper:     'Üst',
  lower:     'Alt',
  outer:     'Dış',
  shoes:     'Ayakkabı',
  accessory: 'Aksesuar',
};

const SEASON_LABEL: Record<string, string> = {
  spring: 'İlkbahar',
  summer: 'Yaz',
  fall:   'Sonbahar',
  winter: 'Kış',
};

export default function WardrobeScreen({ navigation }: Props) {
  const items      = useWardrobeStore((s) => s.items);
  const isLoading  = useWardrobeStore((s) => s.isLoading);
  const fetchItems = useWardrobeStore((s) => s.fetchItems);
  const removeItem = useWardrobeStore((s) => s.removeItem);
  const user       = useUserStore((s) => s.user);

  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [deleting,     setDeleting]     = useState(false);
  const [activeFilter, setActiveFilter] = useState<ClothingCategory | 'all'>('all');
  const [viewMode,     setViewMode]     = useState<ViewMode>('grid');

  const filteredItems = useMemo(
    () => activeFilter === 'all' ? items : items.filter((i) => i.category === activeFilter),
    [items, activeFilter],
  );

  const selectionMode = selectedIds.size > 0;

  // ─── AsyncStorage ────────────────────────────────────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem(VIEW_MODE_KEY).then((val) => {
      if (val === 'list' || val === 'grid') setViewMode(val);
    });
  }, []);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    AsyncStorage.setItem(VIEW_MODE_KEY, mode);
  };

  // ─── Fetch ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (user?.id) fetchItems(user.id);
  }, [user?.id]);

  // ─── Seçim modu ─────────────────────────────────────────────────────────────

  const handleLongPress = (id: string) => setSelectedIds(new Set([id]));

  const handleItemPress = (id: string) => {
    if (!selectionMode) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const cancelSelection = () => setSelectedIds(new Set());

  // ─── Silme ───────────────────────────────────────────────────────────────────

  const confirmDeleteSelected = () => {
    Alert.alert(
      'Parçaları Sil',
      `${selectedIds.size} parçayı kalıcı olarak silmek istediğine emin misin?`,
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Sil',   style: 'destructive', onPress: deleteSelected },
      ],
    );
  };

  const deleteSelected = async () => {
    setDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('wardrobe_items').delete().in('id', ids);
    if (error) {
      Alert.alert('Hata', 'Silme işlemi başarısız oldu.');
    } else {
      ids.forEach((id) => removeItem(id));
      cancelSelection();
    }
    setDeleting(false);
  };

  const confirmDeleteSingle = (id: string) => {
    Alert.alert(
      'Parçayı Sil',
      'Bu parçayı kalıcı olarak silmek istediğine emin misin?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Sil',   style: 'destructive', onPress: () => deleteSingle(id) },
      ],
    );
  };

  const deleteSingle = async (id: string) => {
    const { error } = await supabase.from('wardrobe_items').delete().eq('id', id);
    if (error) Alert.alert('Hata', 'Silme işlemi başarısız oldu.');
    else removeItem(id);
  };

  // ─── "…" menü ────────────────────────────────────────────────────────────────

  const openItemMenu = (item: WardrobeItem) => {
    Alert.alert('Seçenekler', undefined, [
      {
        text: 'Düzenle',
        onPress: () => navigation.navigate('UploadDetail', { existingItem: item }),
      },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => confirmDeleteSingle(item.id),
      },
      { text: 'İptal', style: 'cancel' },
    ]);
  };

  // ─── Loading / boş durum ─────────────────────────────────────────────────────

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

  // ─── Render helpers ──────────────────────────────────────────────────────────

  const renderGridItem = ({ item }: { item: WardrobeItem }) => {
    const selected = selectedIds.has(item.id);
    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => handleItemPress(item.id)}
        onLongPress={() => handleLongPress(item.id)}
        activeOpacity={selectionMode ? 0.7 : 1}
        delayLongPress={350}
      >
        <Image
          source={{ uri: item.processedImageUrl }}
          style={styles.gridImage}
          resizeMode="contain"
        />
        {!selectionMode && (
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => openItemMenu(item)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="ellipsis-vertical" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
        {selectionMode && (
          <View style={[styles.selectionOverlay, selected && styles.selectionOverlaySelected]}>
            {selected && (
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={16} color={colors.white} />
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderListItem = ({ item }: { item: WardrobeItem }) => {
    const selected = selectedIds.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.listItem, selected && styles.listItemSelected]}
        onPress={() => handleItemPress(item.id)}
        onLongPress={() => handleLongPress(item.id)}
        activeOpacity={0.85}
        delayLongPress={350}
      >
        <Image
          source={{ uri: item.processedImageUrl }}
          style={styles.listImage}
          resizeMode="contain"
        />
        <View style={styles.listInfo}>
          <Text style={styles.listCategory}>
            {CATEGORY_LABEL[item.category] ?? item.category}
          </Text>
          {item.subCategory ? (
            <Text style={styles.listSub}>{item.subCategory}</Text>
          ) : null}
          {item.seasons.length > 0 && (
            <Text style={styles.listSeasons}>
              {item.seasons.map((s) => SEASON_LABEL[s] ?? s).join(' · ')}
            </Text>
          )}
        </View>
        {selectionMode ? (
          <View style={[styles.checkCircleList, selected && styles.checkCircleListSelected]}>
            {selected && <Ionicons name="checkmark" size={14} color={colors.white} />}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.menuBtnList}
            onPress={() => openItemMenu(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ellipsis-vertical" size={16} color={colors.muted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // ─── Ana render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      {selectionMode ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={cancelSelection} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancelBtn}>İptal</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedIds.size} parça seçildi</Text>
          <TouchableOpacity
            onPress={confirmDeleteSelected}
            disabled={deleting}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {deleting
              ? <ActivityIndicator color={colors.accent} size="small" />
              : <Text style={styles.deleteBtn}>Sil</Text>
            }
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dolabım</Text>
          <Text style={styles.headerCount}>{filteredItems.length} parça</Text>
          {/* Görünüm toggle */}
          <View style={styles.viewToggle}>
            <TouchableOpacity
              onPress={() => changeViewMode('grid')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="grid-outline"
                size={20}
                color={viewMode === 'grid' ? colors.accent : colors.muted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => changeViewMode('list')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="list-outline"
                size={20}
                color={viewMode === 'list' ? colors.accent : colors.muted}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('Upload')}
            activeOpacity={0.85}
          >
            <Text style={styles.addBtnText}>+ Yeni Parça</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filtre chip'leri — seçim modunda gizle */}
      {!selectionMode && (
        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          style={{
            backgroundColor: '#FAFAFA',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            flexShrink: 0,
          }}
          contentContainerStyle={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            gap: 8,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {FILTERS.map(({ label, value }) => {
            const active = activeFilter === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setActiveFilter(value)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* İçerik — key ile numColumns değişiminde yeniden mount et */}
      <FlatList
        key={viewMode}
        data={filteredItems}
        numColumns={viewMode === 'grid' ? 2 : 1}
        keyExtractor={(item) => item.id}
        contentContainerStyle={viewMode === 'grid' ? styles.gridContainer : styles.listContainer}
        renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

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

  // ─── Boş durum ───────────────────────────────────────────────────────────────
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
    boxShadow: '0 6px 12px rgba(233,69,96,0.35)',
    elevation: 6,
  },
  ctaText: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // ─── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.headingBold,
    color: colors.primary,
    flex: 1,
  },
  headerCount: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  addBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.accent,
  },
  addBtnText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  cancelBtn: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.muted,
    width: 52,
  },
  deleteBtn: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    width: 52,
    textAlign: 'right',
  },

  // ─── Filtre bar ───────────────────────────────────────────────────────────────
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },
  filterChipTextActive: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
  },

  // ─── Grid görünümü ────────────────────────────────────────────────────────────
  gridContainer: {
    padding: 10,
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

  // ─── Liste görünümü ───────────────────────────────────────────────────────────
  listContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    gap: 12,
    paddingRight: 12,
  },
  listItemSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(233,69,96,0.04)',
  },
  listImage: {
    width: 80,
    height: 80,
    backgroundColor: colors.surface,
  },
  listInfo: {
    flex: 1,
    gap: 3,
  },
  listCategory: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  listSub: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  listSeasons: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.accent,
  },
  menuBtnList: {
    padding: 4,
  },
  checkCircleList: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleListSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },

  // ─── "…" butonu (grid) ────────────────────────────────────────────────────────
  menuBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Seçim overlay (grid) ─────────────────────────────────────────────────────
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 16,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 8,
  },
  selectionOverlaySelected: {
    backgroundColor: 'rgba(26,26,46,0.40)',
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
