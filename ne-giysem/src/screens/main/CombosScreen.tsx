import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { useUserStore } from '../../store/useUserStore';
import { useComboStore } from '../../store/useComboStore';
import { generateCombos, generateCombosAI, missingCategories } from '../../utils/comboEngine';
import type { Occasion, UserProfileInput } from '../../utils/comboEngine';
import { OCCASIONS } from '../../constants/occasions';
import { generateVirtualModelImage } from '../../utils/virtualModel';
import type { PhysicalProfile } from '../../utils/virtualModel';
import { supabase } from '../../lib/supabase';
import type { Combo } from '../../types';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';

const CATEGORY_LABEL: Record<string, string> = {
  upper:          'Üst',
  lower:          'Alt',
  dress_jumpsuit: 'Elbise/Tulum',
  outer:          'Dış Giyim',
  shoes:          'Ayakkabı',
  bag:            'Çanta',
  accessory:      'Aksesuar',
};

const FREE_RENDER_LIMIT = 3;

function comboKey(combo: Combo): string {
  return combo.items.map((i) => i.id).sort().join('|');
}

// ─── ComboCard bileşeni ───────────────────────────────────────────────────────

function ComboCard({
  combo,
  isWorn,
  isSaving,
  isGenerating,
  onWear,
  onVirtualModel,
}: {
  combo: Combo;
  isWorn: boolean;
  isSaving: boolean;
  isGenerating: boolean;
  onWear: () => void;
  onVirtualModel: () => void;
}) {
  const allItems = [...combo.items, ...(combo.suggestedItems ?? [])];

  return (
    <View style={styles.card}>

      {/* Tüm parçalar — tek düzende, kategori etiketiyle */}
      <View style={styles.imagesGrid}>
        {allItems.map((item) => (
          <View key={item.id} style={styles.itemImageWrap}>
            <Image
              source={{ uri: item.processedImageUrl }}
              style={styles.itemImage}
              resizeMode="contain"
            />
            <Text style={styles.itemLabel}>{CATEGORY_LABEL[item.category] ?? item.category}</Text>
          </View>
        ))}
        <Text style={styles.scoreText}>{combo.score}%</Text>
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <Text style={styles.comboLabel}>{combo.label}</Text>

        {isGenerating ? (
          <View style={styles.generatingState}>
            <ActivityIndicator size="small" color={colors.textSecondary} />
            <Text style={styles.generatingText}>Manken hazırlanıyor...</Text>
          </View>
        ) : (
          <View style={styles.footerActions}>
            {/* Sanal Manken butonu */}
            <TouchableOpacity
              style={styles.modelBtn}
              onPress={onVirtualModel}
              activeOpacity={0.85}
            >
              <Feather name="user" size={14} color={colors.text} />
            </TouchableOpacity>

            {/* Giy butonu */}
            {isWorn ? (
              <View style={[styles.wearBtn, styles.wearBtnWorn]}>
                <Text style={[styles.wearBtnText, styles.wearBtnTextWorn]}>✓ Giyildi</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.wearBtn}
                onPress={onWear}
                activeOpacity={0.85}
                disabled={isSaving}
              >
                {isSaving
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Text style={styles.wearBtnText}>Giy →</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Model sonuç modalı ───────────────────────────────────────────────────────

function ModelModal({
  visible,
  imageUrl,
  onClose,
}: {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
}) {
  const handleShare = async () => {
    if (!imageUrl) return;
    await Share.share({
      message: `Sanal manken kombinim — Ne Giysem? ile oluşturuldu: ${imageUrl}`,
      url: imageUrl,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={modalStyles.safe}>

        {/* Kapat butonu */}
        <View style={modalStyles.header}>
          <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Feather name="x" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Görsel */}
        <ScrollView
          contentContainerStyle={modalStyles.imageContainer}
          showsVerticalScrollIndicator={false}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={modalStyles.image}
              resizeMode="contain"
            />
          ) : null}
        </ScrollView>

        {/* Paylaş */}
        <View style={modalStyles.footer}>
          <TouchableOpacity style={modalStyles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <Feather name="share-2" size={16} color={colors.white} />
            <Text style={modalStyles.shareBtnText}>Paylaş</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </Modal>
  );
}

// ─── Premium modalı ───────────────────────────────────────────────────────────

function PremiumModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={premiumStyles.overlay}>
        <View style={premiumStyles.card}>
          <Text style={premiumStyles.title}>Limit Doldu</Text>
          <Text style={premiumStyles.body}>
            Ücretsiz planda {FREE_RENDER_LIMIT} sanal manken hakkın var.{'\n'}
            Premium'a geçerek sınırsız kullan.
          </Text>
          <TouchableOpacity style={premiumStyles.premiumBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={premiumStyles.premiumBtnText}>Premium'a Geç →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={premiumStyles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={premiumStyles.cancelBtnText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Fotoğraf yok modalı ─────────────────────────────────────────────────────

function NoAvatarModal({
  visible,
  onClose,
  onGoToProfile,
  onUseAiModel,
}: {
  visible: boolean;
  onClose: () => void;
  onGoToProfile: () => void;
  onUseAiModel: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={noAvatarStyles.overlay}>
        <View style={noAvatarStyles.card}>
          <Text style={noAvatarStyles.title}>Fotoğraf Gerekiyor</Text>
          <Text style={noAvatarStyles.body}>
            Bu özelliği kullanmak için tam boy bir fotoğrafın gerekiyor. Yüzün ve vücudun görünür
            olmalı, iyi aydınlatmalı düz bir zeminde dur.
          </Text>
          <TouchableOpacity style={noAvatarStyles.primaryBtn} onPress={onGoToProfile} activeOpacity={0.85}>
            <Text style={noAvatarStyles.primaryBtnText}>Fotoğraf Ekle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={noAvatarStyles.secondaryBtn} onPress={onUseAiModel} activeOpacity={0.75}>
            <Text style={noAvatarStyles.secondaryBtnText}>Yapay Manken Kullan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={noAvatarStyles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={noAvatarStyles.cancelBtnText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function CombosScreen() {
  const navigation     = useNavigation<any>();
  const items          = useWardrobeStore((s) => s.items);
  const isLoading      = useWardrobeStore((s) => s.isLoading);
  const fetchItems     = useWardrobeStore((s) => s.fetchItems);
  const wornComboKeys  = useWardrobeStore((s) => s.wornComboKeys);
  const markWorn       = useWardrobeStore((s) => s.markWorn);
  const fetchWornToday = useWardrobeStore((s) => s.fetchWornToday);
  const weather        = useWardrobeStore((s) => s.weather);
  const user           = useUserStore((s) => s.user);
  const { cache: comboCache, setCache, clearCache } = useComboStore();

  const [savingKey,      setSavingKey]      = useState<string | null>(null);
  const [activeOccasion, setActiveOccasion] = useState<Occasion>('all');
  const [aiCombos,       setAiCombos]       = useState<Combo[]>([]);
  const [aiLoading,      setAiLoading]      = useState(false);
  const [page,           setPage]           = useState(0);
  const [loadingMore,    setLoadingMore]    = useState(false);

  // Virtual model state
  const [generatingComboId,    setGeneratingComboId]    = useState<string | null>(null);
  const [modelImageUrl,        setModelImageUrl]         = useState<string | null>(null);
  const [modelModalVisible,    setModelModalVisible]     = useState(false);
  const [premiumModalVisible,  setPremiumModalVisible]   = useState(false);
  const [noAvatarModalVisible, setNoAvatarModalVisible]  = useState(false);
  const [pendingCombo,         setPendingCombo]          = useState<Combo | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchItems(user.id);
      fetchWornToday(user.id);
    }
  }, [user?.id]);

  // Yeni parça eklenince veya kullanıcı değişince cache'i sıfırla
  useEffect(() => {
    clearCache();
  }, [items, user?.id]);

  // Claude AI kombin üretimi — her items/occasion değişiminde
  useEffect(() => {
    if (!items.length || !user) { setAiCombos([]); return; }

    // Cache hit — okasyon değişince AI çağrısı yapmadan cache'den al
    const cached = comboCache[activeOccasion];
    if (cached) {
      setAiCombos(cached);
      setPage(0);
      return;
    }

    let cancelled = false;
    setAiLoading(true);

    const styleProfileMap = user.styleProfile?.styles.reduce<Record<string, number>>(
      (acc, s) => ({ ...acc, [s.name]: s.weight }),
      {},
    );
    const profile: UserProfileInput = {
      height:     user.height,
      age:        user.age,
      bodyType:   user.bodyType,
      skinTone:   user.skinTone,
      hairColor:  user.hairColor,
      hairLength: user.hairLength,
      hairType:   user.hairType,
    };

    console.log('styleProfile raw:', user?.styleProfile);
    console.log('styleProfileMap:', styleProfileMap);
    setPage(0);
    generateCombosAI(items, profile, weather, activeOccasion, 0, [], styleProfileMap)
      .then((results) => {
        if (cancelled) return;
        const finalResults = results.length ? results : generateCombos(items, 5, activeOccasion);
        setCache(activeOccasion, finalResults);
        setAiCombos(finalResults);
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = generateCombos(items, 5, activeOccasion);
          setCache(activeOccasion, fallback);
          setAiCombos(fallback);
        }
      })
      .finally(() => { if (!cancelled) setAiLoading(false); });

    return () => { cancelled = true; };
  }, [items, activeOccasion, user?.id]);

  const handleLoadMore = async () => {
    if (loadingMore || !items.length || !user) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const prevIds = [...new Set(aiCombos.flatMap((c) => c.items.map((i) => i.id)))];
    const styleProfileMap = user.styleProfile?.styles.reduce<Record<string, number>>(
      (acc, s) => ({ ...acc, [s.name]: s.weight }),
      {},
    );
    const profile: UserProfileInput = {
      height:     user.height,
      age:        user.age,
      bodyType:   user.bodyType,
      skinTone:   user.skinTone,
      hairColor:  user.hairColor,
      hairLength: user.hairLength,
      hairType:   user.hairType,
    };
    try {
      const results = await generateCombosAI(items, profile, weather, activeOccasion, nextPage, prevIds, styleProfileMap);
      if (results.length) {
        const newAll = [...aiCombos, ...results];
        setCache(activeOccasion, newAll);
        setAiCombos(newAll);
        setPage(nextPage);
      }
    } catch {
      // sessiz hata
    } finally {
      setLoadingMore(false);
    }
  };

  const handleWear = async (combo: Combo) => {
    if (!user) return;
    const key = comboKey(combo);
    setSavingKey(key);
    const now = new Date().toISOString();
    const { error } = await supabase.from('combos').insert({
      user_id:    user.id,
      items:      combo.items.map((i) => i.id),
      score:      combo.score,
      worn_at:    now,
      created_at: now,
    });
    if (!error) markWorn(key);
    setSavingKey(null);
  };

  // Avatar kontrolü: varsa direkt IDM-VTON, yoksa seçenek modalı
  const handleVirtualModelPress = (combo: Combo) => {
    if (!user?.avatarUrl) {
      setPendingCombo(combo);
      setNoAvatarModalVisible(true);
      return;
    }
    handleVirtualModel(combo, user.avatarUrl);
  };

  const handleVirtualModel = async (combo: Combo, avatarUrl?: string) => {
    console.log('handleVirtualModel çağrıldı', combo);
    console.log('user physical profile:', user?.height, user?.bodyType, user?.skinTone);
    if (!user) return;

    // Fiziksel profil + render sayısını çek
    const { data: profile } = await supabase
      .from('profiles')
      .select('height, age, body_type, skin_tone, hair_color, hair_length, hair_type, virtual_model_renders')
      .eq('id', user.id)
      .maybeSingle();

    const renderCount = (profile?.virtual_model_renders ?? 0) as number;

    if (renderCount >= FREE_RENDER_LIMIT && !user.isPremium) {
      setPremiumModalVisible(true);
      return;
    }

    setGeneratingComboId(combo.id);

    try {
      const physProfile: PhysicalProfile = {
        height:     (profile?.height     ?? 165) as number,
        age:        (profile?.age        ?? 25)  as number,
        bodyType:   (profile?.body_type  ?? null) as string | null,
        skinTone:   (profile?.skin_tone  ?? null) as string | null,
        hairColor:  (profile?.hair_color ?? null) as string | null,
        hairLength: (profile?.hair_length ?? null) as string | null,
        hairType:   (profile?.hair_type  ?? null) as string | null,
      };

      const url = await generateVirtualModelImage(physProfile, combo.items, avatarUrl);

      // Render sayısını artır
      await supabase
        .from('profiles')
        .update({ virtual_model_renders: renderCount + 1 })
        .eq('id', user.id);

      setModelImageUrl(url);
      setModelModalVisible(true);
    } catch (err) {
      Alert.alert(
        'Hata',
        err instanceof Error ? err.message : 'Manken görüntüsü oluşturulamadı. Lütfen tekrar dene.',
      );
    } finally {
      setGeneratingComboId(null);
    }
  };

  const combos  = aiCombos;
  const missing = useMemo(() => missingCategories(items), [items]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.textTertiary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Kombinler</Text>
          {combos.length > 0 && (
            <Text style={styles.headerCount}>{combos.length} öneri</Text>
          )}
        </View>
      </View>

      {/* Occasion filtreleri */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        <TouchableOpacity
          key="all"
          style={[styles.chip, activeOccasion === 'all' && styles.chipActive]}
          onPress={() => setActiveOccasion('all')}
          activeOpacity={0.75}
        >
          <Text style={[styles.chipText, activeOccasion === 'all' && styles.chipTextActive]}>
            Tümü
          </Text>
        </TouchableOpacity>

        {OCCASIONS.map((occ) => {
          const active = activeOccasion === occ.id;
          return (
            <TouchableOpacity
              key={occ.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setActiveOccasion(occ.id)}
              activeOpacity={0.75}
            >
              <Feather name={occ.icon as any} size={12} color={active ? colors.white : colors.text} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {occ.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* İçerik */}
      {aiLoading ? (
        <View style={styles.aiLoadingContainer}>
          <ActivityIndicator color={colors.textSecondary} size="large" />
          <Text style={styles.aiLoadingText}>Stilistiniz kombinlerinizi hazırlıyor...</Text>
        </View>
      ) : combos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="layers" size={44} color={colors.border} style={{ marginBottom: spacing.lg }} />
          <Text style={styles.emptyTitle}>Kombin üretilemedi</Text>
          {missing.length > 0 ? (
            <>
              <Text style={styles.emptySubtitle}>
                Kombin için dolabında şunlar gerekiyor:
              </Text>
              {missing.map((cat) => (
                <View key={cat} style={styles.missingRow}>
                  <Text style={styles.missingBullet}>–</Text>
                  <Text style={styles.missingText}>{cat}</Text>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.emptySubtitle}>
              Dolabına parça ekleyerek başla
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={combos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const key = comboKey(item);
            return (
              <ComboCard
                combo={item}
                isWorn={wornComboKeys.has(key)}
                isSaving={savingKey === key}
                isGenerating={generatingComboId === item.id}
                onWear={() => handleWear(item)}
                onVirtualModel={() => handleVirtualModelPress(item)}
              />
            );
          }}
          ListFooterComponent={
            <View style={styles.loadMoreContainer}>
              {loadingMore ? (
                <ActivityIndicator color={colors.textSecondary} size="small" />
              ) : (
                <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore} activeOpacity={0.85}>
                  <Text style={styles.loadMoreText}>Daha fazla kombin</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Modaller */}
      <ModelModal
        visible={modelModalVisible}
        imageUrl={modelImageUrl}
        onClose={() => setModelModalVisible(false)}
      />
      <PremiumModal
        visible={premiumModalVisible}
        onClose={() => setPremiumModalVisible(false)}
      />
      <NoAvatarModal
        visible={noAvatarModalVisible}
        onClose={() => { setNoAvatarModalVisible(false); setPendingCombo(null); }}
        onGoToProfile={() => {
          setNoAvatarModalVisible(false);
          setPendingCombo(null);
          navigation.navigate('Profile');
        }}
        onUseAiModel={() => {
          setNoAvatarModalVisible(false);
          if (pendingCombo) handleVirtualModel(pendingCombo, undefined);
          setPendingCombo(null);
        }}
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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

  // Filtre bar
  filterBar: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexShrink: 0,
  },
  filterBarContent: {
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.sm + 2,
    gap: spacing.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  chipText: {
    ...typography.label,
    color: colors.text,
  },
  chipTextActive: {
    color: colors.white,
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
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  missingBullet: {
    ...typography.body,
    color: colors.textTertiary,
  },
  missingText: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },

  // Kombin listesi
  list: {
    padding: layout.screenPaddingH,
    gap: spacing.md,
  },

  // Kombin kartı
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  itemImageWrap: {
    width: '30%',
    alignItems: 'center',
    gap: spacing.xs,
  },
  itemImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  itemLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  scoreText: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    ...typography.label,
    color: colors.textSecondary,
  },

  // Kart footer
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  comboLabel: {
    flex: 1,
    ...typography.h3,
    fontFamily: fonts.heading,
    color: colors.text,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },

  // Sanal manken butonu
  modelBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Üretim yükleme durumu
  generatingState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  generatingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  // Giy butonu
  wearBtn: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.text,
    minWidth: 48,
    alignItems: 'center',
  },
  wearBtnWorn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wearBtnText: {
    ...typography.bodySmall,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  wearBtnTextWorn: {
    color: colors.textSecondary,
  },

  // Daha fazla yükle
  loadMoreContainer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  loadMoreBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  loadMoreText: {
    ...typography.label,
    color: colors.text,
  },

  // AI yükleme durumu
  aiLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  aiLoadingText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

// ─── Modal stilleri ───────────────────────────────────────────────────────────

const modalStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.screenPaddingH,
  },
  image: {
    width: '100%',
    aspectRatio: 1024 / 1792,
    borderRadius: radius.md,
  },
  footer: {
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  shareBtn: {
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.black,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  shareBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
});

// ─── Fotoğraf yok modal stilleri ─────────────────────────────────────────────

const noAvatarStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingH,
  },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryBtn: {
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  secondaryBtn: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  cancelBtnText: {
    ...typography.body,
    color: colors.textTertiary,
  },
});

// ─── Premium modal stilleri ───────────────────────────────────────────────────

const premiumStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingH,
  },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  premiumBtn: {
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  cancelBtnText: {
    ...typography.body,
    color: colors.textTertiary,
  },
});
