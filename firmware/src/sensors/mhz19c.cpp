#include "mhz19c.h"

#include <HardwareSerial.h>
#include <MHZ19.h>

#include "../../include/config.h"

// The MHZ19 class comes from the wifwaf/MH-Z19 library — a direct match
// now that the physical module is a genuine Winsen MH-Z19C (see
// mhz19c.h for the hardware history on this pin).
namespace {
HardwareSerial co2Serial(2); // ESP32 UART2
MHZ19 co2Sensor;
} // namespace

void mhz19cInit() {
  co2Serial.begin(9600, SERIAL_8N1, PIN_MHZ19C_RX, PIN_MHZ19C_TX);
  co2Sensor.begin(co2Serial);
  co2Sensor.autoCalibration(false); // ABC calibration assumes the sensor
                                     // sees fresh outdoor-level air
                                     // periodically, not a safe assumption
                                     // for an enclosed hospital room —
                                     // disable and rely on the factory
                                     // calibration instead.
}

bool mhz19cRead(float &co2PpmOut) {
  // isunLimited=false: use command 0x86 ("CO2 limited"), the only
  // read-concentration command Winsen's MH-Z19C datasheet documents (the
  // library's getCO2() default, isunLimited=true, sends command 0x85 "CO2
  // unlimited" instead — an undocumented extension for this model, so
  // 0x86 is kept as the one being relied on). See mhz19c.h for why this
  // matters more than it might look: the prior physical unit on this pin
  // (a Huiwen MWD1006, not a genuine Winsen chip) silently answered 0 for
  // 0x85 without raising a comms error, which is what originally forced
  // this explicit isunLimited=false — kept unchanged now that the part is
  // a genuine MH-Z19C, since 0x86 is correct either way.
  int co2 = co2Sensor.getCO2(false);
  if (co2Sensor.errorCode != RESULT_OK) {
    Serial.print("[CO2] read failed, errorCode=");
    Serial.println(co2Sensor.errorCode); // RESULT_TIMEOUT=2, RESULT_MATCH=3, RESULT_CRC=4, RESULT_FILTER=5 (MHZ19.h)
    return false;
  }
  co2PpmOut = static_cast<float>(co2);
  return true;
}
