#include "pms5003.h"

#include <HardwareSerial.h>
#include <PMS.h>

#include "../../include/config.h"

namespace {
HardwareSerial pmsSerial(2); // ESP32 UART2
PMS pms(pmsSerial);
PMS::DATA pmsData;
} // namespace

void pms5003Init() {
  pmsSerial.begin(9600, SERIAL_8N1, PIN_PMS_RX, PIN_PMS_TX);
  pms.passiveMode(); // request-on-demand instead of continuous streaming,
                      // reduces UART buffer buildup between reads.
}

bool pms5003Read(float &pm25Out, float &pm10Out) {
  pms.requestRead();

  // Blocking wait is bounded — PMS::readUntil has its own internal timeout.
  if (!pms.readUntil(pmsData)) {
    return false;
  }

  pm25Out = static_cast<float>(pmsData.PM_AE_UG_2_5);
  pm10Out = static_cast<float>(pmsData.PM_AE_UG_10_0);
  return true;
}
