#include "sds011.h"

#include <HardwareSerial.h>
#include <SdsDustSensor.h>

#include "../../include/config.h"

namespace {
HardwareSerial sdsSerial(1); // ESP32 UART1
SdsDustSensor sds(sdsSerial);
} // namespace

void sds011Init() {
  sdsSerial.begin(9600, SERIAL_8N1, PIN_SDS011_RX, PIN_SDS011_TX);
  sds.begin();
  sds.setQueryReportingMode(); // request-on-demand instead of continuous
                                // streaming, same rationale as the PMS5003
                                // passive-mode setting it replaces.
  sds.wakeup();
}

bool sds011Read(float &pm25Out, float &pm10Out) {
  PmResult pm = sds.queryPm();
  if (!pm.isOk()) {
    return false;
  }

  pm25Out = pm.pm25;
  pm10Out = pm.pm10;
  return true;
}
