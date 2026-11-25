import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, AccessibilityInfo } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * Circular progress in the Material 3 "expressive" style: the done part is a wavy line, the rest
 * is a thin plain track, with a small gap between them. While `animate` is on, the wave drifts
 * slowly (turned off when the phone asks for reduced motion).
 */

const STEP_DEG = 2; // path resolution
const FPS_MS = 50; // wave drift: ~20 frames a second

function polar(cx, cy, r, angle) {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

/** Points along the circle from `a0` to `a1` (radians); `waveFn(angle)` adds to the radius. */
function pathAlong(cx, cy, r, a0, a1, waveFn) {
  if (a1 <= a0) return '';
  const step = (STEP_DEG * Math.PI) / 180;
  let d = '';
  for (let a = a0; a < a1 + step / 2; a += step) {
    const angle = Math.min(a, a1);
    const [x, y] = polar(cx, cy, r + (waveFn ? waveFn(angle) : 0), angle);
    d += `${d ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d;
}

export default function WavyProgressRing({
  size = 160,
  stroke = 10,
  progress = 0,
  color = '#2e7d32',
  trackColor = '#e7f1e3',
  waves = 12,
  amplitude = 3,
  animate = false,
  children,
}) {
  const [phase, setPhase] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((on) => alive && setReduceMotion(!!on))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!animate || reduceMotion) return undefined;
    timer.current = setInterval(() => setPhase((p) => (p + 0.18) % (Math.PI * 2)), FPS_MS);
    return () => clearInterval(timer.current);
  }, [animate, reduceMotion]);

  const p = Math.min(1, Math.max(0, Number(progress) || 0));
  const cx = size / 2;
  const cy = size / 2;
  // Leave room for the wave's height so it never gets clipped.
  const r = (size - stroke) / 2 - amplitude;
  const start = -Math.PI / 2;
  const full = Math.PI * 2;

  const { wavePath, trackPath } = useMemo(() => {
    const end = start + full * p;
    // Taper the wave in at the start and out at the head, like the M3 indicator.
    const taper = (angle) => {
      const fromStart = (angle - start) / 0.35;
      const toEnd = (end - angle) / 0.35;
      return Math.max(0, Math.min(1, fromStart, toEnd));
    };
    const waveFn = (angle) => amplitude * taper(angle) * Math.sin(waves * angle + phase);
    const gap = p > 0 && p < 1 ? (stroke * 1.6) / r : 0;
    return {
      wavePath: p > 0 ? pathAlong(cx, cy, r, start, end, waveFn) : '',
      trackPath: p < 1 ? pathAlong(cx, cy, r, end + gap, start + full - gap) : '',
    };
  }, [p, phase, cx, cy, r, start, full, stroke, waves, amplitude]);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {trackPath ? (
          <Path d={trackPath} stroke={trackColor} strokeWidth={Math.max(3, stroke * 0.55)} strokeLinecap="round" fill="none" />
        ) : null}
        {wavePath ? (
          <Path d={wavePath} stroke={color} strokeWidth={stroke * 0.7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
