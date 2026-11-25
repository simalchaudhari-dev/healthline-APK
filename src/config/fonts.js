import {
  NunitoSans_200ExtraLight,
  NunitoSans_300Light,
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  NunitoSans_800ExtraBold,
  NunitoSans_900Black,
  NunitoSans_400Regular_Italic,
  NunitoSans_500Medium_Italic,
  NunitoSans_600SemiBold_Italic,
  NunitoSans_700Bold_Italic,
} from '@expo-google-fonts/nunito-sans';
import {
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';

/**
 * App fonts (same as the design canvas):
 * - Poppins     → headings, numbers, buttons
 * - Nunito Sans → body text, labels, inputs
 *
 * Older names are kept so existing screens keep working:
 * `FONT.nova` = heading font, `FONT.sn*` / `snPro()` = body font.
 */
export const FONT = {
  sn: 'NunitoSans_400Regular',
  snLight: 'NunitoSans_300Light',
  snMedium: 'NunitoSans_500Medium',
  snSemiBold: 'NunitoSans_600SemiBold',
  snBold: 'NunitoSans_700Bold',
  snExtraBold: 'NunitoSans_800ExtraBold',
  snBlack: 'NunitoSans_900Black',
  /** Heading font (Poppins Bold). */
  nova: 'Poppins_700Bold',
  heading: 'Poppins_700Bold',
  headingMedium: 'Poppins_500Medium',
  headingSemiBold: 'Poppins_600SemiBold',
  headingExtraBold: 'Poppins_800ExtraBold',
};

export const APP_FONT_MAP = {
  NunitoSans_200ExtraLight,
  NunitoSans_300Light,
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  NunitoSans_800ExtraBold,
  NunitoSans_900Black,
  NunitoSans_400Regular_Italic,
  NunitoSans_500Medium_Italic,
  NunitoSans_600SemiBold_Italic,
  NunitoSans_700Bold_Italic,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
};

/** Map CSS-like fontWeight → Nunito Sans face (body text). */
export function snPro(fontWeight = '400', italic = false) {
  const w = String(fontWeight);
  if (italic) {
    if (w === '700' || w === 'bold' || w === '800' || w === '900') return 'NunitoSans_700Bold_Italic';
    if (w === '600' || w === 'semibold') return 'NunitoSans_600SemiBold_Italic';
    if (w === '500' || w === 'medium') return 'NunitoSans_500Medium_Italic';
    return 'NunitoSans_400Regular_Italic';
  }
  if (w === '200' || w === '100') return 'NunitoSans_200ExtraLight';
  if (w === '300' || w === 'light') return 'NunitoSans_300Light';
  if (w === '500' || w === 'medium') return 'NunitoSans_500Medium';
  if (w === '600' || w === 'semibold') return 'NunitoSans_600SemiBold';
  if (w === '700' || w === 'bold') return 'NunitoSans_700Bold';
  if (w === '800') return 'NunitoSans_800ExtraBold';
  if (w === '900' || w === 'black') return 'NunitoSans_900Black';
  return 'NunitoSans_400Regular';
}

/** Map CSS-like fontWeight → Poppins face (headings, buttons). */
export function poppins(fontWeight = '700') {
  const w = String(fontWeight);
  if (w === '500' || w === 'medium' || w === '400') return 'Poppins_500Medium';
  if (w === '600' || w === 'semibold') return 'Poppins_600SemiBold';
  if (w === '800' || w === '900') return 'Poppins_800ExtraBold';
  return 'Poppins_700Bold';
}

export const novaRound = FONT.nova;
