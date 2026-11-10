#include <Arduino.h>
#include <math.h>

// ----------------------------
// Potentiometer pins
// ----------------------------
const int energyPin  = A0;
const int stressPin  = A1;
const int comfortPin = A2;

// ----------------------------
// RGB LED pins
// ----------------------------
const int redPin   = 5;
const int greenPin = 11;
const int bluePin  = 6;

// Current emotional values: 0–100
int energy = 0;
int stress = 0;
int comfort = 0;

// Used for sending serial data
unsigned long lastSerialSend = 0;
const unsigned long serialInterval = 50;


void setup() {

  pinMode(redPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin, OUTPUT);

  Serial.begin(9600);
}


void loop() {

  // ----------------------------------------
  // 1. Read the three potentiometers
  // ----------------------------------------

  int energyRaw  = analogRead(energyPin);
  int stressRaw  = analogRead(stressPin);
  int comfortRaw = analogRead(comfortPin);

  energy  = map(energyRaw,  0, 1023, 0, 100);
  stress  = map(stressRaw,  0, 1023, 0, 100);
  comfort = map(comfortRaw, 0, 1023, 0, 100);


  // ----------------------------------------
  // 2. ENERGY → overall brightness
  // ----------------------------------------

  // Energy 0%   = very dim
  // Energy 100% = full brightness

  float energyBrightness =
    map(energy, 0, 100, 15, 255) / 255.0;


  // ----------------------------------------
  // 3. STRESS → pulsing speed
  // ----------------------------------------

  // Low stress  = slow pulse
  // High stress = fast pulse

  float pulsePeriod =
    map(stress, 0, 100, 3500, 350);

  float phase =
    (millis() % (unsigned long)pulsePeriod)
    / pulsePeriod;

  // Smooth sine-wave pulse from 0 to 1
  float pulse =
    0.5 + 0.5 * sin(phase * TWO_PI);

  // Keep the light from becoming completely dark
  float pulseBrightness =
    0.45 + 0.55 * pulse;


  // ----------------------------------------
  // 4. COMFORT → color
  // ----------------------------------------

  // Low comfort:
  // cool blue
  //
  // High comfort:
  // warm orange / amber

  float t = comfort / 100.0;

  int baseRed =
    20 + (255 - 20) * t;

  int baseGreen =
    80 + (150 - 80) * t;

  int baseBlue =
    255 + (40 - 255) * t;


  // ----------------------------------------
  // 5. Combine all three emotional dimensions
  // ----------------------------------------

  float finalBrightness =
    energyBrightness * pulseBrightness;

  int redOutput =
    constrain(baseRed * finalBrightness, 0, 255);

  int greenOutput =
    constrain(baseGreen * finalBrightness, 0, 255);

  int blueOutput =
    constrain(baseBlue * finalBrightness, 0, 255);


  analogWrite(redPin, redOutput);
  analogWrite(greenPin, greenOutput);
  analogWrite(bluePin, blueOutput);


  // ----------------------------------------
  // 6. Send data to p5.js / computer
  // ----------------------------------------

  if (millis() - lastSerialSend >= serialInterval) {

    lastSerialSend = millis();

    Serial.print(energy);
    Serial.print(",");

    Serial.print(stress);
    Serial.print(",");

    Serial.println(comfort);
  }
}