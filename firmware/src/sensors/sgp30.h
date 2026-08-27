#ifndef SENSORS_SGP30_H
#define SENSORS_SGP30_H

bool sgp30Init();

// Must be called every loop() iteration (non-blocking); internally
// rate-limited to 1Hz to satisfy SGP30's required constant sampling
// interval for its dynamic baseline algorithm. Calling IAQmeasure() at
// any other interval prevents the baseline from converging, causing
// TVOC to spike then drop back to 0 — this fixes that exact symptom.
void sgp30Update();

// Returns the most recent TVOC reading captured by sgp30Update().
bool sgp30Read(float &tvocPpbOut);

#endif // SENSORS_SGP30_H