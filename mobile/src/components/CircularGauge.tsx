import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '../theme';

type Props = {
  value: number | null;
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  progressColor?: string;
  label: string;
};

// Circular progress ring (design/UF IAQ.dc.html's IAQ/prediction gauges).
export default function CircularGauge({
  value,
  size = 104,
  strokeWidth = 9,
  trackColor = '#D3DEBA',
  progressColor = colors.green,
  label,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const dashArray = `${(circumference * pct) / 100} ${circumference}`;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={dashArray}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.center}>
          <Text style={styles.value}>{value === null ? '--' : Math.round(value)}</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, color: colors.ink },
  label: { fontSize: 8.5, fontWeight: '700', letterSpacing: 1, color: colors.faintText, marginTop: 2 },
});
