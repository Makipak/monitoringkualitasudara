#ifndef SENSORS_MICS4514_H
#define SENSORS_MICS4514_H

// NO2 via MiCS-4514 (Seeed Grove Multichannel Gas Sensor v2 module), I2C.
// Library: seeed-studio/Seeed Arduino MultiGas.
//
// Note: MiCS-4514 needs a burn-in/pre-heat period (can be hours on first
// power-up per datasheet) before readings stabilize — expect noisy NO2
// values during initial bring-up/testing, this is sensor behavior, not a
// firmware bug.

bool mics4514Init();

bool mics4514Read(float &no2PpmOut);

#endif // SENSORS_MICS4514_H
