const state = {
  values: { energy: 62, stress: 28, comfort: 71 },
  target: { energy: 62, stress: 28, comfort: 71 },
  simulating: true,
  connected: false,
  serialPort: null,
  serialReader: null,
  serialBuffer: "",
  lastPacket: "waiting for input",
  theme: "light",
  particles: [],
  seed: Math.random() * 1000,
};

const root = document.documentElement;
const body = document.body;
const $ = (selector) => document.querySelector(selector);

const ui = {
  energyValue: $("#energy-value"),
  stressValue: $("#stress-value"),
  comfortValue: $("#comfort-value"),
  energyFill: $("#energy-fill"),
  stressFill: $("#stress-fill"),
  comfortFill: $("#comfort-fill"),
  phaseValue: $("#phase-value"),
  nodeValue: $("#node-value"),
  pulseValue: $("#pulse-value"),
  densityValue: $("#density-value"),
  fpsReadout: $("#fps-readout"),
  modeReadout: $("#mode-readout"),
  signalLabel: $("#signal-label"),
  systemStatus: $("#system-status"),
  systemDot: $("#system-dot"),
  simulateLabel: $("#simulate-label"),
  consoleOutput: $("#console-output"),
  connectLabel: $("#connect-label"),
  canvasHolder: $("#canvas-holder"),
  themeToggle: $("#theme-toggle"),
  simulateButton: $("#simulate-button"),
  connectButton: $("#connect-button"),
  clock: $("#clock"),
};

const LIGHT_COLORS = {
  paper: [255, 255, 255],
  ink: [17, 17, 15],
  muted: [140, 140, 132],
  grid: [211, 211, 202],
};

const DARK_COLORS = {
  paper: [0, 0, 0],
  ink: [255, 255, 255],
  muted: [120, 120, 114],
  grid: [47, 47, 43],
};

const flowResult = { x: 0, y: 0, concentration: 0 };
const spineResult = { x: 0, y: 0 };
const paletteScratch = Array.from({ length: 5 }, () => [0, 0, 0, 255]);

let animationTime = 0;
let interfacePhase = 0;

const MAX_FRAME_DELTA_SECONDS = 0.05;

const COOL_PALETTE = [
  [35, 101, 170],
  [61, 144, 145],
  [119, 166, 132],
  [28, 62, 111],
  [112, 132, 176],
];

const WARM_PALETTE = [
  [231, 92, 119],
  [241, 143, 74],
  [238, 190, 76],
  [104, 156, 91],
  [194, 94, 148],
];

const FLOW_STEPS = 42;
const BODY_STEPS = 52;
const TENSION_STEPS = 28;

const FLOW_PROGRESS = new Float64Array(FLOW_STEPS + 1);
const FLOW_CONCENTRATION = new Float64Array(FLOW_STEPS + 1);
for (let step = 0; step <= FLOW_STEPS; step += 1) {
  const progress = step / FLOW_STEPS;
  FLOW_PROGRESS[step] = progress;
  FLOW_CONCENTRATION[step] = Math.exp(-Math.pow((progress - 0.54) / 0.2, 2));
}

const BODY_PROGRESS = new Float64Array(BODY_STEPS + 1);
const BODY_PROFILE = new Float64Array(BODY_STEPS + 1);
for (let step = 0; step <= BODY_STEPS; step += 1) {
  const progress = step / BODY_STEPS;
  BODY_PROGRESS[step] = progress;
  BODY_PROFILE[step] = 0.66 + 0.34 * Math.sin(progress * Math.PI);
}

const TENSION_PROGRESS = new Float64Array(TENSION_STEPS + 1);
const TENSION_SIN_PI = new Float64Array(TENSION_STEPS + 1);
for (let step = 0; step <= TENSION_STEPS; step += 1) {
  const progress = step / TENSION_STEPS;
  TENSION_PROGRESS[step] = progress;
  TENSION_SIN_PI[step] = Math.sin(progress * Math.PI);
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function smoothState(deltaSeconds) {
  const smoothing = 1 - Math.pow(1 - 0.08, deltaSeconds * 60);

  state.values.energy = lerp(state.values.energy, state.target.energy, smoothing);
  state.values.stress = lerp(state.values.stress, state.target.stress, smoothing);
  state.values.comfort = lerp(state.values.comfort, state.target.comfort, smoothing);
}

function colorForComfort(comfort, alpha = 255) {
  const low = [49, 93, 185];
  const high = [224, 130, 53];
  const t = comfort / 100;
  return [
    lerp(low[0], high[0], t),
    lerp(low[1], high[1], t),
    lerp(low[2], high[2], t),
    alpha,
  ];
}

function themeColors() {
  return state.theme === "dark" ? DARK_COLORS : LIGHT_COLORS;
}

function formatPercent(value) {
  return `${Math.round(value).toString().padStart(2, "0")}%`;
}

function setText(element, value) {
  if (element && element.textContent !== value) {
    element.textContent = value;
  }
}

function setWidth(element, value) {
  if (element && element.style.width !== value) {
    element.style.width = value;
  }
}

function updateInterface(deltaSeconds = 0) {
  const energy = Math.round(state.values.energy);
  const stress = Math.round(state.values.stress);
  const comfort = Math.round(state.values.comfort);
  const pulse = lerp(0.22, 2.8, stress / 100);
  const nodes = Math.round(10 + energy * 0.22);
  const density = (0.38 + energy * 0.005 + comfort * 0.002).toFixed(2);


  interfacePhase = (interfacePhase + deltaSeconds * 60 * 0.005 * pulse) % (Math.PI * 2);
  const phase = interfacePhase;

  const energyText = formatPercent(energy);
  const stressText = formatPercent(stress);
  const comfortText = formatPercent(comfort);
  const energyWidth = `${energy}%`;
  const stressWidth = `${stress}%`;
  const comfortWidth = `${comfort}%`;

  setText(ui.energyValue, energyText);
  setText(ui.stressValue, stressText);
  setText(ui.comfortValue, comfortText);
  setWidth(ui.energyFill, energyWidth);
  setWidth(ui.stressFill, stressWidth);
  setWidth(ui.comfortFill, comfortWidth);
  ui.energyFill?.parentElement?.setAttribute("aria-valuenow", energy);
  ui.stressFill?.parentElement?.setAttribute("aria-valuenow", stress);
  ui.comfortFill?.parentElement?.setAttribute("aria-valuenow", comfort);
  setText(ui.phaseValue, `${(phase / Math.PI).toFixed(2)}π`);
  setText(ui.nodeValue, String(nodes).padStart(2, "0"));
  setText(ui.pulseValue, `${pulse.toFixed(1)} Hz`);
  setText(ui.densityValue, density);
  setText(ui.fpsReadout, `${Math.round(frameRate()) || 60} FPS`);
  setText(ui.modeReadout, state.connected ? "LIVE / SERIAL" : state.simulating ? "LIVE / SIM" : "HOLD / SIM");
  setText(ui.signalLabel, state.connected ? "ARDUINO" : "SIM");
  setText(ui.systemStatus, state.connected ? "serial linked" : state.simulating ? "simulation" : "paused");
  setText(ui.simulateLabel, state.simulating ? "Pause simulation" : "Resume simulation");

  const dotColor = state.connected ? "#39a56a" : "var(--signal)";
  if (ui.systemDot && ui.systemDot.style.backgroundColor !== dotColor) {
    ui.systemDot.style.backgroundColor = dotColor;
  }

  const packetHtml = `<span>${state.lastPacket}</span>`;
  if (ui.consoleOutput && ui.consoleOutput.innerHTML !== packetHtml) {
    ui.consoleOutput.innerHTML = packetHtml;
  }
}

function seedParticles() {
  state.particles = Array.from({ length: 180 }, (_, index) => ({
    u: index / 179,
    phase: Math.random() * Math.PI * 2,
    offset: Math.random() * 2 - 1,
    speed: 0.08 + Math.random() * 0.42,
    size: 0.45 + Math.random() * 1.8,
    kind: index % 5,
  }));
}

function setup() {
  const holder = ui.canvasHolder;
  const canvas = createCanvas(holder.clientWidth, holder.clientHeight);
  canvas.parent(holder);

  pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  angleMode(RADIANS);
  seedParticles();
  updateInterface();
}

function windowResized() {
  const holder = ui.canvasHolder;
  resizeCanvas(holder.clientWidth, holder.clientHeight);
}

function draw() {
  const deltaSeconds = Math.min(
    Math.max((Number.isFinite(deltaTime) ? deltaTime : 1000 / 60) / 1000, 0),
    MAX_FRAME_DELTA_SECONDS
  );

  animateSimulation();
  smoothState(deltaSeconds);

  const colors = themeColors();
  const energy = state.values.energy / 100;
  const stress = state.values.stress / 100;
  const comfort = state.values.comfort / 100;

  animationTime += deltaSeconds * 60 * lerp(0.003, 0.024, stress);
  const t = animationTime;

  updateInterface(deltaSeconds);

  background(colors.paper[0], colors.paper[1], colors.paper[2]);
  noFill();

  drawRegistrationMarks(colors);
  drawFlowField(energy, stress, comfort, t, colors);
  drawBody(energy, stress, comfort, t, colors);
  drawBloomField(energy, stress, comfort, t, colors);
  drawEmotionCore(energy, stress, comfort, t, colors);
}

function comfortPalette(comfort, alpha = 255) {
  for (let index = 0; index < 5; index += 1) {
    const cool = COOL_PALETTE[index];
    const warm = WARM_PALETTE[index];
    const out = paletteScratch[index];
    out[0] = lerp(cool[0], warm[0], comfort);
    out[1] = lerp(cool[1], warm[1], comfort);
    out[2] = lerp(cool[2], warm[2], comfort);
    out[3] = alpha;
  }
  return paletteScratch;
}

function drawRegistrationMarks(colors) {
  stroke(colors.grid[0], colors.grid[1], colors.grid[2], 120);
  strokeWeight(0.7);
  const inset = min(width, height) * 0.045;
  const mark = min(width, height) * 0.018;
  line(inset, inset, inset + mark, inset);
  line(inset, inset, inset, inset + mark);
  line(width - inset, height - inset, width - inset - mark, height - inset);
  line(width - inset, height - inset, width - inset, height - inset - mark);
}


function flowPointInto(out, particle, progress, energy, stress, t, spineX) {
  const startX = width * (0.06 + particle.u * 0.88) + particle.offset * width * 0.025;
  const concentration = Math.exp(-Math.pow((progress - 0.54) / 0.2, 2));
  const attraction = (0.09 + energy * 0.27) * concentration;
  const tension = width * (0.002 + stress * 0.032) * (0.28 + concentration * 1.35);
  const wave = Math.sin(progress * (8 + stress * 10) + particle.phase + t * particle.speed * 1.8) * tension;
  const secondary = Math.sin(progress * 3.2 + particle.phase * 0.5 - t * 0.35) * width * stress * 0.012;

  out.x = startX + (spineX - startX) * attraction + wave + secondary;
  out.y = lerp(height * 0.015, height * 0.965, progress) + Math.sin(particle.phase + progress * 5 + t) * height * stress * 0.006;
  out.concentration = concentration;
}

function flowFieldPointInto(out, startX, phase, speed, progress, concentration, energy, stress, t, spineX) {
  const attraction = (0.09 + energy * 0.27) * concentration;
  const tension = width * (0.002 + stress * 0.032) * (0.28 + concentration * 1.35);
  const wave = Math.sin(progress * (8 + stress * 10) + phase + t * speed * 1.8) * tension;
  const secondary = Math.sin(progress * 3.2 + phase * 0.5 - t * 0.35) * width * stress * 0.012;

  out.x = startX + (spineX - startX) * attraction + wave + secondary;
  out.y = lerp(height * 0.015, height * 0.965, progress) + Math.sin(phase + progress * 5 + t) * height * stress * 0.006;
  out.concentration = concentration;
}

function drawFlowField(energy, stress, comfort, t, colors) {
  const strands = Math.floor(88 + energy * 1.05);
  const palette = comfortPalette(comfort, 165);
  const spineX = width * (0.5 + 0.045 * Math.sin(t * 0.18));
  const widthBase = width * 0.025;

  for (let index = 0; index < strands; index += 1) {
    const u = (index + 0.5) / strands;
    const phase = index * 1.71 + state.seed;
    const offset = Math.sin(index * 9.4 + state.seed);
    const speed = 0.3 + (index % 5) * 0.08;
    const startX = width * (0.06 + u * 0.88) + offset * widthBase;

    if (index % 17 === 0) {
      const c = palette[index % palette.length];
      stroke(c[0], c[1], c[2], c[3]);
    } else {
      stroke(colors.ink[0], colors.ink[1], colors.ink[2], 34 + energy * 48);
    }

    strokeWeight(index % 15 === 0 ? 0.95 : 0.5);
    beginShape();

    for (let step = 0; step <= FLOW_STEPS; step += 1) {
      const progress = FLOW_PROGRESS[step];
      flowFieldPointInto(
        flowResult,
        startX,
        phase,
        speed,
        progress,
        FLOW_CONCENTRATION[step],
        energy,
        stress,
        t,
        spineX
      );
      curveVertex(flowResult.x, flowResult.y);
    }

    endShape();
  }
}

function spinePointInto(out, progress, bodyProfile, lane, energy, stress, t, phase, centerX) {
  const y = height * (0.18 + progress * 0.67) + Math.sin(phase + progress * 5 + t * 0.5) * height * stress * 0.018;
  const bodyWidth = width * (0.026 + energy * 0.095) * bodyProfile;
  const drift = Math.sin(progress * (4 + stress * 5) + phase + t * 0.75) * width * stress * 0.024;

  out.x = centerX + lane * bodyWidth + drift;
  out.y = y;
}

function drawBody(energy, stress, comfort, t, colors) {
  const palette = comfortPalette(comfort, 185);
  const strands = Math.floor(26 + energy * 0.42);
  const centerX = width * (0.5 + 0.045 * Math.sin(t * 0.18));

  for (let index = 0; index < strands; index += 1) {
    const lane = (index / (strands - 1) - 0.5) * 2;
    const phase = state.seed + index * 0.83;

    if (index % 8 === 0) {
      const c = palette[index % palette.length];
      stroke(c[0], c[1], c[2], c[3]);
    } else {
      stroke(colors.ink[0], colors.ink[1], colors.ink[2], 56 + energy * 54);
    }

    strokeWeight(index % 9 === 0 ? 1.1 : 0.62);
    beginShape();

    for (let step = 0; step <= BODY_STEPS; step += 1) {
      const progress = BODY_PROGRESS[step];
      spinePointInto(
        spineResult,
        progress,
        BODY_PROFILE[step],
        lane,
        energy,
        stress,
        t,
        phase,
        centerX
      );
      curveVertex(spineResult.x, spineResult.y);
    }

    endShape();
  }

  const tensionLines = Math.floor(5 + stress * 14);
  stroke(colors.ink[0], colors.ink[1], colors.ink[2], 85);
  strokeWeight(0.7);

  for (let index = 0; index < tensionLines; index += 1) {
    const phase = state.seed * 0.5 + index * 2.6;
    const localT = t + index * 0.013;
    const localCenterX = width * (0.5 + 0.045 * Math.sin(localT * 0.18));

    beginShape();

    for (let step = 0; step <= TENSION_STEPS; step += 1) {
      const progress = TENSION_PROGRESS[step];
      const lane = Math.sin(progress * Math.PI + phase) * (0.7 + stress * 1.2);
      const bodyProfile = 0.66 + 0.34 * TENSION_SIN_PI[step];

      spinePointInto(
        spineResult,
        progress,
        bodyProfile,
        lane,
        energy,
        stress,
        localT,
        phase,
        localCenterX
      );
      curveVertex(spineResult.x, spineResult.y);
    }

    endShape();
  }
}

function drawBloomField(energy, stress, comfort, t, colors) {
  const palette = comfortPalette(comfort, 210);
  const activeCount = Math.floor(58 + energy * 1.28 + comfort * 0.48);
  const spineX = width * (0.5 + 0.045 * Math.sin(t * 0.18));
  const minDimension = min(width, height);

  for (let index = 0; index < activeCount; index += 1) {
    const particle = state.particles[index % state.particles.length];
    const progress = (index * 0.071 + t * particle.speed * 0.055 + particle.phase * 0.01) % 1;

    flowPointInto(flowResult, particle, progress, energy, stress, t, spineX);

    const x = flowResult.x;
    const y = flowResult.y;
    const concentration = flowResult.concentration;
    const localSize = minDimension * (0.003 + particle.size * 0.0018 + energy * 0.0026) * (0.7 + concentration * 1.8);
    const angle = Math.atan2(Math.sin(particle.phase + t), Math.cos(particle.phase + t)) + stress * Math.sin(index);
    const tint = palette[(index + Math.floor(comfort * 3)) % palette.length];

    if (particle.kind === 0 || particle.kind === 3) {
      drawLeaf(x, y, localSize * (0.9 + energy), angle, tint);
    } else if (particle.kind === 1 && comfort > 0.35) {
      drawPetal(x, y, localSize * (0.85 + comfort * 0.55), angle, tint);
    } else {
      noStroke();
      if (index % 4 === 0) {
        fill(tint[0], tint[1], tint[2], tint[3]);
      } else {
        fill(colors.ink[0], colors.ink[1], colors.ink[2], 120 + energy * 60);
      }
      const dotSize = localSize * (0.7 + stress * 0.8);
      ellipse(x, y, dotSize, dotSize);
    }
  }
}

function drawLeaf(x, y, size, angle, tint) {
  push();
  translate(x, y);
  rotate(angle);
  noStroke();
  fill(tint[0], tint[1], tint[2], tint[3]);
  beginShape();
  vertex(0, -size * 1.5);
  vertex(size * 0.75, -size * 0.18);
  vertex(0, size * 1.5);
  vertex(-size * 0.75, -size * 0.18);
  endShape(CLOSE);
  pop();
}

function drawPetal(x, y, size, angle, tint) {
  push();
  translate(x, y);
  rotate(angle);
  noStroke();
  fill(tint[0], tint[1], tint[2], tint[3]);

  for (let index = 0; index < 4; index += 1) {
    rotate(Math.PI / 2);
    beginShape();
    vertex(0, -size * 1.25);
    vertex(size * 0.42, -size * 0.12);
    vertex(0, size * 0.35);
    vertex(-size * 0.42, -size * 0.12);
    endShape(CLOSE);
  }

  fill(255, 255, 255, tint[3] * 0.9);
  ellipse(0, 0, size * 0.35, size * 0.35);
  pop();
}

function drawEmotionCore(energy, stress, comfort, t, colors) {
  const palette = comfortPalette(comfort, 230);
  const cx = width * (0.5 + 0.045 * Math.sin(t * 0.18));
  const cy = height * (0.43 + 0.045 * Math.sin(t * 0.13 + 1.2));
  const coreSize = min(width, height) * (0.052 + energy * 0.062);
  const lobes = 11 + Math.floor(stress * 9);

  for (let layer = 0; layer < 3; layer += 1) {
    const layerScale = 0.72 + layer * 0.2;

    noStroke();
    if (layer === 1) {
      const c = palette[1];
      fill(c[0], c[1], c[2], c[3]);
    } else if (layer === 2) {
      const c = palette[4];
      fill(c[0], c[1], c[2], c[3]);
    } else {
      fill(colors.ink[0], colors.ink[1], colors.ink[2], 68);
    }

    beginShape();
    for (let index = 0; index < lobes * 2; index += 1) {
      const theta = (Math.PI * 2 * index) / (lobes * 2);
      const pulse = 1 + 0.18 * Math.sin(theta * 3 + t + layer) + stress * 0.15 * Math.sin(theta * 7 - t * 1.4);
      const radius = coreSize * layerScale * (0.72 + pulse * 0.25);
      const x = cx + Math.cos(theta) * radius * (1.18 + stress * 0.15);
      const y = cy + Math.sin(theta) * radius * (0.82 + comfort * 0.2);
      vertex(x, y);
    }
    endShape(CLOSE);
  }

  stroke(colors.ink[0], colors.ink[1], colors.ink[2], 130);
  strokeWeight(0.8);
  noFill();
  beginShape();
  for (let index = 0; index <= 34; index += 1) {
    const theta = (Math.PI * 2 * index) / 34;
    const radius = coreSize * (1.12 + stress * 0.28 + 0.1 * Math.sin(theta * 5 + t));
    vertex(cx + Math.cos(theta) * radius, cy + Math.sin(theta) * radius * 0.78);
  }
  endShape();

  const heartSeeds = Math.floor(7 + comfort * 10);
  for (let index = 0; index < heartSeeds; index += 1) {
    const theta = (Math.PI * 2 * index) / heartSeeds + t * 0.24;
    const distance = coreSize * (0.55 + 0.3 * Math.sin(index * 3.1 + t));
    const size = coreSize * (0.09 + energy * 0.095) * (index % 3 === 0 ? 1.5 : 1);
    drawPetal(
      cx + Math.cos(theta) * distance,
      cy + Math.sin(theta) * distance * 0.64,
      size,
      theta + Math.PI / 2,
      palette[(index + 2) % palette.length]
    );
  }

  noStroke();
  fill(colors.ink[0], colors.ink[1], colors.ink[2], 200);
  ellipse(cx, cy, coreSize * 0.11, coreSize * 0.11);
}

// ---------------------------------------------------------------------------
// Mouse / touch control: play the organism without an Arduino.
//   drag on the canvas   left/right = energy, up/down = stress
//   scroll on the canvas = comfort
//   click (no drag)      = reseed the particle field
//   drag / click / arrow keys on the three bars = set that value directly
// Any manual input pauses the simulation; "Resume simulation" hands control back.
// ---------------------------------------------------------------------------
const pointer = { down: false, startX: 0, startY: 0, startEnergy: 0, startStress: 0, moved: false };

function overCanvas() {
  return mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height;
}

function takeManualControl() {
  if (state.connected) return false;
  if (state.simulating) {
    state.simulating = false;
  }
  state.lastPacket = `MOUSE  ${["energy", "stress", "comfort"]
    .map((key) => String(Math.round(state.target[key])).padStart(3, "0"))
    .join("  ")}`;
  return true;
}

function mousePressed() {
  if (!overCanvas()) return;
  pointer.down = true;
  pointer.moved = false;
  pointer.startX = mouseX;
  pointer.startY = mouseY;
  pointer.startEnergy = state.target.energy;
  pointer.startStress = state.target.stress;
}

function mouseDragged() {
  if (!pointer.down || state.connected) return;
  const dx = mouseX - pointer.startX;
  const dy = mouseY - pointer.startY;
  if (!pointer.moved && Math.hypot(dx, dy) < 5) return;
  pointer.moved = true;
  state.target.energy = clamp(pointer.startEnergy + (dx / width) * 140);
  state.target.stress = clamp(pointer.startStress - (dy / height) * 140);
  takeManualControl();
  return false;
}

function mouseReleased() {
  if (pointer.down && !pointer.moved && overCanvas()) {
    state.seed = Math.random() * 1000;
    seedParticles();
  }
  pointer.down = false;
}

function mouseWheel(event) {
  if (!overCanvas() || state.connected) return;
  state.target.comfort = clamp(state.target.comfort - event.delta * 0.05);
  takeManualControl();
  return false;
}

function setupMetricSliders() {
  document.querySelectorAll(".metric").forEach((metric) => {
    const key = metric.dataset.metric;
    const track = metric.querySelector(".metric-track");
    if (!track) return;
    track.setAttribute("role", "slider");
    track.setAttribute("tabindex", "0");
    track.setAttribute("aria-label", key);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");

    const setFromPointer = (event) => {
      const rect = track.getBoundingClientRect();
      state.target[key] = clamp(((event.clientX - rect.left) / rect.width) * 100);
      takeManualControl();
    };

    track.addEventListener("pointerdown", (event) => {
      if (state.connected) return;
      track.setPointerCapture(event.pointerId);
      setFromPointer(event);
      event.preventDefault();
    });
    track.addEventListener("pointermove", (event) => {
      if (track.hasPointerCapture(event.pointerId)) setFromPointer(event);
    });
    track.addEventListener("keydown", (event) => {
      if (state.connected) return;
      const step = event.shiftKey ? 10 : 2;
      if (event.key === "ArrowRight" || event.key === "ArrowUp") state.target[key] = clamp(state.target[key] + step);
      else if (event.key === "ArrowLeft" || event.key === "ArrowDown") state.target[key] = clamp(state.target[key] - step);
      else return;
      takeManualControl();
      event.preventDefault();
    });
  });
}

setupMetricSliders();

async function connectSerial() {
  if (!("serial" in navigator)) {
    state.lastPacket = "Web Serial unavailable — use Chrome or Edge";
    updateInterface();
    return;
  }

  try {
    if (state.connected && state.serialPort) {
      await disconnectSerial();
      return;
    }

    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    state.serialPort = port;
    state.connected = true;
    state.simulating = false;
    state.lastPacket = "serial linked / listening";
    setText(ui.connectLabel, "Disconnect Arduino");
    readSerialLoop();
  } catch (error) {
    state.lastPacket = error?.name === "NotFoundError" ? "connection cancelled" : `serial error / ${error.message}`;
  }

  updateInterface();
}

async function readSerialLoop() {
  if (!state.serialPort?.readable) return;

  state.serialReader = state.serialPort.readable.getReader();
  const decoder = new TextDecoder();

  try {
    while (state.connected) {
      const { value, done } = await state.serialReader.read();
      if (done) break;

      state.serialBuffer += decoder.decode(value, { stream: true });
      const packets = state.serialBuffer.split(/\r?\n/);
      state.serialBuffer = packets.pop() || "";
      packets.forEach(parsePacket);
    }
  } catch (error) {
    state.lastPacket = `serial read / ${error.message}`;
  } finally {
    state.serialReader?.releaseLock();
    state.serialReader = null;
    updateInterface();
  }
}

function parsePacket(packet) {
  const values = packet.trim().split(",").map(Number);
  if (values.length !== 3 || values.some(Number.isNaN)) return;

  state.target.energy = clamp(values[0]);
  state.target.stress = clamp(values[1]);
  state.target.comfort = clamp(values[2]);
  state.lastPacket = `RX  ${values.map((value) => String(Math.round(value)).padStart(3, "0")).join("  ")}`;
}

async function disconnectSerial() {
  state.connected = false;
  try {
    await state.serialReader?.cancel();
  } catch (error) {
    // reader may already be closed
  }
  try {
    await state.serialPort?.close();
  } catch (error) {
    // port may already be closed
  }

  state.serialReader = null;
  state.serialPort = null;
  setText(ui.connectLabel, "Connect Arduino");
  state.lastPacket = "serial disconnected";
  updateInterface();
}

function animateSimulation() {
  if (!state.simulating || state.connected) return;

  const now = millis() * 0.001;
  state.target.energy = 54 + 24 * (0.5 + 0.5 * Math.sin(now * 0.37 + 1));
  state.target.stress = 31 + 28 * (0.5 + 0.5 * Math.sin(now * 0.85 + 2.3));
  state.target.comfort = 57 + 27 * (0.5 + 0.5 * Math.sin(now * 0.22 + 4.1));
}

ui.themeToggle.addEventListener("click", () => {
  state.theme = state.theme === "light" ? "dark" : "light";
  body.dataset.theme = state.theme;
  root.style.colorScheme = state.theme;
});

ui.simulateButton.addEventListener("click", () => {
  state.simulating = !state.simulating;
  state.lastPacket = state.simulating ? "simulation resumed" : "simulation paused";
  updateInterface();
});

ui.connectButton.addEventListener("click", connectSerial);

setInterval(() => {
  setText(ui.clock, new Date().toLocaleTimeString([], { hour12: false }));
}, 250);
