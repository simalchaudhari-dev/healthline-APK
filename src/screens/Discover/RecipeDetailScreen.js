import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  ChevronLeft,
  Clock,
  Flame,
  Star,
  Minus,
  Plus,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import LoadingScreen from '../../components/common/LoadingScreen';
import { useDiary } from '../../context/DiaryContext';
import { FONT, snPro } from '../../config/fonts';
import { mealFromRecipeTags } from '../../data/recipes';
import { apiGetRecipeById, getCachedRecipe } from '../../services/recipesService';
import ProgressRing from '../../components/common/ProgressRing';
import { SafeAreaTop } from '../../components/common/ScreenShell';
import { useSafeTop } from '../../utils/safeArea';

const TAG_COLORS = {
  Breakfast: 'carbs',
  Lunch: 'primary',
  Dinner: 'protein',
  Snack: 'aiPurple',
  Quick: 'accent',
  'High protein': 'exercise',
  'Low carb': 'fat',
  'Plant-based': 'accent',
};

function tagColor(tag, colors) {
  return colors[TAG_COLORS[tag]] || colors.primary;
}

function recipeRating(id) {
  const n = String(id || '').charCodeAt(1) || 0;
  return (4.5 + (n % 5) * 0.1).toFixed(1);
}

export default function RecipeDetailScreen({ navigation, route }) {
  const recipeId = route.params?.id;
  const [recipe, setRecipe] = useState(() => getCachedRecipe(recipeId));
  const [loading, setLoading] = useState(() => !getCachedRecipe(recipeId));

  useEffect(() => {
    let active = true;
    apiGetRecipeById(recipeId).then((r) => {
      if (!active) return;
      if (r) setRecipe(r);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [recipeId]);

  const { isDark, colors, themeColors: c } = useTheme();
  const { addFood } = useDiary();
  const insets = useSafeAreaInsets();
  const topPad = useSafeTop();
  const [servings, setServings] = useState(1);

  const meal = useMemo(
    () => mealFromRecipeTags(recipe?.tags),
    [recipe?.tags],
  );

  const scaled = useMemo(() => {
    if (!recipe) return null;
    const n = recipe.nutrition || { carbs: 30, protein: 20, fat: 12 };
    return {
      calories: Math.round(recipe.calories * servings),
      carbs: Math.round(n.carbs * servings),
      protein: Math.round(n.protein * servings),
      fat: Math.round(n.fat * servings),
    };
  }, [recipe, servings]);

  if (loading && !recipe) {
    return <LoadingScreen fullScreen message="Loading recipe…" />;
  }

  if (!recipe || !scaled) {
    return (
      <View style={[styles.root, { backgroundColor: c.pageBg, flex: 1, padding: 20 }]}>
        <SafeAreaTop color={c.pageBg} />
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ marginBottom: 16 }}>
          <ChevronLeft size={22} color={c.text} />
        </Pressable>
        <Text style={{ color: c.text, fontFamily: snPro('700'), fontSize: 16 }}>Recipe not found</Text>
        <Text style={{ color: c.muted, marginTop: 8, fontFamily: snPro('400') }}>
          Go back and pick another recipe from Discover.
        </Text>
      </View>
    );
  }

  const adjustServings = (delta) => {
    setServings((s) => Math.min(10, Math.max(1, s + delta)));
  };

  const log = () => {
    addFood(meal, {
      id: recipe.id,
      name: recipe.title,
      serving: servings === 1 ? '1 serving' : `${servings} servings`,
      calories: scaled.calories,
      carbs: scaled.carbs,
      protein: scaled.protein,
      fat: scaled.fat,
      imageUrl: recipe.image || '',
    });
    navigation.navigate('Main', { screen: 'Diary' });
  };

  const rings = [
    { label: 'Protein', grams: scaled.protein, color: colors.protein, cap: 60 },
    { label: 'Fat', grams: scaled.fat, color: colors.fat, cap: 40 },
    { label: 'Carbs', grams: scaled.carbs, color: colors.carbs, cap: 80 },
  ];
  const chipBg = isDark ? c.chip : '#F3F4F6';

  return (
    <View style={[styles.root, { backgroundColor: c.pageBg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Image source={{ uri: recipe.image }} style={styles.heroImage} />
          {recipe.featured || route.params?.featured ? (
            <View style={styles.pickBadge}>
              <Star size={12} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={[styles.pickText, { fontFamily: snPro('700') }]}>Chef's pick</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.sheet, { backgroundColor: c.pageBg }]}>
          <View style={styles.metaRow}>
            <MetaChip icon={Clock} label={recipe.time} bg={chipBg} color={c.muted} />
            <MetaChip icon={Flame} label={`${scaled.calories} kcal`} bg={chipBg} color={c.muted} />
            <MetaChip icon={Star} label={recipeRating(recipe.id)} bg={chipBg} color={c.muted} />
          </View>

          <Text style={[styles.title, { color: c.text, fontFamily: FONT.nova }]}>{recipe.title}</Text>

          <View style={styles.tagRow}>
            {(recipe.tags || []).map((tag) => {
              const tint = tagColor(tag, colors);
              return (
                <View key={tag} style={[styles.tag, { backgroundColor: `${tint}22` }]}>
                  <Text style={[styles.tagText, { color: tint, fontFamily: snPro('700') }]}>{tag}</Text>
                </View>
              );
            })}
          </View>

          {recipe.description ? (
            <Text style={[styles.copy, { color: c.muted, fontFamily: snPro('400') }]}>
              {recipe.description}
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
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.servingTitle, { color: c.text, fontFamily: snPro('700') }]}>Servings</Text>
              <Text style={[styles.servingHint, { color: c.muted, fontFamily: snPro('500') }]}>
                Logs to {meal}
              </Text>
            </View>
            <View style={[styles.stepper, { backgroundColor: chipBg }]}>
              <Pressable onPress={() => adjustServings(-1)} style={styles.stepBtn} hitSlop={8}>
                <Minus size={16} color={servings <= 1 ? c.muted : c.text} />
              </Pressable>
              <Text style={[styles.stepVal, { color: c.text, fontFamily: snPro('700') }]}>{servings}</Text>
              <Pressable onPress={() => adjustServings(1)} style={styles.stepBtn} hitSlop={8}>
                <Plus size={16} color={servings >= 10 ? c.muted : c.text} />
              </Pressable>
            </View>
          </View>

          {(recipe.ingredients || []).length ? (
            <View style={[styles.block, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Text style={[styles.blockTitle, { color: c.text, fontFamily: snPro('700') }]}>Ingredients</Text>
              {recipe.ingredients.map((item) => (
                <View key={item} style={styles.listRow}>
                  <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.listText, { color: c.text, fontFamily: snPro('500') }]}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {(recipe.steps || []).length ? (
            <View style={[styles.block, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Text style={[styles.blockTitle, { color: c.text, fontFamily: snPro('700') }]}>Steps</Text>
              {recipe.steps.map((step, i) => (
                <View key={step} style={styles.stepRow}>
                  <View style={[styles.stepNum, { backgroundColor: isDark ? 'rgba(74,130,69,0.22)' : colors.primarySoft }]}>
                    <Text style={[styles.stepNumText, { color: colors.primary, fontFamily: snPro('700') }]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: c.text, fontFamily: snPro('400') }]}>{step}</Text>
                </View>
              ))}
            </View>
          ) : null}
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
        <Pressable onPress={log} style={[styles.logBtn, { backgroundColor: colors.primary }]}>
          <Text style={[styles.logText, { fontFamily: snPro('700') }]}>Log to {meal}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MetaChip({ icon: Icon, label, bg, color }) {
  return (
    <View style={[styles.metaChip, { backgroundColor: bg }]}>
      <Icon size={13} color={color} />
      <Text style={[styles.metaText, { color, fontFamily: snPro('600') }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 16 },
  hero: { height: 340, backgroundColor: '#E7E4D8' },
  heroImage: { width: '100%', height: '100%' },
  pickBadge: {
    position: 'absolute',
    left: 16,
    bottom: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pickText: { color: '#FFFFFF', fontSize: 11, letterSpacing: 0.3 },
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
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  metaText: { fontSize: 12 },
  title: { fontSize: 28, lineHeight: 34, marginTop: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontSize: 12 },
  copy: { fontSize: 14, lineHeight: 22, marginTop: 14 },
  kcalPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  kcalText: { fontSize: 15 },
  ringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 26,
  },
  ringItem: { flex: 1, alignItems: 'center' },
  ringValue: { fontSize: 14 },
  ringLabel: { fontSize: 13, marginTop: 8 },
  servingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 26,
  },
  servingTitle: { fontSize: 16 },
  servingHint: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
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
  block: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  blockTitle: { fontSize: 16, marginBottom: 8 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  bullet: { width: 7, height: 7, borderRadius: 99, marginTop: 6, marginRight: 10 },
  listText: { flex: 1, fontSize: 14, lineHeight: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumText: { fontSize: 13 },
  stepText: { flex: 1, fontSize: 14, lineHeight: 21 },
  footer: { paddingHorizontal: 20, paddingTop: 8 },
  logBtn: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logText: { color: '#FFFFFF', fontSize: 15, textTransform: 'capitalize' },
});
