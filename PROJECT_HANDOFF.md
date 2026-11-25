# Health line — Project handoff / context (READ THIS FIRST)

**Task checklists (client spec):** APK → [`HEALTHLINE_APK.md`](./HEALTHLINE_APK.md) · Admin → `E:\APK\AdminPanel\HEALTHLINE_ADMIN.md`

**Purpose:** Copy this file into the next workspace (NestJS admin + templates) so any AI/dev understands what already exists and what to build next — without asking the user to re-explain.

**Date noted:** 2026-09-11  
**Mobile app repo (current):** `e:\APK\healthline` — Expo SDK 57, package `com.healthline.nutrition`  
**EAS:** `@webbuild-dev2/healthline`  
**Display name:** Health line Nutrition  

---

## 1. What this product is

Health line = consumer nutrition + health companion app (MyFitnessPal-style UI).

- **Mobile app (done as UI + local diary + AI hooks):** Expo / React Native  
- **Next workspace (coming):** NestJS admin panel + existing templates — backend / CMS / admin  
- **Rule for all AI features:** Assist the user. **Do not diagnose. Do not replace doctors.**

Data today is mostly **local** (AsyncStorage diary). Auth uses **AdminPanel MongoDB JWT** (`/api/auth/sign-up`, `sign-in`, `me`).

---

## 2. Already built in the mobile APK (do not rebuild from scratch)

### Tabs
Home · Diary · Discover · Progress · More

### Feature areas (short)
| Area | What’s in |
|------|-----------|
| Setup | Onboarding, goals, body profile, sign up/in |
| Home | Calories, macros, water, meals, quick add/scan/exercise |
| Diary | Day log, add food, favorites, custom food, exercise |
| AI | Meal photo scan, text/voice log, AI coach chat, barcode |
| Discover | Recipes browse + log to diary |
| Progress | Charts, weight log, edit goals, achievements, weekly report |
| Plans | Meal plan, grocery list, health tracks, workout programs |
| More | Profile edit, dark mode, blue/green brand, reminders UI, privacy, about |

### Placeholders / incomplete (mobile)
- Real microphone speech-to-text (demo text only)
- Push notifications (toggles only)
- Healthline Plus / premium (“coming soon”)
- Achievements not live-unlocked from diary
- Program videos = fake player
- Weekly report mostly sample data

### AI stack (mobile)
- OpenRouter API  
- Config: `src/config/ai.js` + fallbacks in `src/config/env.js`  
- Env keys: `EXPO_PUBLIC_OPENROUTER_API_KEY`, `EXPO_PUBLIC_AI_MODEL`, `EXPO_PUBLIC_AI_VISION_MODEL`, `EXPO_PUBLIC_OPENROUTER_BASE_URL`  
- `.env` is gitignored → EAS APK needs `env.js` fallbacks **or** EAS Environment Variables (`preview`)  
- Vision model needed for meal photos (text-only models fail)

### Theme
- Brand blue `#0070E0` (Healthline) / green `#2ECC71` (NutriZen)  
- Light/dark via `useTheme()`  
- Fonts: SN Pro (UI), Nova Round (titles)

### Android APK notes
- Build: `eas build -p android --profile preview`  
- Size ~100MB+ if all ABIs; **arm64-v8a only** via `buildArchs` + `ORG_GRADLE_PROJECT_reactNativeArchitectures` → smaller APK (~50–60MB expected)  
- 20–30MB is **not** realistic for Expo + camera native libs  
- Minify/shrink: `expo-build-properties`  

---

## 3. NEXT BIG FEATURE (not built yet) — Blood-test reports

**Status:** Noted only — **not implemented**. Build when product/admin/backend is ready.

### User story
1. User uploads a blood-test report → Health line  
2. App **reads** the report (OCR / vision / parse)  
3. Explains **abnormal values in simple language**  
4. **Tracks values over time** (trends)  
5. User can **ask questions** about the report  
6. **Reminders** for follow-ups / medicines  
7. Report lives in a **longitudinal health timeline**  
8. Helps **prepare questions for the doctor**

### Non-negotiable safety
- AI **assists** only  
- **No diagnosis**  
- **Does not replace doctors**  
- Copy/UI must say results are informational; see a clinician for medical decisions  

### Likely split (for Nest admin + mobile)
| Layer | Responsibility |
|-------|----------------|
| Mobile app | Upload UI, timeline, Q&A chat, reminders UX, charts |
| Nest API / admin | Store reports, parsed labs, user timeline, reminder jobs, admin review/templates |
| AI | Extract lab names/values/units/ref ranges; explain in plain language; Q&A with disclaimer |

Admin panel (new workspace) already has Nest + templates — use that for:
- Report templates / lab panels  
- Admin moderation or content  
- User health timeline APIs  
- Reminder scheduling  

---

## 4. What the user wants from the NEXT workspace AI

1. Read this file first.  
2. Don’t ask the user to re-list mobile features.  
3. Connect Nest admin templates to health-report flows when implementing blood tests.  
4. Keep nutrition app features in mind for a unified Health line product.  
5. Always keep the **assist, don’t diagnose** rule in prompts, API responses, and UI.

---

## 5. Out of scope / don’t assume

- Full hospital EHR integration (unless asked)  
- Prescribing medicines  
- Claiming medical accuracy / diagnosis  
- Replacing the Expo mobile app with a web-only product  

---

## 6. One-line summary

**Mobile nutrition APK exists (Expo 57, local + OpenRouter AI). Next: Nest admin workspace + blood-test report upload → explain → track → Q&A → reminders → timeline → doctor questions, AI assist only.**
