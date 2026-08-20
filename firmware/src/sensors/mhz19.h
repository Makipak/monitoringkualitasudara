#ifndef SENSORS_MHZ19_H
#define SENSORS_MHZ19_H

// CO2 via Winsen MH-Z19B over UART2.
// Replaces the originally planned SCD30 (I2C) — see architecture.md 2.1
// "Catatan penggantian sensor CO2". Losing SCD30's onboard temperature/
// humidity output doesn't matter here: room temperature is handled
// separately by GY-SHT31 (src/sensors/sht31.h), and humidity isn't an
// official parameter (prd.md/schema.md).
// Library: wifwaf/MH-Z19 (see platformio.ini lib_deps).

void mhz19Init();

// Returns true if a plausible reading was obtained (library returns 0 on
// communication failure). co2PpmOut is only written on success.
bool mhz19Read(float &co2PpmOut);

#endif // SENSORS_MHZ19_H
