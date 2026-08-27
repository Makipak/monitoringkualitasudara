import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CircularGauge from '../components/CircularGauge';
import SectionHeader from '../components/SectionHeader';
import Icon from '../components/Icon';
import { colors, radius, statusTone, predictionLabelTone } from '../theme';
import { DEFAULT_DEVICE_ID } from '../config/env';
import { usePrediction } from '../hooks/usePrediction';
import type { PredictionLabel } from '../services/api';

// Composite status from the BiGRU classifier (ml-service/, wired via
// backend/src/services/ml.js) - real model output, not mock data. The
// model only produces one of 4 composite status labels + a probability
// per class from the last 60 sensor readings; it does NOT forecast
// individual parameter values or a future trend line, so this screen
// intentionally doesn't show either (unlike design/UF IAQ.dc.html's
// mockup, which assumed a richer model than what was actually trained -
// see CLAUDE.md's mobile/ section).
const LABEL_ORDER: PredictionLabel[] = ['Baik', 'Rawan', 'Peringatan', 'Bahaya'];

const LABEL_DESCRIPTION: Record<PredictionLabel, string> = {
  Baik: 'Kualitas udara diprediksi berada dalam rentang aman.',
  Rawan: 'Kualitas udara diprediksi mulai menyimpang dari rentang normal.',
  Peringatan: 'Kualitas udara diprediksi berada di luar rentang normal.',
  Bahaya: 'Kualitas udara diprediksi berada pada tingkat yang perlu perhatian segera.',
};

export default function PredictionScreen() {
  const { prediction, loading, error, refresh } = usePrediction(DEFAULT_DEVICE_ID);

  const available = prediction?.available === true;
  const tone = available ? statusTone[predictionLabelTone[prediction.label]] : statusTone.unknown;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Prediksi</Text>
        <Text style={styles.subtitle}>Prediksi kualitas udara berbasis Deep Learning</Text>
        <View style={styles.statusRow}>
          <View style={styles.statusLeft}>
            <View style={[styles.dot, { backgroundColor: available ? colors.greenLine : colors.faintText }]} />
            <Text style={styles.statusText}>{available ? 'MODEL AKTIF' : 'MENUNGGU DATA'}</Text>
          </View>
          {available && (
            <Text style={styles.updateText}>
              Prediksi terakhir {new Date(prediction.time).toLocaleTimeString('id-ID')}
            </Text>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator color={colors.green} />
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && !available && (
          <View style={styles.emptyCard}>
            <Icon
              path="M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              size={28}
              color={colors.faintText}
              strokeWidth={1.8}
            />
            <Text style={styles.emptyTitle}>Prediksi Belum Tersedia</Text>
            <Text style={styles.emptyBody}>
              Model butuh 60 pembacaan berturut-turut yang lengkap (termasuk CO2, cahaya, suhu, dan
              kelembapan) sebelum bisa menghasilkan prediksi. Sensor CO2, cahaya, suhu, dan kelembapan
              pada perangkat saat ini sedang dalam perbaikan/belum terpasang, jadi tab ini akan tetap
              kosong sampai sensor-sensor tersebut aktif kembali.
            </Text>
          </View>
        )}

        {!loading && !error && available && (
          <>
            <View style={[styles.scoreCard, { backgroundColor: tone.bg }]}>
              <Text style={[styles.scoreLabel, { color: tone.fg }]}>HASIL PREDIKSI AI</Text>
              <View style={styles.scoreRow}>
                <CircularGauge
                  value={prediction.probabilities[prediction.label] * 100}
                  label="KEYAKINAN"
                  progressColor={tone.dot}
                  trackColor={colors.border}
                  size={96}
                  strokeWidth={9}
                />
                <View style={styles.scoreTextCol}>
                  <Text style={[styles.scoreCaption, { color: tone.fg }]}>STATUS PREDIKSI</Text>
                  <Text style={[styles.scoreStatus, { color: tone.fg }]}>{prediction.label.toUpperCase()}</Text>
                  <Text style={[styles.scoreDesc, { color: tone.fg }]}>{LABEL_DESCRIPTION[prediction.label]}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeader title="Probabilitas per Kelas" />
              <View style={styles.probList}>
                {LABEL_ORDER.map(label => {
                  const pct = (prediction.probabilities[label] ?? 0) * 100;
                  const labelTone = statusTone[predictionLabelTone[label]];
                  return (
                    <View key={label} style={styles.probRow}>
                      <View style={styles.probHeaderRow}>
                        <Text style={styles.probLabel}>{label}</Text>
                        <Text style={styles.probPct}>{pct.toFixed(1)}%</Text>
                      </View>
                      <View style={styles.probTrack}>
                        <View style={[styles.probFill, { width: `${pct}%`, backgroundColor: labelTone.dot }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <Text style={styles.modelVersionText}>Model: {prediction.model_version}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.body },
  header: { padding: 18, paddingBottom: 12, backgroundColor: colors.white },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: colors.ink },
  subtitle: { fontSize: 11, fontWeight: '500', color: colors.faintText, marginTop: 5 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10.5, fontWeight: '700', color: colors.mutedText, letterSpacing: 0.3 },
  updateText: { fontSize: 11, color: colors.faintText },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  centerBox: { padding: 40, alignItems: 'center' },
  errorText: { fontSize: 12, color: colors.red, textAlign: 'center' },
  emptyCard: {
    margin: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, marginTop: 12 },
  emptyBody: { fontSize: 12, lineHeight: 18, color: colors.mutedText, marginTop: 8, textAlign: 'center' },
  scoreCard: { margin: 18, marginBottom: 0, borderRadius: radius.xxl, padding: 18 },
  scoreLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14 },
  scoreTextCol: { flex: 1, gap: 4 },
  scoreCaption: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4 },
  scoreStatus: { fontSize: 24, fontWeight: '800', marginTop: 2 },
  scoreDesc: { fontSize: 11, lineHeight: 15, marginTop: 4, opacity: 0.85 },
  section: { padding: 18, paddingTop: 20 },
  probList: { marginTop: 14, gap: 14 },
  probRow: { gap: 6 },
  probHeaderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  probLabel: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  probPct: { fontSize: 12.5, fontWeight: '700', color: colors.mutedText },
  probTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.border },
  probFill: { height: 8, borderRadius: radius.pill },
  modelVersionText: {
    fontSize: 10,
    color: colors.faintText,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
});
