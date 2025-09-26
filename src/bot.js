const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { getAuthState, clearAuthState, resetConnectionAttempts, getConnectionAttempts } = require('./auth/authState');
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
        this.connectionTimeout = null;
        this.connectionStatusCallback = null;
    }

    setQRCallback(callback) {
        this.qrCallback = callback;
    }

    setConnectionStatusCallback(callback) {
        this.connectionStatusCallback = callback;
    }

    cleanup() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        this.isConnecting = false;
    }

    async connect() {
        if (this.isConnecting) {
            logger.warning('Connection attempt already in progress');
            return;
        }

        // Clear any existing connection timeout
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }

        this.isConnecting = true;
        let retryCount = 0;
        const maxRetries = 2; // Reduced since auth module handles the main retry logic

        try {
            // Check if we've exceeded max connection attempts globally
            if (getConnectionAttempts() > 3) {
                logger.warning('Too many failed session restores - forcing fresh QR session');
                await clearAuthState();
                resetConnectionAttempts();
            }

            const { state, saveCreds } = await getAuthState();
            
            // Initialize message handler only once
            if (!this.messageHandler) {
                this.messageHandler = new MessageHandler(null);
            }

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
                        // Log additional context for specific errors
                        if (inputArgs[0] && inputArgs[0].err) {
                            const error = inputArgs[0].err;
                            if (error.message && error.message.includes('importKey')) {
                                logger.error('Crypto importKey error - clearing auth state');
                                clearAuthState().catch(console.error);
                            } else if (error.message && error.message.includes('ENOTFOUND')) {
                                logger.error('DNS resolution error - network connectivity issue');
                            } else if (error.message && error.message.includes('ECONNRESET')) {
                                logger.error('Connection reset - WhatsApp server connection lost');
                            }
                            logger.error('WhatsApp connection error details', { 
                                error: error.message,
                                code: error.code,
                                stack: error.stack?.split('\n')[0]
                            });
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
                connectTimeoutMs: 60000, // Increased to 60 seconds
                qrTimeout: 45000, // Increased QR timeout
                defaultQueryTimeoutMs: 30000, // Increased query timeout
                markOnlineOnConnect: false,
                syncFullHistory: false,
                getMessage: async () => undefined, // Prevent message history sync issues
                shouldIgnoreJid: () => false,
                retryRequestDelayMs: 250,
                maxMsgRetryCount: 5
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
                        this.connectionTimeout = setTimeout(() => {
                            this.isConnecting = false; // Reset connecting flag
                            this.connect();
                        }, 5000);
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
                    } else if (statusCode === DisconnectReason.badSession || 
                              statusCode === DisconnectReason.connectionClosed ||
                              statusCode === DisconnectReason.connectionLost ||
                              statusCode === DisconnectReason.restartRequired) {
                        // Clear auth for critical errors that indicate bad session
                        logger.warning('Critical session error - will retry with fresh auth', { 
                            statusCode: statusCode 
                        });
                        this.sock = null;
                        this.connectionTimeout = setTimeout(() => {
                            this.isConnecting = false; // Reset connecting flag
                            this.connect();
                        }, 5000);
                        return;
                    } else {
                        if (!this.isShuttingDown) {
                            retryCount++;
                            if (retryCount > maxRetries) {
                                logger.warning('Max connection retries exceeded - will restart with auth check');
                                this.connectionTimeout = setTimeout(() => {
                                    this.isConnecting = false; // Reset connecting flag
                                    this.connect();
                                }, 10000); // Longer delay to prevent rapid restarts
                                return;
                            }
                            logger.warning(`Connection attempt ${retryCount}/${maxRetries}`, { 
                                reason: lastDisconnect?.error?.message || 'Connection Failure'
                            });
                            this.connectionTimeout = setTimeout(() => {
                                this.isConnecting = false; // Reset connecting flag
                                this.connect();
                            }, 5000); // 5 second delay between retries
                        }
                    }
                    return;
                }

                if (connection === 'open') {
                    isConnected = true;
                    this.qrDisplayCount = 0;
                    this.qrShowing = false;
                    resetConnectionAttempts(); // Reset auth connection attempts on success
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
                this.connectionTimeout = setTimeout(() => {
                    this.isConnecting = false; // Reset connecting flag
                    this.connect();
                }, 5000);
            } else {
                logger.error('Max critical errors reached - waiting before restart');
                this.connectionTimeout = setTimeout(() => {
                    this.isConnecting = false; // Reset connecting flag
                    this.connect();
                }, 15000); // Longer wait for critical errors
            }
        } finally {
            // Don't reset isConnecting here if we have a timeout pending
            if (!this.connectionTimeout) {
                this.isConnecting = false;
            }
        }
    }
}

module.exports = WhatsAppBot;
