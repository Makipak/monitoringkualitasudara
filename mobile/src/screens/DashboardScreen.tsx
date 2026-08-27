import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_DEVICE_ID } from '../config/env';
import { useSensorData, type ConnectionState } from '../hooks/useSensorData';
import { usePrediction } from '../hooks/usePrediction';
import { computeIaqScore, iaqLabel } from '../utils/iaqScore';
import { PARAMETERS } from '../constants/parameters';
import CircularGauge from '../components/CircularGauge';
import ParameterRow from '../components/ParameterRow';
import Icon from '../components/Icon';
import { colors, radius, statusTone, predictionLabelTone } from '../theme';
import type { HomeStackScreenProps } from '../navigation/RootNavigator';
import type { Prediction } from '../services/api';

type Props = HomeStackScreenProps<'Dashboard'>;

const DEFAULT_RECOMMENDATION =
  'Kualitas udara saat ini baik. Pertahankan ventilasi rutin untuk kondisi optimal.';

// v1 scope is a single device/room (prd.md section 3) - matches
// firmware/include/config.h and backend/sql/seed.sql ("room-01").
export default function DashboardScreen({ navigation }: Props) {
  const { connection, reading, status, alerts, error, refresh } = useSensorData(DEFAULT_DEVICE_ID);
  const { prediction } = usePrediction(DEFAULT_DEVICE_ID);
  const iaq = computeIaqScore(status?.status);
  // Approximates "is the device itself online" from whether the backend is
  // reachable and has ever delivered a reading - there is no dedicated
  // device-connectivity field in the REST API yet (rooms.js /status only
  // reports per-parameter threshold status, not the `devices.status`
  // online/offline column from schema.md).
  const deviceOnline = connection === 'online' && reading !== null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Header
        connection={connection}
        deviceOnline={deviceOnline}
        lastUpdate={reading?.time}
        temperature={reading?.temperature ?? null}
        humidity={reading?.humidity ?? null}
      />
      <ConnectionBanner connection={connection} error={error} />

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
        <View style={styles.iaqCard}>
          <Text style={styles.iaqLabel}>STATUS KUALITAS UDARA</Text>
          <View style={styles.iaqRow}>
            <CircularGauge value={iaq} label="SKOR IAQ" progressColor={colors.green} trackColor="#D3DEBA" />
            <View style={styles.iaqTextCol}>
              <Text style={styles.iaqStatusCaption}>STATUS SAAT INI</Text>
              <Text style={styles.iaqStatus}>{iaqLabel(iaq)}</Text>
              <Text style={styles.iaqDesc}>
                {iaq === null
                  ? 'Menunggu data sensor pertama dari device.'
                  : 'Persentase parameter resmi yang saat ini berada dalam rentang normal.'}
              </Text>
              <PredictionPill prediction={prediction} />
            </View>
          </View>
          {prediction?.available && (
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>Keyakinan Model</Text>
              <Text style={styles.confidenceValue}>
                {(prediction.probabilities[prediction.label] * 100).toFixed(1)}%
              </Text>
            </View>
          )}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Pemantauan Real-Time</Text>
          <Text style={styles.sectionTrailing}>{PARAMETERS.length} PARAMETER</Text>
        </View>

        <View style={styles.grid}>
          {PARAMETERS.map(def => (
            <View key={def.key} style={styles.gridCell}>
              <ParameterRow
                def={def}
                value={reading?.[def.key]}
                status={status?.status[def.key] ?? 'unknown'}
                onPress={() =>
                  navigation.navigate('ParameterDetail', { parameter: def.key, status: status?.status[def.key] ?? 'unknown' })
                }
              />
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitleSpaced}>Rekomendasi</Text>
        <View style={styles.recBox}>
          <Icon
            path="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z M2 21c0-3 1.85-5.36 5.08-6"
            size={18}
            color={colors.green}
          />
          <Text style={styles.recText}>{alerts[0]?.recommendation ?? DEFAULT_RECOMMENDATION}</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.gridCell}>
            <InfoTile
              iconPath="M2 6.5a15 15 0 0 1 20 0M5.5 10.5a10 10 0 0 1 13 0M9 14.5a5 5 0 0 1 6 0M12 18h.01"
              title="Perangkat IoT"
              body={`${deviceOnline ? '1/1' : '0/1'} Terhubung`}
            />
          </View>
          <View style={styles.gridCell}>
            <InfoTile
              iconPath="M10.3 21a1.94 1.94 0 0 0 3.4 0M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
              title="Peringatan Aktif"
              body={alerts.length > 0 ? `${alerts.length} Parameter` : 'Tidak ada'}
            />
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>PERANGKAT IOT</Text>
          <Text style={styles.footerValue}>{DEFAULT_DEVICE_ID.toUpperCase()}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Real composite-status result from the BiGRU classifier (ml-service/,
// see hooks/usePrediction.ts) - replaces the earlier hardcoded "Prediksi
// AI (Contoh)" mock pill. `available: false` (routine while a full 60-
// reading window isn't there yet, e.g. CO2/lux/temperature/humidity
// sensors currently uninstalled - see screens/PredictionScreen.tsx) shows
// a neutral "belum tersedia" pill instead of any placeholder number.
function PredictionPill({ prediction }: { prediction: Prediction | null }) {
  if (!prediction?.available) {
    return (
      <View style={[styles.aiPill, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[styles.aiPillText, { color: colors.mutedText }]}>Prediksi AI (Belum Tersedia)</Text>
      </View>
    );
  }

  const tone = statusTone[predictionLabelTone[prediction.label]];
  return (
    <View style={[styles.aiPill, { backgroundColor: tone.dot }]}>
      <Text style={styles.aiPillText}>Prediksi AI: {prediction.label}</Text>
    </View>
  );
}

function InfoTile({ iconPath, title, body }: { iconPath: string; title: string; body: string }) {
  return (
    <View style={styles.infoTile}>
      <Icon path={iconPath} size={17} color={colors.green} strokeWidth={2.1} />
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoBody}>{body}</Text>
    </View>
  );
}

function Header({
  connection,
  deviceOnline,
  lastUpdate,
  temperature,
  humidity,
}: {
  connection: ConnectionState;
  deviceOnline: boolean;
  lastUpdate?: string;
  temperature: number | null;
  humidity: number | null;
}) {
  const tone =
    connection === 'checking'
      ? { dot: colors.faintText, text: 'Menghubungkan...', label: colors.mutedText }
      : deviceOnline
        ? { dot: colors.greenLine, text: 'Terhubung', label: colors.green }
        : { dot: colors.red, text: 'Tidak Terhubung', label: colors.red };

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>UF IAQ</Text>
          <Text style={styles.subtitle}>Sistem Pemantauan Kualitas Udara Dalam Ruang</Text>
        </View>
        <View style={styles.headerIcons}>
          <View style={styles.bellBox}>
            <Icon path="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" size={16} />
            <View style={styles.bellDot} />
          </View>
          <View style={[styles.connBox, { backgroundColor: deviceOnline ? colors.greenLine : colors.surfaceMuted }]}>
            <Icon
              path="M2 6.5a15 15 0 0 1 20 0M5.5 10.5a10 10 0 0 1 13 0M9 14.5a5 5 0 0 1 6 0M12 18h.01"
              size={15}
              color={deviceOnline ? colors.white : colors.faintText}
              strokeWidth={2.4}
            />
          </View>
        </View>
      </View>
      <View style={styles.statusRow}>
        <View style={styles.statusLeft}>
          <View style={[styles.pulseDot, { backgroundColor: tone.dot }]} />
          <Text style={[styles.statusText, { color: tone.label }]}>{tone.text}</Text>
        </View>
        <Text style={styles.updateText}>
          {lastUpdate ? `Diperbarui ${new Date(lastUpdate).toLocaleTimeString('id-ID')}` : 'Belum ada data'}
        </Text>
      </View>
      {/* Suhu + kelembapan ruangan (GY-SHT31) - dipublikasikan/disimpan
          seperti 7 parameter resmi tapi bukan salah satunya (schema.md
          3.3), jadi ditampilkan di sini sebagai info pendukung, bukan di
          grid parameter yang punya status normal/tidak-normal. */}
      <View style={styles.envRow}>
        <View style={styles.envItem}>
          <Icon path="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" size={13} color={colors.faintText} />
          <Text style={styles.envText}>{temperature != null ? `${temperature.toFixed(1)}°C` : '--°C'}</Text>
        </View>
        <View style={styles.envItem}>
          <Icon
            path="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"
            size={13}
            color={colors.faintText}
          />
          <Text style={styles.envText}>{humidity != null ? `${humidity.toFixed(0)}% RH` : '--% RH'}</Text>
        </View>
      </View>
    </View>
  );
}

function ConnectionBanner({ connection, error }: { connection: ConnectionState; error: string | null }) {
  if (connection === 'checking') return <Banner text="Menghubungkan ke backend..." color={colors.mutedText} />;
  if (connection === 'offline')
    return <Banner text="Backend tidak terjangkau - cek koneksi & src/config/env.ts" color={colors.red} />;
  if (error) return <Banner text={error} color={colors.amber} />;
  return null;
}

function Banner({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.banner, { backgroundColor: color }]}>
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.body },
  scroll: { flex: 1 },
  header: { backgroundColor: colors.white, padding: 18, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: colors.ink },
  subtitle: { fontSize: 11, fontWeight: '500', color: colors.faintText, marginTop: 5 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 0 },
  bellBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.amber,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  connBox: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pulseDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  updateText: { fontSize: 11, color: colors.faintText, fontWeight: '500' },
  envRow: { flexDirection: 'row', gap: 14, marginTop: 8 },
  envItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  envText: { fontSize: 11, fontWeight: '600', color: colors.faintText },
  banner: { padding: 10 },
  bannerText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  iaqCard: { margin: 18, marginTop: 12, borderRadius: radius.xxl, backgroundColor: colors.greenBg, padding: 18 },
  iaqLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1, color: colors.green },
  iaqRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 14 },
  iaqTextCol: { flex: 1, minWidth: 0 },
  iaqStatusCaption: { fontSize: 10, fontWeight: '600', color: colors.greenDark },
  iaqStatus: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, lineHeight: 30, color: colors.greenDark, marginTop: 2 },
  iaqDesc: { fontSize: 11, color: colors.greenDark, marginTop: 5, lineHeight: 15 },
  aiPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.green,
  },
  aiPillText: { fontSize: 10.5, fontWeight: '700', color: colors.white },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(118,150,44,0.16)',
  },
  confidenceLabel: { fontSize: 10.5, fontWeight: '600', color: colors.greenDark },
  confidenceValue: { fontSize: 12, fontWeight: '800', color: colors.greenDark },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 18,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, color: colors.ink },
  sectionTitleSpaced: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, color: colors.ink, marginTop: 22, paddingHorizontal: 18 },
  sectionTrailing: { fontSize: 10, fontWeight: '700', color: colors.faintText, letterSpacing: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 18, marginTop: 12, gap: 12 },
  gridCell: { width: '47%', flexGrow: 1 },
  recBox: {
    marginHorizontal: 18,
    marginTop: 12,
    borderRadius: radius.lg,
    backgroundColor: '#F5F9EC',
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  recText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.mutedText },
  infoTile: { borderRadius: radius.lg, backgroundColor: colors.surface, padding: 14 },
  infoTitle: { fontSize: 11.5, fontWeight: '700', marginTop: 8, color: colors.ink },
  infoBody: { fontSize: 10, color: colors.faintText, marginTop: 3, lineHeight: 14 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: 22,
    marginBottom: 24,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, color: colors.faintText },
  footerValue: { fontSize: 10, fontWeight: '700', color: colors.ink },
});
