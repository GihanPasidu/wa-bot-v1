// Add crypto polyfill for GitHub Actions environment
global.crypto = require('crypto');

require('dotenv').config();
const http = require('http');
const WhatsAppBot = require('./src/bot');

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200);
        res.end('OK');
    } else {
        res.writeHead(404);
        res.end();
    }
});

const PORT = process.env.PORT || 3000;

async function startBot() {
    const bot = new WhatsAppBot();
    await bot.connect();
    
    // Start HTTP server
    server.listen(PORT, () => {
        console.log(`Health check server running on port ${PORT}`);
    });
}

startBot().catch(console.error);
