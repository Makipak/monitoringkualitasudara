#ifndef SENSORS_SDS011_H
#define SENSORS_SDS011_H

// PM2.5 / PM10 via Nova Fitness SDS011 over UART1.
// Replaces the originally planned PMS5003 (architecture.md 2.1 "Catatan
// penggantian sensor PM2.5/PM10") — SDS011 has its own UART packet
// format, not compatible with the PMS library used before.
// Library: lewapek/SdsDustSensor (see platformio.ini lib_deps).

void sds011Init();

// Returns true if a fresh reading was obtained; pm25Out/pm10Out are only
// written on success (ug/m3).
bool sds011Read(float &pm25Out, float &pm10Out);

#endif // SENSORS_SDS011_H
