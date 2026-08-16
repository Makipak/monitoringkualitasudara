import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import DeviceDetailScreen from '../screens/DeviceDetailScreen';

/**
 * Central place for route params. Add new screens here so `navigation.navigate(...)`
 * stays type-checked across the app.
 */
export type RootStackParamList = {
  Home: undefined;
  DeviceDetail: { deviceId: string; deviceName: string };
};

// Convenience type to reuse in screen components, e.g.:
// type Props = NativeStackScreenProps<RootStackParamList, 'DeviceDetail'>;
export type RootStackScreenProps<RouteName extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, RouteName>;

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Udara' }}
        />
        <Stack.Screen
          name="DeviceDetail"
          component={DeviceDetailScreen}
          options={({ route }) => ({ title: route.params.deviceName })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
