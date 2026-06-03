import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { generateCombos, missingCategories } from '../../utils/comboEngine';
import type { Occasion } from '../../utils/comboEngine';
import { OCCASIONS } from '../../constants/occasions';
import { generateVirtualModelImage, getModelImage, comboSignatureForCache } from '../../utils/virtualModel';
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

const ComboCard = React.memo(function ComboCard({
  combo,
  isWorn,
  isSaving,
  isGenerating,
  onWear,
  onVirtualModel,
  onItemPress,
}: {
  combo: Combo;
  isWorn: boolean;
  isSaving: boolean;
  isGenerating: boolean;
  onWear: (c: Combo) => void;
  onVirtualModel: (c: Combo) => void;
  onItemPress: (url: string) => void;
}) {
  const allItems = [...combo.items, ...(combo.suggestedItems ?? [])];

  return (
    <View style={styles.card}>

      {/* Tüm parçalar — flat-lay grid, dokunulabilir */}
      <View style={styles.imagesGrid}>
        {allItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.itemImageWrap}
            onPress={() => onItemPress(item.processedImageUrl)}
            activeOpacity={0.82}
          >
            <Image
              source={{ uri: item.processedImageUrl }}
              style={styles.itemImage}
              resizeMode="contain"
            />
            <Text style={styles.itemLabel}>{CATEGORY_LABEL[item.category] ?? item.category}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>{combo.score}%</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <View style={styles.footerLeft}>
          <Text style={styles.comboLabel}>{combo.label}</Text>
          {combo.reasoning ? (
            <Text style={styles.comboReasoning}>{combo.reasoning}</Text>
          ) : null}
        </View>

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
              onPress={() => onVirtualModel(combo)}
              activeOpacity={0.85}
            >
              <Feather name="user" size={14} color={colors.text} />
              <Text style={styles.modelBtnText}>Üzerinde Gör</Text>
            </TouchableOpacity>

            {/* Giy butonu */}
            {isWorn ? (
              <View style={[styles.wearBtn, styles.wearBtnWorn]}>
                <Text style={[styles.wearBtnText, styles.wearBtnTextWorn]}>✓ Giyildi</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.wearBtn}
                onPress={() => onWear(combo)}
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
});

// ─── Model sonuç modalı ───────────────────────────────────────────────────────

function ModelModal({
  visible,
  imageUrl,
  hasExtras,
  onClose,
}: {
  visible: boolean;
  imageUrl: string | null;
  hasExtras: boolean;
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
            <Feather name="arrow-left" size={20} color={colors.text} />
            <Text style={modalStyles.closeBtnText}>Geri</Text>
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
          {hasExtras && (
            <Text style={modalStyles.modelNote}>
              Çanta ve takılar mankene yansıtılamıyor — tam kombini kartta görebilirsin.
            </Text>
          )}
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

  const PAGE_SIZE = 6;

  const [savingKey,      setSavingKey]      = useState<string | null>(null);
  const [activeOccasion, setActiveOccasion] = useState<Occasion>('all');
  const [localCombos,    setLocalCombos]    = useState<Combo[]>([]);
  const [visibleCount,   setVisibleCount]   = useState(PAGE_SIZE);

  // Virtual model state
  const [generatingComboId,    setGeneratingComboId]    = useState<string | null>(null);
  const [modelImageUrl,        setModelImageUrl]         = useState<string | null>(null);
  const [modelModalVisible,    setModelModalVisible]     = useState(false);
  const [modelHasExtras,       setModelHasExtras]        = useState(false);
  const [lightboxUrl,          setLightboxUrl]           = useState<string | null>(null);
  const [premiumModalVisible,  setPremiumModalVisible]   = useState(false);
  const [noAvatarModalVisible, setNoAvatarModalVisible]  = useState(false);
  const [pendingCombo,         setPendingCombo]          = useState<Combo | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchItems(user.id);
      fetchWornToday(user.id);
    }
  }, [user?.id]);

  // Yeni parça eklenince, kullanıcı veya hava durumu değişince cache'i sıfırla
  useEffect(() => {
    clearCache();
  }, [items, user?.id, weather]);

  // Lokal kombin üretimi — senkron, sıfır network; weather değişince yeniden hesaplanır
  useEffect(() => {
    if (!items.length || !user) { setLocalCombos([]); return; }
    const cached = comboCache[activeOccasion];
    if (cached) { setLocalCombos(cached); setVisibleCount(PAGE_SIZE); return; }
    const combos = generateCombos(items, 24, activeOccasion, weather ?? undefined, user?.styleProfile ?? undefined);
    setCache(activeOccasion, combos);
    setLocalCombos(combos);
    setVisibleCount(PAGE_SIZE);
  }, [items, activeOccasion, user?.id, weather]);

  const handleLoadMore = () => {
    setVisibleCount((v) => v + PAGE_SIZE);
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
    if (!user) return;
    setModelHasExtras(combo.items.some((i) => i.category === 'bag' || i.category === 'accessory'));

    // Fiziksel profil + render sayısı + kayıtlı manken URL'i
    const { data: profile } = await supabase
      .from('profiles')
      .select('height, age, body_type, skin_tone, hair_color, hair_length, hair_type, virtual_model_renders, mannequin_url')
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
        height:     (profile?.height      ?? 165) as number,
        age:        (profile?.age         ?? 25)  as number,
        bodyType:   (profile?.body_type   ?? null) as string | null,
        skinTone:   (profile?.skin_tone   ?? null) as string | null,
        hairColor:  (profile?.hair_color  ?? null) as string | null,
        hairLength: (profile?.hair_length ?? null) as string | null,
        hairType:   (profile?.hair_type   ?? null) as string | null,
      };

      // 1. Manken kaynağını çöz: avatarUrl → kayıtlı manken → yeni üretim
      const savedMannequinUrl = (profile?.mannequin_url ?? null) as string | null;
      let modelSource = avatarUrl ?? savedMannequinUrl;

      if (!modelSource) {
        modelSource = await getModelImage(physProfile);
        await supabase.from('profiles').update({ mannequin_url: modelSource }).eq('id', user.id);
      }

      // GEÇİCİ teşhis — manken kaynağı
      const sourceType = avatarUrl ? 'avatar' : (savedMannequinUrl ? 'KAYITLI manken' : 'YENI uretim');
      console.warn('[manken] kaynak:', sourceType, modelSource?.slice(0, 50));

      // 2. Kombin cache kontrolü
      const cacheKey = `${user.id}/${comboSignatureForCache(combo.items)}.png`;
      const { data: { publicUrl: cachedUrl } } = supabase.storage
        .from('mannequin-cache')
        .getPublicUrl(cacheKey);

      try {
        const headRes = await fetch(cachedUrl, { method: 'HEAD' });
        if (headRes.ok) {
          // Cache HIT — FASHN çağrısı yok, render sayacı artmaz
          console.warn('[manken] CACHE HIT');
          setModelImageUrl(cachedUrl);
          setModelModalVisible(true);
          return;
        }
      } catch {
        // HEAD hatası → cache miss sayılır, devam et
      }

      // 3. Cache MISS — üret, bucket'a yükle, render sayacını artır
      console.warn('[manken] CACHE MISS - uretiliyor');
      Alert.alert('DEBUG', sourceType + ' | cache MISS, uretiliyor');   // GEÇİCİ
      const finalUrl = await generateVirtualModelImage(physProfile, combo.items, modelSource);
      if (!finalUrl) { Alert.alert('DEBUG', 'finalUrl boş'); return; }

      const imgRes = await fetch(finalUrl);
      if (!imgRes.ok) { Alert.alert('DEBUG', 'FASHN fetch HTTP ' + imgRes.status); return; }
      const imgBuffer = await imgRes.arrayBuffer();
      const imgBytes  = new Uint8Array(imgBuffer);

      const { error: upErr } = await supabase.storage
        .from('mannequin-cache')
        .upload(cacheKey, imgBytes, { upsert: true, contentType: 'image/png' });

      if (upErr) {
        Alert.alert('UPLOAD HATASI', upErr.message + ' | bytes=' + imgBytes.length);
        setModelImageUrl(finalUrl);
        setModelModalVisible(true);
        return;
      }

      const { data: { publicUrl: uploadedUrl } } = supabase.storage
        .from('mannequin-cache')
        .getPublicUrl(cacheKey);

      await supabase.from('profiles').update({ virtual_model_renders: renderCount + 1 }).eq('id', user.id);

      setModelImageUrl(uploadedUrl);
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

  // Stabil callback referansları — React.memo'nun çalışması için lightbox state değişince
  // bu fonksiyonlar yeniden üretilmemeli (lightbox bağımlılığı yok).
  const handleWearCb       = useCallback((c: Combo) => handleWear(c),              [handleWear]);
  const handleVirtualCb    = useCallback((c: Combo) => handleVirtualModelPress(c), [handleVirtualModelPress]);
  const handleItemPressCb  = useCallback((url: string) => setLightboxUrl(url),     []);

  const combos  = localCombos;
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
      {combos.length === 0 ? (
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
          data={localCombos.slice(0, visibleCount)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews={true}
          renderItem={({ item }) => {
            const key = comboKey(item);
            return (
              <ComboCard
                combo={item}
                isWorn={wornComboKeys.has(key)}
                isSaving={savingKey === key}
                isGenerating={generatingComboId === item.id}
                onWear={handleWearCb}
                onVirtualModel={handleVirtualCb}
                onItemPress={handleItemPressCb}
              />
            );
          }}
          ListFooterComponent={
            visibleCount < localCombos.length ? (
              <View style={styles.loadMoreContainer}>
                <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore} activeOpacity={0.85}>
                  <Text style={styles.loadMoreText}>Daha fazla kombin</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}

      {/* Parça lightbox */}
      <Modal visible={lightboxUrl !== null} transparent animationType="fade" onRequestClose={() => setLightboxUrl(null)}>
        <TouchableOpacity style={styles.lightboxOverlay} activeOpacity={1} onPress={() => setLightboxUrl(null)}>
          <View style={styles.lightboxContainer}>
            {lightboxUrl && (
              <Image source={{ uri: lightboxUrl }} style={styles.lightboxImage} resizeMode="contain" />
            )}
            <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxUrl(null)} activeOpacity={0.8}>
              <Feather name="x" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modaller */}
      <ModelModal
        visible={modelModalVisible}
        imageUrl={modelImageUrl}
        hasExtras={modelHasExtras}
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
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    backgroundColor: '#F8F8F6',
    position: 'relative',
  },
  itemImageWrap: {
    width: '30%',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#F5F5F5',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: spacing.xs,
    // hafif gölge
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  itemImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.sm,
  },
  itemLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  scoreBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    zIndex: 2,
  },
  scoreText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },

  // Kart footer
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  footerLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  comboLabel: {
    ...typography.h3,
    fontFamily: fonts.heading,
    color: colors.text,
  },
  comboReasoning: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },

  // Sanal manken butonu
  modelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  modelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
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
    justifyContent: 'flex-start',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 72,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
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
  modelNote: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },

  // Parça lightbox
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxContainer: {
    width: '85%',
    aspectRatio: 3 / 4,
    position: 'relative',
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
    borderRadius: radius.lg,
  },
  lightboxClose: {
    position: 'absolute',
    top: -14,
    right: -14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
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
