// Add crypto polyfill for container environment
const { webcrypto } = require('node:crypto');
if (!global.crypto) global.crypto = webcrypto;

require('dotenv').config();
const http = require('http');
const fetch = require('node-fetch'); // Add this import
const WhatsAppBot = require('./src/bot');
const { clearAuthState } = require('./src/auth/authState');

// Use Render assigned port or fallback to 10000
const PORT = process.env.PORT || 10000;

let bot;
let server;
let qrCode = null; // Store current QR code

// Update ping function
async function pingServer() {
    if (process.env.SELF_PING_URL) {
        try {
            const res = await fetch(process.env.SELF_PING_URL, {
                method: 'GET',
                headers: { 'User-Agent': 'WhatsApp-Bot/1.0' }
            });
            if (res.ok) {
                console.log('[PING] Server pinged successfully:', res.status);
            } else {
                console.error('[PING] Server ping failed:', res.status);
            }
        } catch (err) {
            console.error('[PING] Failed to ping server:', err.message); 
        }
    }
}

async function startBot() {
    try {
        console.log('[BOT] Starting session...');
        
        // Add longer initial delay
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        bot = new WhatsAppBot();
        bot.setQRCallback((qr) => {
            qrCode = qr; // Store QR code when generated
        });
        await bot.connect();
        
        // Start HTTP server after bot connects
        server = http.createServer((req, res) => {
            if (req.url === '/health') {
                res.writeHead(200);
                res.end('OK');
            } else if (req.url === '/ping') {
                // Add ping endpoint
                res.writeHead(200);
                res.end('PONG');
            } else if (req.url === '/qr') {
                if (qrCode) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html>
                            <head>
                                <title>WhatsApp QR Code</title>
                                <meta name="viewport" content="width=device-width, initial-scale=1">
                            </head>
                            <body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f0f0f0;">
                                <div style="text-align:center;">
                                    <h2>Scan QR Code to Connect</h2>
                                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}">
                                    <p>Please scan within 20 seconds</p>
                                </div>
                            </body>
                        </html>
                    `);
                } else {
                    res.writeHead(404);
                    res.end('No QR code available');
                }
            } else {
                res.writeHead(404);
                res.end();
            }
        });

        server.listen(PORT, () => {
            console.log(`Health check server running on port ${PORT}`);
        });

        // Start ping interval after server starts
        if (process.env.SELF_PING_URL) {
            console.log('[PING] Starting auto-ping service...');
            setInterval(pingServer, 5 * 60 * 1000); // Ping every 5 minutes
        }

        // Handle server errors
        server.on('error', (err) => {
            console.error('HTTP server error:', err);
        });

    } catch (error) {
        console.error('[BOT] Failed to start:', error);
        process.exit(1);
    }
}

// Update SIGTERM handler for graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[BOT] SIGTERM received. Starting graceful shutdown...');
    
    try {
        // Add delay before cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Close server first
        if (server) {
            await new Promise((resolve) => {
                server.close(() => {
                    console.log('[BOT] HTTP server closed');
                    resolve();
                });
            });
        }

        // Cleanup bot resources
        if (bot && bot.sock) {
            await bot.sock.end();
            console.log('[BOT] WhatsApp connection closed');
        }

        // Final cleanup delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('[BOT] Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('[BOT] Error during shutdown:', error);
        process.exit(1);
    }
});

// Add SIGINT handler
process.on('SIGINT', async () => {
    console.log('\n[BOT] Shutting down...');
    // Removed clearAuthState() call
    process.exit(0);
});

startBot().catch(console.error);
