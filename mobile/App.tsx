/**
 * Falhora (Faletehan Hospital Indoor Air Quality) — React Native app
 * (display name; native identifiers unchanged, see CLAUDE.md)
 *
 * @format
 */

import { useEffect, useState } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from './src/navigation/RootNavigator';
import SplashScreen from './src/screens/SplashScreen';
import { initPushNotifications } from './src/services/notifications';

// JS-level splash only (see SplashScreen.tsx) - just a brief branded
// beat before the navigator mounts, not a substitute for a native
// launch screen.
const SPLASH_DURATION_MS = 900;

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    initPushNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {showSplash ? <SplashScreen /> : <RootNavigator />}
    </SafeAreaProvider>
  );
}

export default App;
