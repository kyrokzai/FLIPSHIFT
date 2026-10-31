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
      background: #070A12;
      touch-action: none;
      font-family: Arial, sans-serif;
    }

    canvas {
      display: block;
      width: 100vw;
      height: 100vh;
      background: #070A12;
    }
  </style>
</head>
<body>
<canvas id="game"></canvas>

<script>
/*
  FLIPSHIFT — простая версия в одном HTML-файле.
  Управление:
  Space / Arrow Up / клик / тап — сменить гравитацию
  ESC — пауза
  R — рестарт
*/

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
  bg: "#070A12",
  grid: "rgba(96, 165, 250, 0.15)",
  panel: "#111827",
  panel2: "#1F2937",
  text: "#F8FAFC",
  muted: "#94A3B8",
  player: "#38BDF8",
  player2: "#A78BFA",
  platform: "#1F2937",
  platformEdge: "#60A5FA",
  danger: "#FB7185",
  finish: "#34D399",
  warning: "#FBBF24",
};

const SAVE_KEY = "flipshift_simple_save";

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
let startTime = 0;
let elapsed = 0;
let lastTime = performance.now();
let buttons = [];
let movingRects = [];
let paused = false;
let deathMessage = "";
let victoryStars = 0;

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
  startTime = performance.now();
  elapsed = 0;
  deathMessage = "";
  victoryStars = 0;
  movingRects = level.movers.map(m => ({ ...m, cx: m.x, cy: m.y }));
  paused = false;
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
}

function failLevel(reason) {
  state = "dead";
  deathMessage = reason || "CRASHED";
}

function updateGame(dt) {
  if (state !== "game" || paused) return;

  elapsed = (performance.now() - startTime) / 1000;

  const prevY = player.y;

  player.vx = level.player.speed;
  player.vy += gravity * 1300 * dt;

  if (player.vy > 1200) player.vy = 1200;
  if (player.vy < -1200) player.vy = -1200;

  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.rotation += 4 * dt;

  for (const p of level.platforms) {
    if (rectsOverlap(player, p)) {
      if (gravity > 0) {
        const prevBottom = prevY + player.h;
        if (prevBottom <= p.y + 8 && player.vy >= 0) {
          player.y = p.y - player.h;
          player.vy = 0;
        }
      } else {
        if (prevY >= p.y + p.h - 8 && player.vy <= 0) {
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
      failLevel("LASER BLOCK");
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

  cameraX = player.x - 380;
  if (cameraX < 0) cameraX = 0;
  if (cameraX > level.width - BASE_W) cameraX = level.width - BASE_W;
}

function clearScreen() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
}

function drawGrid(worldWidth = BASE_W) {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;

  for (let x = -cameraX % 80; x < BASE_W; x += 80) {
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

  const grad = ctx.createRadialGradient(250, 170, 20, 250, 170, 260);
  grad.addColorStop(0, "rgba(56,189,248,0.20)");
  grad.addColorStop(1, "rgba(56,189,248,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, BASE_W, BASE_H);
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

function button(label, x, y, w, h, action, locked = false) {
  buttons.push({ x, y, w, h, action, locked });

  ctx.fillStyle = locked ? "#334155" : COLORS.panel;
  roundRect(x, y, w, h, 14, true, false);

  ctx.strokeStyle = locked ? "#475569" : COLORS.platformEdge;
  ctx.lineWidth = 2;
  roundRect(x, y, w, h, 14, false, true);

  drawText(label, x + w / 2, y + h / 2, 24, locked ? COLORS.muted : COLORS.text);
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

function drawMenu() {
  buttons = [];
  cameraX = 0;
  drawGrid();

  drawText("FLIPSHIFT", BASE_W / 2, 120, 76, COLORS.text);
  drawSmallText("Меняй гравитацию. Обходи ловушки. Доберись до финиша.", BASE_W / 2, 190, 24);

  button("ИГРАТЬ", BASE_W / 2 - 160, 285, 320, 66, () => {
    startLevel(Math.min(save.unlocked - 1, levels.length - 1));
  });

  button("ВЫБОР УРОВНЯ", BASE_W / 2 - 160, 375, 320, 66, () => {
    state = "levels";
  });

  button("СБРОСИТЬ ПРОГРЕСС", BASE_W / 2 - 160, 465, 320, 66, () => {
    localStorage.removeItem(SAVE_KEY);
    save = loadSave();
  });

  drawSmallText(`Открыт уровень: ${save.unlocked} / ${levels.length}`, BASE_W / 2, 590, 22, COLORS.warning);
  drawSmallText("Space / Arrow Up / клик / тап — сменить гравитацию", BASE_W / 2, 640, 20);
}

function drawLevelSelect() {
  buttons = [];
  drawGrid();

  drawText("ВЫБОР УРОВНЯ", BASE_W / 2, 80, 52);

  const startX = 240;
  const startY = 190;
  const gapX = 200;
  const gapY = 145;

  for (let i = 0; i < levels.length; i++) {
    const lvl = levels[i];
    const col = i % 5;
    const row = Math.floor(i / 5);
    const x = startX + col * gapX;
    const y = startY + row * gapY;

    const unlocked = lvl.id <= save.unlocked;
    const stars = save.stars[lvl.id] || 0;

    button(unlocked ? `LEVEL ${lvl.id}` : "LOCKED", x - 75, y - 45, 150, 90, () => {
      if (unlocked) startLevel(i);
    }, !unlocked);

    drawSmallText(
      unlocked ? "★".repeat(stars) + "☆".repeat(3 - stars) : "---",
      x,
      y + 22,
      20,
      unlocked ? COLORS.warning : COLORS.muted
    );
  }

  button("НАЗАД", BASE_W / 2 - 130, 610, 260, 62, () => {
    state = "menu";
  });
}

function drawGame() {
  buttons = [];

  drawGrid(level.width);

  ctx.save();
  ctx.translate(-cameraX, 0);

  for (const p of level.platforms) {
    ctx.fillStyle = COLORS.platform;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    ctx.strokeStyle = COLORS.platformEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  }

  for (const s of level.spikes) {
    drawSpike(s);
  }

  for (const m of movingRects) {
    ctx.fillStyle = COLORS.danger;
    ctx.fillRect(m.cx, m.cy, m.w, m.h);

    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 3;
    ctx.strokeRect(m.cx, m.cy, m.w, m.h);
  }

  const f = level.finish;
  ctx.fillStyle = COLORS.finish;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(f.x, f.y, f.w, f.h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 4;
  ctx.strokeRect(f.x, f.y, f.w, f.h);

  ctx.save();
  ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
  ctx.rotate(player.rotation);
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(-player.w / 2, -player.h / 2, player.w, player.h);
  ctx.strokeStyle = COLORS.player2;
  ctx.lineWidth = 4;
  ctx.strokeRect(-player.w / 2, -player.h / 2, player.w, player.h);
  ctx.restore();

  ctx.restore();

  drawHUD();

  if (paused) {
    drawPauseOverlay();
  }
}

function drawSpike(s) {
  ctx.fillStyle = COLORS.danger;
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
}

function drawHUD() {
  ctx.fillStyle = "rgba(17,24,39,0.75)";
  roundRect(20, 20, 300, 125, 12, true, false);

  drawSmallText(`Уровень ${level.id}: ${level.name}`, 40, 45, 20, COLORS.text, "left");
  drawSmallText(`Время: ${elapsed.toFixed(2)}s`, 40, 75, 20, COLORS.text, "left");
  drawSmallText(`Гравитация: ${gravity > 0 ? "ВНИЗ" : "ВВЕРХ"}`, 40, 105, 20, COLORS.text, "left");
  drawSmallText(`ESC: пауза`, 40, 132, 18, COLORS.muted, "left");
}

function drawPauseOverlay() {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  drawText("ПАУЗА", BASE_W / 2, 230, 56);
  drawSmallText("ESC — продолжить", BASE_W / 2, 305, 24);
  drawSmallText("R — рестарт", BASE_W / 2, 345, 24);
}

function drawDead() {
  drawGame();

  ctx.fillStyle = "rgba(0,0,0,0.60)";
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  drawText("РАЗБИЛСЯ", BASE_W / 2, 250, 56, COLORS.danger);
  drawSmallText(deathMessage, BASE_W / 2, 310, 26, COLORS.text);
  drawSmallText("Нажми Space / R / клик, чтобы начать заново", BASE_W / 2, 380, 24);
}

function drawVictory() {
  drawGame();

  ctx.fillStyle = "rgba(0,0,0,0.60)";
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  drawText("УРОВЕНЬ ПРОЙДЕН", BASE_W / 2, 220, 52, COLORS.finish);
  drawSmallText(`Время: ${elapsed.toFixed(2)}s`, BASE_W / 2, 295, 26, COLORS.text);
  drawText("★".repeat(victoryStars) + "☆".repeat(3 - victoryStars), BASE_W / 2, 350, 44, COLORS.warning);
  drawSmallText("Space / клик — следующий уровень", BASE_W / 2, 430, 24);
}

function render() {
  clearScreen();

  if (state === "menu") drawMenu();
  else if (state === "levels") drawLevelSelect();
  else if (state === "game") drawGame();
  else if (state === "dead") drawDead();
  else if (state === "victory") drawVictory();
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
