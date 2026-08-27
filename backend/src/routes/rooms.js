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
  getThresholds,
  getLatestPrediction,
} from "../services/db.js";
import { evaluateThresholds } from "../services/threshold.js";

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

router.get("/:deviceId/export", async (req, res, next) => {
  try {
    const device = await loadDeviceOr404(req, res);
    if (!device) return;

    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'query param "date" (YYYY-MM-DD) is required' });
    }
    const aggregate = await getDailyAggregate(device.id, date);
    res.json(aggregate ?? { day: date, message: "no readings for this date" });
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

    res.json({ time: reading.time, status, alerts: outOfRange });
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

export default router;
