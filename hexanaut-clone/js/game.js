import {
  key, parseKey, neighbor, dist, generateMap, starterTerritory,
  hexToPixel, pixelToHex, dirToAngle, DIRECTIONS,
} from './hex.js';

export const PLAYER_COLOR = '#4ade80';

export class Game {
  constructor(radius = 28, playerName = 'Player') {
    this.radius = radius;
    this.mapCells = generateMap(radius);
    this.totalCells = this.mapCells.size;
    this.owners = new Map();
    this.trails = new Map();
    this.players = [];
    this.humanId = 0;
    this.running = false;
    this.winner = null;
    this._initPlayer(playerName);
  }

  _initPlayer(name) {
    const q = 0;
    const r = 0;
    const { x, y } = hexToPixel(q, r);
    const territory = starterTerritory(q, r, 2);
    for (const k of territory) {
      if (this.mapCells.has(k)) this.owners.set(k, 0);
    }
    this.trails.set(0, []);
    this.players.push({
      id: 0,
      name: name.trim() || 'Player',
      isHuman: true,
      alive: true,
      x, y,
      dir: 0,
      speed: 55,
      color: PLAYER_COLOR,
      territory,
    });
  }

  getPlayer(id) {
    return this.players[id];
  }

  territoryPercent(id) {
    let count = 0;
    for (const owner of this.owners.values()) {
      if (owner === id) count++;
    }
    return (count / this.totalCells) * 100;
  }

  setHumanDirection(dir) {
    const p = this.getPlayer(this.humanId);
    if (p && p.alive) p.dir = dir;
  }

  update(dt) {
    if (!this.running) return;
    const player = this.getPlayer(this.humanId);
    if (player && player.alive) {
      this._movePlayer(player, dt);
    }
    this._checkWin();
  }

  _movePlayer(player, dt) {
    const angle = dirToAngle(player.dir);
    const prevCell = pixelToHex(player.x, player.y);
    const step = player.speed * dt;
    player.x += Math.cos(angle) * step;
    player.y += Math.sin(angle) * step;

    const cell = pixelToHex(player.x, player.y);
    const k = key(cell.q, cell.r);

    if (!this.mapCells.has(k)) {
      player.x -= Math.cos(angle) * step;
      player.y -= Math.sin(angle) * step;
      player.dir = (player.dir + 3) % 6;
      return;
    }

    if (cell.q !== prevCell.q || cell.r !== prevCell.r) {
      this._onEnterCell(player, cell);
    }
  }

  _onEnterCell(player, cell) {
    const k = key(cell.q, cell.r);
    const owner = this.owners.get(k);
    const trail = this.trails.get(player.id);

    if (trail.includes(k)) {
      this._killPlayer(player.id);
      return;
    }

    if (owner === player.id) {
      if (trail.length > 0) this._captureTerritory(player.id);
    } else if (!trail.includes(k)) {
      trail.push(k);
    }
  }

  _captureTerritory(playerId) {
    const trail = this.trails.get(playerId);
    if (!trail.length) return;

    for (const k of trail) {
      this.owners.set(k, playerId);
    }

    const blocked = new Set();
    for (const [k, owner] of this.owners.entries()) {
      if (owner === playerId) blocked.add(k);
    }

    const outside = new Set();
    const queue = [];

    for (const k of this.mapCells) {
      if (blocked.has(k)) continue;
      const { q, r } = parseKey(k);
      const isEdge = DIRECTIONS.some((_, d) => {
        const n = neighbor(q, r, d);
        return !this.mapCells.has(key(n.q, n.r));
      });
      if (isEdge) {
        outside.add(k);
        queue.push(k);
      }
    }

    while (queue.length) {
      const cur = queue.shift();
      const { q, r } = parseKey(cur);
      for (let d = 0; d < 6; d++) {
        const n = neighbor(q, r, d);
        const nk = key(n.q, n.r);
        if (!this.mapCells.has(nk) || blocked.has(nk) || outside.has(nk)) continue;
        outside.add(nk);
        queue.push(nk);
      }
    }

    for (const k of this.mapCells) {
      if (!blocked.has(k) && !outside.has(k)) {
        this.owners.set(k, playerId);
      }
    }

    trail.length = 0;
    this._syncTerritory(playerId);
  }

  _syncTerritory(playerId) {
    const player = this.getPlayer(playerId);
    player.territory = new Set();
    for (const [k, owner] of this.owners.entries()) {
      if (owner === playerId) player.territory.add(k);
    }
  }

  _killPlayer(id) {
    const player = this.getPlayer(id);
    if (!player || !player.alive) return;
    player.alive = false;

    for (const [k, owner] of [...this.owners.entries()]) {
      if (owner === id) this.owners.delete(k);
    }
    this.trails.set(id, []);
    this.running = false;
  }

  _checkWin() {
    const player = this.getPlayer(this.humanId);
    if (player && player.alive && this.territoryPercent(player.id) >= 99.9) {
      this.winner = player;
      this.running = false;
    }
  }

  start() {
    this.running = true;
    this.winner = null;
  }
}
