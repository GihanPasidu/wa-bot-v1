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
    }

    async connect() {
        try {
            // Verify crypto is available
            if (!global.crypto || !global.crypto.subtle) {
                throw new Error('WebCrypto API is not available');
            }

            console.log('[BOT] Starting WhatsApp bot...');
            const { state, saveCreds } = await getAuthState();

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

            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: true, // Always print QR code
                logger,
                markOnlineOnConnect: false,
                connectTimeoutMs: 90000,
                retryRequestDelayMs: 2000,
                // Add keepAliveIntervalMs
                keepAliveIntervalMs: 15000,
                // Add default timeout
                defaultQueryTimeoutMs: 60000,
                // Add version
                version: [2, 2323, 4],
                // Browser identification
                browser: ['CloudNextra Bot', 'Chrome', '1.0.0'],
                // Add QR options
                qrTimeout: 60000, // QR timeout in ms
                qrFormat: {
                    small: false, // Use larger QR for better visibility
                    scale: 8     // Increase QR code size
                },
                // Add attempt counts
                retries: 5,
                maxRetryAttempts: 10,
                // Add ping configs
                pingIntervalMs: 15000,
                // Add system recovery
                systemReconnect: true
            });

            // Add ping interval
            setInterval(() => {
                if (this.sock?.ws?.readyState === this.sock?.ws?.OPEN) {
                    this.sock.sendRawMessage('?,,')
                        .catch(err => console.warn('[BOT] Ping failed:', err.message));
                }
            }, 15000);

            // Initialize message handler right after socket creation
            this.messageHandler = new MessageHandler(this.sock);
            console.log('[BOT] Message handler initialized');

            // Handle QR code generation
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                // Add stream error detection
                if (lastDisconnect?.error?.output?.statusCode === 515) {
                    console.log('[BOT] Stream error in connection, reconnecting...');
                    await this.sock.end();
                    setTimeout(() => this.connect(), 5000);
                    return;
                }

                if (qr) {
                    console.clear(); // Clear console for better visibility
                    console.log('\n');
                    console.log('╭═══════════════════════════╮');
                    console.log('║    SCAN QR CODE BELOW     ║');
                    console.log('╰═══════════════════════════╯\n');
                    
                    // Generate QR with better visibility
                    qrcode.generate(qr, {
                        small: false,
                        scale: 8,
                        margin: 2
                    });
                    
                    console.log('\n╭═══════════════════════════╮');
                    console.log('║  Waiting for connection... ║');
                    console.log('╰═══════════════════════════╯\n');

                    // Also provide QR URL as fallback
                    console.log('Alternative QR URL:');
                    console.log(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qr)}\n`);
                }
                
                if (connection === 'close') {
                    console.log('[BOT] Connection closed, reconnecting...');
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    
                    if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
                        console.log('[BOT] Device logged out. Clearing auth state...');
                        await clearAuthState();
                        console.log('[BOT] Auth state cleared. Please scan QR code with new device.');
                        // Reconnect to get new QR code
                        this.retryCount = 0;
                        setTimeout(() => this.connect(), 3000);
                        return;
                    }
                    
                    if (shouldReconnect && this.retryCount < this.maxRetries) {
                        console.log(`[BOT] Reconnecting... (${this.retryCount}/${this.maxRetries})`);
                        this.retryCount++;
                        setTimeout(() => this.connect(), 3000);
                    } else if (this.retryCount >= this.maxRetries) {
                        console.log('[BOT] Max retries reached. Clearing auth state...');
                        clearAuthState().then(() => {
                            console.log('[BOT] Auth state cleared. Please restart the bot.');
                            process.exit(1);
                        });
                    }
                } else if (connection === 'open') {
                    console.log('[BOT] Connected successfully!');
                    // Reinitialize message handler after reconnection
                    this.messageHandler = new MessageHandler(this.sock);
                    
                    // Send alive message to self
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

            // Add error event handler
            this.sock.ev.on('error', async (err) => {
                console.error('[BOT] Connection error:', err);
                if (err?.output?.statusCode === 515) {
                    console.log('[BOT] Stream error detected, attempting recovery...');
                    await this.sock.end();
                    setTimeout(() => this.connect(), 5000);
                }
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

            this.sock.ev.on('creds.update', saveCreds);
        } catch (error) {
            console.error('[BOT] Critical error:', error.message);
            // Add specific error handling
            if (error.message.includes('stream errored')) {
                console.log('[BOT] Stream error caught, attempting restart...');
                setTimeout(() => this.connect(), 5000);
                return;
            }
            if (error.message.includes('WebCrypto')) {
                console.error('[BOT] WebCrypto not available. Please check system configuration.');
                process.exit(1);
            }
            throw error;
        }
    }
}

module.exports = WhatsAppBot;
