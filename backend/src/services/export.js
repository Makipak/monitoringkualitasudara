// Daily export file generation (prd.md section 9, resolved: XLSX = full
// raw readings + summary/hourly tables as real Excel sheets, PDF =
// readable summary/hourly tables - no charts, per user decision). Kept
// separate from routes/rooms.js (rule.md section 3: single-responsibility
// modules) - this module only turns already-loaded rows into file bytes,
// it does no I/O of its own. Reuses threshold.js's evaluateThresholds()
// for the Status column rather than re-deriving normal/out-of-range
// logic here, so the export always agrees with the alerts the rest of
// the app raises.
//
// XLSX was chosen over plain CSV (user decision) - write-excel-file was
// picked over the more famous `exceljs` after checking `npm install`
// output for both: exceljs pulls in a deep transitive tree with several
// npm-flagged-deprecated packages (glob@7, inflight, rimraf@2, ...),
// which rule.md's "no deprecated/unmaintained dependencies" rules out;
// write-excel-file adds zero extra dependencies.
import PDFDocument from "pdfkit";
import writeExcelFile from "write-excel-file/node";
import { OFFICIAL_PARAMETERS } from "../config.js";
import { evaluateThresholds } from "./threshold.js";

// Display metadata for the 7 official parameters - mirrors
// mobile/src/constants/parameters.ts's name/unit fields. Duplicated
// rather than shared because backend/ and mobile/ never share code
// (CLAUDE.md: sub-projects only talk over MQTT/REST), the same reason
// OFFICIAL_PARAMETERS itself is duplicated between config.js and
// parameters.ts.
const PARAMETER_LABELS = {
  pm25: { name: "PM2.5", short: "PM2.5", unit: "ug/m3" },
  pm10: { name: "PM10", short: "PM10", unit: "ug/m3" },
  no2: { name: "NO2", short: "NO2", unit: "ppm" },
  co2: { name: "CO2", short: "CO2", unit: "ppm" },
  tvoc: { name: "TVOC", short: "TVOC", unit: "ppb" },
  lux: { name: "Cahaya", short: "Lux", unit: "lux" },
  noise_db: { name: "Kebisingan", short: "dB", unit: "dB" },
};

// temperature/humidity are recorded and shown to the app just like the 7
// official parameters, but deliberately excluded from threshold
// evaluation/alerts (see backend/src/services/threshold.js's own
// OFFICIAL_PARAMETERS-only loop and firmware's roomTempC comment) -
// included in exports for completeness, with no Status column.
const EXTRA_LABELS = {
  temperature: { name: "Suhu Ruangan", unit: "C" },
  humidity: { name: "Kelembapan", unit: "%" },
};

const HOURS_IN_DAY = 24;

// Shared between the XLSX Status column (text color) and the PDF Status
// column (text color) - one palette so both files agree visually.
const STATUS_TONE_COLORS = { good: "#15803d", bad: "#b91c1c", muted: "#6b7280" };

function statsFor(values) {
  if (values.length === 0) return { avg: null, min: null, max: null };
  return {
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function valuesFor(readings, parameter) {
  return readings.map((r) => r[parameter]).filter((v) => v !== null && v !== undefined);
}

// Per-parameter avg/min/max for the day, plus a Normal/Tidak Normal
// status. Status is derived by re-running evaluateThresholds() over
// every individual reading (not just the daily average, which can mask
// a short spike) and counting how many were out of range - and fails
// safe the same way the rest of the backend does when a parameter has
// no `thresholds` row yet (sql/seed.sql deliberately doesn't seed one):
// no threshold configured means no normal/not-normal claim, not a
// silent "Normal".
export function summarizeReadings(readings, thresholds) {
  const outOfRangeCounts = Object.fromEntries(OFFICIAL_PARAMETERS.map((p) => [p, 0]));
  for (const reading of readings) {
    for (const alert of evaluateThresholds(reading, thresholds)) {
      outOfRangeCounts[alert.parameter] += 1;
    }
  }

  const rows = OFFICIAL_PARAMETERS.map((parameter) => {
    const values = valuesFor(readings, parameter);
    const { avg, min, max } = statsFor(values);
    const hasThreshold = thresholds.some((t) => t.parameter === parameter);

    let status;
    if (values.length === 0) status = { tone: "muted", label: "Tidak ada data" };
    else if (!hasThreshold) status = { tone: "muted", label: "Ambang belum diatur" };
    else if (outOfRangeCounts[parameter] > 0)
      status = { tone: "bad", label: `Tidak Normal (${outOfRangeCounts[parameter]}/${values.length})` };
    else status = { tone: "good", label: "Normal" };

    return { parameter, ...PARAMETER_LABELS[parameter], avg, min, max, count: values.length, status };
  });

  for (const parameter of Object.keys(EXTRA_LABELS)) {
    const values = valuesFor(readings, parameter);
    const { avg, min, max } = statsFor(values);
    rows.push({
      parameter,
      ...EXTRA_LABELS[parameter],
      avg,
      min,
      max,
      count: values.length,
      status: { tone: "muted", label: "-" },
    });
  }

  return rows;
}

// Hourly averages for the 7 official parameters, skipping hours with no
// readings at all (keeps the PDF table short instead of padding it with
// 24 rows on a day the device was mostly offline). Buckets by the
// export server's local time zone - same "no timezone config yet" gap
// as the rest of the backend (see grep for "Jakarta"/"timezone" turning
// up nothing outside this comment); revisit if the VPS's TZ ever
// diverges from the hospital's.
export function bucketByHour(readings) {
  const buckets = Array.from({ length: HOURS_IN_DAY }, () =>
    Object.fromEntries(OFFICIAL_PARAMETERS.map((p) => [p, []])),
  );

  for (const reading of readings) {
    const hour = new Date(reading.time).getHours();
    for (const parameter of OFFICIAL_PARAMETERS) {
      const value = reading[parameter];
      if (value !== null && value !== undefined) buckets[hour][parameter].push(value);
    }
  }

  return buckets
    .map((bucket, hour) => {
      const avg = {};
      let count = 0;
      for (const parameter of OFFICIAL_PARAMETERS) {
        count += bucket[parameter].length;
        avg[parameter] = bucket[parameter].length === 0 ? null : statsFor(bucket[parameter]).avg;
      }
      return { hour, avg, count };
    })
    .filter((bucket) => bucket.count > 0);
}

const XLSX_HEADER_FILL = "#f3f4f6";

function xlsxHeaderCell(text) {
  return { value: text, fontWeight: "bold", backgroundColor: XLSX_HEADER_FILL };
}

function xlsxNumberCell(value, decimals = 1) {
  return value === null ? null : { value, type: Number, format: `0.${"0".repeat(decimals)}` };
}

// "Ringkasan" sheet - same rows as the PDF's summary table, plus a
// Jumlah Data column (how many readings that average is based on) that
// the PDF leaves out for space.
function summarySheet(readings, thresholds) {
  const header = [
    xlsxHeaderCell("Parameter"),
    xlsxHeaderCell("Satuan"),
    xlsxHeaderCell("Rata-rata"),
    xlsxHeaderCell("Min"),
    xlsxHeaderCell("Maks"),
    xlsxHeaderCell("Jumlah Data"),
    xlsxHeaderCell("Status"),
  ];
  const rows = summarizeReadings(readings, thresholds).map((s) => [
    { value: s.name },
    { value: s.unit },
    xlsxNumberCell(s.avg),
    xlsxNumberCell(s.min),
    xlsxNumberCell(s.max),
    { value: s.count, type: Number },
    { value: s.status.label, textColor: STATUS_TONE_COLORS[s.status.tone], fontWeight: "bold" },
  ]);
  return {
    data: [header, ...rows],
    sheet: "Ringkasan",
    columns: [{ width: 20 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 24 }],
    stickyRowsCount: 1,
  };
}

// "Rata-rata per Jam" sheet - same hours as the PDF's hourly table
// (hours with zero readings skipped, see bucketByHour's comment).
function hourlySheet(readings) {
  const header = [xlsxHeaderCell("Jam"), ...OFFICIAL_PARAMETERS.map((p) => xlsxHeaderCell(PARAMETER_LABELS[p].short))];
  const rows = bucketByHour(readings).map((h) => [
    { value: `${String(h.hour).padStart(2, "0")}:00` },
    ...OFFICIAL_PARAMETERS.map((p) => xlsxNumberCell(h.avg[p])),
  ]);
  return {
    data: [header, ...rows],
    sheet: "Rata-rata per Jam",
    columns: [{ width: 8 }, ...OFFICIAL_PARAMETERS.map(() => ({ width: 10 }))],
    stickyRowsCount: 1,
  };
}

// "Data Mentah" sheet - every raw reading for the day, full resolution
// (unlike the two sheets above) - this is the sheet meant for further
// analysis/pivoting in Excel, so there is no "readability" pressure to
// collapse it down. `Waktu` is a real Excel Date cell (not text), so it
// sorts/filters correctly.
function rawSheet(readings) {
  const parameterKeys = [...OFFICIAL_PARAMETERS, ...Object.keys(EXTRA_LABELS)];
  const labelFor = (p) => PARAMETER_LABELS[p] ?? EXTRA_LABELS[p];
  const header = [
    xlsxHeaderCell("Waktu"),
    ...parameterKeys.map((p) => xlsxHeaderCell(`${labelFor(p).name} (${labelFor(p).unit})`)),
  ];
  const rows = readings.map((reading) => [
    { value: new Date(reading.time), type: Date, format: "yyyy-mm-dd hh:mm:ss" },
    ...parameterKeys.map((p) => xlsxNumberCell(reading[p] ?? null, 2)),
  ]);
  return {
    data: [header, ...rows],
    sheet: "Data Mentah",
    columns: [{ width: 20 }, ...parameterKeys.map(() => ({ width: 12 }))],
    stickyRowsCount: 1,
  };
}

// Builds the whole workbook as a Buffer - same "fine to hold the whole
// file in memory" reasoning as buildPdfBuffer() below (one day of one
// device, architecture.md's own ~1500-3000 rows/day estimate).
export async function buildXlsxBuffer({ readings, thresholds }) {
  return writeExcelFile(
    [summarySheet(readings, thresholds), hourlySheet(readings), rawSheet(readings)],
    { fontFamily: "Calibri", fontSize: 11 },
  ).toBuffer();
}

const PAGE_MARGIN = 40;
const TABLE_HEADER_HEIGHT = 18;
const TABLE_ROW_HEIGHT = 15;
const TABLE_FONT_SIZE = 8;
const INK = "#111827";
const MUTED_INK = "#374151";

// Draws one table starting at doc.y, adding pages (and repeating the
// header) as rows overflow the current page - pdfkit has no built-in
// table support, so this is the minimal version this report needs:
// left-aligned/right-aligned text columns with a header rule and a
// light divider under every row.
function drawTable(doc, { columns, rows }) {
  const left = doc.page.margins.left;
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);
  let y = doc.y;

  function drawHeaderRow() {
    doc.font("Helvetica-Bold").fontSize(TABLE_FONT_SIZE).fillColor(INK);
    let x = left;
    for (const col of columns) {
      doc.text(col.label, x + 2, y + 5, { width: col.width - 4, align: col.align ?? "left" });
      x += col.width;
    }
    doc.moveTo(left, y + TABLE_HEADER_HEIGHT).lineTo(left + tableWidth, y + TABLE_HEADER_HEIGHT).strokeColor(INK).lineWidth(1).stroke();
    y += TABLE_HEADER_HEIGHT;
  }

  drawHeaderRow();
  doc.font("Helvetica").fontSize(TABLE_FONT_SIZE);

  for (const row of rows) {
    if (y + TABLE_ROW_HEIGHT > pageBottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeaderRow();
      doc.font("Helvetica").fontSize(TABLE_FONT_SIZE);
    }
    let x = left;
    for (let i = 0; i < columns.length; i++) {
      const cell = row[i] ?? {};
      doc.fillColor(cell.color ?? INK).text(String(cell.text ?? "-"), x + 2, y + 4, {
        width: columns[i].width - 4,
        align: columns[i].align ?? "left",
      });
      x += columns[i].width;
    }
    doc.moveTo(left, y + TABLE_ROW_HEIGHT).lineTo(left + tableWidth, y + TABLE_ROW_HEIGHT).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += TABLE_ROW_HEIGHT;
  }

  doc.fillColor(INK);
  doc.y = y;
}

// Builds the whole report as a Buffer (the export is one day of one
// device, tens of KB at most, so buffering in memory rather than
// streaming straight to the response is fine at this project's scale -
// see architecture.md's own ~1500-3000 rows/day estimate).
export function buildPdfBuffer({ device, date, readings, thresholds }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: "A4",
      info: { Title: `Laporan Kualitas Udara ${device.device_id} ${date}` },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text("Laporan Kualitas Udara Harian");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).fillColor(MUTED_INK);
    doc.text(`Ruangan/Perangkat: ${device.device_id}`);
    doc.text(`Tanggal: ${date}`);
    doc.text(`Dibuat: ${new Date().toLocaleString("id-ID")}`);
    doc.moveDown(1);

    if (readings.length === 0) {
      doc.font("Helvetica").fontSize(11).fillColor(STATUS_TONE_COLORS.muted);
      doc.text("Tidak ada data pembacaan sensor untuk tanggal ini.");
      doc.end();
      return;
    }

    doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text("Ringkasan Parameter");
    doc.moveDown(0.4);

    const summary = summarizeReadings(readings, thresholds);
    const summaryColumns = [
      { label: "Parameter", width: 105 },
      { label: "Satuan", width: 55 },
      { label: "Rata-rata", width: 68, align: "right" },
      { label: "Min", width: 55, align: "right" },
      { label: "Maks", width: 55, align: "right" },
      { label: "Status", width: 137 },
    ];
    const summaryRows = summary.map((s) => [
      { text: s.name },
      { text: s.unit },
      { text: s.avg === null ? "-" : s.avg.toFixed(1) },
      { text: s.min === null ? "-" : s.min.toFixed(1) },
      { text: s.max === null ? "-" : s.max.toFixed(1) },
      { text: s.status.label, color: STATUS_TONE_COLORS[s.status.tone] },
    ]);
    drawTable(doc, { columns: summaryColumns, rows: summaryRows });

    doc.y += 20;
    doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text("Rata-rata per Jam", doc.page.margins.left, doc.y);
    doc.moveDown(0.4);

    const hourly = bucketByHour(readings);
    const hourlyColumns = [
      { label: "Jam", width: 40 },
      ...OFFICIAL_PARAMETERS.map((p) => ({ label: PARAMETER_LABELS[p].short, width: 65, align: "right" })),
    ];
    const hourlyRows = hourly.map((h) => [
      { text: `${String(h.hour).padStart(2, "0")}:00` },
      ...OFFICIAL_PARAMETERS.map((p) => ({ text: h.avg[p] === null ? "-" : h.avg[p].toFixed(1) })),
    ]);
    drawTable(doc, { columns: hourlyColumns, rows: hourlyRows });

    doc.end();
  });
}
