const http = require('http');

// Render sets the PORT environment variable. If not found, it defaults to 10000.
const port = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('67');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0:${port}/`);
});
