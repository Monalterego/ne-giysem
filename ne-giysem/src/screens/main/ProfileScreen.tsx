import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../store/useUserStore';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { generateCombos } from '../../utils/comboEngine';
import { colors, fonts } from '../../constants/theme';

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

const STYLE_LABEL: Record<string, string> = {
  minimalist:   'Minimalist',
  streetwear:   'Streetwear',
  old_money:    'Old Money',
  smart_casual: 'Smart Casual',
  bohemian:     'Bohemian',
  athleisure:   'Athleisure',
  avant_garde:  'Avant-garde',
};

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const user    = useUserStore((s) => s.user);
  const logout  = useUserStore((s) => s.logout);
  const setUser = useUserStore((s) => s.setUser);
  const items   = useWardrobeStore((s) => s.items);

  // İstatistikler
  const combos = useMemo(() => generateCombos(items, 50), [items]);
  const avgScore = combos.length > 0
    ? Math.round(combos.reduce((sum, c) => sum + c.score, 0) / combos.length)
    : 0;

  // Stil DNA
  const [styleEntries, setStyleEntries] = useState<{ name: string; weight: number }[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('style_profiles')
      .select('styles')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.styles) setStyleEntries(data.styles);
      })
      .finally(() => setLoadingStyles(false));
  }, [user?.id]);

  // İsim güncelleme
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  const handleSaveName = async () => {
    if (!user) return;
    const trimmed = nameInput.trim();
    if (!trimmed) {
      Alert.alert('Hata', 'İsim boş bırakılamaz.');
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: trimmed })
      .eq('id', user.id);
    setSavingName(false);
    if (error) {
      Alert.alert('Hata', 'İsim güncellenemedi. Tekrar dene.');
      return;
    }
    setUser({ ...user, name: trimmed });
    setEditingName(false);
  };

  // Çıkış
  const handleLogout = async () => {
    Alert.alert('Çıkış Yap', 'Hesabından çıkmak istediğine emin misin?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          logout();
        },
      },
    ]);
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar + bilgi ── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user.name)}</Text>
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>

        {/* ── İstatistikler ── */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{items.length}</Text>
            <Text style={styles.statLabel}>Parça</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{combos.length}</Text>
            <Text style={styles.statLabel}>Kombin</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{avgScore}%</Text>
            <Text style={styles.statLabel}>Ort. Uyum</Text>
          </View>
        </View>

        {/* ── Stil DNA ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stil DNA</Text>
          {loadingStyles ? (
            <ActivityIndicator color={colors.accent} size="small" style={styles.loader} />
          ) : styleEntries.length === 0 ? (
            <Text style={styles.emptyMuted}>Stil profili henüz oluşturulmadı.</Text>
          ) : (
            <View style={styles.dnaTagRow}>
              {styleEntries.map((entry) => (
                <View key={entry.name} style={styles.dnaTag}>
                  <Text style={styles.dnaTagName}>
                    {STYLE_LABEL[entry.name] ?? entry.name}
                  </Text>
                  <Text style={styles.dnaTagWeight}>{entry.weight}%</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── İsim güncelleme ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hesap</Text>

          {!editingName ? (
            <TouchableOpacity
              style={styles.textBtn}
              onPress={() => {
                setNameInput(user.name);
                setEditingName(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.textBtnLabel}>İsmini Güncelle</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.nameEditWrap}>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Adın"
                placeholderTextColor={colors.muted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
              />
              <View style={styles.nameEditBtns}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setEditingName(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveName}
                  disabled={savingName}
                  activeOpacity={0.85}
                >
                  {savingName ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Kaydet</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Çıkış Yap ── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 28,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    letterSpacing: 1,
  },
  userName: {
    fontSize: 20,
    fontFamily: fonts.headingBold,
    color: colors.primary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.muted,
  },

  // İstatistikler
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    paddingVertical: 20,
    boxShadow: '0 1px 6px rgba(26,26,46,0.04)',
    elevation: 1,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  statValue: {
    fontSize: 22,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.muted,
  },

  // Kart
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 16,
    gap: 14,
    boxShadow: '0 1px 6px rgba(26,26,46,0.04)',
    elevation: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  loader: {
    alignSelf: 'flex-start',
  },
  emptyMuted: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.muted,
  },

  // Stil DNA etiketleri
  dnaTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dnaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  dnaTagName: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.white,
  },
  dnaTagWeight: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.accent,
  },

  // İsim güncelleme
  textBtn: {
    alignSelf: 'flex-start',
  },
  textBtnLabel: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.accent,
  },
  nameEditWrap: {
    gap: 12,
  },
  nameInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.primary,
    backgroundColor: colors.background,
  },
  nameEditBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.muted,
  },
  saveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // Çıkış
  logoutBtn: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#FFCDD2',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    marginTop: 4,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: '#C62828',
  },

  bottomPad: {
    height: 16,
  },
});
