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
let qrCode = null; // Store current QR code

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

        // Handle server errors
        server.on('error', (err) => {
            console.error('HTTP server error:', err);
        });

    } catch (error) {
        console.error('[BOT] Failed to start:', error);
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

// Add SIGINT handler
process.on('SIGINT', async () => {
    console.log('\n[BOT] Shutting down...');
    // Removed clearAuthState() call
    process.exit(0);
});

startBot().catch(console.error);
