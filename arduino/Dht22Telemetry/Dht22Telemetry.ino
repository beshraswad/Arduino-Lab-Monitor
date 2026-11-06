#include <DHT.h>

// UNO R4 WiFi. Wire four DHT22 data pins to D2, D3, D4, and D5.
DHT inlet(2, DHT22);
DHT outlet(3, DHT22);
DHT ambient(4, DHT22);
DHT mist(5, DHT22);

void printReading(const char* key, float value, bool& first) {
  if (isnan(value)) return;
  if (!first) Serial.print(',');
  first = false;
  Serial.print('"');
  Serial.print(key);
  Serial.print(F("\":"));
  Serial.print(value, 2);
}

void printSensor(DHT& sensor, const char* temperature, const char* humidity, bool& first) {
  printReading(temperature, sensor.readTemperature(), first);
  printReading(humidity, sensor.readHumidity(), first);
}

void setup() {
  Serial.begin(115200);
  inlet.begin();
  outlet.begin();
  ambient.begin();
  mist.begin();
  delay(2200);
}

void loop() {
  bool first = true;
  Serial.print('{');
  printSensor(inlet, "inlet_temp_c", "inlet_rh", first);
  printSensor(outlet, "outlet_temp_c", "outlet_rh", first);
  printSensor(ambient, "ambient_temp_c", "ambient_rh", first);
  printSensor(mist, "mist_temp_c", "mist_rh", first);
  Serial.println('}');
  delay(2200);
}
