const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { getAuthState, clearAuthState } = require('./auth/authState');
const MessageHandler = require('./features/messageHandler');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.messageHandler = null;
        this.isConnecting = false;
        this.qrDisplayCount = 0;
        this.maxQrDisplays = 5;
        this.qrShowing = false;
        this.qrCallback = null;
    }

    setQRCallback(callback) {
        this.qrCallback = callback;
    }

    async connect() {
        if (this.isConnecting) {
            console.log('[BOT] Connection attempt in progress...');
            return;
        }

        this.isConnecting = true;

        try {
            const { state, saveCreds } = await getAuthState();
            
            // Initialize message handler before socket creation
            this.messageHandler = new MessageHandler(null);

            // Check creds status
            if (Object.keys(state.creds).length === 0) {
                console.log('[BOT] No credentials found, new QR code will be generated');
            } else {
                console.log('[BOT] Found existing credentials, attempting to restore session');
            }

            const logger = pino({ 
                level: 'error',
                hooks: {
                    logMethod(inputArgs, method) {
                        if (inputArgs[0].err && inputArgs[0].err.message.includes('importKey')) {
                            console.error('[BOT] Crypto error detected, attempting recovery...');
                            this.clearAuthState();
                        }
                        return method.apply(this, inputArgs);
                    }
                }
            });

            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: false, // Disable built-in QR printing
                logger,
                browser: ['CloudNextra Bot', 'Chrome', '1.0.0'],
                connectTimeoutMs: 60000,
                qrTimeout: 40000,
                defaultQueryTimeoutMs: 30000
            });

            // Update message handler with socket instance
            this.messageHandler.updateSocket(this.sock);

            // Connection state tracking
            let isConnected = false;

            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr && !this.qrShowing) {
                    this.qrDisplayCount++;
                    this.qrShowing = true;

                    if (this.qrDisplayCount > this.maxQrDisplays) {
                        console.log('\n[BOT] QR code scan timeout, retrying...');
                        this.qrShowing = false;
                        await this.sock.end();
                        // Don't clear auth here, just retry
                        setTimeout(() => this.connect(), 3000);
                        return;
                    }

                    // Call QR callback if set
                    if (this.qrCallback) {
                        this.qrCallback(qr);
                    }

                    console.log('\n[BOT] Please scan this QR code:');
                    console.log(`[BOT] Or visit: ${process.env.RENDER_EXTERNAL_URL}/qr`);
                    qrcode.generate(qr, {small: true});
                }

                // Reset QR flag when connection changes
                if (connection === 'close' || connection === 'open') {
                    this.qrShowing = false;
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    
                    // Only clear auth on explicit logout from device
                    if (statusCode === DisconnectReason.loggedOut) {
                        console.log('[BOT] Device logged out, clearing auth data...');
                        await clearAuthState();
                        this.sock = null;
                        process.exit(0); // Exit cleanly after logout
                    } else {
                        // Just close connection without clearing auth
                        console.log('[BOT] Connection closed, attempting reconnect...');
                        this.isConnecting = false;
                        setTimeout(() => this.connect(), 3000);
                    }
                    return;
                }

                if (connection === 'open') {
                    isConnected = true;
                    this.qrDisplayCount = 0;
                    this.qrShowing = false;
                    console.log('[BOT] Connected successfully');
                    // Remove message handler initialization from here
                }
            });

            // Handle messages and status updates
            this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
                try {
                    if (!this.messageHandler) {
                        console.warn('[BOT] Message handler not initialized');
                        return;
                    }
                    // Handle both normal messages and status updates
                    for (const msg of messages) {
                        await this.messageHandler.handleMessage({ 
                            messages: [msg], 
                            sock: this.sock,
                            type 
                        });
                    }
                } catch (error) {
                    console.error('[BOT] Message handling error:', error);
                }
            });

            // Add status message events
            this.sock.ev.on('message-receipt.update', async (updates) => {
                for (const update of updates) {
                    if (update.key.remoteJid === 'status@broadcast') {
                        try {
                            console.log('[STATUS] Status view receipt received');
                            // You can add additional status view handling here
                        } catch (err) {
                            console.error('[STATUS] Failed to handle status receipt:', err);
                        }
                    }
                }
            });

            // Add status message events
            this.sock.ev.on('message-receipt.update', async (updates) => {
                for (const update of updates) {
                    if (update.key.remoteJid === 'status@broadcast') {
                        try {
                            console.log('[STATUS] Status receipt received:', {
                                from: update.key.participant,
                                type: update.receipt?.type || 'unknown'
                            });
                        } catch (err) {
                            console.error('[STATUS] Failed to handle status receipt:', err);
                        }
                    }
                }
            });

            this.sock.ev.on('presence.update', ({ id, presences }) => {
                if (id === 'status@broadcast') {
                    console.log('[STATUS] Status presence update:', presences);
                }
            });

            // Handle calls
            this.sock.ev.on('call', async (calls) => {
                for (const call of calls) {
                    if (this.messageHandler.controlPanel.getConfig().antiCall) {
                        if (call.status === "offer") {
                            await this.sock.rejectCall(call.id, call.from);
                            await this.sock.sendMessage(call.from, { 
                                text: '❌ Sorry, calls are not allowed.' 
                            });
                        }
                    }
                }
            });

            this.sock.ev.on('creds.update', saveCreds);

        } catch (error) {
            console.error('[BOT] Critical error:', error);
            // Don't clear auth on general errors
            this.isConnecting = false;
            setTimeout(() => this.connect(), 3000);
        }
    }
}

module.exports = WhatsAppBot;
