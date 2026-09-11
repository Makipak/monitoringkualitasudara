#include "mics4514.h"

#include <Arduino.h>
#include <Wire.h>

// This board speaks DFRobot's DFRobot_MICS register protocol - see
// mics4514.h comment for why (found after an extended bring-up
// investigation: Seeed's own command protocol only ever produced a
// frozen value, DFRobot's register protocol produced live, drifting
// data). Address + register map + ppm formula below are all taken
// directly from github.com/DFRobot/DFRobot_MICS (DFRobot_MICS.h/.cpp),
// reimplemented here rather than adding that library as a dependency,
// since only this one board's NO2/OX channel is needed.
namespace {
constexpr uint8_t MICS_I2C_ADDR = 0x75; // DFRobot's MICS_ADDRESS_0
constexpr uint8_t REG_OX_HIGH = 0x04;   // OX_HIGH,OX_LOW,RED_HIGH,RED_LOW,POWER_HIGH,POWER_LOW - 6 consecutive registers
constexpr uint8_t REG_POWER_MODE = 0x0a;
constexpr uint8_t MODE_WAKE_UP = 0x01;

// Bus selection — see mics4514.h. ESP32-S3 gets a dedicated Wire1 bus for
// this sensor (config.h PIN_MICS_SDA/PIN_MICS_SCL, begin() called from
// sensors.cpp's sensorsInit()); the ESP32 DevKitC V4 target shares the
// single main Wire bus with SGP30/BH1750/SHT31, as before.
#if CONFIG_IDF_TARGET_ESP32S3
TwoWire &micsWire = Wire1;
#else
TwoWire &micsWire = Wire;
#endif

int readRegisters(uint8_t reg, uint8_t *data, uint8_t len) {
  micsWire.beginTransmission(MICS_I2C_ADDR);
  micsWire.write(reg);
  if (micsWire.endTransmission() != 0) {
    return -1; // write itself failed (NACK / bus error)
  }
  micsWire.requestFrom(static_cast<int>(MICS_I2C_ADDR), static_cast<int>(len));
  int i = 0;
  while (micsWire.available() && i < len) {
    data[i++] = micsWire.read();
  }
  return i;
}

bool writeRegister(uint8_t reg, uint8_t value) {
  micsWire.beginTransmission(MICS_I2C_ADDR);
  micsWire.write(reg);
  micsWire.write(value);
  return micsWire.endTransmission() == 0;
}

// One burst read matching DFRobot's own getSensorData() - OX and POWER
// are what NO2 needs; RED (CO) isn't used by this project (CO/TVOC
// aren't among the 7 official parameters from this board - TVOC comes
// from the separate SGP30) but costs nothing extra since it comes back
// in the same 6-byte transaction, so it's kept for visibility in the
// calibration log.
bool readOxRedPower(uint16_t &ox, uint16_t &red, uint16_t &power) {
  uint8_t buf[6] = {0, 0, 0, 0, 0, 0};
  if (readRegisters(REG_OX_HIGH, buf, 6) != 6) {
    return false;
  }
  ox = (static_cast<uint16_t>(buf[0]) << 8) | buf[1];
  red = (static_cast<uint16_t>(buf[2]) << 8) | buf[3];
  power = (static_cast<uint16_t>(buf[4]) << 8) | buf[5];
  return true;
}

// --- NO2 (OX channel) calibration ---------------------------------------
//
// R0 baseline - DFRobot's own library computes this the same way:
// power - ox, captured once after burn-in completes in clean air (see
// DFRobot_MICS.cpp warmUpTime()). Varies per physical unit (per the
// MiCS-4514 datasheet, R0 spans 0.8-20 kOhm across units in the real
// underlying resistance this proxies for) - this MUST be re-measured if
// the sensor is ever replaced.
//
// MEASURED 2026-08-26: ~3.2 hours of burn-in (device on an outdoor
// porch/teras - not traffic-adjacent, reasonable NO2-free proxy given no
// lab reference gas is available for this project), logged via
// `pio device monitor -f log2file` to firmware/logs/. Rolling average
// converged and stayed consistent across every window checked:
// 5min=797.4, 30min=799.3, 1hr=797.7, full 3.2hr=800.2 (range 775.8-816.8,
// i.e. normal sensor noise, not ongoing drift) - averaged to 799.
constexpr int32_t NO2_R0_PLACEHOLDER = 799;
constexpr bool NO2_IS_CALIBRATED = true;

// Ratio-to-ppm formula - DFRobot_MICS.cpp getNitrogenDioxide(). This is
// now the board's actual vendor/protocol formula, not a cross-vendor
// approximation (see mics4514.h comment on why DFRobot's protocol
// applies here instead of Seeed's).
constexpr float NO2_FORMULA_OFFSET = 0.045f;
constexpr float NO2_FORMULA_SCALE = 6.13f;
// MiCS-4514 OX/NO2 documented detection range (SGX datasheet) - also
// matches DFRobot's own output clamp: DFRobot_MICS.cpp only clamps the
// resulting ppm (values below 0.1 -> 0), it does NOT floor the input
// `ratio` itself. An earlier version of this file added an extra
// `ratio < 1.1` gate on top of that, not sourced from DFRobot's actual
// library (verified 2026-08-26 by reading DFRobot_MICS.cpp directly) -
// removed because it silently zeroed real, formula-valid readings in
// roughly the ratio 0.66-1.1 range (ppm 0.1-0.14), which is exactly
// where this physical sensor's calibrated ambient baseline (~0.9-1.0)
// sits, so NO2 always read 0 even though the formula had a real answer.
constexpr float NO2_RANGE_MIN_PPM = 0.1f;
constexpr float NO2_RANGE_MAX_PPM = 10.0f;
} // namespace

bool mics4514Init() {
  micsWire.beginTransmission(MICS_I2C_ADDR);
  bool ok = (micsWire.endTransmission() == 0);
  if (!writeRegister(REG_POWER_MODE, MODE_WAKE_UP)) {
    Serial.println("[NO2] init: wake-up write failed (I2C NACK/bus busy)");
  }
  delay(100);
  return ok;
}

bool mics4514Read(float &no2PpmOut) {
  // Re-send wake-up before every read, not just once at init. Found
  // 2026-08-26: right after main.cpp was restored to run all sensors
  // together, ox/red/power all came back 0 (a *successful* 6-byte I2C
  // read, not a comms failure) - meaning the chip's own interface
  // controller was still asleep, most likely because the one-time
  // wake-up write in mics4514Init() silently NACK'd while several other
  // I2C sensors were also being begin()'d back-to-back in sensorsInit()
  // (unlike the standalone calibration sketch, which had this chip alone
  // on the bus). Resending costs one cheap extra I2C write every
  // SENSOR_READ_INTERVAL_MS and self-heals if a wake-up write is ever
  // dropped again.
  if (!writeRegister(REG_POWER_MODE, MODE_WAKE_UP)) {
    Serial.println("[NO2] wake-up re-send failed (I2C NACK/bus busy)");
  }

  uint16_t ox = 0, red = 0, power = 0;
  if (!readOxRedPower(ox, red, power)) {
    Serial.println("[NO2] read failed (I2C error)");
    no2PpmOut = 0.0f;
    return false;
  }

  // DFRobot's own proxy for Rs on the OX (NO2) channel - not a real
  // resistance in ohms, just an internally-consistent value as long as
  // it's computed the same way for the R0 baseline and every runtime
  // read (same reasoning as the earlier voltage-ratio approach, just
  // using this board's actual native quantity instead).
  int32_t powerMinusOx = static_cast<int32_t>(power) - static_cast<int32_t>(ox);
  float ratio = static_cast<float>(powerMinusOx) / static_cast<float>(NO2_R0_PLACEHOLDER);

  // DFRobot_MICS.cpp's getNitrogenDioxide(), unmodified - always evaluate
  // the formula, only clamp the resulting ppm (see NO2_RANGE_MIN_PPM's
  // comment above for why there's no separate floor on `ratio` itself).
  float ppm = (ratio - NO2_FORMULA_OFFSET) / NO2_FORMULA_SCALE;
  if (ppm < NO2_RANGE_MIN_PPM) ppm = 0.0f;
  if (ppm > NO2_RANGE_MAX_PPM) ppm = NO2_RANGE_MAX_PPM;
  no2PpmOut = ppm;

  Serial.print("[NO2] ox=");
  Serial.print(ox);
  Serial.print(" red=");
  Serial.print(red);
  Serial.print(" power=");
  Serial.print(power);
  Serial.print(" power-ox=");
  Serial.print(powerMinusOx);
  Serial.print(" ratio=");
  Serial.print(ratio, 4);
  if (!NO2_IS_CALIBRATED) {
    Serial.print("  -- NOT CALIBRATED, see mics4514.cpp NO2_R0_PLACEHOLDER");
  }
  Serial.println();

  return true;
}
