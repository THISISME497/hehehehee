import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { angleToDir } from './hex.js';

const menu = document.getElementById('menu');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over');
const canvas = document.getElementById('game-canvas');
const scoreEl = document.getElementById('score');
const playerLabelEl = document.getElementById('player-label');
const nameInput = document.getElementById('player-name');
const gameOverTitle = document.getElementById('game-over-title');
const gameOverStats = document.getElementById('game-over-stats');

const NAME_KEY = 'hexanaut-player-name';
nameInput.value = localStorage.getItem(NAME_KEY) || '';

let game = null;
let renderer = null;
let lastTime = 0;
let animId = null;

const keys = {};

document.getElementById('play-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', showMenu);

nameInput.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') startGame();
});

document.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  handleInput();
});

document.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

canvas.addEventListener('mousemove', (e) => {
  if (!game || !game.running) return;
  const human = game.getPlayer(game.humanId);
  if (!human || !human.alive) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left - canvas.width / 2 + renderer.camera.x;
  const my = e.clientY - rect.top - canvas.height / 2 + renderer.camera.y;
  const angle = Math.atan2(my - human.y, mx - human.x);
  game.setHumanDirection(angleToDir(angle));
});

function getPlayerName() {
  const name = nameInput.value.trim() || 'Player';
  localStorage.setItem(NAME_KEY, name);
  return name;
}

function handleInput() {
  if (!game || !game.running) return;

  let dir = null;
  if (keys['ArrowRight'] || keys['KeyD']) dir = 0;
  else if (keys['ArrowDown'] || keys['KeyS']) dir = 1;
  else if (keys['ArrowLeft'] || keys['KeyA']) dir = 3;
  else if (keys['ArrowUp'] || keys['KeyW']) dir = 4;

  if (dir !== null) game.setHumanDirection(dir);
}

function showMenu() {
  if (animId) cancelAnimationFrame(animId);
  gameScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  menu.classList.remove('hidden');
  nameInput.focus();
  nameInput.select();
}

function startGame() {
  if (animId) cancelAnimationFrame(animId);

  const playerName = getPlayerName();
  game = new Game(28, playerName);
  renderer = new Renderer(canvas);
  game.start();

  playerLabelEl.textContent = playerName;

  menu.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');

  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  handleInput();
  game.update(dt);
  renderer.draw(game);
  updateHUD();

  if (!game.running) {
    showGameOver();
    return;
  }

  animId = requestAnimationFrame(loop);
}

function updateHUD() {
  const pct = game.territoryPercent(game.humanId);
  scoreEl.textContent = `Territory: ${pct.toFixed(1)}%`;
}

function showGameOver() {
  gameScreen.classList.add('hidden');
  gameOverScreen.classList.remove('hidden');

  const human = game.getPlayer(game.humanId);
  const pct = game.territoryPercent(game.humanId);
  const name = human?.name || getPlayerName();

  if (game.winner) {
    gameOverTitle.textContent = 'Victory!';
    gameOverStats.textContent = `${name} captured the entire map — ${pct.toFixed(1)}% territory!`;
  } else if (human && !human.alive) {
    gameOverTitle.textContent = 'Eliminated!';
    gameOverStats.textContent = `${name} reached ${pct.toFixed(1)}% before crossing their own trail.`;
  } else {
    gameOverTitle.textContent = 'Game Over';
    gameOverStats.textContent = `${name} — final territory: ${pct.toFixed(1)}%`;
  }
}
