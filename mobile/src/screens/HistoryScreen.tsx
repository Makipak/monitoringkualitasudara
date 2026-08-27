import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_DEVICE_ID } from '../config/env';
import { getHistory, type SensorReading } from '../services/api';
import { PARAMETERS } from '../constants/parameters';
import SectionHeader from '../components/SectionHeader';
import RangeSelector from '../components/RangeSelector';
import Chip from '../components/Chip';
import TrendChart from '../components/TrendChart';
import { colors, radius } from '../theme';

// design/UF IAQ.dc.html's filter uses literal date/time text fields;
// simplified here to preset lookback windows so this doesn't need a
// native date-picker dependency (react-native does not have one built
// in). Revisit if the real UI needs an exact custom date range.
const RANGES = ['24 Jam', '7 Hari', '30 Hari'];
const RANGE_HOURS: Record<string, number> = { '24 Jam': 24, '7 Hari': 24 * 7, '30 Hari': 24 * 30 };

export default function HistoryScreen() {
  const [range, setRange] = useState('24 Jam');
  const [paramFilter, setParamFilter] = useState('Semua');
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const hours = RANGE_HOURS[range] ?? 24;
      const to = new Date();
      const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
      const rows = await getHistory(DEFAULT_DEVICE_ID, from.toISOString(), to.toISOString());
      setReadings(rows);
    } catch {
      setReadings([]);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const singleParam = paramFilter === 'Semua' ? null : (paramFilter as (typeof PARAMETERS)[number]['key']);
  const paramKeys = singleParam ? [singleParam] : PARAMETERS.map(p => p.key);

  const summary = paramKeys.map(key => {
    const values = readings.map(r => r[key]).filter((v): v is number => v !== null && v !== undefined);
    if (values.length === 0) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      key,
      label: PARAMETERS.find(p => p.key === key)!.name,
      avg: avg.toFixed(1),
      count: values.length,
    };
  }).filter((s): s is NonNullable<typeof s> => s !== null);

  const chartValues = singleParam
    ? readings.map(r => r[singleParam]).filter((v): v is number => v !== null && v !== undefined)
    : [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Riwayat</Text>
        <Text style={styles.subtitle}>Riwayat pemantauan lingkungan</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <SectionHeader title="Filter" />
          <View style={styles.rangeWrap}>
            <RangeSelector options={RANGES} value={range} onChange={setRange} />
          </View>
          <View style={styles.chipRow}>
            <Chip label="Semua" active={paramFilter === 'Semua'} onPress={() => setParamFilter('Semua')} />
            {PARAMETERS.map(p => (
              <Chip key={p.key} label={p.name} active={paramFilter === p.key} onPress={() => setParamFilter(p.key)} />
            ))}
          </View>
        </View>

        {singleParam && (
          <View style={styles.section}>
            <SectionHeader title="Tren" trailing={PARAMETERS.find(p => p.key === singleParam)!.unit} />
            <View style={styles.chartWrap}>
              <TrendChart values={chartValues} emptyMessage="Belum ada data pada rentang waktu ini" />
            </View>
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader title="Ringkasan Periode" />
          {loading && <Text style={styles.loadingText}>Memuat...</Text>}
          {!loading && summary.length === 0 && (
            <Text style={styles.emptyText}>Belum ada data pada rentang waktu ini.</Text>
          )}
          <View style={styles.summaryGrid}>
            {summary.map(s => (
              <View key={s.key} style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>RATA-RATA {s.label.toUpperCase()}</Text>
                <Text style={styles.summaryValue}>{s.avg}</Text>
                <Text style={styles.summaryNote}>{s.count} pembacaan</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Tabel Pemantauan" />
          <View style={styles.tableCard}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCell}>WAKTU</Text>
              {singleParam && <Text style={styles.tableHeaderCell}>NILAI</Text>}
            </View>
            {readings
              .slice(-15)
              .reverse()
              .map((r, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{new Date(r.time).toLocaleString('id-ID')}</Text>
                  {singleParam && <Text style={styles.tableCellBold}>{r[singleParam] ?? '--'}</Text>}
                </View>
              ))}
            {readings.length === 0 && !loading && <Text style={styles.emptyText}>Tidak ada baris untuk ditampilkan.</Text>}
          </View>
          {readings.length > 0 && (
            <Text style={styles.footerNote}>
              Menampilkan {Math.min(15, readings.length)} dari {readings.length} catatan
            </Text>
          )}
        </View>

        <View style={styles.exportNote}>
          <Text style={styles.exportNoteText}>
            Export laporan (CSV/PDF) belum tersedia - format file masih terbuka (prd.md bagian 9).
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.body },
  header: { padding: 18, paddingBottom: 12, backgroundColor: colors.white },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: colors.ink },
  subtitle: { fontSize: 11, fontWeight: '500', color: colors.faintText, marginTop: 5 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  section: { padding: 18, paddingTop: 20 },
  rangeWrap: { marginTop: 12 },
  chartWrap: { marginTop: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 13 },
  loadingText: { fontSize: 11, color: colors.mutedText, marginTop: 8 },
  emptyText: { fontSize: 11, color: colors.mutedText, padding: 12 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  summaryCell: { width: '47%', flexGrow: 1, borderRadius: radius.md, backgroundColor: colors.surface, padding: 11 },
  summaryLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3, color: colors.faintText },
  summaryValue: { fontSize: 20, fontWeight: '800', marginTop: 5, color: colors.ink },
  summaryNote: { fontSize: 10, color: colors.faintText, marginTop: 2 },
  tableCard: { marginTop: 10, borderRadius: radius.lg, backgroundColor: colors.surface, paddingHorizontal: 12 },
  tableHeader: { flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableHeaderCell: { flex: 1, fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5, color: colors.faintText },
  tableRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableCell: { flex: 1, fontSize: 11.5, fontWeight: '600', color: colors.ink },
  tableCellBold: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.ink },
  footerNote: { fontSize: 10, fontWeight: '600', color: colors.faintText, marginTop: 10 },
  exportNote: { marginHorizontal: 18, marginTop: 4, marginBottom: 24, borderRadius: radius.md, padding: 12, backgroundColor: colors.surfaceMuted },
  exportNoteText: { fontSize: 11, color: colors.mutedText },
});
