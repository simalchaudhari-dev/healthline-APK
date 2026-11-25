import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Path, Circle, Line } from 'react-native-svg';
import { snPro } from '../../config/fonts';

/**
 * Premium weight line chart (mockup style): green line, dots, soft fill under curve.
 * Pure SVG — reliable on Expo web + Android APK.
 */
export default function WeightLineChart({
  points = [],
  color = '#2ECC71',
  trackColor = '#E8EAED',
  labelColor = '#9CA3AF',
  height = 168,
  goalValue,
  /** When true, Y-axis starts at 0 (better for calorie charts). */
  fromZero = false,
}) {
  const [width, setWidth] = useState(0);

  const chart = useMemo(() => {
    const values = points.map((p) => Number(p.value) || 0);
    if (!values.length || width <= 0) return null;

    const padX = 8;
    const padTop = 12;
    const padBottom = 8;
    const chartW = Math.max(1, width - padX * 2);
    const chartH = Math.max(1, height - padTop - padBottom);

    let minV = fromZero ? 0 : Math.min(...values);
    let maxV = Math.max(...values, 1);
    if (goalValue != null && Number.isFinite(Number(goalValue))) {
      minV = fromZero ? 0 : Math.min(minV, Number(goalValue));
      maxV = Math.max(maxV, Number(goalValue));
    }
    // Breathing room so the line isn't glued to edges
    const span = Math.max(maxV - minV, fromZero ? 1 : 0.8);
    if (!fromZero) minV -= span * 0.12;
    maxV += span * 0.12;
    const range = maxV - minV || 1;

    const coords = values.map((v, i) => {
      const x = padX + (values.length === 1 ? chartW / 2 : (i / (values.length - 1)) * chartW);
      const y = padTop + (1 - (v - minV) / range) * chartH;
      return { x, y, value: v, label: points[i]?.label || '' };
    });

    const lineD = coords
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');

    const baseY = padTop + chartH;
    const areaD = [
      `M ${coords[0].x.toFixed(2)} ${baseY.toFixed(2)}`,
      ...coords.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`),
      `L ${coords[coords.length - 1].x.toFixed(2)} ${baseY.toFixed(2)}`,
      'Z',
    ].join(' ');

    return { coords, lineD, areaD, padTop, chartH };
  }, [points, width, height, goalValue, fromZero]);

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - width) > 0.5) setWidth(w);
      }}
    >
      {width > 0 && chart ? (
        <Svg width={width} height={height}>
          <Defs>
            <SvgGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <Stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </SvgGradient>
          </Defs>

          {/* Vertical guides */}
          {chart.coords.map((p, i) => (
            <Line
              key={`g-${i}`}
              x1={p.x}
              y1={chart.padTop}
              x2={p.x}
              y2={chart.padTop + chart.chartH}
              stroke={trackColor}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          ))}

          <Path d={chart.areaD} fill="url(#weightFill)" />
          <Path d={chart.lineD} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {chart.coords.map((p, i) => (
            <Circle
              key={`d-${i}`}
              cx={p.x}
              cy={p.y}
              r={5}
              fill="#FFFFFF"
              stroke={color}
              strokeWidth={2.5}
            />
          ))}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}

      <View style={styles.labels}>
        {points.map((p, i) => (
          <Text
            key={`l-${i}`}
            style={[styles.label, { color: labelColor, fontFamily: snPro('600') }]}
            numberOfLines={1}
          >
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  label: {
    flex: 1,
    fontSize: 11,
    textAlign: 'center',
  },
});
