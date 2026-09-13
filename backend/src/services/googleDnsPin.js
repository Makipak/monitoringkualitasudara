// DNS-pinning workaround for shared cPanel hosting's restrictive
// firewall - see config.js's GOOGLE_API_DNS_PIN_IP comment for the full
// story (the host's automated abuse-detection firewall blocks most of
// Google's anycast IP space and won't do a blanket allowlist; only a
// small stable range - Google's "Private Google Access",
// private.googleapis.com, 199.36.153.8/30 - can realistically be
// whitelisted long-term).
//
// This module has one job: once that stable IP is whitelisted and
// configured via GOOGLE_API_DNS_PIN_IP, make every *.googleapis.com DNS
// lookup in this process resolve to it directly, instead of the normal
// (and on this host, mostly-blocked) rotating anycast pool. Google's
// edge routes purely on the TLS SNI / HTTP Host header, not the literal
// IP connected to, so pinning the IP while leaving the hostname/SNI
// alone reaches the correct real service (oauth2.googleapis.com,
// fcm.googleapis.com, etc.) exactly as normal DNS resolution would.
//
// Patches the global `dns.lookup`/`dns.promises.lookup` used by
// Node's own net/undici internals (confirmed via a real stack trace on
// this host: fetch() failures bottom out in node:net's
// internalConnectMultiple, which is fed by dns.lookup) - this is
// intentionally global and low-level rather than per-library, since
// firebase-admin (google-auth-library/gaxios) gives no simple hook to
// inject a custom DNS resolver or HTTPS agent into its internal HTTP
// client.
//
// Import this once, for its side effect, before anything makes a
// googleapis.com request (see index.js) - no-ops entirely when
// GOOGLE_API_DNS_PIN_IP isn't set (the normal case everywhere except
// this specific host).
import dns from "node:dns";
import { GOOGLE_API_DNS_PIN_IP } from "../config.js";

const GOOGLE_HOST_SUFFIX = ".googleapis.com";

function isPinnedHost(hostname) {
  return hostname === "googleapis.com" || hostname.endsWith(GOOGLE_HOST_SUFFIX);
}

export function installGoogleDnsPin() {
  if (!GOOGLE_API_DNS_PIN_IP) return; // no-op - see config.js comment

  const originalLookup = dns.lookup;
  const originalPromisesLookup = dns.promises.lookup;

  dns.lookup = function pinnedLookup(hostname, options, callback) {
    if (!isPinnedHost(hostname)) {
      return originalLookup.call(dns, hostname, options, callback);
    }
    const cb = typeof options === "function" ? options : callback;
    const wantsAll = typeof options === "object" && options !== null && options.all;
    const result = wantsAll ? [{ address: GOOGLE_API_DNS_PIN_IP, family: 4 }] : GOOGLE_API_DNS_PIN_IP;
    // Async per dns.lookup()'s own contract - callers must not receive a
    // synchronous callback.
    process.nextTick(() => (wantsAll ? cb(null, result) : cb(null, result, 4)));
  };

  dns.promises.lookup = function pinnedPromisesLookup(hostname, options) {
    if (!isPinnedHost(hostname)) {
      return originalPromisesLookup.call(dns.promises, hostname, options);
    }
    const wantsAll = typeof options === "object" && options !== null && options.all;
    return Promise.resolve(
      wantsAll ? [{ address: GOOGLE_API_DNS_PIN_IP, family: 4 }] : { address: GOOGLE_API_DNS_PIN_IP, family: 4 },
    );
  };

  console.log(`[googleDnsPin] *.googleapis.com DNS lookups pinned to ${GOOGLE_API_DNS_PIN_IP}`);
}
