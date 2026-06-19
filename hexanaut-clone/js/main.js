import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { Network } from './network.js';
import { angleToDir } from './hex.js';

const menu = document.getElementById('menu');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over');
const canvas = document.getElementById('game-canvas');
const scoreEl = document.getElementById('score');
const playerLabelEl = document.getElementById('player-label');
const playersOnlineEl = document.getElementById('players-online');
const statusEl = document.getElementById('connection-status');
const nameInput = document.getElementById('player-name');
const gameOverTitle = document.getElementById('game-over-title');
const gameOverStats = document.getElementById('game-over-stats');
const playBtn = document.getElementById('play-btn');

const NAME_KEY = 'hexanaut-player-name';
nameInput.value = localStorage.getItem(NAME_KEY) || '';

let game = null;
let renderer = null;
let network = null;
let lastTime = 0;
let animId = null;
let lastSentDir = null;

const keys = {};

playBtn.addEventListener('click', startGame);
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
  sendDirection(angleToDir(angle));
});

function getPlayerName() {
  const name = nameInput.value.trim() || 'Player';
  localStorage.setItem(NAME_KEY, name);
  return name;
}

function sendDirection(dir) {
  if (dir === lastSentDir) return;
  lastSentDir = dir;
  network?.sendDirection(dir);
  game?.setHumanDirection(dir);
}

function handleInput() {
  if (!game || !game.running) return;

  let dir = null;
  if (keys['ArrowRight'] || keys['KeyD']) dir = 0;
  else if (keys['ArrowDown'] || keys['KeyS']) dir = 1;
  else if (keys['ArrowLeft'] || keys['KeyA']) dir = 3;
  else if (keys['ArrowUp'] || keys['KeyW']) dir = 4;

  if (dir !== null) sendDirection(dir);
}

function setStatus(text, ok = true) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle('status-ok', ok);
  statusEl.classList.toggle('status-err', !ok);
}

function showMenu() {
  if (animId) cancelAnimationFrame(animId);
  network?.disconnect();
  network = null;
  game = null;
  lastSentDir = null;

  gameScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  menu.classList.remove('hidden');
  nameInput.focus();
  nameInput.select();
  setStatus('Connect to play with others online');
}

async function startGame() {
  if (animId) cancelAnimationFrame(animId);

  const playerName = getPlayerName();
  playBtn.disabled = true;
  setStatus('Connecting…', true);

  try {
    network = new Network();
    network.onState = (state) => {
      if (!game) return;
      game.applyState(state);
      const me = game.getPlayer(game.humanId);
      if (me) me.isHuman = true;
    };
    network.onPlayers = (count) => {
      if (playersOnlineEl) playersOnlineEl.textContent = `${count} online`;
    };
    network.onDisconnected = () => {
      if (game?.running) {
        setStatus('Disconnected from server', false);
        showGameOver(true);
      }
    };

    const { playerId, state } = await network.connect(playerName);

    game = new Game(28, { multiplayer: true });
    game.humanId = playerId;
    game.applyState(state);
    const human = game.getPlayer(playerId);
    if (human) human.isHuman = true;
    renderer = new Renderer(canvas);

    playerLabelEl.textContent = playerName;
    if (playersOnlineEl) playersOnlineEl.textContent = `${network.playerCount} online`;

    menu.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  } catch {
    setStatus('Server offline — run npm start first', false);
    network?.disconnect();
    network = null;
  } finally {
    playBtn.disabled = false;
  }
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  handleInput();

  if (game) {
    renderer.draw(game);
    updateHUD();

    if (!game.running) {
      showGameOver();
      return;
    }
  }

  animId = requestAnimationFrame(loop);
}

function updateHUD() {
  const pct = game.territoryPercent(game.humanId);
  scoreEl.textContent = `Territory: ${pct.toFixed(1)}%`;
}

function showGameOver(disconnected = false) {
  if (animId) cancelAnimationFrame(animId);
  gameScreen.classList.add('hidden');
  gameOverScreen.classList.remove('hidden');

  const human = game.getPlayer(game.humanId);
  const pct = game.territoryPercent(game.humanId);
  const name = human?.name || getPlayerName();

  if (disconnected) {
    gameOverTitle.textContent = 'Disconnected';
    gameOverStats.textContent = 'Lost connection to the server.';
  } else if (game.winner?.id === game.humanId) {
    gameOverTitle.textContent = 'Victory!';
    gameOverStats.textContent = `${name} wins with ${pct.toFixed(1)}% territory!`;
  } else if (game.winner) {
    gameOverTitle.textContent = 'Defeat';
    gameOverStats.textContent = `${game.winner.name} wins — you reached ${pct.toFixed(1)}%`;
  } else if (human && !human.alive) {
    gameOverTitle.textContent = 'Eliminated!';
    gameOverStats.textContent = `${name} reached ${pct.toFixed(1)}% before getting cut off.`;
  } else {
    gameOverTitle.textContent = 'Game Over';
    gameOverStats.textContent = `${name} — final territory: ${pct.toFixed(1)}%`;
  }
}
