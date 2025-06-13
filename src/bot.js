const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { getAuthState, clearAuthState } = require('./auth/authState');
const MessageHandler = require('./features/messageHandler');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const logger = require('./utils/logger');

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
            logger.warning('Connection attempt already in progress');
            return;
        }

        this.isConnecting = true;
        let retryCount = 0;
        const maxRetries = 3;

        try {
            const { state, saveCreds } = await getAuthState();
            
            // Initialize message handler before socket creation
            this.messageHandler = new MessageHandler(null);

            // Check creds status
            if (Object.keys(state.creds).length === 0) {
                logger.auth('No credentials found - QR code will be generated');
            } else {
                logger.auth('Found existing credentials - attempting session restore');
            }

            const logger_pino = pino({ 
                level: 'error',
                hooks: {
                    logMethod(inputArgs, method) {
                        if (inputArgs[0].err && inputArgs[0].err.message.includes('importKey')) {
                            logger.error('Crypto error detected - attempting recovery');
                            this.clearAuthState();
                        }
                        return method.apply(this, inputArgs);
                    }
                }
            });

            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: logger_pino,
                browser: ['CloudNextra Bot', 'Chrome', '1.0.0'],
                connectTimeoutMs: 30000,
                qrTimeout: 30000, 
                defaultQueryTimeoutMs: 20000,
                markOnlineOnConnect: false,
                syncFullHistory: false
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
                        logger.warning('QR code scan timeout - retrying connection');
                        this.qrShowing = false;
                        await this.sock.end();
                        setTimeout(() => this.connect(), 3000);
                        return;
                    }

                    // Call QR callback if set
                    if (this.qrCallback) {
                        this.qrCallback(qr);
                    }

                    logger.qrGenerated();
                    logger.info('Scan QR code above or visit web interface', { 
                        url: process.env.RENDER_EXTERNAL_URL + '/qr' 
                    });
                    qrcode.generate(qr, {small: true});
                    logger.separator();
                }

                // Reset QR flag when connection changes
                if (connection === 'close' || connection === 'open') {
                    this.qrShowing = false;
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    
                    if (statusCode === DisconnectReason.loggedOut) {
                        logger.warning('Device logged out - clearing auth data');
                        await clearAuthState();
                        this.sock = null;
                        process.exit(0);
                    } else {
                        if (!this.isShuttingDown) {
                            retryCount++;
                            if (retryCount > maxRetries) {
                                logger.error('Max retries exceeded - exiting');
                                process.exit(1);
                            }
                            logger.warning(`Connection attempt ${retryCount}/${maxRetries}`, { 
                                reason: lastDisconnect?.error?.message 
                            });
                            setTimeout(() => this.connect(), 3000);
                        }
                    }
                    return;
                }

                if (connection === 'open') {
                    isConnected = true;
                    this.qrDisplayCount = 0;
                    this.qrShowing = false;
                    logger.connected('WhatsApp Bot');
                    logger.success('Ready to receive messages and commands');
                    logger.separator();
                }
            });

            // Handle messages and status updates
            this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
                try {
                    if (!this.messageHandler) {
                        logger.warning('Message handler not initialized');
                        return;
                    }
                    for (const msg of messages) {
                        await this.messageHandler.handleMessage({ 
                            messages: [msg], 
                            sock: this.sock,
                            type 
                        });
                    }
                } catch (error) {
                    logger.error('Message handling error', { error: error.message });
                }
            });

            // Add status message events
            this.sock.ev.on('message-receipt.update', async (updates) => {
                for (const update of updates) {
                    if (update.key.remoteJid === 'status@broadcast') {
                        try {
                            logger.status('Status view receipt received', {
                                from: update.key.participant
                            });
                        } catch (err) {
                            logger.error('Failed to handle status receipt', { error: err.message });
                        }
                    }
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
                            logger.info('Call blocked and rejected', { from: call.from });
                        }
                    }
                }
            });

            this.sock.ev.on('creds.update', saveCreds);

        } catch (error) {
            logger.error('Critical connection error', { error: error.message });
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(() => this.connect(), 3000);
            } else {
                process.exit(1);
            }
        } finally {
            this.isConnecting = false;
        }
    }
}

module.exports = WhatsAppBot;
