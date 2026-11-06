# Arduino Lab Monitor

A React, TypeScript, and Vite dashboard for read-only lab telemetry.

## Start locally

Use Node.js 22.18 or later. From this folder run:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the printed URL in desktop Chrome. `npm run build` checks TypeScript and produces `dist/`. `npm test` checks serial parsing, saved configurations, sample pairing, calculations, and CSV output.

## USB setup

1. In Arduino IDE select **Arduino UNO R4 WiFi**. For the included sketch, install **DHT sensor library** by Adafruit and **Adafruit Unified Sensor** through Library Manager.
2. Connect four DHT22 data lines to D2–D5, share ground, and supply power appropriate to the sensors. For bare sensors, add a pull-up from each data line to its supply. Open `arduino/Dht22Telemetry/Dht22Telemetry.ino` and upload.
3. Close the Arduino IDE Serial Monitor and any other program using that port. In the dashboard select the board's baud rate (115200 for the sketch), click **Connect USB**, and choose the board's port. USB takes over from the demo. After unplugging, reconnect the board and click **Connect USB** again.
4. Send one flat JSON object per newline, such as `{"inlet_temp_c":43.2,"flow_lpm":2.1}`. Send numeric measurements as JSON numbers. Omit failed readings or send `null`. Boolean or text status fields work with the Status field type. Each line is an independent sample.

The sketch emits temperature and humidity only. The demo's distance and pump channels need separate firmware fields to show physical readings. See the [Chrome Web Serial guide](https://developer.chrome.com/docs/capabilities/serial) for browser support and permission details.

## Add a sensor and plot it

1. Open **Flow Bench** and keep Demo mode active. In **Setup**, choose **Add sensor → Custom**. Name it **Custom Flow**, name its channel **Flow**, set units to `L/min`, and choose `flow_lpm` from **Detected fields** or type it into **Serial field**. Save.
2. In **Live View**, select **Custom Flow · Flow (L/min)** on X and **Pressure Drop · ΔP (kPa)** on Y. The result is a scatter plot using same-sample pairs. Pressure Drop is configured as upstream minus downstream. To create a calculation, add a channel, choose **Subtract channels**, and pick two numeric sources with matching units.
3. Choose **Elapsed time (s)** on X for a line chart. **Add Y channel** overlays additional channels of the same unit. A channel becomes stale after six seconds without a reading.

Projects, uploaded thumbnails, mappings, and chart selections save in the current browser and origin. Use the same browser profile and URL to access them again. Create and switch projects from the sidebar and rename the active project with the pencil next to its title.

## Record and export

In **Live View**, start a run, add timestamped markers, and edit the run name or notes. Stop and export CSV when finished. A run uses the channel configuration captured at Start, and switching projects stops the active run. CSV includes every sample in the run with a UTC timestamp, elapsed seconds, and configured channel values. Missing values are blank. Run data stays in memory until reload or replacement. Export before closing the tab or starting another run for that project.

The demo verifies the dashboard workflow without hardware. A physical UNO R4 WiFi is needed to verify device selection, sustained USB reads, unplug and reconnect, and the DHT22 sketch and wiring on the board.
