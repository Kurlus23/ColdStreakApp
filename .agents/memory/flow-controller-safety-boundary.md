---
name: Flow controller safety boundary
description: Durable safety and onboarding rules for the ColdStreak ESP32 flow controller.
---

The ESP32 must remain the local safety authority. It boots with pump/chiller
outputs off, filters flow locally, warns at 70% of learned normal flow, and
shuts down locally for sustained low flow, invalid/stale sensor data, or
watchdog reset. App, Wi-Fi, and server availability must never be required for
shutdown.

**Why:** A cloud or phone dependency can fail precisely when equipment
protection is needed. The user also chose Bluetooth-first ownership setup,
followed by Wi-Fi telemetry and alerts.

**How to apply:** Pair nearby over BLE, authorize through the signed-in account,
then allow the controller to poll for approval and report over Wi-Fi. Before
baseline learning, instruct installers to clean the strainer and verify or
replace filters so restricted flow is not learned as normal. Keep prototype
work in DEV until the user explicitly approves production.