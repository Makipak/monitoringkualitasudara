import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_DEVICE_ID } from '../config/env';
import { useNotifications } from '../hooks/useNotifications';
import { PARAMETERS } from '../constants/parameters';
import Icon from '../components/Icon';
import { colors, radius, statusTone } from '../theme';
import type { HomeStackScreenProps } from '../navigation/RootNavigator';
import type { NotificationItem } from '../services/api';

type Props = HomeStackScreenProps<'Notifications'>;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function NotificationsScreen({ navigation }: Props) {
  const { notifications, loading, error, refresh } = useNotifications(DEFAULT_DEVICE_ID);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon path="m15 18-6-6 6-6" size={17} color={colors.ink} strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifikasi</Text>
        <View style={styles.backBtn} />
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

        {!loading && !error && notifications.length === 0 && (
          <View style={styles.emptyCard}>
            <Icon
              path="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"
              size={26}
              color={colors.faintText}
              strokeWidth={1.8}
            />
            <Text style={styles.emptyTitle}>Belum Ada Notifikasi</Text>
            <Text style={styles.emptyBody}>
              Notifikasi muncul di sini setiap kali salah satu dari 7 parameter resmi keluar dari
              batas normal.
            </Text>
          </View>
        )}

        {!loading && !error && notifications.length > 0 && (
          <View style={styles.list}>
            {notifications.map(item => (
              <NotificationCard key={item.id} item={item} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NotificationCard({ item }: { item: NotificationItem }) {
  const def = PARAMETERS.find(p => p.key === item.parameter);
  const active = item.resolvedAt === null;
  const tone = active ? statusTone.not_normal : statusTone.normal;

  return (
    <View style={styles.card}>
      <View style={[styles.iconBox, { backgroundColor: tone.bg }]}>
        <Icon path={def?.icon ?? 'M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'} size={18} color={tone.fg} />
      </View>
      <View style={styles.cardMid}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle}>
            {def?.name ?? item.parameter}
            {def ? ` ${item.value}${def.unit}` : ` (${item.value})`}
          </Text>
          <View style={[styles.pill, { backgroundColor: tone.dot }]}>
            <Text style={styles.pillText}>{active ? 'Aktif' : 'Selesai'}</Text>
          </View>
        </View>
        <Text style={styles.cardBody}>{item.recommendation}</Text>
        <Text style={styles.cardTime}>{formatTime(item.triggeredAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.body },
  header: {
    backgroundColor: colors.body,
    padding: 14,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, color: colors.ink },
  scroll: { flex: 1 },
  scrollContent: { padding: 18, paddingTop: 6, paddingBottom: 28 },
  centerBox: { padding: 40, alignItems: 'center' },
  errorText: { fontSize: 12, color: colors.red, textAlign: 'center' },
  emptyCard: {
    marginTop: 12,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, marginTop: 12 },
  emptyBody: { fontSize: 12, lineHeight: 18, color: colors.mutedText, marginTop: 8, textAlign: 'center' },
  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 14,
    alignItems: 'flex-start',
  },
  iconBox: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  cardMid: { flex: 1, minWidth: 0 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.ink },
  pill: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.pill },
  pillText: { fontSize: 9.5, fontWeight: '700', color: colors.white },
  cardBody: { fontSize: 11.5, lineHeight: 16, color: colors.mutedText, marginTop: 4 },
  cardTime: { fontSize: 10, color: colors.faintText, marginTop: 6, fontWeight: '600' },
});
