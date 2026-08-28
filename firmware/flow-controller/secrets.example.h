#pragma once

#define API_ORIGIN "https://YOUR-DEV-DOMAIN.replit.dev"

// Generate once with: openssl rand -hex 32
// Enter this same key in ColdStreak Settings > Device to claim the controller.
#define DEVICE_ID "coldstreak-flow-001"
#define DEVICE_PAIRING_KEY "replace-with-at-least-32-random-characters"

// PEM root CA for API_ORIGIN. Do not use setInsecure() on a safety-adjacent device.
static const char SERVER_ROOT_CA[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
replace-with-the-current-root-ca
-----END CERTIFICATE-----
)EOF";