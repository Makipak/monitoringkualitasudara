#ifndef SENSORS_SCD30_H
#define SENSORS_SCD30_H

// CO2 (and onboard temp/humidity, unused here) via Sensirion SCD30, I2C.
// Library: sensirion/Sensirion I2C SCD30.

bool scd30Init();

// Returns true only when a new measurement was ready and read successfully.
bool scd30Read(float &co2PpmOut);

#endif // SENSORS_SCD30_H
