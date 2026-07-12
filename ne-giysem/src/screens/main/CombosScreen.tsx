import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { t } from '../../i18n';
import { catLabel } from '../../constants/categories';

const FREE_RENDER_LIMIT = 3;
const FEW_COMBOS = 4;

// Anahtar referansları — t() gösterim anında çağrılır (dil değişince donmaz)
const LOADING_MSGS = [
  'combos.selectingItems',
  'combos.modelPreparingDots',
  'combos.dressingCombo',
  'combos.finalTouches',
] as const;

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
  onItemPress: (itemId: string, url: string) => void;
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
            onPress={() => onItemPress(item.id, item.processedImageUrl)}
            activeOpacity={0.82}
          >
            <Image
              source={{ uri: item.processedImageUrl }}
              style={styles.itemImage}
              resizeMode="contain"
            />
            <Text style={styles.itemLabel}>{catLabel(item.category)}</Text>
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
            <Text style={styles.generatingText}>{t('combos.modelPreparing')}</Text>
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
              <Text style={styles.modelBtnText}>{t('combos.tryOn')}</Text>
            </TouchableOpacity>

            {/* Giy butonu */}
            {isWorn ? (
              <View style={[styles.wearBtn, styles.wearBtnWorn]}>
                <Text style={[styles.wearBtnText, styles.wearBtnTextWorn]}>{t('combos.worn')}</Text>
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
                  : <Text style={styles.wearBtnText}>{t('combos.wear')}</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
// Callback referans değişimi (lightbox vs.) kart render tetiklemesin — sadece görsel veriye bak
}, (prev, next) =>
  prev.combo.id      === next.combo.id      &&
  prev.isWorn        === next.isWorn        &&
  prev.isSaving      === next.isSaving      &&
  prev.isGenerating  === next.isGenerating,
);

// ─── Model sonuç modalı ───────────────────────────────────────────────────────

function ModelModal({
  visible,
  imageUrl,
  hasExtras,
  isLoading,
  onClose,
}: {
  visible: boolean;
  imageUrl: string | null;
  hasExtras: boolean;
  isLoading: boolean;
  onClose: () => void;
}) {
  const insets    = useSafeAreaInsets();
  const spinValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(1)).current;
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      spinValue.stopAnimation();
      spinValue.setValue(0);
      setMsgIdx(0);
      fadeValue.setValue(1);
      return;
    }

    // Dönen halka
    Animated.loop(
      Animated.timing(spinValue, { toValue: 1, duration: 1400, useNativeDriver: true }),
    ).start();

    // Mesaj değişimi — fade + cycle
    const interval = setInterval(() => {
      Animated.timing(fadeValue, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setMsgIdx((prev) => (prev + 1) % LOADING_MSGS.length);
        Animated.timing(fadeValue, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 2200);

    return () => clearInterval(interval);
  }, [isLoading]);

  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const handleShare = async () => {
    if (!imageUrl) return;
    await Share.share({
      message: `Sanal manken kombinim — Sestina ile oluşturuldu: ${imageUrl}`,
      url: imageUrl,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={modalStyles.safe}>

        {/* Kapat butonu — çentik güvenli alan */}
        <View style={[modalStyles.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Feather name="arrow-left" size={20} color={colors.text} />
            <Text style={modalStyles.closeBtnText}>{t('combos.back')}</Text>
          </TouchableOpacity>
        </View>

        {isLoading || !imageUrl ? (
          /* ── Bekleme ekranı ── */
          <View style={modalStyles.loadingScreen}>
            {/* Dönen halka + ikon */}
            <View style={modalStyles.spinnerWrap}>
              <Animated.View style={[modalStyles.spinRing, { transform: [{ rotate: spin }] }]} />
              <Feather name="shopping-bag" size={36} color={colors.text} />
            </View>

            <Text style={modalStyles.loadingTitle}>{t('combos.preparingCombo')}</Text>

            {/* Değişen mesaj */}
            <Animated.Text style={[modalStyles.loadingMsg, { opacity: fadeValue }]}>
              {t(LOADING_MSGS[msgIdx])}
            </Animated.Text>

            {/* İlerleme noktaları */}
            <View style={modalStyles.dotsRow}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[modalStyles.dot, i === msgIdx % 3 && modalStyles.dotActive]}
                />
              ))}
            </View>

            <Text style={modalStyles.loadingNote}>
              Bu işlem birkaç dakika sürebilir, ekranı açık tutman yeterli.
            </Text>
          </View>
        ) : (
          /* ── Sonuç ekranı ── */
          <>
            <ScrollView
              contentContainerStyle={modalStyles.imageContainer}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri: imageUrl }}
                style={modalStyles.image}
                resizeMode="contain"
              />
              {hasExtras && (
                <Text style={modalStyles.modelNote}>
                  Çanta ve takılar mankene yansıtılamıyor — tam kombini kartta görebilirsin.
                </Text>
              )}
            </ScrollView>

            <View style={modalStyles.footer}>
              <TouchableOpacity style={modalStyles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
                <Feather name="share-2" size={16} color={colors.white} />
                <Text style={modalStyles.shareBtnText}>{t('combos.share')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

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
          <Text style={premiumStyles.title}>{t('combos.limitReached')}</Text>
          <Text style={premiumStyles.body}>
            Ücretsiz planda {FREE_RENDER_LIMIT} sanal manken hakkın var.{'\n'}
            Premium'a geçerek sınırsız kullan.
          </Text>
          <TouchableOpacity style={premiumStyles.premiumBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={premiumStyles.premiumBtnText}>{t('combos.goPremium')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={premiumStyles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={premiumStyles.cancelBtnText}>{t('combos.close')}</Text>
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
          <Text style={noAvatarStyles.title}>{t('combos.photoRequired')}</Text>
          <Text style={noAvatarStyles.body}>
            Bu özelliği kullanmak için tam boy bir fotoğrafın gerekiyor. Yüzün ve vücudun görünür
            olmalı, iyi aydınlatmalı düz bir zeminde dur.
          </Text>
          <TouchableOpacity style={noAvatarStyles.primaryBtn} onPress={onGoToProfile} activeOpacity={0.85}>
            <Text style={noAvatarStyles.primaryBtnText}>{t('combos.addPhoto')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={noAvatarStyles.secondaryBtn} onPress={onUseAiModel} activeOpacity={0.75}>
            <Text style={noAvatarStyles.secondaryBtnText}>{t('combos.useVirtualModel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={noAvatarStyles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={noAvatarStyles.cancelBtnText}>{t('combos.close')}</Text>
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
  const [modelLoading,         setModelLoading]          = useState(false);
  const [lightboxItemId,       setLightboxItemId]        = useState<string | null>(null);
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

  const handleWear = useCallback(async (combo: Combo) => {
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
  }, [user, markWorn]);

  // Avatar kontrolü: varsa direkt IDM-VTON, yoksa seçenek modalı
  const handleVirtualModelPress = useCallback((combo: Combo) => {
    if (!user?.avatarUrl) {
      setPendingCombo(combo);
      setNoAvatarModalVisible(true);
      return;
    }
    handleVirtualModel(combo, user.avatarUrl);
  }, [user, handleVirtualModel]);

  const handleVirtualModel = useCallback(async (combo: Combo, avatarUrl?: string) => {
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

    // Modal hemen aç — bekleme ekranı gösterilsin
    setModelImageUrl(null);
    setModelLoading(true);
    setModelModalVisible(true);
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
      let modelSource: string | null = avatarUrl ?? null;

      // Kayıtlı manken varsa canlı mı doğrula (FASHN CDN çıktıları 72 saatte silinir — ölü URL 403 verir)
      if (!modelSource && savedMannequinUrl) {
        try {
          const head = await fetch(savedMannequinUrl, { method: 'HEAD' });
          if (head.ok) modelSource = savedMannequinUrl;
        } catch {
          // ölü/erişilemez — aşağıda yeniden üretilecek
        }
      }

      if (!modelSource) {
        const fashnUrl = await getModelImage(physProfile);
        // FASHN URL'i geçici — kendi storage'ımıza taşı, kalıcı URL'i kaydet
        let persistedUrl = fashnUrl;
        try {
          const res = await fetch(fashnUrl);
          if (res.ok) {
            const bytes = new Uint8Array(await res.arrayBuffer());
            const baseKey = `${user.id}/base_mannequin.png`;
            const { error: mErr } = await supabase.storage
              .from('mannequin-cache')
              .upload(baseKey, bytes, { upsert: true, contentType: 'image/png' });
            if (!mErr) {
              persistedUrl = supabase.storage.from('mannequin-cache').getPublicUrl(baseKey).data.publicUrl;
            }
          }
        } catch {
          // taşıma başarısızsa FASHN URL ile devam — bu seans çalışır, sonraki seans yeniden üretir
        }
        modelSource = persistedUrl;
        await supabase.from('profiles').update({ mannequin_url: persistedUrl }).eq('id', user.id);
      }

      // 2. Kombin cache kontrolü
      const cacheKey = `${user.id}/${comboSignatureForCache(combo.items)}.png`;
      const { data: { publicUrl: cachedUrl } } = supabase.storage
        .from('mannequin-cache')
        .getPublicUrl(cacheKey);

      try {
        const headRes = await fetch(cachedUrl, { method: 'HEAD' });
        if (headRes.ok) {
          // Cache HIT — FASHN çağrısı yok, render sayacı artmaz
          setModelImageUrl(cachedUrl);
          return;   // finally loading'i kapatır
        }
      } catch {
        // HEAD hatası → cache miss sayılır, devam et
      }

      // 3. Cache MISS — üret, bucket'a yükle, render sayacını artır
      const finalUrl = await generateVirtualModelImage(physProfile, combo.items, modelSource);
      if (!finalUrl) return;

      const imgRes = await fetch(finalUrl);
      if (!imgRes.ok) throw new Error(t('combos.imageDownloadError'));
      const imgBuffer = await imgRes.arrayBuffer();
      const imgBytes  = new Uint8Array(imgBuffer);

      const { error: upErr } = await supabase.storage
        .from('mannequin-cache')
        .upload(cacheKey, imgBytes, { upsert: true, contentType: 'image/png' });

      if (upErr) console.warn('cache upload başarısız:', upErr.message);

      const { data: { publicUrl: uploadedUrl } } = supabase.storage
        .from('mannequin-cache')
        .getPublicUrl(cacheKey);

      await supabase.from('profiles').update({ virtual_model_renders: renderCount + 1 }).eq('id', user.id);

      // Upload patlasa bile FASHN URL'iyle manken gösterilir; sadece o sefer cache'lenmez
      setModelImageUrl(upErr ? finalUrl : uploadedUrl);
    } catch (err) {
      setModelModalVisible(false);
      Alert.alert(
        t('combos.errorTitle'),
        err instanceof Error ? err.message : t('combos.modelCreateError'),
      );
    } finally {
      setGeneratingComboId(null);
      setModelLoading(false);
    }
  }, [user]);

  // Stabil callback referansları — custom comparator sayesinde lightbox state
  // değiştiğinde memo kart render tetiklemez; yine de stable ref sağlıyoruz.
  const handleWearCb       = useCallback((c: Combo) => handleWear(c),              [handleWear]);
  const handleVirtualCb    = useCallback((c: Combo) => handleVirtualModelPress(c), [handleVirtualModelPress]);
  const handleItemPressCb  = useCallback((itemId: string, url: string) => {
    const isData = /^data:image\//i.test(url ?? '');
    if (isData) {
      Alert.alert(t('combos.imageOpenError'), t('combos.imageOpenErrorMsg'));
      return;
    }
    setLightboxItemId(itemId);
  }, []);

  // Lightbox için seçili item — tüm kartlardan ID ile bulunur; devasa string state'e girmez
  const selectedLightboxItem = useMemo(() => {
    if (!lightboxItemId) return null;
    return localCombos
      .flatMap((c) => [...c.items, ...(c.suggestedItems ?? [])])
      .find((i) => i.id === lightboxItemId) ?? null;
  }, [lightboxItemId, localCombos]);

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
          <Text style={styles.headerTitle}>{t('combos.title')}</Text>
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
          {items.length === 0 ? (
            // YENİ KULLANICI — dolap tamamen boş
            <>
              <Feather name="camera" size={44} color={colors.border} style={{ marginBottom: spacing.lg }} />
              <Text style={styles.emptyTitle}>{t('combos.emptyWardrobe')}</Text>
              <Text style={styles.emptySubtitle}>
                Birkaç parça ekle, senin tarzına ve hava durumuna göre kombinler hazırlayalım.
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => navigation.navigate('Scan')}
                activeOpacity={0.85}
              >
                <Feather name="plus" size={16} color={colors.background} />
                <Text style={styles.emptyCtaText}>{t('combos.addFirstItem')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            // DOLAP DOLU ama bu okazyona kombin çıkmadı
            <>
              <Feather name="layers" size={44} color={colors.border} style={{ marginBottom: spacing.lg }} />
              <Text style={styles.emptyTitle}>{t('combos.noComboForOccasion')}</Text>
              {missing.length > 0 ? (
                <>
                  <Text style={styles.emptySubtitle}>{t('combos.needForCombo')}</Text>
                  {missing.map((cat) => (
                    <View key={cat} style={styles.missingRow}>
                      <Text style={styles.missingBullet}>–</Text>
                      <Text style={styles.missingText}>{cat}</Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={styles.emptySubtitle}>
                  Bu okazyona uygun parçaların yok. Başka bir okazyon dene ya da dolabına parça ekle.
                </Text>
              )}
              <TouchableOpacity
                style={styles.emptyCtaSecondary}
                onPress={() => navigation.navigate('Scan')}
                activeOpacity={0.85}
              >
                <Feather name="plus" size={16} color={colors.text} />
                <Text style={styles.emptyCtaSecondaryText}>{t('combos.addItemShort')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={localCombos.slice(0, visibleCount)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          ListHeaderComponent={
            combos.length > 0 && combos.length < FEW_COMBOS ? (
              <View style={styles.infoBanner}>
                <Feather name="info" size={14} color={colors.textSecondary} />
                <Text style={styles.infoBannerText}>
                  Bu okazyon için {combos.length} uyumlu kombin bulundu. Dolabına bu tarza uygun
                  birkaç parça eklersen daha fazla öneri çıkar.
                </Text>
              </View>
            ) : null
          }
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
                  <Text style={styles.loadMoreText}>{t('combos.loadMore')}</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}

      {/* Parça lightbox */}
      <Modal visible={lightboxItemId !== null} transparent animationType="fade" onRequestClose={() => setLightboxItemId(null)}>
        <TouchableOpacity style={modalStyles.lightboxOverlay} activeOpacity={1} onPress={() => setLightboxItemId(null)}>
          <View style={modalStyles.lightboxContainer}>
            {selectedLightboxItem?.processedImageUrl && (
              <Image source={{ uri: selectedLightboxItem.processedImageUrl }} style={modalStyles.lightboxImage} resizeMode="contain" />
            )}
            <TouchableOpacity style={modalStyles.lightboxClose} onPress={() => setLightboxItemId(null)} activeOpacity={0.8}>
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
        isLoading={modelLoading}
        onClose={() => { setModelModalVisible(false); setModelLoading(false); setModelImageUrl(null); }}
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
    flexGrow: 0,
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
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.text,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    marginTop: spacing.lg,
  },
  emptyCtaText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyCtaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    marginTop: spacing.lg,
  },
  emptyCtaSecondaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
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

  // Az kombin bilgi şeridi
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    marginBottom: spacing.sm,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
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

  // Bekleme ekranı
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  spinnerWrap: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderTopColor: colors.text,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
  },
  loadingMsg: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.text,
  },
  loadingNote: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.md,
  },

  // Parça lightbox
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxContainer: {
    width: '88%',
    aspectRatio: 0.8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#ECECEC',
    borderRadius: radius.lg,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
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
