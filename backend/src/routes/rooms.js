// REST API (architecture.md section 4.3). All routes are mounted under
// /api/rooms and take a human-readable :deviceId (e.g. "room-01", the same
// value published in the MQTT topic/payload), not the internal UUID.
import { Router } from "express";
import { OFFICIAL_PARAMETERS } from "../config.js";
import {
  findDeviceByDeviceId,
  getLatestReading,
  getHistory,
  getDailyAggregate,
  getReadingsForDay,
  getThresholds,
  getLatestPrediction,
  getAlertHistory,
  getRecentReadings,
} from "../services/db.js";
import { evaluateThresholds, describeAlert } from "../services/threshold.js";
import { computeIaqIndex } from "../services/iaqIndex.js";
import { buildXlsxBuffer, buildPdfBuffer } from "../services/export.js";
import { buildWindowPayload, requestPrediction } from "../services/ml.js";
import { ML_PREDICTION_WINDOW_SIZE } from "../config.js";

const NOTIFICATIONS_DEFAULT_LIMIT = 50;
const NOTIFICATIONS_MAX_LIMIT = 200;

const router = Router();

async function loadDeviceOr404(req, res) {
  const device = await findDeviceByDeviceId(req.params.deviceId);
  if (!device) {
    res.status(404).json({ error: `unknown deviceId "${req.params.deviceId}"` });
    return null;
  }
  return device;
}

router.get("/:deviceId/latest", async (req, res, next) => {
  try {
    const device = await loadDeviceOr404(req, res);
    if (!device) return;

    const reading = await getLatestReading(device.id);
    if (!reading) return res.status(404).json({ error: "no readings yet for this device" });
    res.json(reading);
  } catch (err) {
    next(err);
  }
});

router.get("/:deviceId/history", async (req, res, next) => {
  try {
    const device = await loadDeviceOr404(req, res);
    if (!device) return;

    const { from, to } = req.query;
    if (!from || !to) {
      return res
        .status(400)
        .json({ error: 'query params "from" and "to" (ISO timestamps) are required' });
    }
    res.json(await getHistory(device.id, from, to));
  } catch (err) {
    next(err);
  }
});

const EXPORT_FORMATS = ["xlsx", "pdf"];

router.get("/:deviceId/export", async (req, res, next) => {
  try {
    const device = await loadDeviceOr404(req, res);
    if (!device) return;

    const { date, format } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'query param "date" (YYYY-MM-DD) is required' });
    }
    if (format !== undefined && !EXPORT_FORMATS.includes(format)) {
      return res
        .status(400)
        .json({ error: `query param "format" must be one of: ${EXPORT_FORMATS.join(", ")}` });
    }

    // No `format` given: keep the original plain-JSON aggregate response
    // (still used as a lightweight preview / for anything that doesn't
    // need an actual file yet).
    if (!format) {
      const aggregate = await getDailyAggregate(device.id, date);
      return res.json(aggregate ?? { day: date, message: "no readings for this date" });
    }

    const [readings, thresholds] = await Promise.all([
      getReadingsForDay(device.id, date),
      getThresholds(),
    ]);
    const filenameBase = `${device.device_id}-${date}`;

    if (format === "xlsx") {
      const xlsx = await buildXlsxBuffer({ device, date, readings, thresholds });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.xlsx"`);
      return res.send(xlsx);
    }

    const pdf = await buildPdfBuffer({ device, date, readings, thresholds });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

router.get("/:deviceId/status", async (req, res, next) => {
  try {
    const device = await loadDeviceOr404(req, res);
    if (!device) return;

    const reading = await getLatestReading(device.id);
    if (!reading) return res.status(404).json({ error: "no readings yet for this device" });

    const thresholds = await getThresholds();
    const outOfRange = evaluateThresholds(reading, thresholds);
    const outOfRangeParams = new Set(outOfRange.map((a) => a.parameter));

    const status = {};
    for (const parameter of OFFICIAL_PARAMETERS) {
      if (reading[parameter] === null || reading[parameter] === undefined) continue;
      status[parameter] = outOfRangeParams.has(parameter) ? "not_normal" : "normal";
    }

    // Real device connectivity (devices.status/last_seen_at, kept current
    // by touchDeviceOnline()/markStaleDevicesOffline() in services/db.js +
    // index.js's sweep) - separate from "does the app's WebSocket reach
    // the backend" (mobile's useSensorData.ts `connection` state). Without
    // this, the mobile app has no way to tell a live reading apart from a
    // stale one served by a device that's actually been offline for days.
    res.json({
      time: reading.time,
      status,
      alerts: outOfRange,
      // ISPU-style composite score for the Dashboard gauge
      // (services/iaqIndex.js) - separate from `status`/`alerts` above,
      // which stay driven by the `thresholds` table's simple normal/
      // not_normal evaluation. null only if every official parameter is
      // missing from this reading (shouldn't happen once a device is
      // reporting at all).
      iaqIndex: computeIaqIndex(reading),
      device: { online: device.status === "online", lastSeenAt: device.last_seen_at },
    });
  } catch (err) {
    next(err);
  }
});

// Composite-status classifier result (services/ml.js), separate from
// /status above (which reports rule-based per-parameter normal/not_normal
// evaluation). `available: false` is a routine state - not an error - for
// as long as fewer than a full window of complete readings exists (e.g.
// while the CO2/lux/temperature/humidity sensors are uninstalled, see
// ml-service/README.md), so this returns 200 rather than 404.
router.get("/:deviceId/prediction", async (req, res, next) => {
  try {
    const device = await loadDeviceOr404(req, res);
    if (!device) return;

    const prediction = await getLatestPrediction(device.id);
    if (!prediction) return res.json({ available: false });

    res.json({
      available: true,
      time: prediction.time,
      label: prediction.label,
      class_index: prediction.class_index,
      probabilities: prediction.probabilities,
      model_version: prediction.model_version,
    });
  } catch (err) {
    next(err);
  }
});

// TEMPORARY diagnostic route, re-added 2026-09-13 (same as the one
// removed after the 232909/tf.data-threadpool debugging - see git
// history) - predictions went stale again after the 171018 model swap
// and mqtt.js's runPredictionStep() failures only go to a console we
// can't read on this shared cPanel host. Mirrors that function
// read-only (no DB insert/broadcast/push). Remove once diagnosed.
router.get("/:deviceId/prediction/debug-run", async (req, res, next) => {
  try {
    const device = await loadDeviceOr404(req, res);
    if (!device) return;

    const readings = await getRecentReadings(device.id, ML_PREDICTION_WINDOW_SIZE);
    const windowPayload = buildWindowPayload(readings);

    if (!windowPayload) {
      return res.json({
        step: "buildWindowPayload",
        result: "null (skipped)",
        readingsFound: readings.length,
        windowSize: ML_PREDICTION_WINDOW_SIZE,
        lastReadingSample: readings[readings.length - 1] ?? null,
      });
    }

    try {
      const prediction = await requestPrediction(windowPayload);
      res.json({ step: "requestPrediction", result: "success", prediction });
    } catch (err) {
      res.json({
        step: "requestPrediction",
        result: "error",
        errorMessage: err.message,
        errorStack: err.stack,
      });
    }
  } catch (err) {
    next(err);
  }
});

// Alert history for the mobile Notifikasi screen - rule-based
// per-parameter `alerts` rows. These no longer drive push notifications
// themselves (see services/mqtt.js sendPredictionAlertNotification, which
// pushes on the composite AI label entering Peringatan/Bahaya instead).
// Newest first; `resolvedAt: null` means still out of range. Separate from
// /status above (that one only reports the *current* per-parameter
// normal/not_normal snapshot, not a browsable history).
router.get("/:deviceId/notifications", async (req, res, next) => {
  try {
    const device = await loadDeviceOr404(req, res);
    if (!device) return;

    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, NOTIFICATIONS_MAX_LIMIT)
      : NOTIFICATIONS_DEFAULT_LIMIT;

    const rows = await getAlertHistory(device.id, limit);
    const notifications = rows.map((row) => {
      const threshold = row.threshold_id
        ? { min_value: row.min_value, max_value: row.max_value }
        : null;
      const { direction, recommendation } = describeAlert(row.parameter, row.value, threshold);
      return {
        id: row.id,
        parameter: row.parameter,
        value: row.value,
        direction,
        recommendation,
        triggeredAt: row.triggered_at,
        resolvedAt: row.resolved_at,
      };
    });

    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

export default router;
