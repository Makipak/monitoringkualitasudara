import { Pressable, Text, View, StyleSheet } from 'react-native';

import Icon from './Icon';
import { colors, radius, statusTone } from '../theme';
import type { ParameterDef } from '../constants/parameters';

type Props = {
  def: ParameterDef;
  value: number | null | undefined;
  status: 'normal' | 'not_normal' | 'unknown';
  onPress: () => void;
};

// Grid tile from design/UF IAQ.dc.html's "Pemantauan Real-Time" section
// (a 2-column grid of these, laid out by the caller): icon box + chevron,
// name, value + unit, status dot.
export default function ParameterRow({ def, value, status, onPress }: Props) {
  const tone = statusTone[status];

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconBox}>
          <Icon path={def.icon} size={17} />
        </View>
        <Icon path="m9 18 6-6-6-6" size={15} color={colors.faintText} strokeWidth={2.3} />
      </View>
      <Text style={styles.name}>{def.name}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value === null || value === undefined ? '--' : value}</Text>
        <Text style={styles.unit}>{def.unit}</Text>
      </View>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: tone.dot }]} />
        <Text style={[styles.statusText, { color: tone.fg }]}>
          {status === 'unknown' ? '--' : status === 'normal' ? 'Normal' : 'Tidak Normal'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, backgroundColor: colors.surface, padding: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 12.5, fontWeight: '700', marginTop: 10, color: colors.ink },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  value: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, color: colors.ink },
  unit: { fontSize: 10.5, fontWeight: '500', color: colors.faintText },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
});
