import { View, Text, StyleSheet } from 'react-native';

import { colors } from '../theme';

type Props = {
  title: string;
  trailing?: string;
};

// Section title + optional trailing label (design/UF IAQ.dc.html repeats
// this before every section - e.g. "Pemantauan Real-Time" / "7 PARAMETER").
export default function SectionHeader({ title, trailing }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {trailing && <Text style={styles.trailing}>{trailing}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, color: colors.ink },
  trailing: { fontSize: 10, fontWeight: '700', color: colors.faintText, letterSpacing: 0.5 },
});
