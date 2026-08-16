#ifndef NETWORK_WIFI_CONN_H
#define NETWORK_WIFI_CONN_H

void wifiInit();

// Non-blocking: kicks off a (re)connect attempt if not already connected
// and the reconnect interval has elapsed. Call every loop() iteration.
void wifiMaintain();

bool wifiIsConnected();

#endif // NETWORK_WIFI_CONN_H
