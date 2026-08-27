import { Pressable, Text, StyleSheet, ScrollView } from 'react-native';

import { colors, radius } from '../theme';

type Props = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
};

// Horizontally-scrolling row of pill buttons (design's time-range pickers:
// "1 Jam" / "6 Jam" / ...) - each option is its own rounded pill rather
// than a joined segmented control.
export default function RangeSelector({ options, value, onChange }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map(option => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.pill, active ? styles.active : styles.inactive]}>
            <Text style={[styles.label, active && styles.activeLabel]}>{option}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  pill: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: radius.pill },
  active: { backgroundColor: colors.green },
  inactive: { backgroundColor: colors.surfaceMuted },
  label: { fontSize: 11, fontWeight: '700', color: colors.mutedText },
  activeLabel: { color: colors.white },
});
