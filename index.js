// Add crypto polyfill for container environment
const { webcrypto } = require('node:crypto');
if (!global.crypto) global.crypto = webcrypto;

require('dotenv').config();
const http = require('http');
const fetch = require('node-fetch');
const WhatsAppBot = require('./src/bot');
const { clearAuthState, resetConnectionAttempts, getConnectionAttempts } = require('./src/auth/authState');
const logger = require('./src/utils/logger');

// Use Render assigned port or fallback to 10000
const PORT = process.env.PORT || 10000;

let bot;
let server;
let qrCode = null;
let isShuttingDown = false;
let pingInterval;

async function pingServer() {
    if (process.env.SELF_PING_URL) {
        try {
            const res = await fetch(process.env.SELF_PING_URL, {
                method: 'GET',
                headers: { 'User-Agent': 'WhatsApp-Bot/1.0' }
            });
            if (res.ok) {
                logger.ping('Server pinged successfully', { status: res.status });
            } else {
                logger.warning('Server ping failed', { status: res.status });
            }
        } catch (err) {
            logger.error('Failed to ping server', { error: err.message }); 
        }
    }
}

async function startBot() {
    try {
        logger.starting('WhatsApp Bot');
        
        // Add longer initial delay
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        bot = new WhatsAppBot();
        bot.setQRCallback((qr) => {
            qrCode = qr;
        });
        await bot.connect();
        
        // Start HTTP server after bot connects
        server = http.createServer(async (req, res) => {
            if (req.url === '/health') {
                res.writeHead(200);
                res.end('OK');
            } else if (req.url === '/ping') {
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
                                <style>
                                    body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
                                    .container { text-align: center; color: white; padding: 20px; }
                                    .qr-box { background: white; border-radius: 15px; padding: 30px; display: inline-block; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
                                    h2 { margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
                                    img { border-radius: 10px; }
                                    p { margin-top: 15px; opacity: 0.9; }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <h2>🤖 CloudNextra Bot - QR Code</h2>
                                    <div class="qr-box">
                                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}">
                                    </div>
                                    <p>📱 Scan with WhatsApp to connect</p>
                                    <p>⏰ QR Code expires in 20 seconds</p>
                                </div>
                            </body>
                        </html>
                    `);
                } else {
                    res.writeHead(404);
                    res.end('No QR code available');
                }
            } else if (req.url === '/clear-auth') {
                try {
                    await clearAuthState();
                    resetConnectionAttempts(); // Also reset the attempt counter
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Auth state cleared successfully' }));
                    logger.info('Auth state cleared via web endpoint');
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: error.message }));
                }
            } else if (req.url === '/status') {
                try {
                    const status = {
                        bot_status: bot && bot.sock ? 'connected' : 'disconnected',
                        qr_available: !!qrCode,
                        connection_attempts: getConnectionAttempts(),
                        uptime: process.uptime()
                    };
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(status, null, 2));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: error.message }));
                }
            } else {
                res.writeHead(404);
                res.end();
            }
        });

        server.listen(PORT, () => {
            logger.connected('HTTP Server');
            logger.info('Health check endpoint available', { port: PORT });
        });

        // Start ping interval after server starts
        if (process.env.SELF_PING_URL) {
            logger.starting('Auto-ping service');
            pingInterval = setInterval(pingServer, 5 * 60 * 1000);
        }

        server.on('error', (err) => {
            logger.error('HTTP server error', { error: err.message });
        });

    } catch (error) {
        logger.error('Failed to start bot', { error: error.message });
        process.exit(1);
    }
}

async function shutdown(signal) {
    if (isShuttingDown) {
        logger.warning('Shutdown already in progress...');
        return;
    }
    isShuttingDown = true;

    logger.warning(`${signal} received - Starting graceful shutdown`);
    logger.separator();
    
    try {
        // Stop ping service first
        if (pingInterval) {
            clearInterval(pingInterval);
            logger.info('Auto-ping service stopped');
        }

        // Close HTTP server
        if (server) {
            await new Promise((resolve) => {
                server.close(() => {
                    logger.info('HTTP server closed');
                    resolve();
                });
            });
        }

        // Allow time for pending operations
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Close WhatsApp connection
        if (bot && bot.sock) {
            await bot.sock.end();
            logger.disconnected('WhatsApp Bot');
        }

        // Final cleanup delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        logger.success('Shutdown completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
    }
}

// Signal handlers
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

async function start() {
    try {
        // Show cool banner
        logger.showBanner();
        logger.showStartupInfo();
        
        await startBot();
    } catch (error) {
        logger.error('Startup error', { error: error.message });
        process.exit(1);
    }
}

// Start the application
start().catch(console.error);
