/**
 * Demo animations for home exercises now come from the admin panel (Exercises at home → Demo GIF):
 * each exercise's `gifUrl` on Cloudinary, with `gifCaption`. See components/common/ExerciseDemo.js.
 *
 * The GIFs used to ship inside the app (src/assets/gif). They were uploaded to Cloudinary and removed
 * from the app to keep it smaller. Add a built-in fallback here only if an exercise must work offline
 * on first open.
 */
const MEDIA = {};

export function getExerciseMedia(id) {
  return MEDIA[id] || null;
}
