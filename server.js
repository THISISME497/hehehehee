const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

// 1. ВІДДАЧА HTML КОДУ НА ПРЯМУ
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <title>Hexanaut Clone</title>
    <style>
        body { margin: 0; background: #222; display: flex; justify-content: center; align-items: center; height: 100vh; color: white; font-family: sans-serif; }
        canvas { border: 2px solid #555; background: #111; }
    </style>
</head>
<body>
    <canvas id="gameCanvas" width="600" height="600"></canvas>
    
    <!-- Підключаємо вбудований клієнт Socket.io -->
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const CELL_SIZE = 10;

        let myId = null;
        let players = {};

        socket.on('init', (data) => {
            myId = data.id;
            players = data.players;
        });

        socket.on('updatePlayers', (serverPlayers) => {
            players = serverPlayers;
        });

        socket.on('gameOver', () => {
            alert('Ваш хвіст перерізали! Гра закінчена.');
            window.location.reload();
        });

        // Керування кнопками WASD та Стрілками
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp' || e.key === 'w') socket.emit('move', 'up');
            if (e.key === 'ArrowDown' || e.key === 's') socket.emit('move', 'down');
            if (e.key === 'ArrowLeft' || e.key === 'a') socket.emit('move', 'left');
            if (e.key === 'ArrowRight' || e.key === 'd') socket.emit('move', 'right');
        });

        // Малювання гри
        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (let id in players) {
                const p = players[id];

                // Територія
                ctx.fillStyle = p.color;
                ctx.globalAlpha = 0.3;
                p.territory.forEach(cell => {
                    ctx.fillRect(cell.x * CELL_SIZE, cell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                });

                // Хвіст
                ctx.globalAlpha = 0.8;
                p.tail.forEach(cell => {
                    ctx.fillRect(cell.x * CELL_SIZE, cell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                });

                // Голова (Гравець)
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x * CELL_SIZE, p.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }

            requestAnimationFrame(draw);
        }
        draw();
    </script>
</body>
</html>
    `);
});

// 2. ЛОГІКА ОНЛАЙН СЕРВЕРА
let players = {};

io.on('connection', (socket) => {
    players[socket.id] = {
        id: socket.id,
        x: Math.floor(Math.random() * 40) + 10,
        y: Math.floor(Math.random() * 40) + 10,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`,
        tail: [],
        territory: []
    };

    // Створення стартової бази 3х3
    for(let i = -1; i <= 1; i++) {
        for(let j = -1; j <= 1; j++) {
            players[socket.id].territory.push({x: players[socket.id].x + i, y: players[socket.id].y + j});
        }
    }

    socket.emit('init', { id: socket.id, players });
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('move', (direction) => {
        let player = players[socket.id];
        if (!player) return;

        let inOwnTerritory = player.territory.some(t => t.x === player.x && t.y === player.y);
        if (!inOwnTerritory) {
            player.tail.push({ x: player.x, y: player.y });
        }

        if (direction === 'up') player.y--;
        if (direction === 'down') player.y++;
        if (direction === 'left') player.x--;
        if (direction === 'right') player.x++;

        let nowInTerritory = player.territory.some(t => t.x === player.x && t.y === player.y);
        if (nowInTerritory && player.tail.length > 0) {
            player.territory = [...player.territory, ...player.tail];
            player.tail = [];
        }

        // Перевірка зіткнень із хвостами
        for (let id in players) {
            if (id !== socket.id) {
                let hitTail = players[id].tail.some(t => t.x === player.x && t.y === player.y);
                if (hitTail) {
                    io.to(id).emit('gameOver');
                    delete players[id];
                }
            }
        }

        io.emit('updatePlayers', players);
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
