import { useMemo } from 'react';
import { useDiary } from '../context/DiaryContext';
import { useSteps } from '../context/StepsContext';
import { DEFAULT_STEP_GOAL } from '../utils/steps';
import { routineMinutes, workoutPlanFor } from '../data/homeExercises';
import { useExerciseCatalog } from '../context/ExerciseCatalogContext';
import { buildDailyGoals } from '../utils/dailyGoals';

/** Minutes from "Exercises at home" sessions (logged as "<routine> (home)"). */
export function homeWorkoutMinutes(exercise) {
  return (exercise || [])
    .filter((e) => /\(home\)$/.test(String(e?.name || '')))
    .reduce((s, e) => s + (Number(e.minutes) || 0), 0);
}

/** Today's seven targets from the live diary, steps and daily routine. */
export default function useDailyGoals() {
  const { meals, totals, profile, water, exercise } = useDiary();
  const { today: steps } = useSteps();

  const catalog = useExerciseCatalog();
  return useMemo(() => {
    const workoutMinutes = homeWorkoutMinutes(exercise);
    const workoutGoal = Math.max(1, routineMinutes(workoutPlanFor(profile).routine));
    const goals = buildDailyGoals({
      meals,
      totals,
      profile,
      water,
      steps,
      stepGoal: DEFAULT_STEP_GOAL,
      workoutMinutes,
      workoutGoal,
    });
    return { goals, doneCount: goals.filter((g) => g.done).length };
  }, [meals, totals, profile, water, exercise, steps, catalog]);
}
