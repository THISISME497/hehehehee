import {
  key, parseKey, neighbor, dist, generateMap, starterTerritory,
  hexToPixel, pixelToHex, dirToAngle, DIRECTIONS,
} from './hex.js';

export const PLAYER_SPEED = 100;

export const PLAYER_COLORS = [
  '#4ade80', '#60a5fa', '#f472b6', '#fbbf24',
  '#a78bfa', '#fb923c', '#2dd4bf', '#f87171',
];

const SPAWN_OFFSETS = [
  [0, 0],
  [-12, 0], [12, 0], [0, -12], [0, 12],
  [-8, -8], [8, 8], [-8, 8], [8, -8],
];

export function getSpawnPosition(index, radius) {
  const [dq, dr] = SPAWN_OFFSETS[index % SPAWN_OFFSETS.length];
  const q = Math.max(-radius + 3, Math.min(radius - 3, dq));
  const r = Math.max(-radius + 3, Math.min(radius - 3, dr));
  return { q, r };
}

export class Game {
  constructor(radius = 28, options = {}) {
    this.radius = radius;
    this.multiplayer = options.multiplayer ?? false;
    this.mapCells = generateMap(radius);
    this.totalCells = this.mapCells.size;
    this.owners = new Map();
    this.trails = new Map();
    this.players = [];
    this.humanId = null;
    this.running = false;
    this.winner = null;
    this.nextPlayerId = 0;

    if (!this.multiplayer && options.playerName) {
      this.addPlayer(options.playerName, true);
    }
  }

  addPlayer(name, isHuman = false) {
    const id = this.nextPlayerId++;
    const { q, r } = getSpawnPosition(id, this.radius);
    const { x, y } = hexToPixel(q, r);
    const territory = starterTerritory(q, r, 2);
    for (const k of territory) {
      if (this.mapCells.has(k)) this.owners.set(k, id);
    }
    this.trails.set(id, []);
    this.players.push({
      id,
      name: name.trim() || `Player ${id + 1}`,
      isHuman,
      alive: true,
      x, y,
      dir: 0,
      speed: PLAYER_SPEED,
      color: PLAYER_COLORS[id % PLAYER_COLORS.length],
      territory,
    });
    if (isHuman) this.humanId = id;
    return id;
  }

  getPlayer(id) {
    return this.players.find((p) => p.id === id);
  }

  territoryPercent(id) {
    let count = 0;
    for (const owner of this.owners.values()) {
      if (owner === id) count++;
    }
    return (count / this.totalCells) * 100;
  }

  setPlayerDirection(id, dir) {
    const p = this.getPlayer(id);
    if (p && p.alive) p.dir = dir;
  }

  setHumanDirection(dir) {
    if (this.humanId !== null) this.setPlayerDirection(this.humanId, dir);
  }

  update(dt) {
    if (!this.running) return;

    for (const player of this.players) {
      if (player.alive) this._movePlayer(player, dt);
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

    for (const [otherId, otherTrail] of this.trails.entries()) {
      if (otherId === player.id || !otherTrail.includes(k)) continue;
      this._killPlayer(otherId);
    }

    if (!this.getPlayer(player.id)?.alive) return;

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
    if (!player) return;
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

    if (!this.multiplayer) {
      this.running = false;
    }
  }

  _alivePlayers() {
    return this.players.filter((p) => p.alive);
  }

  _checkWin() {
    const alive = this._alivePlayers();

    for (const player of alive) {
      if (this.territoryPercent(player.id) >= 99.9) {
        this.winner = player;
        this.running = false;
        return;
      }
    }

    if (this.multiplayer && alive.length === 1 && this.players.length > 1) {
      this.winner = alive[0];
      this.running = false;
    }
  }

  start() {
    this.running = true;
    this.winner = null;
  }

  serialize() {
    return {
      running: this.running,
      winnerId: this.winner?.id ?? null,
      owners: [...this.owners.entries()],
      trails: [...this.trails.entries()],
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHuman: p.isHuman,
        alive: p.alive,
        x: p.x,
        y: p.y,
        dir: p.dir,
        speed: p.speed,
        color: p.color,
      })),
    };
  }

  applyState(state) {
    this.running = state.running;
    this.winner = state.winnerId !== null ? this.getPlayer(state.winnerId) ?? null : null;
    this.owners = new Map(state.owners);
    this.trails = new Map(state.trails.map(([id, trail]) => [Number(id), trail]));

    for (const p of state.players) {
      let local = this.getPlayer(p.id);
      if (!local) {
        this.trails.set(p.id, []);
        local = { territory: new Set(), ...p };
        this.players.push(local);
        this.nextPlayerId = Math.max(this.nextPlayerId, p.id + 1);
      } else {
        Object.assign(local, p);
      }
    }

    for (const p of this.players) {
      this._syncTerritory(p.id);
    }
  }
}
