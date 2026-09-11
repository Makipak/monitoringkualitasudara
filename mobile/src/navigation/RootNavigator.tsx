import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  type BottomTabScreenProps,
} from '@react-navigation/bottom-tabs';

import DashboardScreen from '../screens/DashboardScreen';
import ParameterDetailScreen from '../screens/ParameterDetailScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import PredictionScreen from '../screens/PredictionScreen';
import HistoryScreen from '../screens/HistoryScreen';
import AboutScreen from '../screens/AboutScreen';
import Icon from '../components/Icon';
import { colors } from '../theme';
import type { ParameterKey } from '../constants/parameters';

/**
 * Route structure mirrors design/UF IAQ.dc.html's 4-tab layout (Beranda,
 * Prediksi, Riwayat, Tentang). Beranda gets its own stack so tapping a
 * parameter pushes a detail screen without leaving the tab (matching the
 * design's isHome/isDetail toggle within one "screen").
 *
 * Add new screens to the relevant param list below AND to the matching
 * Navigator further down so `navigation.navigate(...)` stays type-checked.
 */
export type HomeStackParamList = {
  Dashboard: undefined;
  // `status` is passed from Dashboard's already-fetched RoomStatus rather
  // than re-fetched here, so this screen doesn't open a second
  // useSensorData subscription just to show one badge - it's a snapshot
  // from navigation time, not live-updated while this screen stays open.
  ParameterDetail: { parameter: ParameterKey; status?: 'normal' | 'not_normal' | 'unknown' };
  // Alert history (backend GET /api/rooms/:deviceId/notifications) -
  // opened from the Dashboard header's bell icon.
  Notifications: undefined;
};

export type HomeStackScreenProps<RouteName extends keyof HomeStackParamList> =
  NativeStackScreenProps<HomeStackParamList, RouteName>;

export type RootTabParamList = {
  Beranda: undefined;
  Prediksi: undefined;
  Riwayat: undefined;
  Tentang: undefined;
};

export type RootTabScreenProps<RouteName extends keyof RootTabParamList> =
  BottomTabScreenProps<RootTabParamList, RouteName>;

const HomeStack = createNativeStackNavigator<HomeStackParamList>();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Dashboard" component={DashboardScreen} />
      <HomeStack.Screen name="ParameterDetail" component={ParameterDetailScreen} />
      <HomeStack.Screen name="Notifications" component={NotificationsScreen} />
    </HomeStack.Navigator>
  );
}

// One named function per tab, all at module scope, so none of them are
// ever "defined during render" (react/no-unstable-nested-components) -
// passed directly as `options.tabBarIcon` below rather than wrapped in
// an inline arrow function.
type TabIconProps = { color: string; size: number };
function BerandaTabIcon({ color, size }: TabIconProps) {
  return <Icon path="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" size={size} color={color} />;
}
function PrediksiTabIcon({ color, size }: TabIconProps) {
  return <Icon path="M22 12h-4l-3 9L9 3l-3 9H2" size={size} color={color} />;
}
function RiwayatTabIcon({ color, size }: TabIconProps) {
  return <Icon path="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9M12 7v5l3 2" size={size} color={color} />;
}
function TentangTabIcon({ color, size }: TabIconProps) {
  return <Icon path="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9M12 11v5M12 8h.01" size={size} color={color} />;
}

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.green,
          tabBarInactiveTintColor: colors.faintText,
          tabBarActiveBackgroundColor: colors.greenBg,
          tabBarStyle: { borderTopWidth: 1, borderTopColor: colors.body, height: 64, paddingTop: 6, paddingBottom: 8 },
          tabBarItemStyle: { borderRadius: 14, marginHorizontal: 4 },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        }}>
        <Tab.Screen name="Beranda" component={HomeStackNavigator} options={{ tabBarIcon: BerandaTabIcon }} />
        <Tab.Screen name="Prediksi" component={PredictionScreen} options={{ tabBarIcon: PrediksiTabIcon }} />
        <Tab.Screen name="Riwayat" component={HistoryScreen} options={{ tabBarIcon: RiwayatTabIcon }} />
        <Tab.Screen name="Tentang" component={AboutScreen} options={{ tabBarIcon: TentangTabIcon }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
