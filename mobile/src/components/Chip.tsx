import { Pressable, Text, StyleSheet } from 'react-native';

import { colors, radius } from '../theme';

type Props = {
  label: string;
  active: boolean;
  onPress: () => void;
};

// Filter pill used in the History screen's parameter filters - same
// rounded-pill treatment as RangeSelector's range buttons.
export default function Chip({ label, active, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active ? styles.active : styles.inactive]}>
      <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: radius.pill },
  active: { backgroundColor: colors.green },
  inactive: { backgroundColor: colors.surfaceMuted },
  label: { fontSize: 11, fontWeight: '700', color: colors.mutedText },
  activeLabel: { color: colors.white },
});
