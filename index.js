// Add crypto polyfill for container environment
const { webcrypto } = require('node:crypto');
if (!global.crypto) global.crypto = webcrypto;

require('dotenv').config();
const http = require('http');
const WhatsAppBot = require('./src/bot');
const { clearAuthState } = require('./src/auth/authState');

// Use Render assigned port or fallback to 10000
const PORT = process.env.PORT || 10000;

let bot;
let server;

async function startBot() {
    try {
        // Clear auth state on startup
        console.log('[BOT] Clearing previous auth state...');
        await clearAuthState();
        console.log('[BOT] Auth state cleared. Ready for new connection.');
        
        // Add delay before starting bot
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('\n[BOT] Starting new session. Please wait for QR code...\n');
        
        bot = new WhatsAppBot();
        await bot.connect();
        
        // Start HTTP server after bot connects
        server = http.createServer((req, res) => {
            if (req.url === '/health') {
                res.writeHead(200);
                res.end('OK');
            } else {
                res.writeHead(404);
                res.end();
            }
        });

        server.listen(PORT, () => {
            console.log(`Health check server running on port ${PORT}`);
        });

        // Handle server errors
        server.on('error', (err) => {
            console.error('HTTP server error:', err);
        });

    } catch (error) {
        console.error('[BOT] Failed to start bot:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Starting graceful shutdown...');
    
    try {
        // Close server first
        if (server) {
            await new Promise((resolve) => {
                server.close(() => {
                    console.log('HTTP server closed');
                    resolve();
                });
            });
        }

        // Cleanup bot resources
        if (bot && bot.sock) {
            await bot.sock.end();
            console.log('WhatsApp connection closed');
        }

        // Allow time for cleanup
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

startBot().catch(console.error);
