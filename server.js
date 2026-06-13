const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

// ВІДДАЧА КЛІЄНТСЬКОЇ ЧАСТИНИ (ГРА В БРАУЗЕРІ)
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <title>Hexanaut.io MMO</title>
    <style>
        body { margin: 0; padding: 0; background: #1a1a2e; overflow: hidden; font-family: sans-serif; color: white; }
        canvas { display: block; }
        #login-screen { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; background: #111324; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 10; }
        #login-box { background: #1a1a2e; padding: 30px; border-radius: 10px; border: 2px solid #4e54c8; text-align: center; box-shadow: 0 0 20px rgba(78,84,200,0.4); }
        input { padding: 12px; width: 200px; border-radius: 5px; border: none; font-size: 16px; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto; }
        button { padding: 12px 30px; background: #4e54c8; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; font-weight: bold; }
        button:hover { background: #6366f1; }
        #ui { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.6); padding: 12px; border-radius: 8px; pointer-events: none; border: 1px solid #333; }
        #leaderboard { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); padding: 12px; border-radius: 8px; pointer-events: none; width: 180px; border: 1px solid #333; }
        .lb-title { font-weight: bold; border-bottom: 1px solid #555; padding-bottom: 5px; margin-bottom: 5px; color: #ffbc00; }
    </style>
</head>
<body>

    <!-- ЕКРАН ЛОГІНУ -->
    <div id="login-screen">
        <div id="login-box">
            <h2 style="margin-top:0;">HEXANAUT MMO</h2>
            <input type="text" id="username" placeholder="Введіть ваш нік" maxlength="12">
            <button onclick="joinGame()">Грати</button>
        </div>
    </div>

    <!-- ІГРОВИЙ ІНТЕРФЕЙС -->
    <div id="ui">
        <div>Гравець: <b id="my-name">-</b></div>
        <div>Територія: <span id="score" style="color:#00ffcc;font-weight:bold;">0</span> гекс.</div>
    </div>

    <div id="leaderboard">
        <div class="lb-title">ТОП ГРАВЦІВ</div>
        <div id="lb-list"></div>
    </div>

    <canvas id="gameCanvas"></canvas>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        let myId = null;
        let players = {};
        const HEX_RADIUS = 18; // Трохи більший розмір гексагона для видимості

        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });

        // Функція входу в гру
        function joinGame() {
            const name = document.getElementById('username').value.trim() || 'Гравець';
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('my-name').innerText = name;
            
            // Надсилаємо запит серверу на спавн з нікнеймом
            socket.emit('join', name);
        }

        socket.on('init', (data) => { myId = data.id; });
        socket.on('updatePlayers', (serverPlayers) => { players = serverPlayers; });
        
        socket.on('gameOver', () => {
            alert('Ваш хвіст перерізали або ви вилетіли за мапу!');
            document.getElementById('login-screen').style.display = 'flex';
        });

        // Слідкування за мишкою
        window.addEventListener('mousemove', (e) => {
            if (!myId || !players[myId]) return;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
            socket.emit('updateAngle', angle);
        });

        function drawHex(x, y, radius, color, alpha = 1) {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = color;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.04)";
            ctx.stroke();
            ctx.restore();
        }

        function getHexPos(q, r) {
            const x = HEX_RADIUS * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
            const y = HEX_RADIUS * (3/2 * r);
            return { x, y };
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const me = players[myId];
            if (!me) {
                // Малюємо просто заставку, поки гравець не увійшов
                ctx.fillStyle = '#333';
                ctx.font = '20px Arial';
                ctx.fillText('Увійдіть у гру, щоб почати...', canvas.width/2 - 120, canvas.height/2);
                requestAnimationFrame(draw);
                return;
            }

            const myPos = getHexPos(me.q, me.r);
            const camX = canvas.width / 2 - myPos.x;
            const camY = canvas.height / 2 - myPos.y;

            ctx.save();
            ctx.translate(camX, camY);

            // 1. Малюємо ТЕРИТОРІЇ та ХВОСТИ (всі комп'ютери бачать один одного)
            for (let id in players) {
                const p = players[id];

                p.territory.forEach(hex => {
                    const pos = getHexPos(hex.q, hex.r);
                    drawHex(pos.x, pos.y, HEX_RADIUS, p.color, 0.25);
                });

                p.tail.forEach(hex => {
                    const pos = getHexPos(hex.q, hex.r);
                    drawHex(pos.x, pos.y, HEX_RADIUS, p.color, 0.7);
                });
            }

            // 2. Малюємо ГОЛОВИ та НІКНЕЙМИ гравців
            for (let id in players) {
                const p = players[id];
                const pos = getHexPos(p.q, p.r);
                
                drawHex(pos.x, pos.y, HEX_RADIUS + 2, p.color, 1.0);
                
                // Напрямок погляду
                ctx.fillStyle = "white";
                ctx.beginPath();
                ctx.arc(pos.x + 8 * Math.cos(p.angle), pos.y + 8 * Math.sin(p.angle), 4, 0, Math.PI*2);
                ctx.fill();

                // Текст нікнейму над головою
                ctx.fillStyle = "white";
                ctx.font = "12px Arial";
                ctx.textAlign = "center";
                ctx.shadowColor = "black";
                ctx.shadowBlur = 4;
                ctx.fillText(p.name, pos.x, pos.y - 25);
                ctx.shadowBlur = 0;
            }

            ctx.restore();

            // ОНОВЛЕННЯ ІНТЕРФЕЙСУ ТА ТАБЛИЦІ ЛІДЕРІВ
            document.getElementById('score').innerText = me.territory.length;

            // Сортування для топу
            const sorted = Object.values(players).sort((a,b) => b.territory.length - a.territory.length).slice(0, 5);
            let lbHTML = '';
            sorted.forEach((p, index) => {
                lbHTML += \`<div style="color:\${p.color}">\${index+1}. \${p.name} (\${p.territory.length})</div>\`;
            });
            document.getElementById('lb-list').innerHTML = lbHTML;

            requestAnimationFrame(draw);
        }
        draw();
    </script>
</body>
</html>
    `);
});

// ЛОГІКА СЕРВЕРА (МАСШТАБОВАНА КАРТА ТА MMO ОБРОБКА)
let players = {};
const MAP_RADIUS = 120; // ВЕЛИКА КАРТА (В 3 рази більша за попередню!)

function getHexDirection(angle) {
    const dirs = [
        { q: 1, r: 0 },   // 0 deg
        { q: 1, r: -1 },  // 60 deg
        { q: 0, r: -1 },  // 120 deg
        { q: -1, r: 0 },  // 180 deg
        { q: -1, r: 1 },  // 240 deg
        { q: 0, r: 1 }    // 300 deg
    ];
    let index = Math.round(angle / (Math.PI / 3));
    if (index < 0) index += 6;
    return dirs[index % 6];
}

io.on('connection', (socket) => {
    
    // Гравець спочатку у режимі очікування (не спавниться без логіну)
    socket.emit('init', { id: socket.id });

    // Обробка успішного входу користувача
    socket.on('join', (username) => {
        // Спавн у випадковій точці на ВЕЛИКІЙ карті
        players[socket.id] = {
            id: socket.id,
            name: username,
            q: Math.floor(Math.random() * (MAP_RADIUS * 1.5)) - MAP_RADIUS,
            r: Math.floor(Math.random() * (MAP_RADIUS * 1.5)) - MAP_RADIUS,
            angle: 0,
            color: `hsl(${Math.random() * 360}, 100%, 60%)`,
            tail: [],
            territory: []
        };

        const p = players[socket.id];
        // Генерація стартової зони 3х3 гексагони
        for (let q = -2; q <= 2; q++) {
            for (let r = Math.max(-2, -q-2); r <= Math.min(2, -q+2); r++) {
                p.territory.push({ q: p.q + q, r: p.r + r });
            }
        }
    });

    socket.on('updateAngle', (angle) => {
        if (players[socket.id]) players[socket.id].angle = angle;
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// ІГРОВИЙ СЕРВЕРНИЙ ЦИКЛ (ТІК-РЕЙТ)
setInterval(() => {
    for (let id in players) {
        const p = players[id];
        
        const dir = getHexDirection(p.angle);
        const inOwnTerritory = p.territory.some(h => h.q === p.q && h.r === p.r);
        
        if (!inOwnTerritory) {
            // Перевірка: врізання у власний хвіст
            if (p.tail.some(h => h.q === p.q && h.r === p.r)) {
                io.to(id).emit('gameOver');
delete players[id];continue;}p.tail.push({ q: p.q, r: p.r });}// Рухp.q += dir.q;p.r += dir.r;// Межі карти — якщо вилетів, гра закінчуєтьсяif (Math.abs(p.q) > MAP_RADIUS || Math.abs(p.r) > MAP_RADIUS || Math.abs(p.q + p.r) > MAP_RADIUS) {io.to(id).emit('gameOver');delete players[id];continue;}// Повернення на базуconst nowInTerritory = p.territory.some(h => h.q === p.q && h.r === p.r);if (nowInTerritory && p.tail.length > 0) {p.tail.forEach(tHex => {if (!p.territory.some(h => h.q === tHex.q && h.r === tHex.r)) {p.territory.push(tHex);}});p.tail = [];}// СИСТЕМА БОЮ: Перевірка перерізання ліній іншими гравцямиfor (let otherId in players) {if (otherId !== id) {const other = players[otherId];const hitTail = other.tail.some(h => h.q === p.q && h.r === p.r);if (hitTail) {io.to(otherId).emit('gameOver'); // Сервер вбиває жертвуdelete players[otherId];}}}}// Надсилаємо оновлені координати абсолютно ВСІМ підключеним комп'ютерамio.emit('updatePlayers', players);}, 180); // Швидкість серверу оптимізовано для кращого відгуку (180мс)const PORT = process.env.PORT || 3000;http.listen(PORT, () => console.log(MMO Hexanaut engine active on port ${PORT}));
