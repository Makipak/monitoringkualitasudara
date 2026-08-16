import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { RootStackScreenProps } from '../navigation/RootNavigator';

// Placeholder data — replace with real results from your BLE/WiFi/MQTT
// device discovery service (see src/services).
const MOCK_DEVICES = [
  { id: 'esp32-01', name: 'ESP32 - Ruang Tamu' },
  { id: 'esp32-02', name: 'ESP32 - Kamar' },
];

type Props = RootStackScreenProps<'Home'>;

export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perangkat IoT</Text>
      <FlatList
        data={MOCK_DEVICES}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              navigation.navigate('DeviceDetail', {
                deviceId: item.id,
                deviceName: item.name,
              })
            }>
            <Text style={styles.cardText}>{item.name}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  list: { gap: 8 },
  card: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f2f2f2',
  },
  cardText: { fontSize: 16 },
});
