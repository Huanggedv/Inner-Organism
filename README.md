# Inner Organism

**Live site:** https://huanggedv.github.io/Inner-Organism/
**Article:** [Lab 3 — Inner Organism: Visualizing Emotion with Arduino, Light and Motion](https://medium.com/@chloe_huang_19782/lab-3-inner-organism-visualizing-emotion-with-arduino-light-and-motion-e4bdb8ba5781)

An experimental p5.js visualizer for three Arduino potentiometers.

## Try it without Arduino (mouse / touch)

The page runs on its own. Without hardware it plays a simulation, and you can take over with the mouse:

| Mouse / keyboard | Stands in for | Result |
| --- | --- | --- |
| drag on the field, left / right | A0 energy knob | expansion and body density |
| drag on the field, up / down | A1 stress knob | bending, turbulence, membrane tension |
| scroll on the field | A2 comfort knob | bloom, softness, cool → warm colour |
| drag or click a bar on the right (or focus it and use ← →) | any one knob | sets that value directly |
| click the field without dragging | — | reseeds the particle field |
| **Resume simulation** | — | hands control back to the automatic simulation |

Any manual input pauses the simulation. When an Arduino is connected, the knobs take over.

## Run locally

```bash
npm run dev
```

Open `http://localhost:4173` in Chrome. The page loads p5.js from its CDN and does not need an npm install.

## Arduino data

The browser expects one newline-delimited packet every 50 ms:

```text
energy,stress,comfort
```

Each value should be an integer from `0` to `100`, matching `arduino/inner_organism/inner_organism.ino` (three potentiometers on A0–A2, RGB LED on pins 5 / 11 / 6). Click **Connect Arduino** and select the board's serial port. Without hardware, the default simulation continuously animates the same three parameters.

Energy controls expansion and body density. Stress controls bending, turbulence, and membrane tension. Comfort controls bloom, softness, and the cool-to-warm color bias.

## Controls

- **Connect Arduino**: open or close the Web Serial connection at `9600` baud.
- **Pause simulation**: hold or resume the generated input when no board is connected.
- **◐**: switch between flat white and flat black visual modes.
- Click inside the canvas to reseed the particle field; drag / scroll on it to control the values (see above).
