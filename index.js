// Load polyfills first
require('./polyfill');

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { Boom } = require('@hapi/boom');
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

// Bot state variables - MOVED BEFORE USAGE
let isConnecting = false;
let currentSock = null;
let retryCount = 0;
let botId = null;
const maxRetries = config.reconnectAttempts ?? 5;

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
        botConnected: !!currentSock,
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
        connected: !!currentSock && connectionStatus === 'connected',
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
    console.log('[WA-BOT] Received SIGTERM. Gracefully shutting down...');
    if (currentSock) {
        currentSock.end();
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[WA-BOT] Received SIGINT. Gracefully shutting down...');
    if (currentSock) {
        currentSock.end();
    }
    process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[WA-BOT] Health server running on port ${PORT}`);
});

async function connectToWhatsApp() {
    // avoid parallel connects
    if (isConnecting) return;
    isConnecting = true;

    try {
        // Use Docker-friendly auth path
        const authPath = process.env.RENDER ? '/app/auth_info' : 'auth_info';
        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            printQRInTerminal: true,
            auth: state,
            connectTimeoutMs: 60_000,
            emitOwnEvents: true,
            retryRequestDelayMs: 2000,
            browser: ['CloudNextra Bot', 'Desktop', '1.0.0'],
        });

        // persist credentials on update
        sock.ev.on('creds.update', saveCreds);

        // keep reference for safe close on reconnect
        if (currentSock && currentSock !== sock) {
            try { currentSock.end?.(); } catch (e) { /* ignore */ }
        }
        currentSock = sock;

        // reset retry counter when we successfully connect
        retryCount = 0;

        // store bot id when connection opens
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Handle QR code - IMPROVED LOGGING
            if (qr) {
                qrCodeData = qr;
                lastQRUpdate = new Date().toISOString();
                connectionStatus = 'qr_ready';
                console.log('[WA-BOT] ✅ QR Code generated and stored for web display');
                console.log('[WA-BOT] QR Code length:', qr.length);
            }

            if (connection === 'close') {
                connectionStatus = 'disconnected';
                qrCodeData = null;
                console.log('[WA-BOT] ❌ Connection closed, QR cleared');
                const rawError = lastDisconnect?.error;
                const statusCode = rawError?.output?.statusCode;
                const errorMsg = rawError?.message || JSON.stringify(rawError);
                
                const isDeviceRemoved = errorMsg?.toString().toLowerCase().includes('device_removed') || 
                                      errorMsg?.toString().toLowerCase().includes('device removed') || 
                                      (statusCode === 401 && errorMsg?.toString().toLowerCase().includes('conflict'));
                const isStreamRestartRequired = statusCode === 515 || /restart required/i.test(errorMsg) || /stream errored/i.test(errorMsg);

                const shouldReconnect = (statusCode !== DisconnectReason.loggedOut && statusCode !== 405) && !isDeviceRemoved;

                console.log('[WA-BOT] Connection closed:', errorMsg, 'Code:', statusCode, 'Reconnect:', shouldReconnect);

                // Non-recoverable device/session removal
                if (isDeviceRemoved || statusCode === 401) {
                    console.warn('[WA-BOT] Device/session removed. Clearing local auth and re-registering.');
                    try {
                        fs.rmSync(authPath, { recursive: true, force: true });
                        console.log('[WA-BOT] Local auth_info cleared.');
                    } catch (e) {
                        console.error('[WA-BOT] Failed to clear local auth:', e);
                    }

                    try { sock.end?.(); } catch (e) { /* ignore */ }
                    currentSock = null;

                    retryCount++;
                    if (retryCount < maxRetries) {
                        const delay = config.reconnectDelayOnAuthReset ?? 3000;
                        setTimeout(() => {
                            isConnecting = false;
                            connectToWhatsApp();
                        }, delay);
                    } else {
                        console.error('[WA-BOT] Max retries after auth reset. Exiting.');
                        setTimeout(() => process.exit(1), 1000);
                    }
                    return;
                }

                // Stream restart required
                if (isStreamRestartRequired) {
                    console.warn('Stream error (restart required) detected — attempting controlled in-process restart.');
                    try { sock.end?.(); } catch (e) { /* ignore */ }
                    currentSock = null;

                    retryCount++;
                    if (retryCount < maxRetries) {
                        const delay = config.reconnectDelayOnStreamError ?? (config.reconnectDelay ?? 10000);
                        setTimeout(() => {
                            isConnecting = false;
                            connectToWhatsApp();
                        }, delay);
                    } else {
                        console.error('Exceeded max retries for stream errors — exiting to allow supervisor restart.');
                        setTimeout(() => process.exit(1), 1000);
                    }
                    return;
                }

                // Default reconnect path for recoverable disconnects
                if (shouldReconnect && retryCount < maxRetries) {
                    retryCount++;
                    try { sock.end?.(); } catch (e) { /* ignore */ }
                    setTimeout(() => {
                        isConnecting = false;
                        connectToWhatsApp();
                    }, config.reconnectDelay ?? 5000);
                } else {
                    console.error('[WA-BOT] Max reconnect attempts reached. Exiting.');
                    setTimeout(() => process.exit(1), 1000);
                }
            } else if (connection === 'open') {
                connectionStatus = 'connected';
                qrCodeData = null;
                botId = update?.me?.id || sock?.user?.id || botId;
                console.log(`[WA-BOT] ✅ Connected as ${botId}, QR cleared`);
            } else if (connection === 'connecting') {
                connectionStatus = 'connecting';
                console.log('[WA-BOT] 🔄 Connecting to WhatsApp...');
            }
        });

        // Message handler with all commands
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const m = messages[0];
            if (!m?.message) return;

            const messageType = Object.keys(m.message)[0];
            const messageContent = m.message[messageType];

            // extract plain text for common message types
            let text = '';
            if (messageType === 'conversation') text = messageContent.conversation || '';
            else if (messageType === 'extendedTextMessage') text = messageContent.text || messageContent?.contextInfo?.quotedMessage?.conversation || '';
            else text = (messageContent?.caption || messageContent?.text) || '';

            // normalize prefix and command
            const prefix = config?.commands?.prefix ?? '.';
            const isCommand = text.startsWith(prefix);
            const parts = isCommand ? text.slice(prefix.length).trim().split(/\s+/) : [];
            const cmd = parts[0]?.toLowerCase();
            const args = parts.slice(1).join(' ');

            // Only respond to commands from self
            if (!isCommand || !m.key.fromMe) {
                return;
            }

            try {
                // Handle .info command
                if (cmd === 'info') {
                    const uptimeSeconds = Math.floor(process.uptime());
                    const hours = Math.floor(uptimeSeconds / 3600);
                    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
                    const seconds = uptimeSeconds % 60;
                    const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;
                    
                    const infoText = 
`╔═════════════════════════════╗
║   CloudNextra Bot — Info    ║
╚═════════════════════════════╝

📊 *Bot Status:*
• Connection: ${connectionStatus === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}
• Presence: ${currentPresence === 'available' ? '🟢 Online' : '🔴 Offline'}
• Uptime: ${uptimeFormatted}

🛠️ *Available Commands:*
• ${prefix}info - Show bot information
• ${prefix}online - Set presence to online
• ${prefix}offline - Set presence to offline
`;
                    await sock.sendMessage(m.key.remoteJid, { text: infoText }, { quoted: m });
                    return;
                }

                // Handle .online command
                if (cmd === 'online') {
                    try {
                        await sock.sendPresenceUpdate('available', m.key.remoteJid);
                        currentPresence = 'available';
                        await sock.sendMessage(m.key.remoteJid, { 
                            text: '🟢 *Status Updated*\n\nPresence set to: *Online*' 
                        }, { quoted: m });
                        console.log('[WA-BOT] Presence set to online');
                    } catch (error) {
                        await sock.sendMessage(m.key.remoteJid, { 
                            text: '❌ Failed to set presence to online' 
                        }, { quoted: m });
                        console.error('[WA-BOT] Online command error:', error);
                    }
                    return;
                }

                // Handle .offline command
                if (cmd === 'offline') {
                    try {
                        await sock.sendPresenceUpdate('unavailable', m.key.remoteJid);
                        currentPresence = 'unavailable';
                        await sock.sendMessage(m.key.remoteJid, { 
                            text: '🔴 *Status Updated*\n\nPresence set to: *Offline*' 
                        }, { quoted: m });
                        console.log('[WA-BOT] Presence set to offline');
                    } catch (error) {
                        await sock.sendMessage(m.key.remoteJid, { 
                            text: '❌ Failed to set presence to offline' 
                        }, { quoted: m });
                        console.error('[WA-BOT] Offline command error:', error);
                    }
                    return;
                }

                // Unknown command
                if (cmd) {
                    await sock.sendMessage(m.key.remoteJid, { 
                        text: `❓ Unknown command: *${cmd}*\n\n🛠️ *Available Commands:*\n• ${prefix}info - Show bot information\n• ${prefix}online - Set presence to online\n• ${prefix}offline - Set presence to offline` 
                    }, { quoted: m });
                }

            } catch (error) {
                console.error('[WA-BOT] Command error:', error);
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ An error occurred while processing your command.' 
                }, { quoted: m });
            }

            // Log received messages
            console.log('[WA-BOT] Command executed:', {
                from: m.key.remoteJid,
                command: cmd,
                fromSelf: m.key.fromMe
            });
        });
    } catch (err) {
        connectionStatus = 'error';
        qrCodeData = null;
        console.error('[WA-BOT] Connection error:', err);
        
        retryCount++;
        if (retryCount >= maxRetries) {
            console.error('[WA-BOT] Max retries reached. Exiting.');
            setTimeout(() => process.exit(1), 1000);
        } else {
            isConnecting = false;
            setTimeout(connectToWhatsApp, config.reconnectDelay ?? 5000);
        }
    } finally {
        isConnecting = false;
    }
}

// Add error handler
process.on('unhandledRejection', error => {
    console.log('[WA-BOT] Unhandled rejection:', error);
});

// Start with error handling
connectToWhatsApp().catch(err => {
    console.error('[WA-BOT] Fatal error:', err);
    process.exit(1);
});
