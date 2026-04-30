const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const PORT = process.env.PORT || 8080;

let players = {};

server.on('message', (msg, rinfo) => {
    try {
        const data = JSON.parse(msg.toString());
        const id = `${rinfo.address}:${rinfo.port}`;
        players[id] = { q: data.q, r: data.r, last: Date.now() };
        
        // Відправляємо список всіх гравців назад (UDP)
        const output = JSON.stringify(players);
        server.send(output, rinfo.port, rinfo.address);
    } catch (e) {}
});

server.on('listening', () => console.log(`UDP Server on ${PORT}`));
server.bind(PORT);

// Видаляємо тих, хто відключився
setInterval(() => {
    const now = Date.now();
    for (let id in players) if (now - players[id].last > 3000) delete players[id];
}, 3000);
