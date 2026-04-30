const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

let players = {};

wss.on('connection', (ws) => {
    const id = Math.random().toString(36).substr(2, 9);
    console.log(`Player connected: ${id}`);

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        // Оновлюємо позицію гравця
        players[id] = { q: data.q, r: data.r, color: data.color };
        
        // Розсилаємо всім стан світу
        const update = JSON.stringify({ type: 'update', players });
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) client.send(update);
        });
    });

    ws.on('close', () => {
        delete players[id];
        console.log(`Player disconnected: ${id}`);
    });
});

console.log("Server is running...");
