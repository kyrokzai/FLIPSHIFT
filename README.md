<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>FLIPSHIFT</title>

  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #050816;
      touch-action: none;
      font-family: Arial, sans-serif;
    }

    canvas {
      display: block;
      width: 100vw;
      height: 100vh;
      background: #050816;
      cursor: pointer;
    }
  </style>
</head>

<body>
<canvas id="game"></canvas>

<script>
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const BASE_W = 1280;
const BASE_H = 720;

let scale = 1;
let offsetX = 0;
let offsetY = 0;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  scale = Math.min(canvas.width / BASE_W, canvas.height / BASE_H);
  offsetX = (canvas.width - BASE_W * scale) / 2;
  offsetY = (canvas.height - BASE_H * scale) / 2;
}

window.addEventListener("resize", resize);
resize();

const COLORS = {
  bg: "#050816",
  bg2: "#070A12",
  grid: "rgba(96,165,250,0.13)",
  text: "#F8FAFC",
  muted: "#94A3B8",
  cyan: "#38BDF8",
  purple: "#A78BFA",
  pink: "#FB7185",
  green: "#34D399",
  yellow: "#FBBF24",
  platform: "#111827",
  platform2: "#1F2937",
  platformEdge: "#60A5FA",
  panel: "rgba(17,24,39,0.86)",
  panelSolid: "#111827",
};

const SAVE_KEY = "flipshift_neon_save_v2";

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { unlocked: 1, stars: {} };
    const data = JSON.parse(raw);
    return {
      unlocked: data.unlocked || 1,
      stars: data.stars || {}
    };
  } catch {
    return { unlocked: 1, stars: {} };
  }
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

let save = loadSave();

const levels = [
  {
    id: 1,
    name: "First Flip",
    width: 2200,
    player: { x: 120, y: 560, speed: 260, gravity: 1 },
    finish: { x: 2020, y: 520, w: 90, h: 140 },
    platforms: [
      { x: 0, y: 660, w: 2200, h: 60 },
      { x: 450, y: 500, w: 280, h: 30 },
      { x: 850, y: 390, w: 260, h: 30 },
      { x: 1250, y: 500, w: 280, h: 30 },
      { x: 1650, y: 660, w: 550, h: 60 },
    ],
    spikes: [
      { x: 750, y: 620, w: 120, h: 40, dir: "up" },
      { x: 1450, y: 620, w: 160, h: 40, dir: "up" },
    ],
    movers: [],
    stars: { three: 8, two: 12, one: 18 },
  },
  {
    id: 2,
    name: "Ceiling Run",
    width: 2500,
    player: { x: 120, y: 560, speed: 285, gravity: 1 },
    finish: { x: 2320, y: 70, w: 90, h: 140 },
    platforms: [
      { x: 0, y: 660, w: 520, h: 60 },
      { x: 620, y: 60, w: 520, h: 40 },
      { x: 1240, y: 660, w: 430, h: 60 },
      { x: 1760, y: 60, w: 740, h: 40 },
    ],
    spikes: [
      { x: 530, y: 620, w: 210, h: 40, dir: "up" },
      { x: 1140, y: 60, w: 130, h: 40, dir: "down" },
      { x: 1660, y: 620, w: 130, h: 40, dir: "up" },
    ],
    movers: [
      { x: 1470, y: 360, w: 70, h: 70, toX: 1470, toY: 160, time: 1.2 },
    ],
    stars: { three: 9, two: 14, one: 20 },
  },
  {
    id: 3,
    name: "Timing Gate",
    width: 3000,
    player: { x: 120, y: 560, speed: 310, gravity: 1 },
    finish: { x: 2820, y: 510, w: 90, h: 150 },
    platforms: [
      { x: 0, y: 660, w: 620, h: 60 },
      { x: 730, y: 60, w: 520, h: 40 },
      { x: 1360, y: 660, w: 450, h: 60 },
      { x: 1940, y: 60, w: 460, h: 40 },
      { x: 2500, y: 660, w: 500, h: 60 },
    ],
    spikes: [
      { x: 640, y: 620, w: 180, h: 40, dir: "up" },
      { x: 1260, y: 60, w: 140, h: 40, dir: "down" },
      { x: 1810, y: 620, w: 170, h: 40, dir: "up" },
      { x: 2400, y: 60, w: 120, h: 40, dir: "down" },
    ],
    movers: [
      { x: 980, y: 340, w: 70, h: 70, toX: 980, toY: 560, time: 1.0 },
      { x: 2160, y: 160, w: 70, h: 70, toX: 2160, toY: 520, time: 0.85 },
    ],
    stars: { three: 10, two: 16, one: 24 },
  },
  {
    id: 4,
    name: "Broken Path",
    width: 3300,
    player: { x: 120, y: 560, speed: 325, gravity: 1 },
    finish: { x: 3100, y: 70, w: 90, h: 140 },
    platforms: [
      { x: 0, y: 660, w: 460, h: 60 },
      { x: 600, y: 60, w: 360, h: 40 },
      { x: 1080, y: 660, w: 330, h: 60 },
      { x: 1560, y: 60, w: 360, h: 40 },
      { x: 2050, y: 660, w: 370, h: 60 },
      { x: 2550, y: 60, w: 750, h: 40 },
    ],
    spikes: [
      { x: 470, y: 620, w: 180, h: 40, dir: "up" },
      { x: 970, y: 60, w: 110, h: 40, dir: "down" },
      { x: 1420, y: 620, w: 160, h: 40, dir: "up" },
      { x: 1940, y: 60, w: 150, h: 40, dir: "down" },
      { x: 2440, y: 620, w: 120, h: 40, dir: "up" },
    ],
    movers: [
      { x: 1240, y: 220, w: 60, h: 60, toX: 1240, toY: 500, time: 0.9 },
      { x: 2280, y: 500, w: 60, h: 60, toX: 2280, toY: 160, time: 1.0 },
    ],
    stars: { three: 11, two: 17, one: 25 },
  },
  {
    id: 5,
    name: "Final Shift",
    width: 3700,
    player: { x: 120, y: 560, speed: 345, gravity: 1 },
    finish: { x: 3500, y: 510, w: 90, h: 150 },
    platforms: [
      { x: 0, y: 660, w: 420, h: 60 },
      { x: 560, y: 60, w: 340, h: 40 },
      { x: 1040, y: 660, w: 300, h: 60 },
      { x: 1480, y: 60, w: 300, h: 40 },
      { x: 1920, y: 660, w: 300, h: 60 },
      { x: 2360, y: 60, w: 300, h: 40 },
      { x: 2800, y: 660, w: 900, h: 60 },
    ],
    spikes: [
      { x: 430, y: 620, w: 130, h: 40, dir: "up" },
      { x: 910, y: 60, w: 130, h: 40, dir: "down" },
      { x: 1350, y: 620, w: 130, h: 40, dir: "up" },
      { x: 1790, y: 60, w: 130, h: 40, dir: "down" },
      { x: 2230, y: 620, w: 130, h: 40, dir: "up" },
      { x: 2670, y: 60, w: 130, h: 40, dir: "down" },
      { x: 3150, y: 620, w: 180, h: 40, dir: "up" },
    ],
    movers: [
      { x: 720, y: 160, w: 70, h: 70, toX: 720, toY: 520, time: 0.65 },
      { x: 1620, y: 520, w: 70, h: 70, toX: 1620, toY: 160, time: 0.65 },
      { x: 2520, y: 160, w: 70, h: 70, toX: 2520, toY: 520, time: 0.65 },
    ],
    stars: { three: 14, two: 22, one: 34 },
  },
];

let state = "menu";
let currentLevelIndex = 0;
let level = null;
let player = null;
let gravity = 1;
let cameraX = 0;
let targetCameraX = 0;
let startTime = 0;
let elapsed = 0;
let lastTime = performance.now();
let buttons = [];
let movingRects = [];
let paused = false;
let deathMessage = "";
let victoryStars = 0;
let particles = [];
let trail = [];
let starsBg = [];
let mouse = { x: -9999, y: -9999 };
let shakeTime = 0;
let shakePower = 0;
let flashAlpha = 0;
let flashColor = "rgba(56,189,248,";
let audioCtx = null;

for (let i = 0; i < 120; i++) {
  starsBg.push({
    x: Math.random() * BASE_W,
    y: Math.random() * BASE_H,
    r: Math.random() * 1.8 + 0.4,
    a: Math.random() * 0.6 + 0.15,
    s: Math.random() * 0.4 + 0.1,
  });
}

function playSound(type) {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === "flip") {
      osc.frequency.value = gravity > 0 ? 420 : 620;
      gain.gain.value = 0.045;
      osc.type = "sine";
      osc.start();
      osc.stop(audioCtx.currentTime + 0.07);
    }

    if (type === "dead") {
      osc.frequency.value = 140;
      gain.gain.value = 0.07;
      osc.type = "sawtooth";
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    }

    if (type === "win") {
      osc.frequency.value = 660;
      gain.gain.value = 0.06;
      osc.type = "triangle";
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
    }
  } catch {}
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function calculateStars(lvl, time) {
  if (time <= lvl.stars.three) return 3;
  if (time <= lvl.stars.two) return 2;
  if (time <= lvl.stars.one) return 1;
  return 0;
}

function startLevel(index) {
  currentLevelIndex = index;
  level = levels[index];

  player = {
    x: level.player.x,
    y: level.player.y,
    w: 42,
    h: 42,
    vx: level.player.speed,
    vy: 0,
    rotation: 0,
  };

  gravity = level.player.gravity;
  cameraX = 0;
  targetCameraX = 0;
  startTime = performance.now();
  elapsed = 0;
  deathMessage = "";
  victoryStars = 0;
  movingRects = level.movers.map(m => ({ ...m, cx: m.x, cy: m.y }));
  particles = [];
  trail = [];
  paused = false;
  flashAlpha = 0.35;
  flashColor = "rgba(56,189,248,";
  state = "game";
}

function restartLevel() {
  startLevel(currentLevelIndex);
}

function nextLevel() {
  if (currentLevelIndex + 1 < levels.length) {
    startLevel(currentLevelIndex + 1);
  } else {
    state = "menu";
  }
}

function flipGravity() {
  if (state !== "game" || paused) return;

  gravity *= -1;
  player.vy = 0;

  flashAlpha = 0.28;
  flashColor = gravity > 0 ? "rgba(56,189,248," : "rgba(167,139,250,";

  spawnParticles(
    player.x + player.w / 2,
    player.y + player.h / 2,
    22,
    gravity > 0 ? COLORS.cyan : COLORS.purple,
    220
  );

  playSound("flip");
}

function completeLevel() {
  state = "victory";
  elapsed = (performance.now() - startTime) / 1000;
  victoryStars = calculateStars(level, elapsed);

  const levelId = level.id;
  save.unlocked = Math.max(save.unlocked, levelId + 1);
  save.stars[levelId] = Math.max(save.stars[levelId] || 0, victoryStars);

  if (save.unlocked > levels.length) save.unlocked = levels.length;

  saveGame();

  spawnParticles(player.x, player.y, 80, COLORS.green, 360);
  flashAlpha = 0.35;
  flashColor = "rgba(52,211,153,";
  playSound("win");
}

function failLevel(reason) {
  if (state !== "game") return;

  state = "dead";
  deathMessage = reason || "CRASHED";

  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 70, COLORS.pink, 420);

  shakeTime = 0.35;
  shakePower = 13;
  flashAlpha = 0.32;
  flashColor = "rgba(251,113,133,";

  playSound("dead");
}

function spawnParticles(x, y, count, color, power) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = Math.random() * power + 40;

    particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: Math.random() * 0.45 + 0.35,
      maxLife: Math.random() * 0.45 + 0.35,
      size: Math.random() * 4 + 2,
      color
    });
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.life -= dt;
  }

  particles = particles.filter(p => p.life > 0);
}

function updateGame(dt) {
  updateParticles(dt);

  if (flashAlpha > 0) {
    flashAlpha -= dt * 1.8;
    if (flashAlpha < 0) flashAlpha = 0;
  }

  if (shakeTime > 0) {
    shakeTime -= dt;
    if (shakeTime < 0) shakeTime = 0;
  }

  for (const s of starsBg) {
    s.x -= s.s * dt * 20;
    if (s.x < -5) {
      s.x = BASE_W + 5;
      s.y = Math.random() * BASE_H;
    }
  }

  if (state !== "game" || paused) return;

  elapsed = (performance.now() - startTime) / 1000;

  const prevY = player.y;

  player.vx = level.player.speed;
  player.vy += gravity * 1300 * dt;

  if (player.vy > 1250) player.vy = 1250;
  if (player.vy < -1250) player.vy = -1250;

  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.rotation += 4.2 * dt;

  trail.push({
    x: player.x + player.w / 2,
    y: player.y + player.h / 2,
    r: player.rotation,
    life: 0.35
  });

  for (const t of trail) t.life -= dt;
  trail = trail.filter(t => t.life > 0).slice(-18);

  for (const p of level.platforms) {
    if (rectsOverlap(player, p)) {
      if (gravity > 0) {
        const prevBottom = prevY + player.h;
        if (prevBottom <= p.y + 10 && player.vy >= 0) {
          player.y = p.y - player.h;
          player.vy = 0;
        }
      } else {
        if (prevY >= p.y + p.h - 10 && player.vy <= 0) {
          player.y = p.y + p.h;
          player.vy = 0;
        }
      }
    }
  }

  for (const s of level.spikes) {
    if (rectsOverlap(player, s)) {
      failLevel("SPIKES");
    }
  }

  const t = performance.now() / 1000;

  for (const m of movingRects) {
    const k = (Math.sin((t / m.time) * Math.PI) + 1) / 2;
    m.cx = m.x + (m.toX - m.x) * k;
    m.cy = m.y + (m.toY - m.y) * k;

    if (rectsOverlap(player, { x: m.cx, y: m.cy, w: m.w, h: m.h })) {
      failLevel("MOVING BLOCK");
    }
  }

  if (rectsOverlap(player, level.finish)) {
    completeLevel();
  }

  if (
    player.y > BASE_H + 180 ||
    player.y < -180 ||
    player.x > level.width + 250
  ) {
    failLevel("OUT OF WORLD");
  }

  targetCameraX = player.x - 380;
  if (targetCameraX < 0) targetCameraX = 0;
  if (targetCameraX > level.width - BASE_W) targetCameraX = level.width - BASE_W;

  cameraX += (targetCameraX - cameraX) * 0.12;
}

function clearScreen() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, "#050816");
  bg.addColorStop(0.5, "#070A12");
  bg.addColorStop(1, "#111827");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

  if (shakeTime > 0) {
    const sx = (Math.random() - 0.5) * shakePower * shakeTime * 3;
    const sy = (Math.random() - 0.5) * shakePower * shakeTime * 3;
    ctx.translate(sx, sy);
  }
}

function drawBackground() {
  ctx.save();

  for (const s of starsBg) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;

  const g1 = ctx.createRadialGradient(260, 160, 20, 260, 160, 330);
  g1.addColorStop(0, "rgba(56,189,248,0.22)");
  g1.addColorStop(1, "rgba(56,189,248,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  const g2 = ctx.createRadialGradient(1040, 560, 20, 1040, 560, 360);
  g2.addColorStop(0, "rgba(167,139,250,0.20)");
  g2.addColorStop(1, "rgba(167,139,250,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;

  const gridOffset = state === "game" && level ? -cameraX % 80 : 0;

  for (let x = gridOffset; x < BASE_W; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, BASE_H);
    ctx.stroke();
  }

  for (let y = 0; y < BASE_H; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(BASE_W, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawText(text, x, y, size = 28, color = COLORS.text, align = "center") {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px Arial`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawSmallText(text, x, y, size = 20, color = COLORS.muted, align = "center") {
  ctx.fillStyle = color;
  ctx.font = `${size}px Arial`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function roundRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function isHover(x, y, w, h) {
  return mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
}

function button(label, x, y, w, h, action, locked = false) {
  buttons.push({ x, y, w, h, action, locked });

  const hover = isHover(x, y, w, h) && !locked;

  ctx.save();

  ctx.shadowColor = locked ? "transparent" : hover ? COLORS.cyan : "rgba(56,189,248,0.25)";
  ctx.shadowBlur = hover ? 28 : 14;

  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  if (locked) {
    grad.addColorStop(0, "#1E293B");
    grad.addColorStop(1, "#334155");
  } else if (hover) {
    grad.addColorStop(0, "#1F2937");
    grad.addColorStop(1, "#0F172A");
  } else {
    grad.addColorStop(0, "#111827");
    grad.addColorStop(1, "#0F172A");
  }

  ctx.fillStyle = grad;
  roundRect(x, y, w, h, 16, true, false);

  ctx.shadowBlur = 0;
  ctx.strokeStyle = locked ? "#475569" : hover ? COLORS.cyan : COLORS.platformEdge;
  ctx.lineWidth = hover ? 3 : 2;
  roundRect(x, y, w, h, 16, false, true);

  drawText(label, x + w / 2, y + h / 2, hover ? 25 : 24, locked ? COLORS.muted : COLORS.text);

  ctx.restore();
}

function drawLogo() {
  ctx.save();
  ctx.translate(BASE_W / 2, 105);

  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 28;

  ctx.fillStyle = COLORS.cyan;
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.lineTo(48, 0);
  ctx.lineTo(0, 52);
  ctx.lineTo(-48, 0);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = COLORS.purple;
  ctx.shadowBlur = 18;

  ctx.fillStyle = COLORS.purple;
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(26, 0);
  ctx.lineTo(0, 28);
  ctx.lineTo(-26, 0);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.text;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawMenu() {
  buttons = [];
  cameraX = 0;

  drawBackground();
  drawLogo();

  drawText("FLIPSHIFT", BASE_W / 2, 195, 72, COLORS.text);
  drawSmallText("Меняй гравитацию. Обходи ловушки. Доберись до портала.", BASE_W / 2, 252, 24);

  button("ИГРАТЬ", BASE_W / 2 - 170, 315, 340, 68, () => {
    startLevel(Math.min(save.unlocked - 1, levels.length - 1));
  });

  button("ВЫБОР УРОВНЯ", BASE_W / 2 - 170, 405, 340, 68, () => {
    state = "levels";
  });

  button("СБРОСИТЬ ПРОГРЕСС", BASE_W / 2 - 170, 495, 340, 68, () => {
    localStorage.removeItem(SAVE_KEY);
    save = loadSave();
  });

  drawSmallText(`Открыт уровень: ${save.unlocked} / ${levels.length}`, BASE_W / 2, 615, 22, COLORS.yellow);
  drawSmallText("Space / Arrow Up / клик / тап — сменить гравитацию", BASE_W / 2, 660, 20);
}

function drawLevelSelect() {
  buttons = [];

  drawBackground();

  drawText("ВЫБОР УРОВНЯ", BASE_W / 2, 80, 52);

  const startX = 240;
  const startY = 210;
  const gapX = 200;

  for (let i = 0; i < levels.length; i++) {
    const lvl = levels[i];
    const x = startX + i * gapX;
    const y = startY;

    const unlocked = lvl.id <= save.unlocked;
    const stars = save.stars[lvl.id] || 0;

    button(unlocked ? `LEVEL ${lvl.id}` : "LOCKED", x - 75, y - 50, 150, 100, () => {
      if (unlocked) startLevel(i);
    }, !unlocked);

    drawSmallText(
      unlocked ? "★".repeat(stars) + "☆".repeat(3 - stars) : "---",
      x,
      y + 30,
      21,
      unlocked ? COLORS.yellow : COLORS.muted
    );

    if (unlocked) {
      drawSmallText(lvl.name, x, y + 85, 16, COLORS.muted);
    }
  }

  button("НАЗАД", BASE_W / 2 - 130, 610, 260, 62, () => {
    state = "menu";
  });
}

function drawGame() {
  buttons = [];

  drawBackground();

  ctx.save();
  ctx.translate(-cameraX, 0);

  drawLevelObjects();
  drawTrail();
  drawPlayer();
  drawParticles();

  ctx.restore();

  drawHUD();

  if (paused) {
    drawPauseOverlay();
  }
}

function drawLevelObjects() {
  for (const p of level.platforms) {
    const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
    grad.addColorStop(0, COLORS.platform2);
    grad.addColorStop(1, COLORS.platform);

    ctx.fillStyle = grad;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    ctx.strokeStyle = COLORS.platformEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, p.y, p.w, p.h);

    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "rgba(96,165,250,0.45)";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + p.w, p.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  for (const s of level.spikes) {
    drawSpike(s);
  }

  for (const m of movingRects) {
    ctx.save();
    ctx.shadowColor = COLORS.pink;
    ctx.shadowBlur = 24;

    const grad = ctx.createLinearGradient(m.cx, m.cy, m.cx + m.w, m.cy + m.h);
    grad.addColorStop(0, "#FB7185");
    grad.addColorStop(1, "#BE123C");

    ctx.fillStyle = grad;
    ctx.fillRect(m.cx, m.cy, m.w, m.h);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 3;
    ctx.strokeRect(m.cx, m.cy, m.w, m.h);

    ctx.restore();
  }

  drawFinishPortal(level.finish);
}

function drawFinishPortal(f) {
  const cx = f.x + f.w / 2;
  const cy = f.y + f.h / 2;
  const time = performance.now() / 1000;
  const pulse = Math.sin(time * 5) * 0.08 + 1;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);

  ctx.shadowColor = COLORS.green;
  ctx.shadowBlur = 35;

  const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, 90);
  grad.addColorStop(0, "rgba(52,211,153,0.9)");
  grad.addColorStop(0.45, "rgba(52,211,153,0.35)");
  grad.addColorStop(1, "rgba(52,211,153,0)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, f.w * 0.65, f.h * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = COLORS.green;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, 0, f.w * 0.45, f.h * 0.48, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, f.w * 0.28, f.h * 0.32, time, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawSpike(s) {
  ctx.save();

  ctx.shadowColor = COLORS.pink;
  ctx.shadowBlur = 16;

  const grad = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.h);
  grad.addColorStop(0, "#FB7185");
  grad.addColorStop(1, "#881337");

  ctx.fillStyle = grad;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;

  ctx.beginPath();

  if (s.dir === "down") {
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + s.w / 2, s.y + s.h);
    ctx.lineTo(s.x + s.w, s.y);
  } else {
    ctx.moveTo(s.x, s.y + s.h);
    ctx.lineTo(s.x + s.w / 2, s.y);
    ctx.lineTo(s.x + s.w, s.y + s.h);
  }

  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawTrail() {
  for (let i = 0; i < trail.length; i++) {
    const t = trail[i];
    const a = t.life / 0.35;

    ctx.save();
    ctx.globalAlpha = a * 0.28;
    ctx.translate(t.x, t.y);
    ctx.rotate(t.r);
    ctx.fillStyle = gravity > 0 ? COLORS.cyan : COLORS.purple;
    ctx.fillRect(-21, -21, 42, 42);
    ctx.restore();
  }
}

function drawPlayer() {
  ctx.save();

  ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
  ctx.rotate(player.rotation);

  ctx.shadowColor = gravity > 0 ? COLORS.cyan : COLORS.purple;
  ctx.shadowBlur = 25;

  const grad = ctx.createLinearGradient(-21, -21, 21, 21);
  grad.addColorStop(0, COLORS.cyan);
  grad.addColorStop(1, COLORS.purple);

  ctx.fillStyle = grad;
  ctx.fillRect(-player.w / 2, -player.h / 2, player.w, player.h);

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.strokeRect(-player.w / 2, -player.h / 2, player.w, player.h);

  ctx.strokeStyle = gravity > 0 ? COLORS.cyan : COLORS.purple;
  ctx.lineWidth = 4;
  ctx.strokeRect(-player.w / 2 - 4, -player.h / 2 - 4, player.w + 8, player.h + 8);

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const a = p.life / p.maxLife;

    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHUD() {
  ctx.save();

  ctx.fillStyle = "rgba(17,24,39,0.78)";
  roundRect(20, 20, 320, 135, 16, true, false);

  ctx.strokeStyle = "rgba(96,165,250,0.55)";
  ctx.lineWidth = 2;
  roundRect(20, 20, 320, 135, 16, false, true);

  drawSmallText(`Уровень ${level.id}: ${level.name}`, 42, 48, 20, COLORS.text, "left");
  drawSmallText(`Время: ${elapsed.toFixed(2)}s`, 42, 80, 20, COLORS.text, "left");
  drawSmallText(`Гравитация: ${gravity > 0 ? "ВНИЗ" : "ВВЕРХ"}`, 42, 112, 20, gravity > 0 ? COLORS.cyan : COLORS.purple, "left");
  drawSmallText(`ESC: пауза`, 42, 138, 17, COLORS.muted, "left");

  ctx.restore();
}

function drawPauseOverlay() {
  ctx.fillStyle = "rgba(0,0,0,0.58)";
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  drawText("ПАУЗА", BASE_W / 2, 230, 58);
  drawSmallText("ESC — продолжить", BASE_W / 2, 305, 24);
  drawSmallText("R — рестарт", BASE_W / 2, 345, 24);
}

function drawDead() {
  drawGame();

  ctx.fillStyle = "rgba(0,0,0,0.64)";
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  drawText("РАЗБИЛСЯ", BASE_W / 2, 245, 60, COLORS.pink);
  drawSmallText(deathMessage, BASE_W / 2, 315, 26, COLORS.text);
  drawSmallText("Нажми Space / R / клик, чтобы начать заново", BASE_W / 2, 390, 24);

  drawParticles();
}

function drawVictory() {
  drawGame();

  ctx.fillStyle = "rgba(0,0,0,0.60)";
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  drawText("УРОВЕНЬ ПРОЙДЕН", BASE_W / 2, 220, 54, COLORS.green);
  drawSmallText(`Время: ${elapsed.toFixed(2)}s`, BASE_W / 2, 295, 26, COLORS.text);
  drawText("★".repeat(victoryStars) + "☆".repeat(3 - victoryStars), BASE_W / 2, 355, 48, COLORS.yellow);
  drawSmallText("Space / клик — следующий уровень", BASE_W / 2, 440, 24);

  drawParticles();
}

function drawFlash() {
  if (flashAlpha <= 0) return;

  ctx.save();
  ctx.fillStyle = flashColor + flashAlpha + ")";
  ctx.fillRect(0, 0, BASE_W, BASE_H);
  ctx.restore();
}

function render() {
  clearScreen();

  if (state === "menu") drawMenu();
  else if (state === "levels") drawLevelSelect();
  else if (state === "game") drawGame();
  else if (state === "dead") drawDead();
  else if (state === "victory") drawVictory();

  drawFlash();
}

function gameLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  updateGame(dt);
  render();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

function getGameMousePosition(event) {
  const rect = canvas.getBoundingClientRect();

  const clientX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
  const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? 0;

  const x = (clientX - rect.left - offsetX) / scale;
  const y = (clientY - rect.top - offsetY) / scale;

  return { x, y };
}

function handlePointer(event) {
  event.preventDefault();

  const pos = getGameMousePosition(event);

  for (const b of buttons) {
    if (
      pos.x >= b.x &&
      pos.x <= b.x + b.w &&
      pos.y >= b.y &&
      pos.y <= b.y + b.h
    ) {
      if (!b.locked) b.action();
      return;
    }
  }

  if (state === "game") {
    if (!paused) flipGravity();
  } else if (state === "dead") {
    restartLevel();
  } else if (state === "victory") {
    nextLevel();
  }
}

canvas.addEventListener("mousedown", handlePointer);
canvas.addEventListener("touchstart", handlePointer, { passive: false });

canvas.addEventListener("mousemove", (e) => {
  mouse = getGameMousePosition(e);
});

canvas.addEventListener("mouseleave", () => {
  mouse = { x: -9999, y: -9999 };
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();

    if (state === "game" && !paused) {
      flipGravity();
    } else if (state === "dead") {
      restartLevel();
    } else if (state === "victory") {
      nextLevel();
    }
  }

  if (e.code === "KeyR") {
    if (state === "game" || state === "dead") {
      restartLevel();
    }
  }

  if (e.code === "Escape") {
    if (state === "game") {
      paused = !paused;
    } else if (state === "levels") {
      state = "menu";
    }
  }
});
</script>
</body>
</html>
