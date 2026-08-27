import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_DEVICE_ID } from '../config/env';
import { PARAMETERS } from '../constants/parameters';
import { PARAMETER_INFO } from '../constants/parameterInfo';
import { useParameterHistory } from '../hooks/useParameterHistory';
import RangeSelector from '../components/RangeSelector';
import TrendChart from '../components/TrendChart';
import Icon from '../components/Icon';
import { colors, radius, statusTone } from '../theme';
import type { HomeStackScreenProps } from '../navigation/RootNavigator';

type Props = HomeStackScreenProps<'ParameterDetail'>;

const RANGES = ['1 Jam', '6 Jam', '12 Jam', '24 Jam', '7 Hari'];
const X_LABEL_COUNT = 5;

function stats(values: number[]) {
  if (values.length === 0) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const variance = values.reduce((a, b) => a + (b - avg) ** 2, 0) / values.length;
  return { avg, min, max, sd: Math.sqrt(variance) };
}

// Picks up to `count` evenly-spaced (time, value) pairs so the chart's
// x-axis labels line up with the points actually drawn, even though
// readings with a null value for this parameter were filtered out first.
function sampleTimeLabels(times: string[], count: number): string[] {
  if (times.length === 0) return [];
  if (times.length <= count) return times.map(formatTime);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i * (times.length - 1)) / (count - 1));
    out.push(formatTime(times[idx]));
  }
  return out;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function ParameterDetailScreen({ route, navigation }: Props) {
  const { parameter, status = 'unknown' } = route.params;
  const def = PARAMETERS.find(p => p.key === parameter)!;
  const info = PARAMETER_INFO[parameter];
  const [range, setRange] = useState('6 Jam');
  const { readings, loading } = useParameterHistory(DEFAULT_DEVICE_ID, parameter, range);

  // Keep (time, value) paired after dropping missing readings - values
  // alone (as returned by the hook) lose their index alignment with
  // `readings` once nulls are filtered out.
  const paired = readings
    .map(r => ({ time: r.time, value: r[parameter] }))
    .filter((p): p is { time: string; value: number } => p.value !== null && p.value !== undefined);
  const chartValues = paired.map(p => p.value);
  const chartLabels = sampleTimeLabels(paired.map(p => p.time), X_LABEL_COUNT);

  const s = stats(chartValues);
  const current = chartValues.length > 0 ? chartValues[chartValues.length - 1] : null;
  const tone = statusTone[status];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon path="m15 18-6-6 6-6" size={17} color={colors.ink} strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.headerTitle}>{def.name} Detail</Text>
        <View style={styles.infoBtn}>
          <Icon path="M12 16v-5M12 8h.01" size={16} color={colors.ink} strokeWidth={2} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.valueCard, { backgroundColor: tone.bg }]}>
          <View style={styles.valueIconBox}>
            <Icon path={def.icon} size={21} />
          </View>
          <View style={styles.valueMid}>
            <Text style={styles.valueName}>{def.name}</Text>
            <Text style={styles.valueFullName}>{def.fullName}</Text>
          </View>
          <View style={styles.valueRight}>
            <View style={styles.valueRow}>
              <Text style={styles.valueText}>{current === null ? '--' : current}</Text>
              <Text style={styles.valueUnit}>{def.unit}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: tone.dot }]}>
              <Text style={styles.statusPillText}>
                {status === 'unknown' ? '--' : status === 'normal' ? 'Normal' : 'Tidak Normal'}
              </Text>
            </View>
          </View>
        </View>
        {loading && <Text style={styles.loadingText}>Memuat...</Text>}

        <View style={styles.rangeWrap}>
          <RangeSelector options={RANGES} value={range} onChange={setRange} />
        </View>

        <View style={styles.chartWrap}>
          <TrendChart
            values={chartValues}
            labels={chartLabels.length > 1 ? chartLabels : undefined}
            color={tone.dot}
            emptyMessage="Belum ada data historis pada rentang ini"
          />
        </View>

        {s && (
          <>
            <Text style={styles.sectionTitle}>Statistik Ringkasan</Text>
            <View style={styles.statsGrid}>
              <StatCell label="RATA-RATA" value={s.avg.toFixed(1)} />
              <StatCell label="MINIMUM" value={s.min.toFixed(1)} />
              <StatCell label="MAKSIMUM" value={s.max.toFixed(1)} />
              <StatCell label="STD. DEVIASI" value={s.sd.toFixed(1)} />
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Tentang {def.name}</Text>
        <Text style={styles.aboutText}>{info.about}</Text>

        <View style={styles.infoCard}>
          <Icon
            path="M12 2a7 7 0 0 0-7 7c0 3 1.5 4.5 2.5 6h9c1-1.5 2.5-3 2.5-6a7 7 0 0 0-7-7Z M9 21h6M10 18h4"
            size={17}
            color={colors.green}
          />
          <View style={styles.infoCardTextCol}>
            <Text style={styles.infoCardTitle}>Dampak Kesehatan</Text>
            <Text style={styles.infoCardBody}>{info.healthImpact}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.tipsHeaderRow}>
            <Icon
              path="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z M2 21c0-3 1.85-5.36 5.08-6"
              size={17}
              color={colors.green}
            />
            <Text style={styles.infoCardTitle}>Tips Umum</Text>
          </View>
          <View style={styles.tipsList}>
            {info.tips.map(tip => (
              <View key={tip} style={styles.tipRow}>
                <View style={styles.tipDot} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Data Pemantauan</Text>
        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderCell}>WAKTU</Text>
            <Text style={styles.tableHeaderCell}>NILAI</Text>
          </View>
          {readings
            .slice(-8)
            .reverse()
            .map((r, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.tableCell}>{formatTime(r.time)}</Text>
                <Text style={styles.tableCellBold}>{r[parameter] ?? '--'}</Text>
              </View>
            ))}
          {readings.length === 0 && !loading && (
            <Text style={styles.emptyText}>Belum ada data pada rentang waktu ini.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.body },
  header: { backgroundColor: colors.body, padding: 14, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, color: colors.ink },
  infoBtn: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 18, paddingTop: 10, paddingBottom: 28 },
  valueCard: { borderRadius: radius.xl, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  valueIconBox: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  valueMid: { flex: 1, minWidth: 0 },
  valueName: { fontSize: 13, fontWeight: '700', color: colors.ink },
  valueFullName: { fontSize: 10.5, color: colors.mutedText, marginTop: 2 },
  valueRight: { alignItems: 'flex-end', gap: 6 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  valueText: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, color: colors.ink },
  valueUnit: { fontSize: 11, color: colors.mutedText },
  statusPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill },
  statusPillText: { fontSize: 10, fontWeight: '700', color: colors.white },
  loadingText: { fontSize: 11, color: colors.mutedText, marginTop: 8 },
  rangeWrap: { marginTop: 16 },
  chartWrap: { marginTop: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.ink, marginTop: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  statCell: { width: '47%', flexGrow: 1, borderRadius: radius.md, backgroundColor: colors.surface, padding: 12 },
  statLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4, color: colors.faintText },
  statValue: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, marginTop: 5, color: colors.ink },
  aboutText: { marginTop: 9, fontSize: 12, lineHeight: 18, color: colors.mutedText },
  infoCard: { marginTop: 12, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoCardTextCol: { flex: 1, minWidth: 0 },
  infoCardTitle: { fontSize: 11.5, fontWeight: '700', color: colors.ink },
  infoCardBody: { fontSize: 11.5, color: colors.mutedText, marginTop: 3, lineHeight: 17 },
  tipsHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipsList: { marginTop: 9, gap: 7, paddingLeft: 27 },
  tipRow: { flexDirection: 'row', gap: 7, alignItems: 'flex-start' },
  tipDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.faintText, marginTop: 6 },
  tipText: { flex: 1, fontSize: 11.5, color: colors.mutedText, lineHeight: 17 },
  tableCard: { marginTop: 10, borderRadius: radius.lg, backgroundColor: colors.surface, paddingHorizontal: 12 },
  tableHeader: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableHeaderCell: { flex: 1, fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5, color: colors.faintText },
  tableRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableCell: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.ink },
  tableCellBold: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.ink },
  emptyText: { fontSize: 11, color: colors.mutedText, paddingVertical: 12 },
});
