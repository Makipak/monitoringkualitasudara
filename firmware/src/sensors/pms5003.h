#ifndef SENSORS_PMS5003_H
#define SENSORS_PMS5003_H

// PM2.5 / PM10 via Plantower PMS5003 over UART.
// Library: fu-hsi/PMS (see platformio.ini lib_deps).

void pms5003Init();

// Returns true if a fresh frame was read within this call; pm25Out/pm10Out
// are only written on success (ug/m3, atmospheric-environment value).
bool pms5003Read(float &pm25Out, float &pm10Out);

#endif // SENSORS_PMS5003_H
