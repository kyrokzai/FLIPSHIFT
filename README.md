<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>FLIPSHIFT</title>
  <style>
    html, body {
      margin: 0;
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

const C = {
  bg: "#050816",
  text: "#F8FAFC",
  muted: "#94A3B8",
  cyan: "#38BDF8",
  purple: "#A78BFA",
  pink: "#FB7185",
  green: "#34D399",
  yellow: "#FBBF24",
  platform: "#111827",
  platform2: "#1F2937",
  edge: "#60A5FA",
  grid: "rgba(96,165,250,0.13)"
};

const SAVE_KEY = "flipshift_long_levels_v3";

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
    name: "Neon Sprint",
    width: 3600,
    player: { x: 120, y: 560, speed: 285, gravity: 1 },
    finish: { x: 3420, y: 520, w: 100, h: 140 },
    platforms: [
      { x: 0, y: 660, w: 820, h: 60 },
      { x: 640, y: 60, w: 880, h: 40 },
      { x: 1340, y: 660, w: 950, h: 60 },
      { x: 2140, y: 60, w: 900, h: 40 },
      { x: 2840, y: 660, w: 760, h: 60 }
    ],
    spikes: [
      { x: 720, y: 590, w: 180, h: 70, dir: "up" },
      { x: 1360, y: 60, w: 180, h: 70, dir: "down" },
      { x: 2020, y: 590, w: 260, h: 70, dir: "up" },
      { x: 2880, y: 60, w: 200, h: 70, dir: "down" },
      { x: 3180, y: 590, w: 180, h: 70, dir: "up" }
    ],
    movers: [
      { x: 1060, y: 250, w: 90, h: 140, toX: 1060, toY: 490, time: 1.15 },
      { x: 2520, y: 480, w: 90, h: 140, toX: 2520, toY: 180, time: 1.05 }
    ],
    stars: { three: 13, two: 19, one: 30 }
  },
  {
    id: 2,
    name: "Crusher Road",
    width: 4400,
    player: { x: 120, y: 560, speed: 315, gravity: 1 },
    finish: { x: 4200, y: 70, w: 100, h: 140 },
    platforms: [
      { x: 0, y: 660, w: 760, h: 60 },
      { x: 600, y: 60, w: 900, h: 40 },
      { x: 1350, y: 660, w: 900, h: 60 },
      { x: 2100, y: 60, w: 900, h: 40 },
      { x: 2850, y: 660, w: 880, h: 60 },
      { x: 3600, y: 60, w: 800, h: 40 }
    ],
    spikes: [
      { x: 680, y: 590, w: 220, h: 70, dir: "up" },
      { x: 1280, y: 60, w: 220, h: 70, dir: "down" },
      { x: 1580, y: 590, w: 260, h: 70, dir: "up" },
      { x: 2220, y: 60, w: 230, h: 70, dir: "down" },
      { x: 2920, y: 590, w: 300, h: 70, dir: "up" },
      { x: 3700, y: 60, w: 260, h: 70, dir: "down" }
    ],
    movers: [
      { x: 980, y: 150, w: 120, h: 170, toX: 980, toY: 470, time: 1.1 },
      { x: 1880, y: 460, w: 120, h: 170, toX: 1880, toY: 150, time: 0.95 },
      { x: 3320, y: 160, w: 120, h: 170, toX: 3320, toY: 470, time: 0.9 }
    ],
    stars: { three: 15, two: 23, one: 35 }
  },
  {
    id: 3,
    name: "Long Drop",
    width: 5200,
    player: { x: 120, y: 560, speed: 340, gravity: 1 },
    finish: { x: 4980, y: 520, w: 100, h: 140 },
    platforms: [
      { x: 0, y: 660, w: 740, h: 60 },
      { x: 590, y: 60, w: 840, h: 40 },
      { x: 1280, y: 660, w: 850, h: 60 },
      { x: 1980, y: 60, w: 850, h: 40 },
      { x: 2680, y: 660, w: 850, h: 60 },
      { x: 3380, y: 60, w: 850, h: 40 },
      { x: 4080, y: 660, w: 1120, h: 60 }
    ],
    spikes: [
      { x: 620, y: 590, w: 240, h: 70, dir: "up" },
      { x: 1220, y: 60, w: 240, h: 70, dir: "down" },
      { x: 1500, y: 590, w: 280, h: 70, dir: "up" },
      { x: 2120, y: 60, w: 280, h: 70, dir: "down" },
      { x: 2820, y: 590, w: 300, h: 70, dir: "up" },
      { x: 3520, y: 60, w: 300, h: 70, dir: "down" },
      { x: 4320, y: 590, w: 330, h: 70, dir: "up" },
      { x: 4680, y: 590, w: 180, h: 70, dir: "up" }
    ],
    movers: [
      { x: 960, y: 170, w: 110, h: 180, toX: 960, toY: 470, time: 0.95 },
      { x: 2380, y: 480, w: 110, h: 180, toX: 2380, toY: 150, time: 0.9 },
      { x: 3780, y: 170, w: 110, h: 180, toX: 3780, toY: 470, time: 0.85 },
      { x: 4540, y: 250, w: 160, h: 120, toX: 4540, toY: 430, time: 0.8 }
    ],
    stars: { three: 17, two: 26, one: 40 }
  },
  {
    id: 4,
    name: "Panic Tunnel",
    width: 5850,
    player: { x: 120, y: 90, speed: 365, gravity: -1 },
    finish: { x: 5620, y: 70, w: 100, h: 140 },
    platforms: [
      { x: 0, y: 60, w: 760, h: 40 },
      { x: 620, y: 660, w: 850, h: 60 },
      { x: 1320, y: 60, w: 840, h: 40 },
      { x: 2020, y: 660, w: 850, h: 60 },
      { x: 2720, y: 60, w: 850, h: 40 },
      { x: 3420, y: 660, w: 850, h: 60 },
      { x: 4120, y: 60, w: 850, h: 40 },
      { x: 4820, y: 660, w: 520, h: 60 },
      { x: 5320, y: 60, w: 530, h: 40 }
    ],
    spikes: [
      { x: 650, y: 60, w: 250, h: 70, dir: "down" },
      { x: 1220, y: 590, w: 260, h: 70, dir: "up" },
      { x: 1420, y: 60, w: 280, h: 70, dir: "down" },
      { x: 2120, y: 590, w: 300, h: 70, dir: "up" },
      { x: 2820, y: 60, w: 320, h: 70, dir: "down" },
      { x: 3520, y: 590, w: 320, h: 70, dir: "up" },
      { x: 4220, y: 60, w: 330, h: 70, dir: "down" },
      { x: 4880, y: 590, w: 300, h: 70, dir: "up" },
      { x: 5400, y: 60, w: 220, h: 70, dir: "down" }
    ],
    movers: [
      { x: 1000, y: 180, w: 130, h: 180, toX: 1000, toY: 470, time: 0.85 },
      { x: 2400, y: 470, w: 130, h: 180, toX: 2400, toY: 150, time: 0.8 },
      { x: 3800, y: 180, w: 130, h: 180, toX: 3800, toY: 470, time: 0.78 },
      { x: 5060, y: 170, w: 160, h: 160, toX: 5060, toY: 460, time: 0.75 }
    ],
    stars: { three: 18, two: 28, one: 43 }
  },
  {
    id: 5,
    name: "Final Rush",
    width: 6500,
    player: { x: 120, y: 560, speed: 390, gravity: 1 },
    finish: { x: 6280, y: 520, w: 100, h: 140 },
    platforms: [
      { x: 0, y: 660, w: 720, h: 60 },
      { x: 580, y: 60, w: 820, h: 40 },
      { x: 1260, y: 660, w: 820, h: 60 },
      { x: 1940, y: 60, w: 820, h: 40 },
      { x: 2620, y: 660, w: 820, h: 60 },
      { x: 3300, y: 60, w: 820, h: 40 },
      { x: 3980, y: 660, w: 820, h: 60 },
      { x: 4660, y: 60, w: 820, h: 40 },
      { x: 5340, y: 660, w: 1160, h: 60 }
    ],
    spikes: [
      { x: 620, y: 590, w: 260, h: 70, dir: "up" },
      { x: 1160, y: 60, w: 260, h: 70, dir: "down" },
      { x: 1400, y: 590, w: 300, h: 70, dir: "up" },
      { x: 2080, y: 60, w: 320, h: 70, dir: "down" },
      { x: 2760, y: 590, w: 340, h: 70, dir: "up" },
      { x: 3440, y: 60, w: 340, h: 70, dir: "down" },
      { x: 4120, y: 590, w: 360, h: 70, dir: "up" },
      { x: 4800, y: 60, w: 360, h: 70, dir: "down" },
      { x: 5520, y: 590, w: 300, h: 70, dir: "up" },
      { x: 5940, y: 590, w: 220, h: 70, dir: "up" }
    ],
    movers: [
      { x: 940, y: 150, w: 130, h: 200, toX: 940, toY: 450, time: 0.75 },
      { x: 1760, y: 450, w: 130, h: 200, toX: 1760, toY: 150, time: 0.72 },
      { x: 3120, y: 150, w: 140, h: 200, toX: 3120, toY: 450, time: 0.7 },
      { x: 4480, y: 450, w: 140, h: 200, toX: 4480, toY: 150, time: 0.68 },
      { x: 5700, y: 180, w: 170, h: 160, toX: 5700, toY: 450, time: 0.65 },
      { x: 6100, y: 450, w: 170, h: 160, toX: 6100, toY: 180, time: 0.65 }
    ],
    stars: { three: 20, two: 31, one: 48 }
  }
];

let state = "menu";
let levelIndex = 0;
let level = null;
let player = null;
let gravity = 1;
let cam = 0;
let targetCam = 0;
let startTime = 0;
let elapsed = 0;
let lastTime = performance.now();
let buttons = [];
let moving = [];
let paused = false;
let deathText = "";
let winStars = 0;
let particles = [];
let trail = [];
let bgStars = [];
let mouse = { x: -9999, y: -9999 };
let shake = 0;
let flash = 0;
let flashColor = "rgba(56,189,248,";
let audioCtx = null;

for (let i = 0; i < 130; i++) {
  bgStars.push({
    x: Math.random() * BASE_W,
    y: Math.random() * BASE_H,
    r: Math.random() * 1.9 + 0.4,
    a: Math.random() * 0.65 + 0.12,
    s: Math.random() * 0.35 + 0.08
  });
}

function sound(type) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === "flip") {
      osc.type = "sine";
      osc.frequency.value = gravity > 0 ? 460 : 650;
      gain.gain.value = 0.045;
      osc.start();
      osc.stop(audioCtx.currentTime + 0.07);
    }

    if (type === "dead") {
      osc.type = "sawtooth";
      osc.frequency.value = 120;
      gain.gain.value = 0.07;
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    }

    if (type === "win") {
      osc.type = "triangle";
      osc.frequency.value = 700;
      gain.gain.value = 0.06;
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
    }
  } catch {}
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function starsFor(lvl, time) {
  if (time <= lvl.stars.three) return 3;
  if (time <= lvl.stars.two) return 2;
  if (time <= lvl.stars.one) return 1;
  return 0;
}

function startLevel(i) {
  levelIndex = i;
  level = levels[i];

  player = {
    x: level.player.x,
    y: level.player.y,
    w: 42,
    h: 42,
    vx: level.player.speed,
    vy: 0,
    rot: 0
  };

  gravity = level.player.gravity;
  cam = 0;
  targetCam = 0;
  startTime = performance.now();
  elapsed = 0;
  moving = level.movers.map(m => ({ ...m, cx: m.x, cy: m.y }));
  particles = [];
  trail = [];
  paused = false;
  deathText = "";
  winStars = 0;
  flash = 0.32;
  flashColor = "rgba(56,189,248,";
  state = "game";
}

function restartLevel() {
  startLevel(levelIndex);
}

function nextLevel() {
  if (levelIndex + 1 < levels.length) startLevel(levelIndex + 1);
  else state = "menu";
}

function spawn(x, y, count, color, power) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = Math.random() * power + 45;
    const life = Math.random() * 0.45 + 0.35;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life,
      max: life,
      size: Math.random() * 4 + 2,
      color
    });
  }
}

function flipGravity() {
  if (state !== "game" || paused) return;
  gravity *= -1;
  player.vy = 0;
  flash = 0.28;
  flashColor = gravity > 0 ? "rgba(56,189,248," : "rgba(167,139,250,";
  spawn(player.x + 21, player.y + 21, 24, gravity > 0 ? C.cyan : C.purple, 230);
  sound("flip");
}

function die(reason) {
  if (state !== "game") return;
  state = "dead";
  deathText = reason;
  spawn(player.x + 21, player.y + 21, 80, C.pink, 430);
  shake = 0.38;
  flash = 0.35;
  flashColor = "rgba(251,113,133,";
  sound("dead");
}

function win() {
  if (state !== "game") return;
  state = "victory";
  elapsed = (performance.now() - startTime) / 1000;
  winStars = starsFor(level, elapsed);

  save.unlocked = Math.max(save.unlocked, level.id + 1);
  if (save.unlocked > levels.length) save.unlocked = levels.length;
  save.stars[level.id] = Math.max(save.stars[level.id] || 0, winStars);
  saveGame();

  spawn(player.x + 21, player.y + 21, 90, C.green, 380);
  flash = 0.34;
  flashColor = "rgba(52,211,153,";
  sound("win");
}

function update(dt) {
  for (const s of bgStars) {
    s.x -= s.s * dt * 25;
    if (s.x < -10) {
      s.x = BASE_W + 10;
      s.y = Math.random() * BASE_H;
    }
  }

  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);

  if (flash > 0) flash = Math.max(0, flash - dt * 1.8);
  if (shake > 0) shake = Math.max(0, shake - dt);

  if (state !== "game" || paused) return;

  elapsed = (performance.now() - startTime) / 1000;

  const prevY = player.y;

  player.vx = level.player.speed;
  player.vy += gravity * 1300 * dt;
  player.vy = Math.max(-1250, Math.min(1250, player.vy));

  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.rot += 4.3 * dt;

  trail.push({ x: player.x + 21, y: player.y + 21, r: player.rot, life: 0.34 });
  for (const t of trail) t.life -= dt;
  trail = trail.filter(t => t.life > 0).slice(-20);

  for (const p of level.platforms) {
    if (overlap(player, p)) {
      if (gravity > 0) {
        if (prevY + player.h <= p.y + 12 && player.vy >= 0) {
          player.y = p.y - player.h;
          player.vy = 0;
        }
      } else {
        if (prevY >= p.y + p.h - 12 && player.vy <= 0) {
          player.y = p.y + p.h;
          player.vy = 0;
        }
      }
    }
  }

  for (const s of level.spikes) {
    if (overlap(player, s)) die("SPIKES");
  }

  const time = performance.now() / 1000;
  for (const m of moving) {
    const k = (Math.sin((time / m.time) * Math.PI) + 1) / 2;
    m.cx = m.x + (m.toX - m.x) * k;
    m.cy = m.y + (m.toY - m.y) * k;
    if (overlap(player, { x: m.cx, y: m.cy, w: m.w, h: m.h })) die("CRUSHER BLOCK");
  }

  if (overlap(player, level.finish)) win();

  if (player.y > BASE_H + 180 || player.y < -180 || player.x > level.width + 260) {
    die("OUT OF WORLD");
  }

  targetCam = player.x - 390;
  if (targetCam < 0) targetCam = 0;
  if (targetCam > level.width - BASE_W) targetCam = level.width - BASE_W;
  cam += (targetCam - cam) * 0.12;
}

function clear() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  g.addColorStop(0, "#050816");
  g.addColorStop(0.5, "#070A12");
  g.addColorStop(1, "#111827");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake * 35, (Math.random() - 0.5) * shake * 35);
  }
}

function bg() {
  for (const s of bgStars) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  let g1 = ctx.createRadialGradient(260, 150, 20, 260, 150, 330);
  g1.addColorStop(0, "rgba(56,189,248,0.22)");
  g1.addColorStop(1, "rgba(56,189,248,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  let g2 = ctx.createRadialGradient(1040, 560, 20, 1040, 560, 360);
  g2.addColorStop(0, "rgba(167,139,250,0.20)");
  g2.addColorStop(1, "rgba(167,139,250,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  const off = state === "game" && level ? -cam % 80 : 0;

  for (let x = off; x < BASE_W; x += 80) {
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
}

function text(str, x, y, size, color = C.text, align = "center", bold = true) {
  ctx.fillStyle = color;
  ctx.font = `${bold ? "bold" : ""} ${size}px Arial`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(str, x, y);
}

function round(x, y, w, h, r, fill, stroke) {
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

function hover(x, y, w, h) {
  return mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
}

function button(label, x, y, w, h, action, locked = false) {
  buttons.push({ x, y, w, h, action, locked });
  const hvr = hover(x, y, w, h) && !locked;

  ctx.save();
  ctx.shadowColor = locked ? "transparent" : hvr ? C.cyan : "rgba(56,189,248,0.25)";
  ctx.shadowBlur = hvr ? 28 : 14;

  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  if (locked) {
    g.addColorStop(0, "#1E293B");
    g.addColorStop(1, "#334155");
  } else {
    g.addColorStop(0, hvr ? "#1F2937" : "#111827");
    g.addColorStop(1, "#0F172A");
  }

  ctx.fillStyle = g;
  round(x, y, w, h, 16, true, false);

  ctx.shadowBlur = 0;
  ctx.strokeStyle = locked ? "#475569" : hvr ? C.cyan : C.edge;
  ctx.lineWidth = hvr ? 3 : 2;
  round(x, y, w, h, 16, false, true);

  text(label, x + w / 2, y + h / 2, hvr ? 25 : 24, locked ? C.muted : C.text);
  ctx.restore();
}

function logo() {
  ctx.save();
  ctx.translate(BASE_W / 2, 105);

  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = 28;
  ctx.fillStyle = C.cyan;
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.lineTo(48, 0);
  ctx.lineTo(0, 52);
  ctx.lineTo(-48, 0);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = C.purple;
  ctx.shadowBlur = 18;
  ctx.fillStyle = C.purple;
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(26, 0);
  ctx.lineTo(0, 28);
  ctx.lineTo(-26, 0);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = C.text;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawMenu() {
  buttons = [];
  cam = 0;
  bg();
  logo();

  text("FLIPSHIFT", BASE_W / 2, 195, 72);
  text("Длинные уровни, большие ловушки и быстрый ритм.", BASE_W / 2, 252, 24, C.muted, "center", false);

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

  text(`Открыт уровень: ${save.unlocked} / ${levels.length}`, BASE_W / 2, 615, 22, C.yellow, "center", false);
  text("Space / Arrow Up / клик / тап — сменить гравитацию", BASE_W / 2, 660, 20, C.muted, "center", false);
}

function drawLevels() {
  buttons = [];
  bg();

  text("ВЫБОР УРОВНЯ", BASE_W / 2, 80, 52);

  const startX = 240;
  const y = 220;
  const gap = 200;

  for (let i = 0; i < levels.length; i++) {
    const lvl = levels[i];
    const x = startX + i * gap;
    const unlocked = lvl.id <= save.unlocked;
    const st = save.stars[lvl.id] || 0;

    button(unlocked ? `LEVEL ${lvl.id}` : "LOCKED", x - 75, y - 50, 150, 100, () => {
      if (unlocked) startLevel(i);
    }, !unlocked);

    text(unlocked ? "★".repeat(st) + "☆".repeat(3 - st) : "---", x, y + 30, 21, unlocked ? C.yellow : C.muted, "center", false);
    if (unlocked) text(lvl.name, x, y + 88, 16, C.muted, "center", false);
  }

  text("Уровни стали длиннее и сложнее. Держи ритм.", BASE_W / 2, 500, 22, C.muted, "center", false);

  button("НАЗАД", BASE_W / 2 - 130, 610, 260, 62, () => {
    state = "menu";
  });
}

function drawSpike(s) {
  ctx.save();
  ctx.shadowColor = C.pink;
  ctx.shadowBlur = 16;

  const g = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.h);
  g.addColorStop(0, "#FB7185");
  g.addColorStop(1, "#881337");

  ctx.fillStyle = g;
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
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

function drawPortal(f) {
  const cx = f.x + f.w / 2;
  const cy = f.y + f.h / 2;
  const t = performance.now() / 1000;
  const pulse = 1 + Math.sin(t * 5) * 0.08;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);

  ctx.shadowColor = C.green;
  ctx.shadowBlur = 38;

  const g = ctx.createRadialGradient(0, 0, 5, 0, 0, 95);
  g.addColorStop(0, "rgba(52,211,153,0.95)");
  g.addColorStop(0.45, "rgba(52,211,153,0.35)");
  g.addColorStop(1, "rgba(52,211,153,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, f.w * 0.7, f.h * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = C.green;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, 0, f.w * 0.46, f.h * 0.48, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, f.w * 0.3, f.h * 0.32, t, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const a = p.life / p.max;
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

function drawWorld() {
  ctx.save();
  ctx.translate(-cam, 0);

  for (const p of level.platforms) {
    const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
    g.addColorStop(0, C.platform2);
    g.addColorStop(1, C.platform);

    ctx.fillStyle = g;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    ctx.strokeStyle = C.edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, p.y, p.w, p.h);

    ctx.shadowColor = C.cyan;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "rgba(96,165,250,0.45)";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + p.w, p.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  for (const s of level.spikes) drawSpike(s);

  for (const m of moving) {
    ctx.save();
    ctx.shadowColor = C.pink;
    ctx.shadowBlur = 25;

    const g = ctx.createLinearGradient(m.cx, m.cy, m.cx + m.w, m.cy + m.h);
    g.addColorStop(0, "#FB7185");
    g.addColorStop(1, "#BE123C");

    ctx.fillStyle = g;
    ctx.fillRect(m.cx, m.cy, m.w, m.h);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 3;
    ctx.strokeRect(m.cx, m.cy, m.w, m.h);
    ctx.restore();
  }

  drawPortal(level.finish);

  for (const t of trail) {
    const a = t.life / 0.34;
    ctx.save();
    ctx.globalAlpha = a * 0.28;
    ctx.translate(t.x, t.y);
    ctx.rotate(t.r);
    ctx.fillStyle = gravity > 0 ? C.cyan : C.purple;
    ctx.fillRect(-21, -21, 42, 42);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(player.x + 21, player.y + 21);
  ctx.rotate(player.rot);

  ctx.shadowColor = gravity > 0 ? C.cyan : C.purple;
  ctx.shadowBlur = 26;

  const pg = ctx.createLinearGradient(-21, -21, 21, 21);
  pg.addColorStop(0, C.cyan);
  pg.addColorStop(1, C.purple);

  ctx.fillStyle = pg;
  ctx.fillRect(-21, -21, 42, 42);

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.strokeRect(-21, -21, 42, 42);

  ctx.strokeStyle = gravity > 0 ? C.cyan : C.purple;
  ctx.lineWidth = 4;
  ctx.strokeRect(-25, -25, 50, 50);

  ctx.restore();

  drawParticles();

  ctx.restore();
}

function hud() {
  ctx.fillStyle = "rgba(17,24,39,0.80)";
  round(20, 20, 330, 142, 16, true, false);

  ctx.strokeStyle = "rgba(96,165,250,0.55)";
  ctx.lineWidth = 2;
  round(20, 20, 330, 142, 16, false, true);

  text(`Уровень ${level.id}: ${level.name}`, 42, 48, 20, C.text, "left", false);
  text(`Время: ${elapsed.toFixed(2)}s`, 42, 82, 20, C.text, "left", false);
  text(`Гравитация: ${gravity > 0 ? "ВНИЗ" : "ВВЕРХ"}`, 42, 116, 20, gravity > 0 ? C.cyan : C.purple, "left", false);
  text(`ESC: пауза    R: рестарт`, 42, 143, 17, C.muted, "left", false);
}

function drawGame() {
  buttons = [];
  bg();
  drawWorld();
  hud();

  if (paused) {
    ctx.fillStyle = "rgba(0,0,0,0.58)";
    ctx.fillRect(0, 0, BASE_W, BASE_H);
    text("ПАУЗА", BASE_W / 2, 230, 58);
    text("ESC — продолжить", BASE_W / 2, 305, 24, C.muted, "center", false);
    text("R — рестарт", BASE_W / 2, 345, 24, C.muted, "center", false);
  }
}

function drawDead() {
  drawGame();

  ctx.fillStyle = "rgba(0,0,0,0.64)";
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  text("РАЗБИЛСЯ", BASE_W / 2, 245, 60, C.pink);
  text(deathText, BASE_W / 2, 315, 26, C.text, "center", false);
  text("Нажми Space / R / клик, чтобы начать заново", BASE_W / 2, 390, 24, C.muted, "center", false);
}

function drawVictory() {
  drawGame();

  ctx.fillStyle = "rgba(0,0,0,0.60)";
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  text("УРОВЕНЬ ПРОЙДЕН", BASE_W / 2, 220, 54, C.green);
  text(`Время: ${elapsed.toFixed(2)}s`, BASE_W / 2, 295, 26, C.text, "center", false);
  text("★".repeat(winStars) + "☆".repeat(3 - winStars), BASE_W / 2, 355, 48, C.yellow);
  text("Space / клик — следующий уровень", BASE_W / 2, 440, 24, C.muted, "center", false);
}

function drawFlash() {
  if (flash <= 0) return;
  ctx.fillStyle = flashColor + flash + ")";
  ctx.fillRect(0, 0, BASE_W, BASE_H);
}

function render() {
  clear();

  if (state === "menu") drawMenu();
  else if (state === "levels") drawLevels();
  else if (state === "game") drawGame();
  else if (state === "dead") drawDead();
  else if (state === "victory") drawVictory();

  drawFlash();
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function pos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
  const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
  return {
    x: (clientX - rect.left - offsetX) / scale,
    y: (clientY - rect.top - offsetY) / scale
  };
}

function pointer(e) {
  e.preventDefault();
  const p = pos(e);

  for (const b of buttons) {
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
      if (!b.locked) b.action();
      return;
    }
  }

  if (state === "game" && !paused) flipGravity();
  else if (state === "dead") restartLevel();
  else if (state === "victory") nextLevel();
}

canvas.addEventListener("mousedown", pointer);
canvas.addEventListener("touchstart", pointer, { passive: false });

canvas.addEventListener("mousemove", e => {
  mouse = pos(e);
});

canvas.addEventListener("mouseleave", () => {
  mouse = { x: -9999, y: -9999 };
});

window.addEventListener("keydown", e => {
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();

    if (state === "game" && !paused) flipGravity();
    else if (state === "dead") restartLevel();
    else if (state === "victory") nextLevel();
  }

  if (e.code === "KeyR") {
    if (state === "game" || state === "dead") restartLevel();
  }

  if (e.code === "Escape") {
    if (state === "game") paused = !paused;
    else if (state === "levels") state = "menu";
  }
});
</script>
</body>
</html>
