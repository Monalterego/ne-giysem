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
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../store/useUserStore';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { generateCombos } from '../../utils/comboEngine';
import { colors, fonts, typography, spacing, radius, shadows, layout } from '../../constants/theme';

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const user     = useUserStore((s) => s.user);
  const logout   = useUserStore((s) => s.logout);
  const setUser  = useUserStore((s) => s.setUser);
  const items    = useWardrobeStore((s) => s.items);
  const setItems      = useWardrobeStore((s) => s.setItems);
  const setOnboarded  = useUserStore((s) => s.setOnboarded);

  const combos = useMemo(() => generateCombos(items, 50), [items]);
  const avgScore = combos.length > 0
    ? Math.round(combos.reduce((sum, c) => sum + c.score, 0) / combos.length)
    : 0;

  const [styleEntries,  setStyleEntries]  = useState<{ name: string; weight: number }[]>([]);
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

  const [editingName, setEditingName] = useState(false);
  const [nameInput,   setNameInput]   = useState(user?.name ?? '');
  const [savingName,  setSavingName]  = useState(false);

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

  const handleLogout = () => {
    supabase.auth.signOut()
      .catch((err) => console.warn('[ProfileScreen] signOut exception:', err))
      .finally(() => {
        setItems([]);
        logout();
      });
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

        <View style={styles.separator} />

        {/* ── İstatistikler — kart yok, direkt ekranda ── */}
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

        <View style={styles.separator} />

        {/* ── Stil DNA ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>STİL DNA</Text>
          {loadingStyles ? (
            <ActivityIndicator color={colors.textTertiary} size="small" />
          ) : styleEntries.length === 0 ? (
            <View style={styles.emptyDna}>
              <Text style={styles.emptyMuted}>Stil profili henüz oluşturulmadı.</Text>
              <TouchableOpacity
                style={styles.styleBtn}
                onPress={() => setOnboarded(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.styleBtnText}>Stilini Belirle →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.dnaList}>
              {styleEntries.map((entry, i) => (
                <View key={entry.name}>
                  <View style={styles.dnaRow}>
                    <Text style={styles.dnaName}>{entry.name}</Text>
                    <Text style={styles.dnaWeight}>{entry.weight}%</Text>
                  </View>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${entry.weight}%` }]} />
                  </View>
                  {i < styleEntries.length - 1 && <View style={styles.dnaSeparator} />}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Hesap ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>HESAP</Text>

          {!editingName ? (
            <TouchableOpacity
              style={styles.listItem}
              onPress={() => {
                setNameInput(user.name);
                setEditingName(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.listItemText}>İsmini Güncelle</Text>
              <Feather name="chevron-right" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.nameEditWrap}>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Adın"
                placeholderTextColor={colors.textTertiary}
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
          activeOpacity={0.7}
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
    paddingBottom: spacing.xl,
  },

  // Separator
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    paddingHorizontal: layout.screenPaddingH,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    ...typography.h3,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    letterSpacing: 1,
  },
  userName: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  userEmail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  // İstatistikler
  statsRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xl,
    backgroundColor: colors.background,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  statValue: {
    ...typography.h1,
    color: colors.text,
  },
  statLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },

  // Kartlar
  card: {
    marginHorizontal: layout.screenPaddingH,
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.subtle,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  emptyMuted: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  emptyDna: {
    gap: spacing.sm,
  },
  styleBtn: {
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.black,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  styleBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.white,
  },

  // Stil DNA
  dnaList: {
    gap: 0,
  },
  dnaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  dnaName: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  dnaWeight: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  progressBg: {
    height: 2,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.text,
    borderRadius: radius.full,
  },
  dnaSeparator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },

  // Hesap — liste item
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  listItemText: {
    ...typography.body,
    color: colors.text,
  },

  // İsim düzenleme
  nameEditWrap: {
    gap: spacing.sm,
  },
  nameInput: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.background,
  },
  nameEditBtns: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    ...typography.body,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // Çıkış Yap
  logoutBtn: {
    marginTop: spacing.xl,
    marginHorizontal: layout.screenPaddingH,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  logoutText: {
    ...typography.body,
    color: colors.error,
  },

  bottomPad: {
    height: spacing.md,
  },
});
