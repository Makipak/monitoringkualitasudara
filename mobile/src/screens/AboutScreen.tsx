import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Icon from '../components/Icon';
import { colors, radius } from '../theme';

// Static project info (design/UF IAQ.dc.html's "Tentang" tab). Fields
// still written as bracket placeholders are exactly that in the design
// too - fill in real values before the actual demo/sidang.
const ABOUT_ROWS = [
  {
    icon: 'M9 3h6l2 4h2a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1h2Z',
    title: 'Proyek',
    body: 'UF IAQ – Sistem Pemantauan Kualitas Udara Dalam Ruang',
  },
  {
    icon: 'M4 4h16v16H4Z M9 9h6v6H9Z M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2',
    title: 'Teknologi',
    body: 'IoT (ESP32 + 7 sensor) · Node.js/PostgreSQL · Evaluasi rule-based (v1)',
  },
  {
    icon: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z M2 21c0-3 1.85-5.36 5.08-6',
    title: 'Fokus',
    body: 'Ruang Pemulihan Pasien · Lingkungan Emisi Rendah',
  },
  {
    icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-4 3.6-7 8-7s8 3 8 7',
    title: 'Pengembang',
    body: '[ nama ] · [ institusi ]\nProgram Studi: [ prodi ]\nDosen Pembimbing: [ pembimbing ]',
  },
  {
    icon: 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9M12 11v5M12 8h.01',
    title: 'Versi',
    body: '1.0.0 · 2026',
  },
];

export default function AboutScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Tentang</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <View style={styles.heroIconBox}>
            <Icon
              path="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z M2 21c0-3 1.85-5.36 5.08-6"
              size={30}
              color={colors.green}
              strokeWidth={1.9}
            />
          </View>
          <Text style={styles.heroTitle}>UF IAQ</Text>
          <Text style={styles.heroSubtitle}>Sistem Pemantauan Kualitas Udara Dalam Ruang</Text>
          <Text style={styles.heroBody}>
            UF IAQ adalah platform pemantauan lingkungan yang menggabungkan sensor IoT dan evaluasi berbasis aturan
            untuk mendukung lingkungan pemulihan pasien yang sehat. Fitur prediksi berbasis Deep Learning
            direncanakan sebagai pengembangan lanjutan (lihat tab Prediksi).
          </Text>
        </View>

        <View style={styles.rowsCard}>
          {ABOUT_ROWS.map((row, i) => (
            <View key={row.title} style={[styles.row, i === ABOUT_ROWS.length - 1 && styles.rowLast]}>
              <View style={styles.rowIconBox}>
                <Icon path={row.icon} size={16} color={colors.green} />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.rowBody}>{row.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.body },
  header: { padding: 18, paddingBottom: 6, backgroundColor: colors.white, alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2, color: colors.ink },
  scroll: { flex: 1 },
  scrollContent: { padding: 18, paddingTop: 10, paddingBottom: 28 },
  hero: { alignItems: 'center' },
  heroIconBox: { width: 64, height: 64, borderRadius: radius.xl, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 14, color: colors.ink },
  heroSubtitle: { fontSize: 12, fontWeight: '600', color: colors.mutedText, marginTop: 4, textAlign: 'center' },
  heroBody: { marginTop: 14, fontSize: 11.5, lineHeight: 18, color: colors.faintText, textAlign: 'center' },
  rowsCard: { marginTop: 22, borderRadius: radius.lg, backgroundColor: colors.surface, paddingHorizontal: 14 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowIconBox: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' },
  rowTextCol: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 12, fontWeight: '700', color: colors.ink },
  rowBody: { fontSize: 11, color: colors.mutedText, marginTop: 3, lineHeight: 16 },
});
