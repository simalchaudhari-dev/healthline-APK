import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { Heart, Plus } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import LoadingScreen from '../../components/common/LoadingScreen';
import ScreenHeader from '../../components/common/ScreenHeader';
import { useTheme } from '../../context/ThemeContext';
import { useDiary } from '../../context/DiaryContext';
import { useConfirm } from '../../context/ConfirmContext';
import { colors, themeColors } from '../../config/colors';
import { snPro } from '../../config/fonts';

export default function FavoritesScreen({ navigation }) {
  const { isDark } = useTheme();
  const c = themeColors(isDark);
  const { favorites, toggleFavorite, addFood, favoritesLoading } = useDiary();
  const { confirm } = useConfirm();
  // Saved on the user's account with full nutrition, so no per-item fetch is needed.
  const list = favorites || [];
  const loading = favoritesLoading;

  const logFood = (food) => {
    addFood('snacks', food);
    navigation.navigate('Main', { screen: 'Diary' });
  };

  const removeFavorite = async (food) => {
    const ok = await confirm({
      title: 'Remove favorite?',
      message: `Remove “${food.name}” from your favorites?`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
    });
    if (ok) toggleFavorite(food);
  };

  return (
    <ScreenShell>
      <ScreenHeader title="Favorites" onBack={() => navigation.goBack()} theme={c} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <LoadingScreen message="Loading your favorites…" />
        ) : !list.length ? (
          <Text style={[styles.empty, { color: c.muted, fontFamily: snPro('500') }]}>
            No favorites yet. Heart a food to save it here.
          </Text>
        ) : (
          list.map((food) => (
            <View
              key={food.id}
              style={[styles.row, { backgroundColor: c.cardBg, borderColor: c.border }]}
            >
              {food.imageUrl ? (
                <Image source={{ uri: food.imageUrl }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={[styles.thumb, { backgroundColor: `${colors.primary}18` }]} />
              )}
              <Pressable
                style={{ flex: 1 }}
                onPress={() => navigation.navigate('FoodDetail', { id: food.id, food, meal: 'snacks' })}
              >
                <Text style={[styles.name, { color: c.text, fontFamily: snPro('700') }]}>{food.name}</Text>
                <Text style={[styles.sub, { color: c.muted, fontFamily: snPro('500') }]}>
                  {food.brand || 'Food'} · {food.serving} · {food.calories} kcal
                </Text>
              </Pressable>
              <Pressable onPress={() => logFood(food)} hitSlop={8} style={styles.iconBtn}>
                <Plus size={18} color={colors.primary} />
              </Pressable>
              <Pressable onPress={() => removeFavorite(food)} hitSlop={8} style={styles.iconBtn}>
                <Heart size={18} color={colors.danger} fill={colors.danger} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
  empty: { marginTop: 24, fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  thumb: { width: 44, height: 44, borderRadius: 12, overflow: 'hidden' },
  name: { fontSize: 14 },
  sub: { fontSize: 12, marginTop: 2 },
  iconBtn: { padding: 6 },
});
