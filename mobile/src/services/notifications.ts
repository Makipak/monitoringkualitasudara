// FCM push notification wiring (architecture.md 6.3). Android only for
// now - iOS additionally needs an Apple Developer Program membership (for
// an APNs key) and a macOS build, neither of which exist yet (see
// CLAUDE.md mobile/ section); initPushNotifications() below no-ops on iOS
// rather than fail loudly. Requests notification permission, obtains the
// device's FCM token, and keeps the backend's device_push_tokens table
// (schema.md 3.7) in sync with it via registerPushToken/api.ts.
//
// Foreground behavior: FCM does NOT auto-display a "notification"-only
// message while the app is in the foreground on Android (only when
// backgrounded/killed) - onMessage below deliberately just logs rather
// than faking a banner with a new UI component, since
// useSensorData.ts's WebSocket subscription already surfaces the same
// out-of-range alerts live on the Dashboard whenever the app is open.
import { PermissionsAndroid, Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';

import { registerPushToken } from './api';

// Android 13+ (API 33) requires this runtime permission before any
// notification can be shown - messaging().requestPermission() is a no-op
// on Android (see @react-native-firebase/messaging source), so this has
// to go through PermissionsAndroid directly. No-op (permission implicitly
// granted) below API 33.
async function ensureAndroidNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return true;

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

// Call once at app start (see App.tsx). Fire-and-forget by design - a
// denied permission or a registration failure must never block the rest
// of the app, so every step here only warns on failure.
export async function initPushNotifications(): Promise<void> {
  if (Platform.OS !== 'android') return; // iOS not wired up yet, see file header

  try {
    const androidPermissionGranted = await ensureAndroidNotificationPermission();
    if (!androidPermissionGranted) {
      console.warn('[notifications] POST_NOTIFICATIONS permission denied by user');
      return;
    }

    const messaging = getMessaging(getApp());
    const status = await requestPermission(messaging);
    if (status !== AuthorizationStatus.AUTHORIZED && status !== AuthorizationStatus.PROVISIONAL) {
      console.warn('[notifications] FCM permission not granted, status:', status);
      return;
    }

    const token = await getToken(messaging);
    await registerPushToken(token, 'android');

    onTokenRefresh(messaging, async refreshedToken => {
      try {
        await registerPushToken(refreshedToken, 'android');
      } catch (err) {
        console.warn('[notifications] failed to re-register refreshed token:', err);
      }
    });

    onMessage(messaging, async remoteMessage => {
      // See file header - foreground messages are intentionally not
      // turned into an in-app banner here.
      console.log('[notifications] foreground message received:', remoteMessage.notification);
    });
  } catch (err) {
    console.warn('[notifications] setup failed:', err);
  }
}
