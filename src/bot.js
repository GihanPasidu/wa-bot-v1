const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { getAuthState, clearAuthState } = require('./auth/authState');
const MessageHandler = require('./features/messageHandler');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.messageHandler = null;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.isConnecting = false;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
    }

    async connect() {
        // Prevent multiple connection attempts
        if (this.isConnecting) {
            console.log('[BOT] Connection attempt already in progress...');
            return;
        }

        this.isConnecting = true;

        try {
            const { state, saveCreds } = await getAuthState();
            if (!Object.keys(state.creds).length) {
                console.log('[BOT] No existing credentials, starting fresh session...');
            } else {
                console.log('[BOT] Found existing credentials, attempting to restore session...');
            }

            // Use Pino logger with error level and custom error handling
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

            // Add safety check 
            if (this.sock?.ws) {
                try {
                    await this.sock.ws.close();
                } catch (err) {
                    console.log('[BOT] Error closing existing connection:', err.message);
                }
                this.sock = null;
            }

            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: true,
                logger,
                browser: ['CloudNextra Bot', 'Chrome', '1.0.0'],
                // Adjusted timeouts
                connectTimeoutMs: 60000,
                qrTimeout: 40000,
                defaultQueryTimeoutMs: 30000,
                // Keep alive settings
                keepAliveIntervalMs: 15000,
                retryRequestDelayMs: 5000,
                // Disable auto reconnect
                retries: 0,
                maxRetryAttempts: 0,
                systemReconnect: false
            });

            // Connection state tracking
            let isConnected = false;
            let connectionTimeout;

            let qrDisplayCount = 0;
            const maxQrDisplays = 5;
            let connectionStartTime = Date.now();

            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                // Clear existing timeout if any
                if (connectionTimeout) {
                    clearTimeout(connectionTimeout);
                }

                // Set new connection timeout
                connectionTimeout = setTimeout(async () => {
                    if (!isConnected) {
                        console.log('[BOT] Connection timeout, attempting restart...');
                        try {
                            if (this.sock?.ws?.readyState !== 3) { // Not CLOSED
                                await this.sock.ws.close();
                            }
                        } catch (err) {
                            console.log('[BOT] Error closing socket:', err.message);
                        }
                        this.sock = null;
                        this.isConnecting = false;
                        setTimeout(() => this.connect(), 3000);
                    }
                }, 60000);

                // Handle QR code
                if (qr) {
                    qrDisplayCount++;
                    if (qrDisplayCount > maxQrDisplays) {
                        console.log('\n[BOT] QR code scan timeout. Restarting connection...');
                        await this.sock.end();
                        await clearAuthState();
                        setTimeout(() => this.connect(), 3000);
                        return;
                    }

                    console.clear();
                    console.log('\n[BOT] Please scan this QR code within 40 seconds:');
                    console.log(`[BOT] Attempt ${qrDisplayCount} of ${maxQrDisplays}`);
                    console.log('╭═══════════════════════════╮');
                    console.log('║    SCAN QR CODE BELOW     ║');
                    console.log('╰═══════════════════════════╯\n');
                    
                    qrcode.generate(qr, {
                        small: false,
                        scale: 8
                    });
                }
                
                if (connection === 'close') {
                    isConnected = false;
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    console.log('[BOT] Connection closed. Status:', statusCode);
                    
                    // Enhanced error handling
                    if (statusCode === DisconnectReason.loggedOut || 
                        statusCode === DisconnectReason.connectionClosed) {
                        console.log('[BOT] Connection closed permanently, clearing auth...');
                        await clearAuthState();
                        this.sock = null;
                    } else if (statusCode === DisconnectReason.connectionReplaced) {
                        console.log('[BOT] Connection replaced, waiting...');
                        return;
                    }
                    
                    this.isConnecting = false;
                    setTimeout(() => this.connect(), 3000);
                    return;
                }

                if (connection === 'open') {
                    isConnected = true;
                    this.isConnecting = false;
                    clearTimeout(connectionTimeout);
                    console.log('[BOT] Connected successfully with' + 
                              (qr ? ' new' : ' saved') + ' session!');
                    qrDisplayCount = 0;
                    this.messageHandler = new MessageHandler(this.sock);
                    // Send alive message
                    const botNumber = this.sock.user.id.split(':')[0];
                    await this.sock.sendMessage(`${botNumber}@s.whatsapp.net`, {
                        text: '🤖 *CloudNextra Bot Alive*\n\n_Bot is up and running!_',
                        contextInfo: {
                            externalAdReply: {
                                title: "CloudNextra Bot",
                                body: "WhatsApp Automation",
                                mediaType: 1,
                                thumbnail: null,
                                showAdAttribution: true
                            }
                        }
                    });
                }
            });

            // Custom keep-alive
            let lastSeen = Date.now();
            let keepAliveTimer = null;

            const checkConnection = async () => {
                try {
                    if (Date.now() - lastSeen > 25000) {
                        console.log('[BOT] Connection stale, reconnecting...');
                        await this.sock.end();
                        clearInterval(keepAliveTimer);
                        this.connect();
                        return;
                    }
                    
                    if (this.sock?.ws?.readyState === this.sock?.ws?.OPEN) {
                        await this.sock.sendPresenceUpdate('available');
                        lastSeen = Date.now();
                    }
                } catch (err) {
                    console.log('[BOT] Keep-alive error:', err.message);
                }
            };

            // Start keep-alive after connection opens
            this.sock.ev.on('connection.update', ({ connection }) => {
                if (connection === 'open') {
                    console.log('[BOT] Starting keep-alive...');
                    keepAliveTimer = setInterval(checkConnection, 15000);
                }
            });

            // Clear timer on close
            this.sock.ev.on('close', () => {
                if (keepAliveTimer) {
                    clearInterval(keepAliveTimer);
                }
            });

            // Add explicit WebSocket error handler
            this.sock.ws.on('error', (err) => {
                console.error('[BOT] WebSocket error:', err.message);
                this.isConnecting = false;
                if (!isConnected) {
                    setTimeout(() => this.connect(), 3000);
                }
            });

            // Add connection timeout
            setTimeout(async () => {
                if (!this.sock?.user) {
                    console.log('\n[BOT] Connection timeout. Restarting...');
                    await this.sock?.end();
                    await clearAuthState();
                    this.connect();
                }
            }, 60000);

            // Add error event handler
            this.sock.ev.on('error', async (err) => {
                console.error('[BOT] Connection error:', err);
                await clearAuthState();
                this.sock = null;
                setTimeout(() => this.connect(), 3000);
            });

            this.sock.ev.on('messages.upsert', async ({ messages }) => {
                try {
                    console.log('[BOT] Received message update');
                    for (const msg of messages) {
                        if (msg.key.remoteJid === 'status@broadcast') {
                            console.log('[BOT] Skipping status message');
                            continue;
                        }
                        // Process message
                        await this.messageHandler.handleMessage({ messages: [msg], sock: this.sock });
                    }
                } catch (error) {
                    if (error.message.includes('No SenderKeyRecord')) {
                        console.log('[BOT] Missing sender key, requesting new key...');
                        try {
                            await this.sock.requestSenderKey(msg.key.remoteJid);
                        } catch (err) {
                            console.warn('[BOT] Failed to request sender key:', err.message);
                        }
                    } else {
                        console.error('[BOT] Message handling error:', error);
                    }
                }
            });

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

            // Make sure to save credentials
            this.sock.ev.on('creds.update', saveCreds);
        } catch (error) {
            console.error('[BOT] Critical error:', error);
            this.isConnecting = false;
            setTimeout(() => this.connect(), 3000); 
        }
    }
}

module.exports = WhatsAppBot;
