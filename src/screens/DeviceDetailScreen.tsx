import { StyleSheet, Text, View } from 'react-native';

import type { RootStackScreenProps } from '../navigation/RootNavigator';

type Props = RootStackScreenProps<'DeviceDetail'>;

export default function DeviceDetailScreen({ route }: Props) {
  const { deviceId, deviceName } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{deviceName}</Text>
      <Text style={styles.meta}>ID: {deviceId}</Text>
      {/*
        Wire up telemetry / control here, e.g.:
        - BLE: src/services/ble.ts -> subscribe to characteristic notifications
        - MQTT: src/services/mqtt.ts -> subscribe to `devices/{deviceId}/state`
      */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '600' },
  meta: { fontSize: 14, color: '#666', marginTop: 4 },
});
