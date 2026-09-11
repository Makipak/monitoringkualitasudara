// Downloads a daily export file (backend/README.md GET .../export?format=)
// and hands it to the OS to open - screens don't do native file I/O
// directly (rule.md section 7: data fetching/subscriptions live in
// hooks, not screens). See HistoryScreen.tsx for the two buttons that
// call this.
//
// Always exports "today" - the endpoint is per-calendar-day
// (architecture.md 4.3) and there's no date picker in this screen (same
// simplification HistoryScreen.tsx's range presets already make, to
// avoid a native date-picker dependency React Native doesn't ship).
//
// Uses react-native-blob-util because RN's global fetch() has no
// filesystem access - it downloads straight to a local file, then hands
// that file to the OS: `android.actionViewIntent` opens it in whatever
// app the user has for that file type (a spreadsheet/PDF app, Google
// Drive, ...); `ios.previewDocument` opens Apple's QuickLook, which has
// its own Share button built in. iOS is untested from this session (no
// macOS build available) - same caveat as notifications.ts's push setup,
// see CLAUDE.md mobile/ section.
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { ApiError, getAuthToken, getExportUrl, type ExportFormat } from '../services/api';

const MIME_TYPES: Record<ExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function useExport(deviceId: string) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportReport = useCallback(
    async (format: ExportFormat) => {
      setBusy(format);
      setError(null);
      try {
        const date = todayIsoDate();
        const token = await getAuthToken();
        const url = getExportUrl(deviceId, date, format);
        const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/laporan-${deviceId}-${date}.${format}`;

        const res = await ReactNativeBlobUtil.config({ path, overwrite: true }).fetch('GET', url, {
          Authorization: `Bearer ${token}`,
        });

        const status = res.respInfo.status;
        if (status >= 400) {
          // Error responses are JSON (see routes/rooms.js), not the file
          // itself - blob-util still writes whatever bytes came back to
          // `path`, so read it back as JSON for a real message instead of
          // treating it as a downloaded report.
          const body = await res.json().catch(() => ({}));
          throw new ApiError(body?.error ?? `Gagal mengunduh laporan (status ${status})`, status);
        }

        const filePath = res.path();
        if (Platform.OS === 'android') {
          await ReactNativeBlobUtil.android.actionViewIntent(filePath, MIME_TYPES[format]);
        } else {
          await ReactNativeBlobUtil.ios.previewDocument(filePath);
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Gagal mengunduh laporan. Periksa koneksi Anda.');
      } finally {
        setBusy(null);
      }
    },
    [deviceId],
  );

  return { busy, error, exportReport };
}
