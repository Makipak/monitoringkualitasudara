#ifndef SENSORS_MHZ19C_H
#define SENSORS_MHZ19C_H

// CO2 via UART2, using the wifwaf/MH-Z19 Arduino library (see platformio.ini
// lib_deps). Replaces the originally planned SCD30 (I2C) — see
// architecture.md 2.1 "Catatan penggantian sensor CO2". Losing SCD30's
// onboard temperature/humidity output doesn't matter here: room
// temperature is handled separately by GY-SHT31 (src/sensors/sht31.h),
// and humidity isn't an official parameter (prd.md/schema.md).
//
// Hardware history on this pin (see git history for the prior
// mhz19.{h,cpp} / mwd1006.{h,cpp} implementations if this ever needs
// cross-referencing):
//   1. Originally planned: SCD30 (I2C).
//   2. Sourced as a genuine Winsen MH-Z19B, but the physical unit that
//      arrived (2026-08-27 bring-up) turned out to actually be a Huiwen
//      MWD1006 — a different vendor's NDIR module that happens to share
//      MH-Z19's public UART command subset. Driver was renamed to
//      mwd1006.{h,cpp} to match at the time.
//   3. That MWD1006 unit later stopped working, so it was replaced
//      (2026-09-01) with a genuine Winsen **MH-Z19C** — confirmed against
//      Winsen's own MH-Z19C datasheet (v1.0, 2020.02.04): UART 9600
//      8N1/TTL, "read concentration" command 0x86 (Byte0..8:
//      FF 01 86 00 00 00 00 00 <checksum>, reply FF 86 HIGH LOW ...
//      <checksum>, ppm = HIGH*256+LOW), checksum = negate(sum of bytes
//      1..7)+1, and "ABC on/off" command 0x79 (byte3 0xA0 on / 0x00 off)
//      — byte-for-byte identical to what mwd1006.cpp was already sending,
//      so no protocol-level code changes were needed, only this rename
//      back to a chip-accurate filename.
//
// `getCO2(false)` (command 0x86, "CO2 limited") is used rather than the
// library's default `getCO2()` (isunLimited=true, command 0x85, "CO2
// unlimited") — see mhz19c.cpp. 0x85 was never a problem on this genuine
// Winsen part (unlike the old MWD1006 clone, which silently answered 0
// for it), but 0x86 is the only read-concentration command the MH-Z19C
// datasheet actually documents, so it's kept as the one being relied on.
//
// Preheat: MH-Z19C datasheet specifies 1 minute preheat time, response
// T90 < 120s — faster than the ~2 minute minimum the old MWD1006 unit's
// datasheet called for. No explicit warm-up delay is implemented in
// firmware (readings are taken on the normal SENSOR_READ_INTERVAL_MS
// tick from boot) — early post-boot readings may be inaccurate during
// that first ~1-2 minutes, same as before.

void mhz19cInit();

// Returns true if a plausible reading was obtained (library returns 0 on
// communication failure). co2PpmOut is only written on success.
bool mhz19cRead(float &co2PpmOut);

#endif // SENSORS_MHZ19C_H
