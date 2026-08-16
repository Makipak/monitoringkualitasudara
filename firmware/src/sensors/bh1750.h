#ifndef SENSORS_BH1750_H
#define SENSORS_BH1750_H

// Ambient light (lux) via BH1750, I2C. Library: claws/BH1750.

bool bh1750SensorInit();

bool bh1750Read(float &luxOut);

#endif // SENSORS_BH1750_H
