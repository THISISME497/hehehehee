import {
  HEX_SIZE, parseKey, hexToPixel, dirToAngle,
} from './hex.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 0 };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  follow(x, y) {
    this.camera.x = x;
    this.camera.y = y;
  }

  worldToScreen(x, y) {
    return {
      x: x - this.camera.x + this.canvas.width / 2,
      y: y - this.camera.y + this.canvas.height / 2,
    };
  }

  draw(game) {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#0f1419';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const human = game.getPlayer(game.humanId);
    if (human) this.follow(human.x, human.y);

    this._drawGrid(game);
    this._drawTerritory(game);
    this._drawTrails(game);
    this._drawPlayers(game);
  }

  _drawGrid(game) {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;

    for (const k of game.mapCells) {
      const { q, r } = parseKey(k);
      const { x, y } = hexToPixel(q, r);
      const s = this.worldToScreen(x, y);
      this._strokeHex(ctx, s.x, s.y, HEX_SIZE - 1);
    }
  }

  _drawTerritory(game) {
    const { ctx } = this;

    for (const k of game.mapCells) {
      const owner = game.owners.get(k);
      if (owner === undefined) continue;
      const player = game.getPlayer(owner);
      if (!player) continue;

      const { q, r } = parseKey(k);
      const { x, y } = hexToPixel(q, r);
      const s = this.worldToScreen(x, y);
      ctx.fillStyle = this._withAlpha(player.color, 0.55);
      this._fillHex(ctx, s.x, s.y, HEX_SIZE - 0.5);
    }
  }

  _drawTrails(game) {
    const { ctx } = this;

    for (const [pid, trail] of game.trails.entries()) {
      const player = game.getPlayer(pid);
      if (!player || !player.alive || trail.length === 0) continue;

      ctx.strokeStyle = player.color;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      const start = this.worldToScreen(player.x, player.y);
      ctx.moveTo(start.x, start.y);

      for (const k of trail) {
        const { q, r } = parseKey(k);
        const { x, y } = hexToPixel(q, r);
        const s = this.worldToScreen(x, y);
        ctx.lineTo(s.x, s.y);
      }
      ctx.stroke();

      for (const k of trail) {
        const { q, r } = parseKey(k);
        const { x, y } = hexToPixel(q, r);
        const s = this.worldToScreen(x, y);
        ctx.fillStyle = this._withAlpha(player.color, 0.35);
        this._fillHex(ctx, s.x, s.y, HEX_SIZE * 0.45);
      }
    }
  }

  _drawPlayers(game) {
    const { ctx } = this;

    for (const player of game.players) {
      if (!player.alive) continue;
      const s = this.worldToScreen(player.x, player.y);

      ctx.beginPath();
      ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = player.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      const angle = dirToAngle(player.dir);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.cos(angle) * 16, s.y + Math.sin(angle) * 16);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (player.isHuman) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, 14, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(player.name, s.x, s.y - 18);
    }
  }

  _fillHex(ctx, cx, cy, size) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      const x = cx + size * Math.cos(angle);
      const y = cy + size * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  _strokeHex(ctx, cx, cy, size) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      const x = cx + size * Math.cos(angle);
      const y = cy + size * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  _withAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
}
