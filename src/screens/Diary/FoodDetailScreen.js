import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { ChevronLeft, Flame, Plus, Minus, Heart } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import LoadingScreen from '../../components/common/LoadingScreen';
import { useDiary } from '../../context/DiaryContext';
import { FONT, snPro } from '../../config/fonts';
import ProgressRing from '../../components/common/ProgressRing';
import { apiGetFoodById } from '../../services/foodsService';
import { SafeAreaTop } from '../../components/common/ScreenShell';
import { useSafeTop } from '../../utils/safeArea';
import { oneServing } from '../../utils/foodServing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FoodDetailScreen({ navigation, route }) {
  const { id, meal = 'breakfast', food: passedFood, barcode } = route.params || {};
  const { isDark, colors, themeColors: c } = useTheme();
  const topPad = useSafeTop();
  const insets = useSafeAreaInsets();
  const { addFood, isFavorite, toggleFavorite, customFoods } = useDiary();
  // Always work from one serving (a food picked from a logged / recent entry may hold totals).
  const [food, setFood] = useState(() =>
    oneServing(passedFood || (customFoods || []).find((f) => f.id === id) || null)
  );
  const [loadingFood, setLoadingFood] = useState(!passedFood && !!id);
  const [servings, setServings] = useState(1);

  useEffect(() => {
    if (passedFood || !id) {
      setLoadingFood(false);
      return undefined;
    }
    const custom = (customFoods || []).find((f) => f.id === id);
    if (custom) {
      setFood(oneServing(custom));
      setLoadingFood(false);
      return undefined;
    }
    let active = true;
    (async () => {
      setLoadingFood(true);
      const next = await apiGetFoodById(id);
      if (!active) return;
      setFood(next);
      setLoadingFood(false);
    })();
    return () => {
      active = false;
    };
  }, [id, passedFood, customFoods]);

  const scaled = useMemo(() => {
    if (!food) return null;
    // Every nutrient is for the servings eaten, not just one (fiber/sugar keep one decimal).
    const times = (value, places = 0) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return undefined;
      const f = 10 ** places;
      return Math.round(n * servings * f) / f;
    };
    // A missing macro on a scanned/custom food becomes 0, so the ring never shows "NaNg".
    const num = (value) => Math.round((Number(value) || 0) * servings);
    return {
      calories: num(food.calories),
      carbs: num(food.carbs),
      protein: num(food.protein),
      fat: num(food.fat),
      fiber: times(food.fiber, 1),
      sugar: times(food.sugar, 1),
      sodium: times(food.sodium),
    };
  }, [food, servings]);

  if (loadingFood) {
    return <LoadingScreen fullScreen message="Loading food…" />;
  }

  if (!food || !scaled) {
    return (
      <View style={[styles.root, { backgroundColor: c.pageBg, flex: 1, padding: 20 }]}>
        <SafeAreaTop color={c.pageBg} />
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ marginBottom: 16 }}>
          <ChevronLeft size={22} color={c.text} />
        </Pressable>
        <Text style={{ color: c.text, fontFamily: snPro('700'), fontSize: 16 }}>Food not found</Text>
        <Text style={{ color: c.muted, marginTop: 8, fontFamily: snPro('400') }}>
          Go back and try another item or barcode scan.
        </Text>
      </View>
    );
  }

  // Favourites store only the catalog food id (MongoDB ObjectId). Custom / scanned foods
  // have no catalog id, so they can't be favourited.
  const favId = String(food.foodId || food.id || '');
  const canFavorite = /^[a-f\d]{24}$/i.test(favId);
  const isFav = canFavorite && isFavorite(favId);

  const adjust = (delta) => {
    setServings((s) => Math.min(10, Math.max(1, s + delta)));
  };

  const log = () => {
    addFood(meal, {
      ...food,
      calories: scaled.calories,
      carbs: scaled.carbs,
      protein: scaled.protein,
      fat: scaled.fat,
      ...(scaled.fiber !== undefined ? { fiber: scaled.fiber } : null),
      ...(scaled.sugar !== undefined ? { sugar: scaled.sugar } : null),
      ...(scaled.sodium !== undefined ? { sodium: scaled.sodium } : null),
      serving: servings === 1 ? food.serving : `${servings} × ${food.serving}`,
      // How many servings these totals are for, so Recent can bring it back to one exactly.
      servings,
    });
    navigation.navigate('Main', { screen: 'Diary' });
  };

  const category = food.tags?.[0] || food.brand || 'Food';
  const rings = [
    { label: 'Protein', grams: scaled.protein, color: colors.protein, cap: 60 },
    { label: 'Fat', grams: scaled.fat, color: colors.fat, cap: 40 },
    { label: 'Carbs', grams: scaled.carbs, color: colors.carbs, cap: 80 },
  ];

  return (
    <View style={[styles.root, { backgroundColor: c.pageBg }]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        {food.imageUrl ? (
          <Image source={{ uri: food.imageUrl }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroImage, styles.heroFallback, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.heroLetter, { color: colors.primary, fontFamily: FONT.nova }]}>
              {(food.name || '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

        <View style={[styles.sheet, { backgroundColor: c.pageBg }]}>
        <View style={styles.chipRow}>
          <View style={[styles.chip, { backgroundColor: isDark ? c.chip : '#F3F4F6' }]}>
            <Text style={[styles.chipText, { color: c.muted, fontFamily: snPro('700') }]}>
              {String(category).toUpperCase()}
            </Text>
          </View>
          <View style={[styles.chip, { backgroundColor: isDark ? c.chip : '#F3F4F6' }]}>
            <Text style={[styles.chipText, { color: c.muted, fontFamily: snPro('700') }]}>
              {String(food.serving || '1 serving').toUpperCase()}
            </Text>
          </View>
          {canFavorite ? (
            <Pressable
              onPress={() => toggleFavorite({ ...food, id: favId })}
              style={[styles.chip, { backgroundColor: isFav ? `${colors.danger}22` : isDark ? c.chip : '#F3F4F6' }]}
            >
              <Heart size={14} color={isFav ? colors.danger : c.muted} fill={isFav ? colors.danger : 'transparent'} />
            </Pressable>
          ) : null}
        </View>

        <Text style={[styles.name, { color: c.text, fontFamily: FONT.nova }]}>{food.name}</Text>
        {barcode || food.barcode ? (
          <Text style={[styles.barcodeLine, { color: c.muted, fontFamily: snPro('500') }]}>
            Barcode {barcode || food.barcode}
          </Text>
        ) : null}

        <View style={[styles.kcalPill, { backgroundColor: isDark ? 'rgba(74,130,69,0.22)' : colors.primarySoft }]}>
          <Text style={[styles.kcalText, { color: c.text, fontFamily: snPro('700') }]}>
            Total {scaled.calories} kcal
          </Text>
          <Flame size={16} color={colors.primary} />
        </View>

        <View style={styles.ringRow}>
          {rings.map((ring) => (
            <View key={ring.label} style={styles.ringItem}>
              <ProgressRing
                size={86}
                stroke={7}
                progress={Math.min(1, ring.grams / ring.cap)}
                color={ring.color}
                trackColor={isDark ? '#2A2A32' : `${ring.color}22`}
              >
                <Text style={[styles.ringValue, { color: c.text, fontFamily: snPro('700') }]}>{ring.grams}g</Text>
              </ProgressRing>
              <Text style={[styles.ringLabel, { color: c.muted, fontFamily: snPro('600') }]}>{ring.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.servingRow}>
          <Text style={[styles.servingLabel, { color: c.muted, fontFamily: snPro('600') }]}>
            Servings · logs to {meal}
          </Text>
          <View style={[styles.stepper, { backgroundColor: isDark ? c.chip : '#F3F4F6' }]}>
            <Pressable onPress={() => adjust(-1)} style={styles.stepBtn} hitSlop={8}>
              <Minus size={16} color={servings <= 1 ? c.muted : c.text} />
            </Pressable>
            <Text style={[styles.stepVal, { color: c.text, fontFamily: snPro('700') }]}>{servings}</Text>
            <Pressable onPress={() => adjust(1)} style={styles.stepBtn} hitSlop={8}>
              <Plus size={16} color={servings >= 10 ? c.muted : c.text} />
            </Pressable>
          </View>
        </View>
        </View>
      </ScrollView>

      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={8}
        style={[styles.back, { top: topPad + 8 }]}
      >
        <ChevronLeft size={20} color="#111111" />
      </Pressable>

      <View style={[styles.footer, { backgroundColor: c.pageBg, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.outlineBtn, { borderColor: c.border }]}
        >
          <Text style={[styles.outlineText, { color: c.text, fontFamily: snPro('700') }]}>Update details</Text>
        </Pressable>
        <Pressable onPress={log} style={[styles.addBtn, { backgroundColor: isDark ? c.text : '#111111' }]}>
          <Text style={[styles.addText, { color: isDark ? c.pageBg : '#FFFFFF', fontFamily: snPro('700') }]}>
            Add meal
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { height: 320, backgroundColor: '#E7E4D8' },
  heroImage: { width: '100%', height: '100%' },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  heroLetter: { fontSize: 72 },
  scroll: { paddingBottom: 16 },
  back: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    zIndex: 5,
  },
  sheet: {
    marginTop: -28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 12,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 11, letterSpacing: 0.4 },
  name: { fontSize: 28, lineHeight: 34, marginTop: 16 },
  barcodeLine: { fontSize: 12, marginTop: 6 },
  kcalPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  kcalText: { fontSize: 15 },
  ringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
  },
  ringItem: { flex: 1, alignItems: 'center' },
  ringValue: { fontSize: 14 },
  ringLabel: { fontSize: 13, marginTop: 8 },
  servingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  servingLabel: { fontSize: 13, textTransform: 'capitalize', flex: 1, marginRight: 12 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 4,
  },
  stepBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepVal: { minWidth: 24, textAlign: 'center', fontSize: 16 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  outlineBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { fontSize: 15 },
  addBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { fontSize: 15 },
});
