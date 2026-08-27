import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';

import { colors, radius } from '../theme';

const WIDTH = 306;
const HEIGHT = 148;
const PAD_LEFT = 4;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

function points(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map((v, i) => {
    const x = PAD_LEFT + ((WIDTH - PAD_LEFT) * i) / (values.length - 1);
    const y = HEIGHT - PAD_BOTTOM - ((v - min) / span) * (HEIGHT - PAD_BOTTOM - PAD_TOP);
    return [x, y] as const;
  });
}

function linePath(pts: readonly (readonly [number, number])[]): string {
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}

function areaPath(pts: readonly (readonly [number, number])[]): string {
  const base = HEIGHT - PAD_BOTTOM;
  return `${linePath(pts)} L${pts[pts.length - 1][0].toFixed(1)} ${base} L${pts[0][0].toFixed(1)} ${base} Z`;
}

type Props = {
  values: number[];
  // Sparse x-axis labels (e.g. times), evenly spaced across the series.
  // Optional - omit to render the chart without an x-axis.
  labels?: string[];
  color?: string;
  areaColor?: string;
  emptyMessage?: string;
};

// Line chart (design/UF IAQ.dc.html's "Tren Konsentrasi" SVG), fed with
// real values from GET /api/rooms/:deviceId/history instead of the
// design's randomly-generated series. Deliberately does not draw a
// "safe range" band - the project's actual threshold values are not
// decided yet (schema.md `thresholds` table is unseeded, see
// backend/sql/seed.sql), so there is nothing real to shade there.
export default function TrendChart({ values, labels, color = colors.green, areaColor, emptyMessage }: Props) {
  if (values.length < 2) {
    return (
      <View style={[styles.wrap, styles.empty]}>
        <Text style={styles.emptyText}>{emptyMessage ?? 'Belum cukup data untuk grafik'}</Text>
      </View>
    );
  }

  const pts = points(values);
  const dotEvery = Math.max(1, Math.round(pts.length / 6));
  const gridLines = [0.15, 0.45, 0.75].map(f => PAD_TOP + (HEIGHT - PAD_BOTTOM - PAD_TOP) * f);

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {gridLines.map(y => (
          <Line key={y} x1={0} y1={y} x2={WIDTH} y2={y} stroke={colors.border} strokeWidth={1} />
        ))}
        <Line
          x1={0}
          y1={HEIGHT - PAD_BOTTOM}
          x2={WIDTH}
          y2={HEIGHT - PAD_BOTTOM}
          stroke={colors.borderStrong}
          strokeWidth={1.3}
        />
        <Path d={areaPath(pts)} fill={areaColor ?? `${color}22`} />
        <Path d={linePath(pts)} stroke={color} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" fill="none" />
        {pts
          .filter((_, i) => i % dotEvery === 0 || i === pts.length - 1)
          .map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={3} fill={colors.white} stroke={color} strokeWidth={2} />
          ))}
        {labels &&
          labels.map((label, i) => {
            const x = PAD_LEFT + ((WIDTH - PAD_LEFT) * i) / (labels.length - 1);
            const anchor = i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle';
            return (
              <SvgText key={i} x={x} y={HEIGHT - 6} fontSize={9} fontWeight="600" fill={colors.faintText} textAnchor={anchor}>
                {label}
              </SvgText>
            );
          })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.xl, backgroundColor: colors.surface, padding: 10 },
  empty: { height: HEIGHT + 20, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 11, color: colors.mutedText, fontWeight: '600' },
});
