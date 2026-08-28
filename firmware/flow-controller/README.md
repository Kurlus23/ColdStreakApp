# ColdStreak ESP32 flow controller prototype

This firmware reads the ScioSense UFM-02 over SPI and drives one Digital
Loggers IoT Relay trigger. The one relay is treated as a shared safety cutoff
for the pump and chiller. If independent pump/chiller control is required,
use separately rated, isolated outputs and update the state model first.

## Safety boundary

- The relay output boots **off** and cannot be enabled remotely.
- A local pushbutton starts the output. A fault requires a deliberate
  three-second local hold before restart.
- Readings use an exponential filter. Flow below 70% of the learned baseline
  warns after 2 seconds and trips after 8 seconds.
- Missing/invalid sensor data trips locally after 3 seconds.
- Loss of Wi-Fi, the API, or the app does not disable local sensor monitoring
  or shutdown logic. Telemetry resumes when the connection returns.
- The task watchdog resets a stuck controller; reset returns to outputs off.

This is prototype firmware, not certified electrical protection. Confirm the
relay revision, motor/compressor inrush rating, GFCI protection, enclosure,
grounding, and mains installation with a qualified electrician before
connecting a pump or chiller.

## Verified UFM-02 wiring

The official ScioSense Arduino library specifies a 5 V sensor supply and 3.3 V
I/O. Its ESP32 SPI example uses:

| UFM-02 | ESP32 |
|---|---|
| VCC | 5 V |
| GND | GND |
| CS | GPIO 5 |
| MO | GPIO 23 |
| SCK | GPIO 18 |
| MI | GPIO 19 |
| INT | GPIO 2 |

The relay trigger input is connected to GPIO 26 and ground. The local
enable/reset pushbutton connects GPIO 27 to ground.

## Setup

1. Clean the system strainer and inspect/change filters before learning normal
   flow. A restricted filter can teach an unsafe baseline.
2. Install the official `ScioSense_UFM02` Arduino library.
3. Copy `secrets.example.h` to `secrets.h`; fill in the **DEV** API origin, a
   unique device ID, a random 32-byte pairing key, and the API origin's current
   root CA. Do not point the prototype at production. Customer Wi-Fi is entered
   in the app and sent directly to the ESP32 over BLE; the server never receives it.
4. Flash the ESP32 and open the serial console at 115200 baud.
5. In ColdStreak DEV, sign in and open **Settings → Device**. Tap **Find
   nearby controller over Bluetooth**. The app reads the identity/key locally
   and claims the device to that account. The controller then polls the DEV API
   until authorization is granted before it publishes telemetry.
6. With mains loads disconnected, verify boot-off, button start/stop, a short
   flow dip, sustained low-flow shutdown, sensor disconnect, Wi-Fi loss, and
   reboot behavior before connecting real equipment.

Sources:

- ScioSense UFM-02 datasheet, revision 9 (2026-06-08):
  https://www.sciosense.com/wp-content/uploads/2026/06/SC-002732-DS-9-UFM-02-Datasheet.pdf
- Official ScioSense Arduino library:
  https://github.com/sciosense/ufm02-arduino
- Digital Loggers IoT Relay II FAQ:
  https://www.digital-loggers.com/iot2faqs.html