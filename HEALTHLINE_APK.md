# HealthLine — APK roadmap

**Repo:** `E:\APK\healthline`  
**Stack:** Expo SDK 57, package `com.healthline.nutrition`  
**Display name:** Health line Nutrition  
**Safety:** AI **assists** only. Do not diagnose. Do not replace doctors or mental-health professionals.  
**Data today:** Local only (AsyncStorage). Auth is local demo. Cloud APIs will come from `E:\APK\AdminPanel`.

Admin checklist: `E:\APK\AdminPanel\HEALTHLINE_ADMIN.md`.  
Older context: `PROJECT_HANDOFF.md`.

---

## Status key

- `[x]` Done (UI / local / placeholder as noted)
- `[ ]` Not done

---

## Product rules (always)

- Freemium: free must be useful enough to build a habit
- Premium sells **personalization + AI + insights + unlimited usage**, not basic tracking
- One HealthLine AI layer (not separate Food / Sleep / Workout / Weight AIs)
- Never paywall: basic weight, steps, water, meals, sleep, goals, basic charts
- Copy must say results are informational; see a clinician for medical decisions
- Do not name a feature “Increase Height”

---

## Phase 0 — Already in the APK (do not rebuild)

### Tabs

- [x] Home
- [x] Diary
- [x] Discover
- [x] Progress
- [x] More

### Built (UI + local diary + AI hooks)

- [x] Onboarding, goals, body profile, sign up / in (local demo)
- [x] Home: calories, macros, water, meals, quick add / scan / exercise
- [x] Diary: add food, search, favorites, custom food, meals, exercise
- [x] AI hooks: meal photo scan, text / voice log, AI coach chat, barcode
- [x] Discover: browse recipes + log to diary
- [x] Progress: charts, weight log, edit goals, achievements UI, weekly report (mostly sample)
- [x] Plans: meal plan, grocery list, health tracks, workout programs
- [x] More: profile, dark mode, blue `#0070E0` / green `#2ECC71`, reminders UI, privacy, about
- [x] OpenRouter AI config (`src/config/ai.js`, `src/config/env.js`)

### Incomplete / placeholder

- [ ] Real microphone speech-to-text (demo text only)
- [ ] Real push notifications (toggles only)
- [ ] HealthLine Plus / premium (coming soon — no real paywall)
- [ ] Achievements live-unlocked from diary
- [ ] Program videos (fake player)
- [ ] Weekly report real data (sample now)
- [ ] Cloud sync with AdminPanel APIs
- [ ] Blood-test / medical reports (Phase 2)

---

## Phase 1 — Freemium gates

Three tiers (prices are tests, not locked):

| Plan | Price (test) |
|------|----------------|
| Free | ₹0 |
| HealthLine Plus | ₹199/mo or ₹1,999/yr |
| HealthLine Family | ₹299/mo or ₹2,999/yr |

- [ ] Plan model + feature flags
- [ ] Free vs Plus vs Family checks in UI
- [ ] Limited Free AI (example: **5 interactions / day**)
- [ ] Plus: unlimited reasonable AI + fair-use
- [ ] Family: up to 5 profiles, separate histories, shared grocery, family goals / dashboard
- [ ] Wire later to AdminPanel subscription APIs

---

## Phase 2 — Home

**Keep current Home.** Add Free vs Premium on top.

### Free (keep)

- [x] Daily calories
- [x] Basic macros
- [x] Water
- [x] Meals
- [x] Basic food logging
- [x] Basic exercise logging
- [ ] Weight on Home (exists in Progress / log — surface if missing)
- [ ] Steps on Home (first-class; see Phase 9)
- [x] Basic daily goals
- [x] Basic daily summary

### Premium (add)

- [ ] Personalized daily recommendations
- [ ] Adaptive calorie target
- [ ] Adaptive macro targets
- [ ] AI-generated daily plan
- [ ] Health / wellness score
- [ ] Advanced insights
- [ ] AI daily briefing

---

## Phase 3 — Diary (mostly Free)

### Free (keep / finish)

- [x] Add food, search, favorites, custom food
- [x] Breakfast / lunch / dinner / snacks
- [x] Exercise
- [x] Water
- [ ] Weight from Diary if not already
- [ ] Notes

### Premium

- [ ] AI meal photo analysis (hook exists — gate + improve)
- [ ] AI voice logging (real STT)
- [ ] Advanced food recognition
- [ ] Automatic meal analysis
- [ ] Personalized nutrition feedback
- [ ] Smart portion estimation
- [ ] Advanced insights e.g. “Protein below target for 5 days”

---

## Phase 4 — AI (main Premium reason)

**One intelligence layer** over nutrition, fitness, sleep, weight, activity, recovery + user profile + goals + history.

### Free AI (limited)

- [x] Coach chat UI / hook
- [ ] Enforce daily cap (e.g. 5)
- [ ] Nutrition / fitness / wellness questions
- [ ] Questions about logged data  
  Examples: “Is my breakfast healthy?” · “What should I eat for dinner?” · “How many calories today?”

### Premium AI

- [ ] Fair-use unlimited
- [ ] HealthLine Coach briefing (sleep vs usual, recovery, moderate workout — assist only)
- [ ] Personalized meal + workout planning
- [ ] Weight-loss coaching (non-diagnostic)
- [ ] Weekly / monthly / habit / sleep / nutrition analysis
- [ ] Trend detection + goal-adjustment **suggestions**
- [ ] Voice conversations
- [ ] AI meal analysis + food logging
- [ ] Health-report interpretation (Phase 11 only)

AI must connect the whole user. Example: “My weight hasn’t decreased” → look at calories, protein, steps, workouts, sleep, trend, adherence — **patterns, not diagnosis**.

---

## Phase 5 — Discover

### Free

- [x] Browse recipes, basic details, search
- [ ] Save recipes (if not already)

### Premium

- [ ] Personalized / “recipes for my goal”
- [ ] High-protein, weight-management, Indian regional
- [ ] AI substitutions + meal modifications
- [ ] Weekly recipe recommendations
- [ ] “I have potatoes, tomatoes, paneer — what under my dinner target?”

---

## Phase 6 — Progress

### Free (keep basic)

- [x] Weight log + basic chart
- [x] Calories / water / workouts / goal progress (as built)
- [ ] Steps on Progress

### Premium

- [ ] 30-day health analysis (weight, steps, sleep, protein, water, consistency)
- [ ] Biggest improvement / needs attention
- [ ] Correlation-style **observations** only  
  e.g. “On days with more activity, calorie balance was generally lower.”

---

## Phase 7 — Weekly report (Premium)

Every Sunday. Reason to come back.

- [x] Weekly report screen (sample data)
- [ ] Real week: weight, steps, nutrition %, water %, sleep, exercise count
- [ ] Biggest win + focus next week + HealthLine recommendation
- [ ] Gate as Plus

---

## Phase 8 — Plans + grocery + tracks

### Free

- [x] Basic goals
- [x] Basic workout plan / programs
- [x] Basic meal plan
- [x] Basic grocery list

### Premium

- [ ] AI 7-day meal plan (goal, calories, veg/non-veg, cuisine, allergies, budget, cook time)
- [ ] Grocery from weekly meal plan (grouped: veg, dairy, grains, protein)
- [ ] Health Tracks as first-class choice: Weight · Muscle · Wellness · Sleep · Activity · Nutrition · Stress  
  Dashboard adapts to the selected track
- [x] Health tracks UI exists — upgrade to track-driven Home + Premium content

---

## Phase 9 — Sleep + steps (first-class)

### Sleep

- [ ] Manual sleep log (Free): last night, goal, bedtime, wake
- [ ] Basic history (Free)
- [ ] Premium: trends, goals, recommendations, wearable later, weekly sleep analysis

### Steps / walking

- [ ] Today: steps, km, active minutes, goal (Free)
- [ ] Premium: adaptive goals, trends, weekly analysis, walking plans

---

## Phase 10 — Body + growth + mood

### Body measurements

- [x] Weight / height in profile or onboarding (keep)
- [ ] Waist, hip, chest, arms
- [ ] Optional body-fat **only** if user has a reliable device — never fake phone measurement

### Growth & body (not “Increase Height”)

- [ ] Children/teens: height tracking + growth chart / trends
- [ ] Adults: height, posture, mobility, flexibility
- [ ] Posture & mobility exercises

### Mental wellness (simple)

- [ ] Daily mood: Great / Good / Okay / Low / Stressed
- [ ] Stress, meditation, breathing, journaling
- [ ] Premium: AI reflection, mood trends, habit correlations
- [ ] Never position as therapy or a replacement for professionals

---

## Phase 11 — Medications + medical reports (later)

### Medications (after V1)

- [ ] List + schedule UI
- [ ] Premium: schedule, refill reminders, prescription history, doctor notes
- [ ] AI must **never** change prescribed medicines

### Health records — Phase 2 (do not delay V1)

Blood-test / labs / prescriptions / doctor visits:

1. Upload  
2. Read (OCR / vision / parse)  
3. Explain abnormal values in simple language  
4. Track values over time  
5. Q&A on the report  
6. Follow-up / medicine reminders  
7. Longitudinal health timeline  
8. Prepare questions for the doctor  

- [ ] Upload UI + timeline + Q&A + charts
- [ ] Disclaimer on every screen
- [ ] Backend store + parse + review in AdminPanel

---

## Phase 12 — Languages + AI multilingual

Architect keys from day one. Do not hardcode `"Calories"`. Use `home.calories`, `home.water`, etc.

### V1 UI

- [ ] English
- [ ] Hindi
- [ ] Gujarati  
Files: `en.json` · `hi.json` · `gu.json`

### V2 UI

- [ ] Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi

### AI language

- [ ] Understand Gujarati / Hindi / English text
- [ ] Voice in those languages later  
  e.g. “આજે મેં શું ખાધું?” → reply in the same language

---

## Phase 13 — Connect to AdminPanel APIs

Same APIs as the admin site.

- [ ] Replace local demo auth with `POST /api/auth/sign-in` + `sign-up` + `GET /api/auth/me`
- [ ] Sync diary / weight / water / steps when APIs exist
- [ ] Load published foods, recipes, workouts, tracks, content
- [ ] Subscription + AI usage limits from server
- [ ] Reminders / push when Admin notifications exist

---

## What must stay Free

- Basic weight, steps, water, meal logging, sleep logging
- Basic goals
- Basic progress charts

## What is Premium

- Intelligence: Coach, meal analysis, voice logging, recommendations
- Personalization: meal / workout plans, adaptive goals
- Insights: advanced trends, weekly / monthly reports, patterns
- Convenience: generated grocery lists, unlimited AI, Family, integrations

---

## Suggested APK build order

1. i18n keys (en / hi / gu) so new screens are translatable  
2. Freemium flags + 5/day Free AI cap  
3. Sleep + steps as first-class Home/Diary widgets  
4. Body measurements + mood  
5. Premium Home briefing + adaptive targets  
6. Diary AI gates + real voice STT  
7. Weekly report real data + Plus gate  
8. AI meal plan + grocery-from-plan  
9. Health track adapts dashboard  
10. Connect AdminPanel auth + content APIs  
11. Subscriptions / Family  
12. Medications, then medical reports (Phase 2)

---

## Do not

- Diagnose, prescribe, or change medicines
- Claim the phone can measure body fat
- Promise height increase
- Replace doctors or therapists
- Lock basic logging behind payment
- Rebuild existing Home / Diary / Discover UI from scratch
