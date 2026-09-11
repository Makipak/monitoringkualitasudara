import { Image, StyleSheet, View } from 'react-native';

// Shown briefly on app launch (see App.tsx) while the JS bundle settles.
// This is a JS-level splash only, not a native launch screen (no
// react-native-splash-screen/bootsplash dependency has been added), so
// it cannot appear before the JS bundle itself loads.
const logo = require('../assets/images/falhora.png');

// Sampled from the logo's own flat background (see assets/images/falhora.png)
// so the square logo image blends into a full-bleed screen with no
// visible edge - see mobile/src/theme.ts for why this isn't one of the
// existing brand tokens (the logo uses its own palette, distinct from
// the in-app lime/gold accent colors).
const SPLASH_BACKGROUND = '#38BAA6';

export default function SplashScreen() {
  return (
    <View style={styles.screen}>
      <Image source={logo} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SPLASH_BACKGROUND, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 160, height: 160 },
});
