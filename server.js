const express = require('express');
const app = express();
const http = require('http').createServer(app);

// Налаштування Socket.io спеціально для хостингу Render.com
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // Дозволяє запити з будь-яких доменів Render
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'] // Пріоритет на чисті WebSockets
});

// Головна сторінка гри
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hexanaut Multi-PC Edition</title>
    <style>
        body { margin: 0; padding: 0; background: #0f0f1a; overflow: hidden; font-family: 'Segoe UI', sans-serif; color: white; }
        canvas { display: block; }
        #login-screen { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15,15,26,0.95); display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 10; }
        .login-box { background: #1c1c3a; padding: 30px; border-radius: 12px; box-shadow: 0 0 20px rgba(0,255,200,0.2); text-align: center; width: 300px; }
        h1 { color: #00ffc8; margin-bottom: 20px; font-size: 28px; letter-spacing: 2px; }
        input { width: 90%; padding: 12px; margin-bottom: 15px; border: none; border-radius: 6px; background: #2a2a52; color: white; font-size: 16px; outline: none; text-align: center; }
        button { width: 97%; padding: 12px; border: none; border-radius: 6px; background: #00ffc8; color: #0f0f1a; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        button:hover { background: #00cca0; transform: scale(1.02); }
        #game-ui { display: none; position: absolute; top: 15px; left: 15px; background: rgba(28,28,58,0.7); padding: 12px 20px; border-radius: 8px; pointer-events: none; border-left: 4px solid #00ffc8; }
        .stat { font-size: 18px; margin: 3px 0; }
        #leaderboard { display: none; position: absolute; top: 15px; right: 15px; background: rgba(28,28,58,0.7); padding: 15px; border-radius: 8px; width: 200px; pointer-events: none; }
        .lb-title { color: #00ffc8; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #3a3a6a; padding-bottom: 5px; }
        .lb-player { display: flex; justify-content: space-between; font-size: 14px; margin: 4px 0; }
    </style>
    <!-- Використовуємо стабільний CDN для Render замість відносного шляху сервера -->
    <script src="https://socket.io"></script>
</head>
<body>
    <div id="login-screen">
        <div class="login-box">
            <h1>HEXANAUT</h1>
            <input type="text" id="username-input" placeholder="Введіть нікнейм" maxlength="14">
            <button id="start-btn">ГРАТИ ОНЛАЙН</button>
        </div>
    </div>
    <div id="game-ui">
        <div class="stat">Гравець: <span id="ui-name" style="color:#00ffc8;">-</span></div>
        <div class="stat">Територія: <span id="ui-score">0</span> гекс.</div>
    </div>
    <div id="leaderboard">
        <div class="lb-title">ТОП ГРАВЦІВ</div>
        <div id="lb-list"></div>
    </div>
    <canvas id="gameCanvas"></canvas>
    <script>
        // Автоматично підлаштовуємо сокети під домен Render (протокол wss:// або https://)
        const socket = io(window.location.origin, {
            transports: ['websocket', 'polling']
        });

        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;

        let myId = null; let players = {}; let mapRadius = 150; const HEX_RADIUS = 18;
        window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });

        document.getElementById('start-btn').addEventListener('click', () => {
            const name = document.getElementById('username-input').value;
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('game-ui').style.display = 'block';
            document.getElementById('leaderboard').style.display = 'block';
            socket.emit('joinGame', name);
        });

        socket.on('init', (data) => {
            myId = data.id; players = data.players; mapRadius = data.mapRadius;
            document.getElementById('ui-name').innerText = players[myId].username;
        });
        socket.on('updatePlayers', (serverPlayers) => { players = serverPlayers; updateLeaderboard(); });
        socket.on('gameOver', () => { alert('Вас ліквідували!'); window.location.reload(); });

        window.addEventListener('mousemove', (e) => {
            if (!myId || !players[myId]) return;
            const angle = Math.atan2(e.clientY - canvas.height / 2, e.clientX - canvas.width / 2);
            socket.emit('updateAngle', angle);
        });

        function getHexPos(q, r) {
            return { x: HEX_RADIUS * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r), y: HEX_RADIUS * (3/2 * r) };
        }

        function drawHex(x, y, radius, color, alpha = 1, stroke = false) {
            ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
            }
            ctx.closePath(); ctx.fill();
            if (stroke) { ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.stroke(); }
            ctx.restore();
        }

        function updateLeaderboard() {
            const list = document.getElementById('lb-list'); list.innerHTML = '';
            const sorted = Object.values(players).sort((a,b) => b.territory.length - a.territory.length).slice(0, 5);
            for (let i = 0; i < sorted.length; i++) {
                const p = sorted[i];
                list.innerHTML += '<div class="lb-player"><span>' + (i+1) + '. ' + p.username + '</span><span style="color:' + p.color + '">' + p.territory.length + '</span></div>';
            }
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const me = players[myId]; if (!me) { requestAnimationFrame(draw); return; }
            const myPos = getHexPos(me.q, me.r);
            ctx.save(); ctx.translate(canvas.width / 2 - myPos.x, canvas.height / 2 - myPos.y);

            for (let id in players) {
                const p = players[id];
                p.territory.forEach(hex => { const pos = getHexPos(hex.q, hex.r); drawHex(pos.x, pos.y, HEX_RADIUS, p.color, 0.25, true); });
                p.tail.forEach(hex => { const pos = getHexPos(hex.q, hex.r); drawHex(pos.x, pos.y, HEX_RADIUS, p.color, 0.65); });
            }
            for (let id in players) {
                const p = players[id]; const pos = getHexPos(p.q, p.r);
                drawHex(pos.x, pos.y, HEX_RADIUS + 2, p.color, 1.0);
                ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(pos.x + 9 * Math.cos(p.angle), pos.y + 9 * Math.sin(p.angle), 4, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = "white"; ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.fillText(p.username, pos.x, pos.y - 25);
            }
            ctx.restore(); document.getElementById('ui-score').innerText = me.territory.length;
            requestAnimationFrame(draw);
        }
        draw();
    </script>
</body>
</html>
    `);
});
let players = {};
const MAP_RADIUS = 150; 

function getHexDirection(angle) {
    const dirs = [
        { q: 1, r: 0 },   
        { q: 0, r: 1 },   
        { q: -1, r: 1 },  
        { q: -1, r: 0 },  
        { q: 0, r: -1 },  
        { q: 1, r: -1 }   
    ];
    let index = Math.round(angle / (Math.PI / 3));
    if (index < 0) index += 6;
    return dirs[index % 6];
}

function fillCapturedTerritory(player) {
    if (player.territory.length === 0) return;

    let minQ = Infinity, maxQ = -Infinity;
    let minR = Infinity, maxR = -Infinity;

    player.territory.forEach(h => {
        if (h.q < minQ) minQ = h.q; if (h.q > maxQ) maxQ = h.q;
        if (h.r < minR) minR = h.r; if (h.r > maxR) maxR = h.r;
    });

    minQ -= 1; maxQ += 1;
    minR -= 1; maxR += 1;

    const territorySet = new Set(player.territory.map(h => `${h.q},${h.r}`));
    const visitedOutside = new Set();
    const queue = [{ q: minQ, r: minR }];
    visitedOutside.add(`${minQ},${minR}`);

    const hexNeighbors = [
        {q:1, r:0}, {q:0, r:1}, {q:-1, r:1},
        {q:-1, r:0}, {q:0, r:-1}, {q:1, r:-1}
    ];

    while (queue.length > 0) {
        const current = queue.shift();
        for (let i = 0; i < hexNeighbors.length; i++) {
            const nQ = current.q + hexNeighbors[i].q;
            const nR = current.r + hexNeighbors[i].r;
            const key = `${nQ},${nR}`;

            if (nQ >= minQ && nQ <= maxQ && nR >= minR && nR <= maxR) {
                if (!territorySet.has(key) && !visitedOutside.has(key)) {
                    visitedOutside.add(key);
                    queue.push({ q: nQ, r: nR });
                }
            }
        }
    }

    for (let q = minQ; q <= maxQ; q++) {
        for (let r = minR; r <= maxR; r++) {
            const key = `${q},${r}`;
            if (!territorySet.has(key) && !visitedOutside.has(key)) {
                if (Math.abs(q) <= MAP_RADIUS && Math.abs(r) <= MAP_RADIUS && Math.abs(q + r) <= MAP_RADIUS) {
                    player.territory.push({ q, r });
                }
            }
        }
    }
}

io.on('connection', (socket) => {
    socket.on('joinGame', (username) => {
        const name = username.trim() || `Гравець #${Math.floor(1000 + Math.random() * 9000)}`;
        const spawnQ = Math.floor(Math.random() * (MAP_RADIUS - 10)) - (MAP_RADIUS / 2);
        const spawnR = Math.floor(Math.random() * (MAP_RADIUS - 10)) - (MAP_RADIUS / 2);

        players[socket.id] = {
            id: socket.id, username: name, q: spawnQ, r: spawnR, angle: 0,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`, tail: [], territory: []
        };

        const p = players[socket.id];
        for (let q = -1; q <= 1; q++) {
            for (let r = -1; r <= 1; r++) {
                p.territory.push({ q: p.q + q, r: p.r + r });
            }
        }
        socket.emit('init', { id: socket.id, players, mapRadius: MAP_RADIUS });
    });

    socket.on('updateAngle', (angle) => {
        if (players[socket.id]) players[socket.id].angle = angle;
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

setInterval(() => {
    for (let id in players) {
        const p = players[id];
        const dir = getHexDirection(p.angle);
        const wasInOwnTerritory = p.territory.some(h => h.q === p.q && h.r === p.r);
        
        if (!wasInOwnTerritory) {
            if (p.tail.some(h => h.q === p.q && h.r === p.r)) {
                io.to(id).emit('gameOver'); delete players[id]; continue;
            }
            p.tail.push({ q: p.q, r: p.r });
        }

        p.q += dir.q; p.r += dir.r;

        if (Math.abs(p.q) > MAP_RADIUS || Math.abs(p.r) > MAP_RADIUS || Math.abs(p.q + p.r) > MAP_RADIUS) {
            p.q -= dir.q; p.r -= dir.r; 
        }

        const nowInTerritory = p.territory.some(h => h.q === p.q && h.r === p.r);
        if (nowInTerritory && p.tail.length > 0) {
            p.tail.forEach(tHex => {
                if (!p.territory.some(h => h.q === tHex.q && h.r === tHex.r)) {
                    p.territory.push(tHex);
                }
            });
            p.tail = [];
            fillCapturedTerritory(p);
        }

        for (let otherId in players) {
            if (otherId !== id) {
                const other = players[otherId];
                if (other.tail.some(h => h.q === p.q && h.r === p.r)) {
                    io.to(otherId).emit('gameOver'); 
                    delete players[otherId];
                }
            }
        }
    }
    io.emit('updatePlayers', players);
}, 150);

// КРИТИЧНО ДЛЯ RENDER: Прив'язка до 0.0.0.0 з урахуванням системного порту
const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => console.log(`Server is active on port ${PORT}`));
