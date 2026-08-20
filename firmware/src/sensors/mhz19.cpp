#include "mhz19.h"

#include <HardwareSerial.h>
#include <MHZ19.h>

#include "../../include/config.h"

namespace {
HardwareSerial mhzSerial(2); // ESP32 UART2
MHZ19 mhz19;
} // namespace

void mhz19Init() {
  mhzSerial.begin(9600, SERIAL_8N1, PIN_MHZ19_RX, PIN_MHZ19_TX);
  mhz19.begin(mhzSerial);
  mhz19.autoCalibration(false); // ABC calibration assumes the sensor sees
                                 // fresh outdoor-level air periodically,
                                 // not a safe assumption for an enclosed
                                 // hospital room — disable and rely on the
                                 // factory calibration instead.
}

bool mhz19Read(float &co2PpmOut) {
  int co2 = mhz19.getCO2();
  if (mhz19.errorCode != RESULT_OK) {
    return false;
  }
  co2PpmOut = static_cast<float>(co2);
  return true;
}
