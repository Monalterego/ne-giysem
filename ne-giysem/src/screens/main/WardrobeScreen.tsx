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
import { Ionicons, Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WardrobeStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabase';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { useUserStore } from '../../store/useUserStore';
import type { ClothingCategory, WardrobeItem } from '../../types';
import { CATEGORY_META, CATEGORY_ORDER } from '../../constants/categories';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';

type Props = NativeStackScreenProps<WardrobeStackParamList, 'WardrobeList'>;
type ViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'wardrobe_view_mode';

const FILTERS: { label: string; value: ClothingCategory | 'all' }[] = [
  { label: 'Tümü', value: 'all' },
  ...CATEGORY_ORDER.map((cat) => ({ label: CATEGORY_META[cat].label, value: cat })),
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_ORDER.map((cat) => [cat, CATEGORY_META[cat].label]),
);

const SEASON_LABEL: Record<string, string> = {
  spring: 'İlkbahar',
  summer: 'Yaz',
  fall:   'Sonbahar',
  winter: 'Kış',
};

const SUBCATEGORIES: Partial<Record<ClothingCategory, { value: string; label: string }[]>> = {
  upper: [
    { value: 'tisort',     label: 'T-Shirt'  },
    { value: 'bluz',       label: 'Bluz'     },
    { value: 'gomlek',     label: 'Gömlek'   },
    { value: 'kazak',      label: 'Kazak'    },
    { value: 'triko',      label: 'Triko'    },
    { value: 'hirka',      label: 'Hırka'    },
    { value: 'yelek',      label: 'Yelek'    },
    { value: 'sweatshirt', label: 'Sweatshirt' },
    { value: 'hoodie',     label: 'Hoodie'   },
    { value: 'body',       label: 'Body'     },
  ],
  lower: [
    { value: 'pantolon', label: 'Pantolon' },
    { value: 'jean',     label: 'Jean'     },
    { value: 'etek',     label: 'Etek'     },
    { value: 'sort',     label: 'Şort'     },
    { value: 'tayt',     label: 'Tayt'     },
  ],
  dress_jumpsuit: [
    { value: 'mini_elbise', label: 'Mini Elbise' },
    { value: 'midi_elbise', label: 'Midi Elbise' },
    { value: 'maxi_elbise', label: 'Maxi Elbise' },
    { value: 'tulum',       label: 'Tulum'       },
  ],
  outer: [
    { value: 'ceket',      label: 'Ceket'     },
    { value: 'blazer',     label: 'Blazer'    },
    { value: 'mont',       label: 'Mont'      },
    { value: 'kaban',      label: 'Kaban'     },
    { value: 'trenchkot',  label: 'Trençkot'  },
    { value: 'yagmurluk',  label: 'Yağmurluk' },
  ],
  shoes: [
    { value: 'sneaker',  label: 'Sneaker'  },
    { value: 'loafer',   label: 'Loafer'   },
    { value: 'bot',      label: 'Bot'      },
    { value: 'cizme',    label: 'Çizme'    },
    { value: 'topuklu',  label: 'Topuklu'  },
    { value: 'sandalet', label: 'Sandalet' },
    { value: 'terlik',   label: 'Terlik'   },
    { value: 'babet',    label: 'Babet'    },
  ],
  bag: [
    { value: 'omuz_cantasi', label: 'Omuz Çantası' },
    { value: 'clutch',       label: 'Clutch'        },
    { value: 'tote',         label: 'Tote'          },
    { value: 'bel_cantasi',  label: 'Bel Çantası'  },
    { value: 'sirt_cantasi', label: 'Sırt Çantası' },
    { value: 'mini_canta',   label: 'Mini Çanta'   },
  ],
  accessory: [
    { value: 'kolye',    label: 'Kolye'   },
    { value: 'kupe',     label: 'Küpe'    },
    { value: 'bileklik', label: 'Bileklik' },
    { value: 'yuzuk',    label: 'Yüzük'   },
    { value: 'fular',    label: 'Fular'   },
    { value: 'kaskol',   label: 'Kaşkol'  },
    { value: 'bandana',  label: 'Bandana' },
    { value: 'kemer',    label: 'Kemer'   },
    { value: 'sapka',    label: 'Şapka'   },
    { value: 'gozluk',   label: 'Gözlük'  },
  ],
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
  const [activeSub,    setActiveSub]    = useState<string>('all');
  const [viewMode,     setViewMode]     = useState<ViewMode>('grid');

  const filteredItems = useMemo(() => {
    let result = activeFilter === 'all' ? items : items.filter((i) => i.category === activeFilter);
    if (activeSub !== 'all') result = result.filter((i) => i.subCategory === activeSub);
    return result;
  }, [items, activeFilter, activeSub]);

  // Sadece dolap verisinde mevcut olan subcategory'leri, SUBCATEGORIES sırasına göre döndürür
  const availableSubcategories = useMemo(() => {
    if (activeFilter === 'all') return [];
    const subs = SUBCATEGORIES[activeFilter as ClothingCategory] ?? [];
    const existing = new Set(
      items
        .filter((i) => i.category === activeFilter && i.subCategory)
        .map((i) => i.subCategory as string),
    );
    return subs.filter((s) => existing.has(s.value));
  }, [items, activeFilter]);

  const handleFilterChange = (value: ClothingCategory | 'all') => {
    setActiveFilter(value);
    setActiveSub('all');
  };

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

  // ─── Seçim modu ──────────────────────────────────────────────────────────────

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
          <ActivityIndicator color={colors.textTertiary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyContainer}>
          <Feather name="inbox" size={48} color={colors.border} style={{ marginBottom: spacing.lg }} />
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="more-vertical" size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
        {selectionMode && (
          <View style={[styles.selectionOverlay, selected && styles.selectionOverlaySelected]}>
            {selected && (
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={14} color={colors.white} />
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
            {selected && <Ionicons name="checkmark" size={13} color={colors.white} />}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.menuBtnList}
            onPress={() => openItemMenu(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="more-vertical" size={15} color={colors.textTertiary} />
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
          <Text style={styles.selectionTitle}>{selectedIds.size} parça seçildi</Text>
          <TouchableOpacity
            onPress={confirmDeleteSelected}
            disabled={deleting}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {deleting
              ? <ActivityIndicator color={colors.error} size="small" />
              : <Text style={styles.deleteBtn}>Sil</Text>
            }
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Dolabım</Text>
            <Text style={styles.headerCount}>{filteredItems.length} parça</Text>
          </View>
          <View style={styles.viewToggle}>
            <TouchableOpacity
              onPress={() => changeViewMode('grid')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={viewMode === 'grid' ? 'grid' : 'grid-outline'}
                size={19}
                color={viewMode === 'grid' ? colors.text : colors.textTertiary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => changeViewMode('list')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={viewMode === 'list' ? 'list' : 'list-outline'}
                size={20}
                color={viewMode === 'list' ? colors.text : colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('Upload')}
            activeOpacity={0.82}
          >
            <Text style={styles.addBtnText}>+ Yeni Parça</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Kategori filtre barı */}
      {!selectionMode && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={styles.filterBarContent}
        >
          {FILTERS.map(({ label, value }) => {
            const active = activeFilter === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => handleFilterChange(value)}
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

      {/* Subcategory filtre barı — sadece kategori seçiliyken ve dolu chip varsa */}
      {!selectionMode && activeFilter !== 'all' && availableSubcategories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.subFilterBar}
          contentContainerStyle={styles.subFilterBarContent}
        >
          <TouchableOpacity
            style={[styles.subChip, activeSub === 'all' && styles.subChipActive]}
            onPress={() => setActiveSub('all')}
            activeOpacity={0.75}
          >
            <Text style={[styles.subChipText, activeSub === 'all' && styles.subChipTextActive]}>
              Hepsi
            </Text>
          </TouchableOpacity>
          {availableSubcategories.map(({ value, label }) => {
            const active = activeSub === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.subChip, active && styles.subChipActive]}
                onPress={() => setActiveSub(value)}
                activeOpacity={0.75}
              >
                <Text style={[styles.subChipText, active && styles.subChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* İçerik */}
      <FlatList
        style={{ flex: 1 }}
        key={viewMode}
        data={filteredItems}
        numColumns={viewMode === 'grid' ? 2 : 1}
        keyExtractor={(item) => item.id}
        contentContainerStyle={viewMode === 'grid' ? styles.gridContainer : styles.listContainer}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
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

  // Boş durum
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  cta: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
    backgroundColor: colors.text,
  },
  ctaText: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  headerCount: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  selectionTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  addBtn: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.black,
  },
  addBtnText: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  cancelBtn: {
    ...typography.body,
    color: colors.textSecondary,
    width: 48,
  },
  deleteBtn: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.error,
    width: 48,
    textAlign: 'right',
  },

  // Filtre bar
  filterBar: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexShrink: 0,
    flexGrow: 0,
    maxHeight: 56,
  },
  filterBarContent: {
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.sm + 2,
    gap: spacing.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterChipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  filterChipText: {
    ...typography.label,
    color: colors.text,
  },
  filterChipTextActive: {
    color: colors.white,
  },

  // Subcategory filtre barı (kategori barından biraz daha küçük/soluk)
  subFilterBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexShrink: 0,
    flexGrow: 0,
    maxHeight: 48,
  },
  subFilterBarContent: {
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.xs + 2,
    gap: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  subChip: {
    paddingVertical: spacing.xs - 1,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  subChipActive: {
    backgroundColor: colors.textSecondary,
    borderColor: colors.textSecondary,
  },
  subChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  subChipTextActive: {
    color: colors.white,
  },

  // Grid
  gridContainer: {
    padding: spacing.sm,
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  gridItem: {
    width: '47%',
    margin: spacing.xs + 2,
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },

  // Liste
  listContainer: {
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    gap: spacing.md,
    paddingRight: spacing.md,
    ...shadows.subtle,
  },
  listItemSelected: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  listImage: {
    width: 76,
    height: 76,
    backgroundColor: colors.surface,
  },
  listInfo: {
    flex: 1,
    gap: spacing.xs - 1,
  },
  listCategory: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  listSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  listSeasons: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  menuBtnList: {
    padding: spacing.xs,
  },
  checkCircleList: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleListSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },

  // "…" butonu (grid)
  menuBtn: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    padding: spacing.xs,
  },

  // Seçim overlay (grid)
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: radius.md,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: spacing.xs,
  },
  selectionOverlaySelected: {
    backgroundColor: 'rgba(10,10,10,0.32)',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
