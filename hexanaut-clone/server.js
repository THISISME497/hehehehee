import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { Game } from './js/game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const TICK_RATE = 30;
const TICK_MS = 1000 / TICK_RATE;

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(__dirname));

const game = new Game(28, { multiplayer: true });
game.start();

const clients = new Map();

function broadcast(msg, excludeWs = null) {
  const data = JSON.stringify(msg);
  for (const [ws] of clients) {
    if (ws !== excludeWs && ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  }
}

function sendState() {
  const state = game.serialize();
  broadcast({ type: 'state', state });
}

function handleDisconnect(ws) {
  const info = clients.get(ws);
  if (!info) return;

  const player = game.getPlayer(info.playerId);
  if (player?.alive) {
    game._killPlayer(info.playerId);
  }

  clients.delete(ws);
  broadcast({ type: 'players', count: clients.size });
  sendState();
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'join') {
      if (clients.has(ws)) return;

      const playerId = game.addPlayer(msg.name || 'Player');
      clients.set(ws, { playerId, name: msg.name });

      ws.send(JSON.stringify({
        type: 'welcome',
        playerId,
        state: game.serialize(),
      }));

      broadcast({ type: 'players', count: clients.size });
      broadcast({ type: 'joined', name: msg.name, playerId }, ws);
      sendState();
      return;
    }

    const info = clients.get(ws);
    if (!info) return;

    if (msg.type === 'dir' && typeof msg.dir === 'number') {
      game.setPlayerDirection(info.playerId, msg.dir % 6);
    }
  });

  ws.on('close', () => handleDisconnect(ws));
  ws.on('error', () => handleDisconnect(ws));
});

setInterval(() => {
  if (game.running) {
    game.update(1 / TICK_RATE);
  }
  sendState();
}, TICK_MS);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Hexanaut server running at http://localhost:${PORT}`);
  console.log(`Share your local IP on port ${PORT} so others can join`);
});
