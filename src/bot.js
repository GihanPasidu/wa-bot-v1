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
            console.log('[BOT] Starting WhatsApp bot...');
            const { state, saveCreds } = await getAuthState();

            // Use Pino logger with error level to reduce noise
            const logger = pino({ level: 'error' });

            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: !process.env.CI,
                logger,
                markOnlineOnConnect: false,
                connectTimeoutMs: 60000,
                retryRequestDelayMs: 1000
            });

            // Initialize message handler right after socket creation
            this.messageHandler = new MessageHandler(this.sock);
            console.log('[BOT] Message handler initialized');

            // Handle QR code generation
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (qr) {
                    // Print QR details for CI environment
                    if (process.env.CI) {
                        console.log('\n=== WhatsApp QR Code ===');
                        console.log('Scan this QR code in your WhatsApp app:');
                        qrcode.generate(qr, {
                            small: false,
                            scale: 8,
                            margin: 3
                        });
                        console.log('\nQR Code URL:', `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qr)}`);
                        console.log('======================\n');
                    }
                }
                
                if (connection === 'close') {
                    console.log('[BOT] Connection closed, reconnecting...');
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    
                    if (shouldReconnect && this.retryCount < this.maxRetries) {
                        console.log(`[BOT] Reconnecting... (${this.retryCount}/$this.maxRetries)`);
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
                }
            });

            this.sock.ev.on('messages.upsert', async ({ messages }) => {
                console.log('[BOT] Received message update');
                await this.messageHandler.handleMessage({ messages, sock: this.sock });
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
            console.error('[BOT] Failed to start:', error.message);
        }
    }
}

module.exports = WhatsAppBot;
