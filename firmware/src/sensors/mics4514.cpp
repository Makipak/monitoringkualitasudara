#include "mics4514.h"

#include <Multichannel_Gas_GMXXX.h>

namespace {
GAS_GMXXX<TwoWire> gas;
}

bool mics4514Init() {
  gas.begin(Wire, 0x08); // default I2C address for the Grove Multichannel
                          // Gas Sensor v2 carrier board
  return true;
}

bool mics4514Read(float &no2PpmOut) {
  // getGM102B() maps to the NO2-sensitive channel on this module; consult
  // the Seeed library docs to confirm the channel-to-gas mapping matches
  // your specific board revision before trusting this value.
  uint32_t raw = gas.getGM102B();
  no2PpmOut = static_cast<float>(raw) / 1000.0f; // placeholder conversion —
                                                  // replace with the
                                                  // datasheet curve/calibration.
  return true;
}
