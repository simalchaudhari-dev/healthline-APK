import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

function pointOnRing(cx, cy, r, progress) {
  const angle = (progress * 360 - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** Partial arc from 12 o'clock. A real path, so web does not ignore dash offset. */
function progressArc(cx, cy, r, progress) {
  const start = pointOnRing(cx, cy, r, 0);
  if (progress >= 0.999) {
    const mid = pointOnRing(cx, cy, r, 0.5);
    return `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${mid.x} ${mid.y} A ${r} ${r} 0 1 1 ${start.x} ${start.y}`;
  }
  const end = pointOnRing(cx, cy, r, progress);
  const large = progress > 0.5 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

/**
 * Calorie / progress ring. The track stays pale and only the eaten share is drawn in color.
 */
export default function ProgressRing({
  size = 168,
  stroke = 14,
  progress = 0,
  color = '#2e7d32',
  trackColor = '#EEF1F4',
  children,
}) {
  const r = (size - stroke) / 2;
  const clamped = Math.min(1, Math.max(0, Number(progress) || 0));
  const center = size / 2;
  const showArc = clamped > 0.002;

  // Keep label stack inside the hollow of the ring (stroke + padding).
  const inner = Math.max(0, size - stroke * 2 - 16);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        {showArc ? (
          <Path
            d={progressArc(center, center, r, clamped)}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
        ) : null}
      </Svg>
      <View
        style={[styles.center, { width: inner, height: inner, maxWidth: inner, maxHeight: inner, pointerEvents: 'none' }]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
