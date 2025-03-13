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
                printQRInTerminal: true,
                logger,
                markOnlineOnConnect: false,
                connectTimeoutMs: 60000,
                retryRequestDelayMs: 1000
            });

            // Initialize message handler after socket creation
            this.messageHandler = new MessageHandler(this.sock);
            console.log('[BOT] Message handler initialized');

            this.sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect } = update;
                
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
