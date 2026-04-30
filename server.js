const WebSocket = require('ws');
const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port });

let players = {};
const colors = [0x0000FF, 0xFF0000, 0x00FF00, 0xFFFF00, 0xFF00FF, 0x00FFFF]; // Синій, Червоний, Зелений...

wss.on('connection', (ws) => {
    const id = Math.random().toString(36).substr(2, 9);
    // Призначаємо колір залежно від кількості гравців
    const colorIdx = Object.keys(players).length % colors.length;
    players[id] = { q: 0, r: 0, trail: [], color: colors[colorIdx], score: 0 };

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (players[id]) {
            players[id].q = data.q;
            players[id].r = data.r;
            players[id].trail = data.trail || [];

            // Перевірка на "Slice": чи врізався хтось у хвіст іншого
            Object.keys(players).forEach(otherId => {
                if (id !== otherId) {
                    players[otherId].trail.forEach(t => {
                        if (t.q === data.q && t.r === data.r) {
                            // Якщо гравець А наступив на хвіст гравця Б
                            ws.send(JSON.stringify({ type: 'killed_someone' }));
                            // Можна надіслати сигнал смерті гравцю Б через його сокет
                        }
                    });
                }
            });
        }
        
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'update', players }));
            }
        });
    });

    ws.on('close', () => { delete players[id]; });
});
