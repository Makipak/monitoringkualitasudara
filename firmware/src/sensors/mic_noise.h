#ifndef SENSORS_MIC_NOISE_H
#define SENSORS_MIC_NOISE_H

// Sound level (approximate dB) via MAX9814 electret mic amp, analog output.
// No library needed — reads ADC envelope and converts to an approximate
// dB(SPL)-like value. This is NOT a calibrated sound level meter; treat it
// as a relative/comparative indicator unless calibrated against a
// reference meter (log this caveat wherever noise_db is displayed/used).

void micNoiseInit();

float micNoiseRead();

#endif // SENSORS_MIC_NOISE_H
