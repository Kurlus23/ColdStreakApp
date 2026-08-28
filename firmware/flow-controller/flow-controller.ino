#include <Arduino.h>
#include <SPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <ScioSense_UFM02.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <esp_task_wdt.h>
#include "secrets.h"

// Verified against the official ScioSense ESP32 SPI example:
// UFM-02 VCC=5V, IO logic=3.3V, CS=5, MO=23, SCK=18, MI=19, INT=2.
static constexpr uint8_t PIN_UFM_INT = 2;
static constexpr uint8_t PIN_UFM_CS = 5;
static constexpr uint8_t PIN_RELAY = 26;
static constexpr uint8_t PIN_ENABLE_BUTTON = 27;
static constexpr bool RELAY_ACTIVE_HIGH = true;

static constexpr float LOW_FLOW_RATIO = 0.70f;
static constexpr uint32_t STARTUP_GRACE_MS = 15000;
static constexpr uint32_t WARNING_DELAY_MS = 2000;
static constexpr uint32_t TRIP_DELAY_MS = 8000;
static constexpr uint32_t SENSOR_STALE_MS = 3000;
static constexpr uint32_t TELEMETRY_INTERVAL_MS = 5000;
static constexpr uint32_t BUTTON_HOLD_RESET_MS = 3000;
static constexpr float FILTER_ALPHA = 0.25f;
static constexpr char FLOW_SERVICE_UUID[] = "8d6f0001-7f1a-4c9b-9a12-1f35c5d40001";
static constexpr char FLOW_DEVICE_ID_UUID[] = "8d6f0002-7f1a-4c9b-9a12-1f35c5d40001";
static constexpr char FLOW_PAIRING_KEY_UUID[] = "8d6f0003-7f1a-4c9b-9a12-1f35c5d40001";
static constexpr char FLOW_WIFI_SSID_UUID[] = "8d6f0004-7f1a-4c9b-9a12-1f35c5d40001";
static constexpr char FLOW_WIFI_PASSWORD_UUID[] = "8d6f0005-7f1a-4c9b-9a12-1f35c5d40001";
static constexpr char FLOW_PROVISION_UUID[] = "8d6f0006-7f1a-4c9b-9a12-1f35c5d40001";

enum SafetyState { BOOT_SAFE, NORMAL, WARNING, LOW_FLOW_TRIP, SENSOR_FAULT, MANUAL_OFF };

UFM02 sensor;
Preferences preferences;
WiFiClientSecure secureClient;

SafetyState safetyState = BOOT_SAFE;
bool outputEnabled = false;
bool sensorReady = false;
bool cloudAuthorized = false;
bool wifiProvisionRequested = false;
String wifiSSID;
String wifiPassword;
float filteredFlowLpm = 0;
float waterTempC = 0;
float normalFlowLpm = 0;
uint32_t outputStartedAt = 0;
uint32_t lowFlowStartedAt = 0;
uint32_t lastValidReadingAt = 0;
uint32_t lastTelemetryAt = 0;
uint32_t lastAuthorizationAt = 0;
uint32_t buttonPressedAt = 0;
uint32_t sequenceNumber = 0;
const char *faultCode = "boot_safe";

enum ProvisioningField { WIFI_SSID_FIELD, WIFI_PASSWORD_FIELD, PROVISION_COMMAND_FIELD };

class ProvisioningCallbacks : public BLECharacteristicCallbacks {
 public:
  explicit ProvisioningCallbacks(ProvisioningField field) : field(field) {}
  void onWrite(BLECharacteristic *characteristic) override {
    const std::string value = characteristic->getValue();
    if (field == WIFI_SSID_FIELD) wifiSSID = String(value.c_str());
    if (field == WIFI_PASSWORD_FIELD) wifiPassword = String(value.c_str());
    if (field == PROVISION_COMMAND_FIELD && value == "connect" && wifiSSID.length() && wifiPassword.length() >= 8) {
      preferences.putString("wifiSsid", wifiSSID);
      preferences.putString("wifiPass", wifiPassword);
      wifiProvisionRequested = true;
    }
  }
 private:
  ProvisioningField field;
};

const char *stateName(SafetyState state) {
  switch (state) {
    case BOOT_SAFE: return "boot_safe";
    case NORMAL: return "normal";
    case WARNING: return "warning";
    case LOW_FLOW_TRIP: return "low_flow_trip";
    case SENSOR_FAULT: return "sensor_fault";
    case MANUAL_OFF: return "manual_off";
  }
  return "sensor_fault";
}

void setOutput(bool enabled) {
  outputEnabled = enabled;
  digitalWrite(PIN_RELAY, (enabled == RELAY_ACTIVE_HIGH) ? HIGH : LOW);
}

void trip(SafetyState state, const char *code) {
  setOutput(false);
  safetyState = state;
  faultCode = code;
  lowFlowStartedAt = 0;
  Serial.printf("SAFETY TRIP: %s\n", code);
}

void startOutput() {
  if (!cloudAuthorized) {
    Serial.println("Output remains off until first-use account authorization succeeds.");
    return;
  }
  if (!sensorReady) {
    trip(SENSOR_FAULT, "sensor_invalid");
    return;
  }
  setOutput(true);
  outputStartedAt = millis();
  lastValidReadingAt = millis();
  lowFlowStartedAt = 0;
  safetyState = NORMAL;
  faultCode = nullptr;
}

void readSensor() {
  if (digitalRead(PIN_UFM_INT) != LOW) return;
  sensor.update();
  if (sensor.hasErrorFlag(UFM02_ERROR_FLAG_MEAS_NOT_OK) ||
      sensor.hasErrorFlag(UFM02_ERROR_FLAG_BUBBLES)) {
    if (outputEnabled && millis() - lastValidReadingAt > SENSOR_STALE_MS) {
      trip(SENSOR_FAULT, "sensor_invalid");
    }
    return;
  }

  const float rawFlowLpm = sensor.getInstantFlowLPerHr() / 60.0f;
  const float rawTempC = sensor.getTemperatureDegC();
  if (!isfinite(rawFlowLpm) || !isfinite(rawTempC) || rawFlowLpm < 0 || rawTempC < -5 || rawTempC > 80) {
    return;
  }

  filteredFlowLpm = lastValidReadingAt == 0
    ? rawFlowLpm
    : FILTER_ALPHA * rawFlowLpm + (1.0f - FILTER_ALPHA) * filteredFlowLpm;
  waterTempC = rawTempC;
  lastValidReadingAt = millis();

  // Learn upward readily, but decay very slowly so a blockage cannot teach the
  // controller that unsafe flow is the new normal. Persist meaningful changes.
  if (outputEnabled && millis() - outputStartedAt > STARTUP_GRACE_MS && filteredFlowLpm > 0.1f) {
    const float learned = normalFlowLpm <= 0
      ? filteredFlowLpm
      : (filteredFlowLpm > normalFlowLpm
          ? normalFlowLpm * 0.98f + filteredFlowLpm * 0.02f
          : normalFlowLpm * 0.9995f + filteredFlowLpm * 0.0005f);
    if (fabsf(learned - normalFlowLpm) > 0.05f) {
      normalFlowLpm = learned;
      preferences.putFloat("normalFlow", normalFlowLpm);
    }
  }
}

void evaluateSafety() {
  if (!outputEnabled) return;
  const uint32_t now = millis();
  if (now - lastValidReadingAt > SENSOR_STALE_MS) {
    trip(SENSOR_FAULT, "sensor_stale");
    return;
  }
  if (now - outputStartedAt < STARTUP_GRACE_MS || normalFlowLpm <= 0) return;

  if (filteredFlowLpm < normalFlowLpm * LOW_FLOW_RATIO) {
    if (lowFlowStartedAt == 0) lowFlowStartedAt = now;
    const uint32_t lowFor = now - lowFlowStartedAt;
    if (lowFor >= TRIP_DELAY_MS) {
      trip(LOW_FLOW_TRIP, "low_flow");
    } else if (lowFor >= WARNING_DELAY_MS) {
      safetyState = WARNING;
      faultCode = "low_flow";
    }
  } else {
    lowFlowStartedAt = 0;
    safetyState = NORMAL;
    faultCode = nullptr;
  }
}

void handleButton() {
  const bool pressed = digitalRead(PIN_ENABLE_BUTTON) == LOW;
  if (pressed && buttonPressedAt == 0) buttonPressedAt = millis();
  if (!pressed && buttonPressedAt != 0) {
    const uint32_t held = millis() - buttonPressedAt;
    buttonPressedAt = 0;
    if (held >= BUTTON_HOLD_RESET_MS) {
      // A local, deliberate hold is required after a trip. Cloud/app cannot reset it.
      safetyState = MANUAL_OFF;
      faultCode = nullptr;
      startOutput();
    } else if (outputEnabled) {
      setOutput(false);
      safetyState = MANUAL_OFF;
      faultCode = nullptr;
    } else if (safetyState == BOOT_SAFE || safetyState == MANUAL_OFF) {
      startOutput();
    }
  }
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (!wifiSSID.length() || wifiPassword.length() < 8) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());
  wifiProvisionRequested = false;
}

void startBluetoothPairing() {
  BLEDevice::init("ColdStreak Flow Controller");
  BLEServer *server = BLEDevice::createServer();
  BLEService *service = server->createService(FLOW_SERVICE_UUID);
  BLECharacteristic *idChar = service->createCharacteristic(FLOW_DEVICE_ID_UUID, BLECharacteristic::PROPERTY_READ);
  BLECharacteristic *keyChar = service->createCharacteristic(FLOW_PAIRING_KEY_UUID, BLECharacteristic::PROPERTY_READ);
  BLECharacteristic *ssidChar = service->createCharacteristic(FLOW_WIFI_SSID_UUID, BLECharacteristic::PROPERTY_WRITE);
  BLECharacteristic *passChar = service->createCharacteristic(FLOW_WIFI_PASSWORD_UUID, BLECharacteristic::PROPERTY_WRITE);
  BLECharacteristic *provisionChar = service->createCharacteristic(FLOW_PROVISION_UUID, BLECharacteristic::PROPERTY_WRITE);
  idChar->setValue(DEVICE_ID);
  keyChar->setValue(DEVICE_PAIRING_KEY);
  ssidChar->setCallbacks(new ProvisioningCallbacks(WIFI_SSID_FIELD));
  passChar->setCallbacks(new ProvisioningCallbacks(WIFI_PASSWORD_FIELD));
  provisionChar->setCallbacks(new ProvisioningCallbacks(PROVISION_COMMAND_FIELD));
  service->start();
  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(FLOW_SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->start();
}

void pollAuthorization() {
  const uint32_t now = millis();
  if (cloudAuthorized || now - lastAuthorizationAt < 5000 || WiFi.status() != WL_CONNECTED) return;
  lastAuthorizationAt = now;
  secureClient.setCACert(SERVER_ROOT_CA);
  HTTPClient http;
  String url = String(API_ORIGIN) + "/api/flow-devices/authorization?deviceId=" + DEVICE_ID;
  if (!http.begin(secureClient, url)) return;
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("Authorization", String("Device ") + DEVICE_PAIRING_KEY);
  const int status = http.GET();
  if (status == 200) {
    cloudAuthorized = true;
    preferences.putBool("authorized", true);
    Serial.println("Cloud authorization granted. Local output control is enabled.");
  }
  http.end();
}

void publishTelemetry() {
  const uint32_t now = millis();
  if (!cloudAuthorized || now - lastTelemetryAt < TELEMETRY_INTERVAL_MS || WiFi.status() != WL_CONNECTED) return;
  lastTelemetryAt = now;
  secureClient.setCACert(SERVER_ROOT_CA);
  HTTPClient http;
  if (!http.begin(secureClient, String(API_ORIGIN) + "/api/flow-devices/telemetry")) return;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("Authorization", String("Device ") + DEVICE_PAIRING_KEY);

  sequenceNumber++;
  String body = "{";
  body += "\"sequence\":" + String(sequenceNumber);
  body += ",\"flowLpm\":" + String(filteredFlowLpm, 3);
  body += ",\"waterTempC\":" + String(waterTempC, 3);
  body += ",\"normalFlowLpm\":" + (normalFlowLpm > 0 ? String(normalFlowLpm, 3) : "null");
  body += ",\"relayState\":\"" + String(outputEnabled ? "on" : (safetyState == LOW_FLOW_TRIP || safetyState == SENSOR_FAULT ? "tripped" : "off")) + "\"";
  body += ",\"safetyState\":\"" + String(stateName(safetyState)) + "\"";
  body += ",\"faultCode\":" + (faultCode ? "\"" + String(faultCode) + "\"" : "null");
  body += ",\"firmwareVersion\":\"0.1.0\"";
  body += ",\"controllerUptimeMs\":" + String(now);
  body += "}";
  const int status = http.POST(body);
  if (status >= 200 && status < 300) preferences.putUInt("sequence", sequenceNumber);
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_RELAY, OUTPUT);
  pinMode(PIN_ENABLE_BUTTON, INPUT_PULLUP);
  pinMode(PIN_UFM_INT, INPUT_PULLUP);
  setOutput(false); // first executable safety action

  preferences.begin("coldstreak", false);
  normalFlowLpm = preferences.getFloat("normalFlow", 0);
  sequenceNumber = preferences.getUInt("sequence", esp_random() & 0x3fffffff);
  cloudAuthorized = preferences.getBool("authorized", false);
  wifiSSID = preferences.getString("wifiSsid", "");
  wifiPassword = preferences.getString("wifiPass", "");

  SPI.begin(18, 19, 23, PIN_UFM_CS);
  sensor.begin(&SPI, PIN_UFM_CS, SPISettings(14000000, MSBFIRST, SPI_MODE1));
  sensorReady = sensor.init();
  if (!sensorReady) trip(SENSOR_FAULT, "sensor_invalid");

  esp_task_wdt_init(10, true);
  esp_task_wdt_add(nullptr);
  startBluetoothPairing();
  connectWifi();
  Serial.printf("Device ID: %s\nPairing key: %s\n", DEVICE_ID, DEVICE_PAIRING_KEY);
  Serial.println("Outputs are OFF. Short-press the local enable button to start.");
}

void loop() {
  esp_task_wdt_reset();
  readSensor();
  handleButton();
  evaluateSafety();
  connectWifi();
  pollAuthorization();
  publishTelemetry();
  delay(10);
}