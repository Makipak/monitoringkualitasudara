#ifndef SENSORS_MICS4514_H
#define SENSORS_MICS4514_H

// NO2 via MiCS-4514 (Grove Multichannel Gas Sensor v2 carrier board), I2C.
//
// Bus: shares the main I2C bus (Wire, config.h PIN_I2C_*) on the ESP32
// DevKitC V4 target. On the ESP32-S3 target it gets its own dedicated bus
// instead (Wire1, config.h PIN_MICS_SDA/PIN_MICS_SCL) — found necessary
// during ESP32-S3 bring-up, see mics4514.cpp — selected automatically via
// CONFIG_IDF_TARGET_ESP32S3, same pattern as config.h's pin map.
//
// IMPORTANT (found 2026-08-26 after an extended bring-up investigation):
// this physical board speaks DFROBOT's DFRobot_MICS register protocol
// (github.com/DFRobot/DFRobot_MICS), NOT Seeed's Multichannel_Gas_GMXXX
// command protocol, despite being sold/wired as a Seeed Grove board.
// Confirmed via the board's I2C address (0x75 = DFRobot's documented
// MICS_ADDRESS_0, not Seeed's documented default of 0x08) and by
// directly testing DFRobot's exact register read sequence, which
// produced live, drifting OX/RED values (real heater warm-up behavior)
// where Seeed's own command protocol only ever produced a frozen value.
// Do not switch this back to the Seeed library/protocol.
//
// Note: MiCS-4514 needs a burn-in/pre-heat period (can be hours on first
// power-up per datasheet) before readings stabilize — expect noisy NO2
// values during initial bring-up/testing, this is sensor behavior, not a
// firmware bug.
//
// Reported ppm uses DFRobot's own published formula (DFRobot_MICS.cpp
// getNitrogenDioxide() - this is the ACTUAL vendor/protocol for this
// board, not a cross-vendor approximation). R0 has been measured for
// this physical sensor (see NO2_R0_PLACEHOLDER's comment in
// mics4514.cpp for the measurement date/conditions) - still a
// single-point field calibration against ambient outdoor air, not a
// lab/reference-gas calibration, so treat ppm values as indicative
// rather than certified-precise. Re-measure if the sensor is replaced.

bool mics4514Init();

bool mics4514Read(float &no2PpmOut);

#endif // SENSORS_MICS4514_H
