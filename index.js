// Load polyfills first
require('./polyfill');

// Import advanced bot implementation
const WhatsAppBot = require('./src/bot');
const logger = require('./src/utils/logger');
const config = require('./config');
const express = require('express');
const QRCode = require('qrcode');
const KeepAliveService = require('./keep-alive');

// Express app for health checks
const app = express();
const PORT = process.env.PORT || 10000;

// Keep-alive configuration for Render free plan
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || process.env.RENDER_URL;
const KEEP_ALIVE_INTERVAL = 10; // minutes

// Store QR code and connection status
let qrCodeData = null;
let connectionStatus = 'disconnected';
let lastQRUpdate = null;

// Bot instance
let whatsappBot = null;
let botId = null;

// Presence tracking
let currentPresence = 'available'; // Default to online

// Initialize keep-alive service
const keepAliveService = new KeepAliveService({
    url: RENDER_URL,
    interval: KEEP_ALIVE_INTERVAL,
    endpoints: ['/health', '/ping', '/wake']
});

// Start keep-alive service
keepAliveService.start();

// Health endpoint with enhanced information
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        botConnected: whatsappBot && whatsappBot.sock,
        connectionStatus: connectionStatus,
        keepAliveEnabled: !!RENDER_URL,
        memoryUsage: process.memoryUsage()
    });
});

// Keep-alive endpoint specifically for external services
app.get('/ping', (req, res) => {
    res.status(200).json({ 
        pong: true,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        status: connectionStatus
    });
});

// Wake-up endpoint to prevent sleeping
app.get('/wake', (req, res) => {
    res.status(200).json({ 
        message: 'Bot is awake!',
        timestamp: new Date().toISOString(),
        botConnected: !!currentSock,
        connectionStatus: connectionStatus
    });
});

// QR Code endpoint - FIXED to handle errors better
app.get('/qr', async (req, res) => {
    try {
        if (qrCodeData) {
            console.log('[WA-BOT] Generating QR code for web display');
            const qrImage = await QRCode.toDataURL(qrCodeData, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            res.json({ 
                success: true, 
                qr: qrImage, 
                timestamp: lastQRUpdate,
                status: connectionStatus 
            });
        } else {
            res.json({ 
                success: false, 
                message: 'No QR code available',
                status: connectionStatus 
            });
        }
    } catch (error) {
        console.error('[WA-BOT] QR generation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/status', (req, res) => {
    res.json({
        connected: whatsappBot && whatsappBot.sock && connectionStatus === 'connected',
        status: connectionStatus,
        presence: currentPresence,
        uptime: Math.floor(process.uptime()),
        botId: botId,
        hasQR: !!qrCodeData
    });
});

app.get('/keep-alive-stats', keepAliveService.getStatsEndpoint());

app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>CloudNextra WhatsApp Bot</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 0; 
                    padding: 20px; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    min-height: 100vh;
                    color: #333;
                }
                .container { 
                    background: white; 
                    padding: 30px; 
                    border-radius: 15px; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    max-width: 600px;
                    margin: 0 auto;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .status { 
                    padding: 15px; 
                    border-radius: 8px; 
                    margin: 15px 0; 
                    text-align: center;
                    font-weight: bold;
                }
                .online { background: #d4edda; color: #155724; border: 2px solid #c3e6cb; }
                .offline { background: #f8d7da; color: #721c24; border: 2px solid #f5c6cb; }
                .connecting { background: #fff3cd; color: #856404; border: 2px solid #ffeaa7; }
                .qr-section {
                    text-align: center;
                    margin: 20px 0;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 10px;
                }
                .qr-code {
                    max-width: 256px;
                    margin: 20px auto;
                    padding: 20px;
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }
                .qr-code img {
                    width: 100%;
                    height: auto;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin: 20px 0;
                }
                .info-item {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                }
                .refresh-btn {
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 16px;
                    margin: 10px 5px;
                }
                .refresh-btn:hover {
                    background: #0056b3;
                }
                .loading {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    color: #666;
                }
                .keep-alive-info {
                    background: #e3f2fd;
                    border: 1px solid #2196f3;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 15px 0;
                    text-align: center;
                }
                .badge {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                .badge-success { background: #4caf50; color: white; }
                .badge-warning { background: #ff9800; color: white; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🤖 CloudNextra WhatsApp Bot</h1>
                    <p>Professional WhatsApp automation service</p>
                    ${RENDER_URL ? '<span class="badge badge-success">Keep-Alive Active</span>' : '<span class="badge badge-warning">Local Mode</span>'}
                </div>
                
                ${RENDER_URL ? `
                <div class="keep-alive-info">
                    <h4>🔄 Keep-Alive Status</h4>
                    <p>Automatic pings every ${KEEP_ALIVE_INTERVAL} minutes to prevent sleeping</p>
                    <p><strong>Service URL:</strong> ${RENDER_URL}</p>
                </div>
                ` : ''}
                
                <div id="status-section">
                    <div class="status connecting">
                        <span class="loading"></span> Loading connection status...
                    </div>
                </div>

                <div id="qr-section" class="qr-section" style="display: none;">
                    <h3>📱 Scan QR Code to Connect</h3>
                    <p>Open WhatsApp on your phone → Settings → Linked Devices → Link a Device</p>
                    <div class="qr-code">
                        <img id="qr-image" src="" alt="QR Code" />
                    </div>
                    <button class="refresh-btn" onclick="refreshQR()">🔄 Refresh QR Code</button>
                </div>

                <div class="info-grid">
                    <div class="info-item">
                        <strong>Uptime</strong><br>
                        <span id="uptime">${Math.floor(process.uptime())} seconds</span>
                    </div>
                    <div class="info-item">
                        <strong>Presence</strong><br>
                        <span id="presence">${currentPresence === 'available' ? '🟢 Online' : '🔴 Offline'}</span>
                    </div>
                </div>

                <div style="text-align: center; margin: 20px 0;">
                    <button class="refresh-btn" onclick="refreshStatus()">🔄 Refresh Status</button>
                    <button class="refresh-btn" onclick="location.reload()">↻ Reload Page</button>
                </div>

                <div class="footer">
                    <p><small>Made by CloudNextra</small></p>
                    <p><small>Last updated: <span id="last-update">${new Date().toLocaleString()}</span></small></p>
                </div>
            </div>

            <script>
                let refreshInterval;

                async function updateStatus() {
                    try {
                        const response = await fetch('/status');
                        const data = await response.json();
                        
                        const statusSection = document.getElementById('status-section');
                        const qrSection = document.getElementById('qr-section');
                        const uptimeSpan = document.getElementById('uptime');
                        const presenceSpan = document.getElementById('presence');
                        
                        // Update uptime status
                        uptimeSpan.textContent = data.uptime + ' seconds';
                        presenceSpan.textContent = data.presence === 'available' ? '🟢 Online' : '🔴 Offline';
                        
                        if (data.connected) {
                            statusSection.innerHTML = '<div class="status online">🟢 Connected to WhatsApp</div>';
                            qrSection.style.display = 'none';
                            if (refreshInterval) {
                                clearInterval(refreshInterval);
                                refreshInterval = null;
                            }
                        } else {
                            statusSection.innerHTML = '<div class="status offline">🔴 Disconnected from WhatsApp</div>';
                            await updateQR();
                        }
                        
                        // Update keep-alive info if present
                        const keepAliveSection = document.querySelector('.keep-alive-info');
                        if (keepAliveSection && data.keepAliveEnabled) {
                            const lastPing = new Date().toLocaleTimeString();
                            keepAliveSection.innerHTML += \`<p><small>Last check: \${lastPing}</small></p>\`;
                        }
                        
                        document.getElementById('last-update').textContent = new Date().toLocaleString();
                    } catch (error) {
                        console.error('Error updating status:', error);
                    }
                }

                async function updateQR() {
                    try {
                        const response = await fetch('/qr');
                        const data = await response.json();
                        const qrSection = document.getElementById('qr-section');
                        
                        if (data.success && data.qr) {
                            document.getElementById('qr-image').src = data.qr;
                            qrSection.style.display = 'block';
                        } else {
                            qrSection.style.display = 'none';
                        }
                    } catch (error) {
                        console.error('Error updating QR:', error);
                    }
                }

                async function refreshQR() {
                    await updateQR();
                }

                async function refreshStatus() {
                    await updateStatus();
                }

                // Initial load
                updateStatus();

                // Auto-refresh every 5 seconds when disconnected
                refreshInterval = setInterval(updateStatus, 5000);
            </script>
        </body>
        </html>
    `);
});

// Add graceful shutdown for Docker
process.on('SIGTERM', () => {
    logger.warning('Received SIGTERM. Gracefully shutting down...');
    if (whatsappBot && whatsappBot.sock) {
        whatsappBot.sock.end();
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.warning('Received SIGINT. Gracefully shutting down...');
    if (whatsappBot && whatsappBot.sock) {
        whatsappBot.sock.end();
    }
    process.exit(0);
});

// Initialize the advanced WhatsApp bot
async function initializeBot() {
    try {
        // Show startup banner
        logger.showBanner();
        logger.showStartupInfo();
        logger.separator();
        
        // Create bot instance
        whatsappBot = new WhatsAppBot();
        
        // Set QR callback to update web interface
        whatsappBot.setQRCallback((qr) => {
            qrCodeData = qr;
            lastQRUpdate = new Date().toISOString();
            connectionStatus = 'qr_ready';
            logger.qrGenerated();
        });

        // Set connection status callback
        whatsappBot.setConnectionStatusCallback((status, botInfo = null) => {
            connectionStatus = status;
            if (botInfo) {
                botId = botInfo.id;
                currentPresence = botInfo.presence || 'available';
            }
            if (status === 'connected') {
                qrCodeData = null;
                logger.connected('WhatsApp');
            } else if (status === 'disconnected') {
                qrCodeData = null;
                logger.disconnected('WhatsApp');
            }
        });

        // Start bot connection
        logger.starting('WhatsApp Bot');
        await whatsappBot.connect();
        
    } catch (error) {
        logger.error('Failed to initialize bot', { error: error.message });
        setTimeout(() => process.exit(1), 1000);
    }
}

app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Health server running on port ${PORT}`, { port: PORT });
    
    // Initialize bot after server starts
    initializeBot();
});

// Add error handler
process.on('unhandledRejection', error => {
    logger.error('Unhandled rejection', { error: error.message });
});

// Start keep-alive service
if (RENDER_URL) {
    keepAliveService.start();
    logger.info('Keep-alive service started', { url: RENDER_URL, interval: KEEP_ALIVE_INTERVAL });
}
